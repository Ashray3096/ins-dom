-- =====================================================
-- Migration 010: Field Library Tables
-- Purpose: Create reusable field definitions library
-- =====================================================

-- =====================================================
-- 1. field_library table
-- =====================================================
CREATE TABLE IF NOT EXISTS field_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic Info
  name TEXT NOT NULL UNIQUE,              -- 'vendor_name', 'sales_l12m'
  label TEXT NOT NULL,                    -- 'Vendor Name', 'Sales (L12M)'
  description TEXT,                       -- Human-readable description

  -- Field Properties
  field_type TEXT NOT NULL CHECK (field_type IN (
    'TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'EMAIL', 'URL', 'PHONE', 'JSON'
  )),

  -- Classification & Categorization
  classification TEXT CHECK (classification IN (
    'PII', 'PCI', 'PHI', 'PUBLIC', 'INTERNAL', 'CONFIDENTIAL'
  )),
  category TEXT,                          -- 'vendor', 'sales', 'product', 'date'
  tags TEXT[],                            -- ['supplier', 'company', 'distributor']

  -- Validation Rules (JSON)
  validation_rules JSONB DEFAULT '{}'::JSONB,  -- { max_length: 255, pattern: '^[A-Z]' }

  -- Transformation Pipeline (Array of transformations)
  transformations TEXT[] DEFAULT ARRAY[]::TEXT[],  -- ['trim', 'uppercase', 'remove_commas']

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,          -- How many templates use this field
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Versioning
  version INTEGER DEFAULT 1,
  is_deprecated BOOLEAN DEFAULT FALSE,
  deprecated_reason TEXT,
  replaced_by UUID REFERENCES field_library(id)
);

-- Indexes for field_library
CREATE INDEX idx_field_library_name ON field_library(name);
CREATE INDEX idx_field_library_category ON field_library(category);
CREATE INDEX idx_field_library_tags ON field_library USING GIN(tags);
CREATE INDEX idx_field_library_created_by ON field_library(created_by);
CREATE INDEX idx_field_library_field_type ON field_library(field_type);

-- Comments for documentation
COMMENT ON TABLE field_library IS 'Reusable field definitions for templates and entities';
COMMENT ON COLUMN field_library.name IS 'Unique field identifier (snake_case)';
COMMENT ON COLUMN field_library.label IS 'Human-readable field name';
COMMENT ON COLUMN field_library.field_type IS 'Data type for validation';
COMMENT ON COLUMN field_library.classification IS 'Data sensitivity classification';
COMMENT ON COLUMN field_library.category IS 'Logical grouping (vendor, sales, product, etc.)';
COMMENT ON COLUMN field_library.tags IS 'Search tags for field discovery';
COMMENT ON COLUMN field_library.validation_rules IS 'JSON schema for field validation';
COMMENT ON COLUMN field_library.transformations IS 'Array of transformation functions to apply';
COMMENT ON COLUMN field_library.usage_count IS 'Number of templates using this field';

-- =====================================================
-- 2. template_fields table (Junction table)
-- =====================================================
CREATE TABLE IF NOT EXISTS template_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES field_library(id) ON DELETE CASCADE,

  -- Extraction Configuration (varies by strategy)
  extraction_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Examples:
  --   table_detection:  { "column_index": 3, "header_match": "Vendor" }
  --   dom_selection:    { "selector": "td.vendor-name", "attribute": "textContent" }
  --   json_path:        { "path": "$.vendors[*].name" }
  --   key_value:        { "key_pattern": "Vendor.*Name" }

  -- Field-specific transformations (overrides field_library defaults)
  transformations TEXT[],

  -- Display order in template
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Required field?
  is_required BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  UNIQUE(template_id, field_id)
);

-- Indexes for template_fields
CREATE INDEX idx_template_fields_template ON template_fields(template_id);
CREATE INDEX idx_template_fields_field ON template_fields(field_id);
CREATE INDEX idx_template_fields_display_order ON template_fields(template_id, display_order);

-- Comments for documentation
COMMENT ON TABLE template_fields IS 'Links templates to field_library with extraction configuration';
COMMENT ON COLUMN template_fields.extraction_config IS 'Strategy-specific extraction configuration (JSON)';
COMMENT ON COLUMN template_fields.transformations IS 'Field-specific transformations (overrides field_library defaults)';
COMMENT ON COLUMN template_fields.display_order IS 'Order of field in template output';
COMMENT ON COLUMN template_fields.is_required IS 'Whether this field must be present in extraction';

-- =====================================================
-- 3. RLS Policies for field_library
-- =====================================================
ALTER TABLE field_library ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all fields
CREATE POLICY "Users can view all fields"
  ON field_library FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create fields
CREATE POLICY "Users can create fields"
  ON field_library FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Allow users to update their own fields
CREATE POLICY "Users can update own fields"
  ON field_library FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

-- Allow users to delete their own fields (soft delete via is_deprecated)
CREATE POLICY "Users can delete own fields"
  ON field_library FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- =====================================================
-- 4. RLS Policies for template_fields
-- =====================================================
ALTER TABLE template_fields ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view template fields
CREATE POLICY "Users can view template fields"
  ON template_fields FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_fields.template_id
    )
  );

-- Allow users to manage template fields for their own templates
CREATE POLICY "Users can manage template fields"
  ON template_fields FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_fields.template_id
      AND templates.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_fields.template_id
      AND templates.created_by = auth.uid()
    )
  );

-- =====================================================
-- 5. Trigger to update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_field_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER field_library_updated_at
  BEFORE UPDATE ON field_library
  FOR EACH ROW
  EXECUTE FUNCTION update_field_library_updated_at();

CREATE TRIGGER template_fields_updated_at
  BEFORE UPDATE ON template_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_field_library_updated_at();

-- =====================================================
-- 6. Function to increment usage_count
-- =====================================================
CREATE OR REPLACE FUNCTION increment_field_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE field_library
  SET
    usage_count = usage_count + 1,
    last_used_at = TIMEZONE('utc', NOW())
  WHERE id = NEW.field_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER template_fields_increment_usage
  AFTER INSERT ON template_fields
  FOR EACH ROW
  EXECUTE FUNCTION increment_field_usage_count();

-- =====================================================
-- 7. Function to decrement usage_count
-- =====================================================
CREATE OR REPLACE FUNCTION decrement_field_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE field_library
  SET usage_count = GREATEST(0, usage_count - 1)
  WHERE id = OLD.field_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER template_fields_decrement_usage
  AFTER DELETE ON template_fields
  FOR EACH ROW
  EXECUTE FUNCTION decrement_field_usage_count();

-- =====================================================
-- Success message
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 010 completed: field_library and template_fields tables created';
END $$;
