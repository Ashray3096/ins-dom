-- Create sources table according to spec section 3: Database Schema
-- Sources define WHERE data comes from (URL, S3, API, File Upload)

-- ============================================================================
-- SOURCES TABLE
-- Individual data sources within providers
-- ============================================================================

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('url', 's3_bucket', 'api', 'file_upload')),
  configuration JSONB NOT NULL,
  -- Examples:
  -- { "url": "https://example.com/data.pdf" }
  -- { "bucket": "my-bucket", "prefix": "data/", "pattern": "*.pdf", "test_mode": true, "test_limit": 10 }
  -- { "endpoint": "https://api.example.com/data", "auth_token": "..." }
  -- { "upload_type": "manual" }
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_sources_provider_id ON sources(provider_id);
CREATE INDEX idx_sources_source_type ON sources(source_type);
CREATE INDEX idx_sources_is_active ON sources(is_active);
CREATE INDEX idx_sources_created_by ON sources(created_by);

-- Comments
COMMENT ON TABLE sources IS 'Source configurations defining where data comes from';
COMMENT ON COLUMN sources.source_type IS 'Type of source: url, s3_bucket, api, file_upload';
COMMENT ON COLUMN sources.configuration IS 'Source-specific configuration as JSON (URL, S3 settings, API credentials, etc.)';
COMMENT ON COLUMN sources.is_active IS 'Whether this source is actively being processed';
COMMENT ON COLUMN sources.last_sync_at IS 'Last time artifacts were extracted from this source';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

-- Users can view sources from their own providers
CREATE POLICY "Users can view sources from their providers"
  ON sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = sources.provider_id
      AND providers.created_by = auth.uid()
    )
  );

-- Users can create sources for their own providers
CREATE POLICY "Users can create sources for their providers"
  ON sources FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_id
      AND providers.created_by = auth.uid()
    )
  );

-- Users can update their own sources
CREATE POLICY "Users can update their sources"
  ON sources FOR UPDATE
  USING (auth.uid() = created_by);

-- Users can delete their own sources
CREATE POLICY "Users can delete their sources"
  ON sources FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW
  EXECUTE FUNCTION update_sources_updated_at();
