-- Inspector Dom - Database Schema
-- Phase 2: Complete database schema for AI-powered data extraction platform
--
-- This migration creates all tables, relationships, indexes, and RLS policies
-- for the Inspector Dom application.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROVIDERS
-- Data providers (NABCA, TTB, Custom sources)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('NABCA', 'TTB', 'CUSTOM')),
  description TEXT,
  cadence TEXT NOT NULL CHECK (cadence IN ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ADHOC')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT unique_provider_name UNIQUE (name, created_by)
);

CREATE INDEX idx_providers_created_by ON providers(created_by);
CREATE INDEX idx_providers_type ON providers(type);

COMMENT ON TABLE providers IS 'Data providers (NABCA, TTB, etc.) that supply source documents';
COMMENT ON COLUMN providers.type IS 'Provider category: NABCA, TTB, or CUSTOM';
COMMENT ON COLUMN providers.cadence IS 'How often data is updated: MONTHLY, QUARTERLY, ANNUAL, or ADHOC';

-- ----------------------------------------------------------------------------
-- 2. SOURCE FILES
-- Uploaded documents from providers
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS source_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PDF', 'HTML', 'EMAIL', 'MSG', 'CSV', 'EXCEL')),
  status TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'PROCESSING', 'EXTRACTED', 'ERROR')),
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period TEXT, -- e.g., "2024-01", "Q1-2024"
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_source_files_provider ON source_files(provider_id);
CREATE INDEX idx_source_files_status ON source_files(status);
CREATE INDEX idx_source_files_type ON source_files(type);
CREATE INDEX idx_source_files_period ON source_files(period);
CREATE INDEX idx_source_files_uploaded_by ON source_files(uploaded_by);

COMMENT ON TABLE source_files IS 'Uploaded documents from data providers';
COMMENT ON COLUMN source_files.period IS 'Time period this file represents (e.g., "2024-01" or "Q1-2024")';
COMMENT ON COLUMN source_files.metadata IS 'Additional file metadata in JSON format';

-- ----------------------------------------------------------------------------
-- 3. TEMPLATES
-- Reusable extraction prompts and field schemas
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  fields JSONB NOT NULL, -- Array of {name, description, type, required}
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT unique_template_name UNIQUE (name, created_by)
);

CREATE INDEX idx_templates_provider ON templates(provider_id);
CREATE INDEX idx_templates_status ON templates(status);
CREATE INDEX idx_templates_created_by ON templates(created_by);

COMMENT ON TABLE templates IS 'Reusable extraction templates with prompts and field schemas';
COMMENT ON COLUMN templates.fields IS 'JSON array of field definitions: [{name, description, type, required}]';
COMMENT ON COLUMN templates.version IS 'Template version number (increments on update)';

-- ----------------------------------------------------------------------------
-- 4. TEMPLATE VERSIONS
-- History of template changes
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS template_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  fields JSONB NOT NULL,
  change_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT unique_template_version UNIQUE (template_id, version)
);

CREATE INDEX idx_template_versions_template ON template_versions(template_id);

COMMENT ON TABLE template_versions IS 'Version history of template changes';

-- ----------------------------------------------------------------------------
-- 5. EXTRACTIONS
-- AI extraction runs
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS extractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_file_id UUID NOT NULL REFERENCES source_files(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CORRECTED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_extracted INTEGER NOT NULL DEFAULT 0,
  accuracy_score NUMERIC(5,2), -- Percentage (0-100)
  cost NUMERIC(10,6) NOT NULL DEFAULT 0, -- Cost in dollars
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  duration_seconds NUMERIC(10,2),
  error_message TEXT,
  metadata JSONB, -- Model config, file info, etc.
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_extractions_source_file ON extractions(source_file_id);
CREATE INDEX idx_extractions_template ON extractions(template_id);
CREATE INDEX idx_extractions_status ON extractions(status);
CREATE INDEX idx_extractions_created_by ON extractions(created_by);
CREATE INDEX idx_extractions_started_at ON extractions(started_at DESC);

COMMENT ON TABLE extractions IS 'AI extraction runs with results and metadata';
COMMENT ON COLUMN extractions.accuracy_score IS 'Data quality score (0-100%)';
COMMENT ON COLUMN extractions.cost IS 'Cost in USD for this extraction';

-- ----------------------------------------------------------------------------
-- 6. EXTRACTED RECORDS
-- Individual records extracted from documents
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS extracted_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extraction_id UUID NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
  record_index INTEGER NOT NULL,
  data JSONB NOT NULL,
  is_corrected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_extraction_record UNIQUE (extraction_id, record_index)
);

CREATE INDEX idx_extracted_records_extraction ON extracted_records(extraction_id);
CREATE INDEX idx_extracted_records_corrected ON extracted_records(is_corrected);

COMMENT ON TABLE extracted_records IS 'Individual data records extracted by AI';
COMMENT ON COLUMN extracted_records.data IS 'Extracted data in JSON format';
COMMENT ON COLUMN extracted_records.is_corrected IS 'Whether this record has been manually corrected';

-- ----------------------------------------------------------------------------
-- 7. CORRECTIONS
-- User corrections to improve extraction quality
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  extraction_id UUID NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES extracted_records(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN ('FIELD_VALUE', 'FIELD_TYPE', 'MISSING_FIELD', 'EXTRA_FIELD', 'DUPLICATE_RECORD')),
  original_value JSONB,
  corrected_value JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_corrections_extraction ON corrections(extraction_id);
CREATE INDEX idx_corrections_record ON corrections(record_id);
CREATE INDEX idx_corrections_type ON corrections(correction_type);
CREATE INDEX idx_corrections_created_by ON corrections(created_by);

COMMENT ON TABLE corrections IS 'User corrections to improve extraction accuracy';
COMMENT ON COLUMN corrections.correction_type IS 'Type of correction: FIELD_VALUE, FIELD_TYPE, MISSING_FIELD, EXTRA_FIELD, or DUPLICATE_RECORD';

-- ----------------------------------------------------------------------------
-- 8. PIPELINES
-- Dagster pipeline configurations
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  schedule TEXT, -- Cron expression
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  config JSONB, -- Pipeline configuration
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT unique_pipeline_name UNIQUE (name, created_by)
);

CREATE INDEX idx_pipelines_provider ON pipelines(provider_id);
CREATE INDEX idx_pipelines_template ON pipelines(template_id);
CREATE INDEX idx_pipelines_active ON pipelines(is_active);
CREATE INDEX idx_pipelines_next_run ON pipelines(next_run_at);
CREATE INDEX idx_pipelines_created_by ON pipelines(created_by);

COMMENT ON TABLE pipelines IS 'Automated extraction pipelines (Dagster)';
COMMENT ON COLUMN pipelines.schedule IS 'Cron expression for scheduled runs';
COMMENT ON COLUMN pipelines.config IS 'Pipeline configuration in JSON format';

-- ----------------------------------------------------------------------------
-- 9. PIPELINE RUNS
-- History of pipeline executions
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  files_processed INTEGER NOT NULL DEFAULT 0,
  records_extracted INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC(10,6) NOT NULL DEFAULT 0,
  error_message TEXT,
  logs TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_pipeline_runs_pipeline ON pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs(started_at DESC);

COMMENT ON TABLE pipeline_runs IS 'History of pipeline execution runs';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Update updated_at timestamp automatically
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at column
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_source_files_updated_at BEFORE UPDATE ON source_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipelines_updated_at BEFORE UPDATE ON pipelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Increment template version and save to history
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_template_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if prompt or fields changed
  IF OLD.prompt IS DISTINCT FROM NEW.prompt OR OLD.fields IS DISTINCT FROM NEW.fields THEN
    -- Save old version to history
    INSERT INTO template_versions (template_id, version, prompt, fields, created_by)
    VALUES (OLD.id, OLD.version, OLD.prompt, OLD.fields, OLD.created_by);

    -- Increment version
    NEW.version = OLD.version + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER template_version_trigger BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION increment_template_version();

-- ----------------------------------------------------------------------------
-- Update source file status when extraction completes
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_source_file_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
    UPDATE source_files
    SET status = 'EXTRACTED'
    WHERE id = NEW.source_file_id;
  ELSIF NEW.status = 'FAILED' AND OLD.status != 'FAILED' THEN
    UPDATE source_files
    SET status = 'ERROR'
    WHERE id = NEW.source_file_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER extraction_status_trigger AFTER UPDATE ON extractions
  FOR EACH ROW EXECUTE FUNCTION update_source_file_status();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROVIDERS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view their own providers"
  ON providers FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own providers"
  ON providers FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own providers"
  ON providers FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own providers"
  ON providers FOR DELETE
  USING (auth.uid() = created_by);

-- ----------------------------------------------------------------------------
-- SOURCE FILES POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view files from their providers"
  ON source_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = source_files.provider_id
      AND providers.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can upload files to their providers"
  ON source_files FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by AND
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = provider_id
      AND providers.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their source files"
  ON source_files FOR UPDATE
  USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their source files"
  ON source_files FOR DELETE
  USING (auth.uid() = uploaded_by);

-- ----------------------------------------------------------------------------
-- TEMPLATES POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view their own templates"
  ON templates FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own templates"
  ON templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own templates"
  ON templates FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own templates"
  ON templates FOR DELETE
  USING (auth.uid() = created_by);

-- ----------------------------------------------------------------------------
-- TEMPLATE VERSIONS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view versions of their templates"
  ON template_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_versions.template_id
      AND templates.created_by = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- EXTRACTIONS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view their own extractions"
  ON extractions FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own extractions"
  ON extractions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own extractions"
  ON extractions FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own extractions"
  ON extractions FOR DELETE
  USING (auth.uid() = created_by);

-- ----------------------------------------------------------------------------
-- EXTRACTED RECORDS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view records from their extractions"
  ON extracted_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM extractions
      WHERE extractions.id = extracted_records.extraction_id
      AND extractions.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert records for their extractions"
  ON extracted_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM extractions
      WHERE extractions.id = extraction_id
      AND extractions.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their extracted records"
  ON extracted_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM extractions
      WHERE extractions.id = extracted_records.extraction_id
      AND extractions.created_by = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- CORRECTIONS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view corrections on their extractions"
  ON corrections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM extractions
      WHERE extractions.id = corrections.extraction_id
      AND extractions.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create corrections"
  ON corrections FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM extractions
      WHERE extractions.id = extraction_id
      AND extractions.created_by = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- PIPELINES POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view their own pipelines"
  ON pipelines FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own pipelines"
  ON pipelines FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own pipelines"
  ON pipelines FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own pipelines"
  ON pipelines FOR DELETE
  USING (auth.uid() = created_by);

-- ----------------------------------------------------------------------------
-- PIPELINE RUNS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view runs of their pipelines"
  ON pipeline_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pipelines
      WHERE pipelines.id = pipeline_runs.pipeline_id
      AND pipelines.created_by = auth.uid()
    )
  );

-- ============================================================================
-- VIEWS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extraction statistics view
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW extraction_stats AS
SELECT
  e.id,
  e.source_file_id,
  e.template_id,
  e.status,
  e.records_extracted,
  e.accuracy_score,
  e.cost,
  e.duration_seconds,
  sf.name AS file_name,
  sf.type AS file_type,
  sf.period AS file_period,
  p.name AS provider_name,
  t.name AS template_name,
  COUNT(c.id) AS correction_count,
  e.created_by
FROM extractions e
LEFT JOIN source_files sf ON e.source_file_id = sf.id
LEFT JOIN providers p ON sf.provider_id = p.id
LEFT JOIN templates t ON e.template_id = t.id
LEFT JOIN corrections c ON e.id = c.extraction_id
GROUP BY e.id, sf.name, sf.type, sf.period, p.name, t.name;

COMMENT ON VIEW extraction_stats IS 'Extraction statistics with file and provider details';

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Note: Initial data (like default templates) can be inserted here
-- or through application seed scripts

COMMENT ON SCHEMA public IS 'Inspector Dom - AI-powered data extraction platform schema';
