-- Create artifacts table for storing raw files and content
-- Based on spec section 3: Database Schema

-- ============================================================================
-- ARTIFACTS TABLE
-- Raw files extracted from sources (PDFs, HTML, emails)
-- ============================================================================

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('pdf', 'html', 'email', 'json')),
  file_path TEXT, -- Path in Supabase Storage (e.g., 'artifacts/uuid/filename.pdf')
  file_size BIGINT, -- File size in bytes
  original_filename TEXT NOT NULL,
  raw_content JSONB, -- Structured representation for non-binary content
  metadata JSONB, -- File metadata (page count, dimensions, etc.)
  extraction_status TEXT DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT, -- Error details if extraction failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_artifacts_provider_id ON artifacts(provider_id);
CREATE INDEX idx_artifacts_artifact_type ON artifacts(artifact_type);
CREATE INDEX idx_artifacts_extraction_status ON artifacts(extraction_status);
CREATE INDEX idx_artifacts_created_by ON artifacts(created_by);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at DESC);

-- Comments
COMMENT ON TABLE artifacts IS 'Raw files and content extracted from data sources';
COMMENT ON COLUMN artifacts.artifact_type IS 'Type of artifact: pdf, html, email, json';
COMMENT ON COLUMN artifacts.file_path IS 'Path in Supabase Storage bucket (artifacts)';
COMMENT ON COLUMN artifacts.raw_content IS 'Structured content for non-binary files (HTML, JSON)';
COMMENT ON COLUMN artifacts.metadata IS 'File metadata: page_count, file_type, dimensions, etc.';
COMMENT ON COLUMN artifacts.extraction_status IS 'Current extraction status: pending, processing, completed, failed';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;

-- Users can view artifacts from their own providers
CREATE POLICY "Users can view their own artifacts"
  ON artifacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = artifacts.provider_id
      AND providers.created_by = auth.uid()
    )
  );

-- Users can insert artifacts for their own providers
CREATE POLICY "Users can upload artifacts to their providers"
  ON artifacts FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_id
      AND providers.created_by = auth.uid()
    )
  );

-- Users can update their own artifacts
CREATE POLICY "Users can update their artifacts"
  ON artifacts FOR UPDATE
  USING (auth.uid() = created_by);

-- Users can delete their own artifacts
CREATE POLICY "Users can delete their artifacts"
  ON artifacts FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artifacts_updated_at
  BEFORE UPDATE ON artifacts
  FOR EACH ROW
  EXECUTE FUNCTION update_artifacts_updated_at();
