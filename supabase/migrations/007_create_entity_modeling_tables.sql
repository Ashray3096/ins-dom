-- Entity Modeling System
-- Three-tier entity architecture: INTERIM → REFERENCE → MASTER
--
-- This migration creates tables for defining entity schemas that will be
-- populated by template extractions. This bridges the gap between flat
-- template extractions and relational database structures.

-- ============================================================================
-- ENTITY TYPES
-- ============================================================================

-- INTERIM: Raw extracted data, 1:1 with source documents
--   - Matches extraction templates directly
--   - Includes extraction_date timestamp
--   - Links to source artifact
--   - Example: raw_ttb_monthly_report

-- REFERENCE: Lookup/dimension tables, deduplicated
--   - Slow-changing dimensions
--   - Unique constraints on natural keys
--   - Example: dim_product, dim_supplier

-- MASTER: Fact tables with foreign keys to reference entities
--   - Business logic and validation rules
--   - Foreign keys to REFERENCE entities
--   - Aggregations and calculations
--   - Example: fact_sales, fact_inventory

-- ============================================================================
-- ENTITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,

  -- Entity Type: INTERIM, REFERENCE, or MASTER
  entity_type TEXT NOT NULL CHECK (entity_type IN ('INTERIM', 'REFERENCE', 'MASTER')),

  -- Status
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),

  -- For INTERIM entities: link to template
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,

  -- Metadata
  metadata JSONB, -- Type-specific config: constraints, keys, rules

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT unique_entity_name UNIQUE (name, created_by)
);

CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_status ON entities(status);
CREATE INDEX idx_entities_template ON entities(template_id);
CREATE INDEX idx_entities_created_by ON entities(created_by);

COMMENT ON TABLE entities IS 'Entity definitions for three-tier data architecture';
COMMENT ON COLUMN entities.entity_type IS 'INTERIM (raw), REFERENCE (dimensions), or MASTER (facts)';
COMMENT ON COLUMN entities.metadata IS 'Type-specific configuration: constraints, keys, business rules';

-- ============================================================================
-- ENTITY FIELDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS entity_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

  -- Field definition
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  data_type TEXT NOT NULL CHECK (data_type IN ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'JSON', 'UUID')),

  -- Field constraints
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_unique BOOLEAN NOT NULL DEFAULT FALSE,
  is_primary_key BOOLEAN NOT NULL DEFAULT FALSE,

  -- For MASTER entities: foreign key to another entity
  foreign_key_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  foreign_key_field_id UUID REFERENCES entity_fields(id) ON DELETE SET NULL,

  -- Default value and validation
  default_value TEXT,
  validation_rules JSONB, -- Regex, range, enum values, etc.

  -- Transformation logic
  transform_expression TEXT, -- SQL expression or function to transform source data

  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_entity_field UNIQUE (entity_id, name)
);

CREATE INDEX idx_entity_fields_entity ON entity_fields(entity_id);
CREATE INDEX idx_entity_fields_fk_entity ON entity_fields(foreign_key_entity_id);
CREATE INDEX idx_entity_fields_sort ON entity_fields(entity_id, sort_order);

COMMENT ON TABLE entity_fields IS 'Field definitions for entities';
COMMENT ON COLUMN entity_fields.foreign_key_entity_id IS 'For MASTER entities: reference to another entity';
COMMENT ON COLUMN entity_fields.validation_rules IS 'Validation rules: regex, range, enum, custom';
COMMENT ON COLUMN entity_fields.transform_expression IS 'Transformation logic to apply to source data';

-- ============================================================================
-- ENTITY FIELD MAPPINGS TABLE
-- ============================================================================
-- Maps entity fields to template fields (entities pull from templates)

CREATE TABLE IF NOT EXISTS entity_field_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_field_id UUID NOT NULL REFERENCES entity_fields(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  template_field_path TEXT NOT NULL, -- JSON path to field in template (e.g., "fields.TTB_ID")

  -- Mapping metadata
  mapping_type TEXT NOT NULL DEFAULT 'DIRECT' CHECK (mapping_type IN ('DIRECT', 'TRANSFORMED', 'CALCULATED')),
  transform_expression TEXT, -- For TRANSFORMED mappings
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT unique_entity_field_mapping UNIQUE (entity_field_id, template_id)
);

CREATE INDEX idx_entity_field_mappings_entity_field ON entity_field_mappings(entity_field_id);
CREATE INDEX idx_entity_field_mappings_template ON entity_field_mappings(template_id);

COMMENT ON TABLE entity_field_mappings IS 'Maps entity fields to template fields (entities pull from templates)';
COMMENT ON COLUMN entity_field_mappings.template_field_path IS 'JSON path to template field (e.g., "fields.TTB_ID")';
COMMENT ON COLUMN entity_field_mappings.mapping_type IS 'DIRECT (1:1), TRANSFORMED (with expression), or CALCULATED (from multiple sources)';

-- ============================================================================
-- ENTITY RELATIONSHIPS TABLE
-- ============================================================================
-- Explicit relationships between entities (for ER diagram generation)

CREATE TABLE IF NOT EXISTS entity_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,

  -- Relationship type
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY')),

  -- Foreign key field (in from_entity)
  from_field_id UUID REFERENCES entity_fields(id) ON DELETE CASCADE,

  -- Description
  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT unique_entity_relationship UNIQUE (from_entity_id, to_entity_id, from_field_id)
);

CREATE INDEX idx_entity_relationships_from ON entity_relationships(from_entity_id);
CREATE INDEX idx_entity_relationships_to ON entity_relationships(to_entity_id);

COMMENT ON TABLE entity_relationships IS 'Explicit relationships between entities for ER diagram generation';

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entity_fields_updated_at BEFORE UPDATE ON entity_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;

-- Entities policies
CREATE POLICY "Users can view their own entities"
  ON entities FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own entities"
  ON entities FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own entities"
  ON entities FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own entities"
  ON entities FOR DELETE
  USING (auth.uid() = created_by);

-- Entity fields policies
CREATE POLICY "Users can view fields of their entities"
  ON entity_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entities
      WHERE entities.id = entity_fields.entity_id
      AND entities.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create fields for their entities"
  ON entity_fields FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entities
      WHERE entities.id = entity_id
      AND entities.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update fields of their entities"
  ON entity_fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM entities
      WHERE entities.id = entity_fields.entity_id
      AND entities.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete fields of their entities"
  ON entity_fields FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM entities
      WHERE entities.id = entity_fields.entity_id
      AND entities.created_by = auth.uid()
    )
  );

-- Entity field mappings policies
CREATE POLICY "Users can view mappings of their entities"
  ON entity_field_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entity_fields ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE ef.id = entity_field_mappings.entity_field_id
      AND e.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create mappings for their entities"
  ON entity_field_mappings FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM entity_fields ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE ef.id = entity_field_id
      AND e.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete mappings of their entities"
  ON entity_field_mappings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM entity_fields ef
      JOIN entities e ON e.id = ef.entity_id
      WHERE ef.id = entity_field_mappings.entity_field_id
      AND e.created_by = auth.uid()
    )
  );

-- Entity relationships policies
CREATE POLICY "Users can view relationships of their entities"
  ON entity_relationships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM entities
      WHERE entities.id = entity_relationships.from_entity_id
      AND entities.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create relationships for their entities"
  ON entity_relationships FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM entities
      WHERE entities.id = from_entity_id
      AND entities.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete relationships of their entities"
  ON entity_relationships FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM entities
      WHERE entities.id = entity_relationships.from_entity_id
      AND entities.created_by = auth.uid()
    )
  );
