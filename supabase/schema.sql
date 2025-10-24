-- Inspector Dom Database Schema
-- This schema supports the data extraction pipeline application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table - Top level container for extraction pipelines
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Source Files table - Uploaded HTML, PDF, Email files
CREATE TABLE IF NOT EXISTS source_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('html', 'pdf', 'email')),
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates table - Extraction templates created from source files
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_file_id UUID REFERENCES source_files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  selectors JSONB NOT NULL DEFAULT '[]', -- Array of XPath/CSS selectors
  field_mappings JSONB NOT NULL DEFAULT '{}', -- Maps selectors to field names
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entities table - Interim, Reference, and Master entities
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('interim', 'reference', 'master')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Entity Fields table - Fields within entities
CREATE TABLE IF NOT EXISTS entity_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  is_nullable BOOLEAN DEFAULT TRUE,
  is_primary_key BOOLEAN DEFAULT FALSE,
  is_foreign_key BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  constraints JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, name)
);

-- Relationships table - Entity relationships for ER diagram
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  from_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('1:1', '1:N', 'N:M')),
  from_field_id UUID REFERENCES entity_fields(id) ON DELETE SET NULL,
  to_field_id UUID REFERENCES entity_fields(id) ON DELETE SET NULL,
  relationship_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dimensions table - Dimensional attributes for data modeling
CREATE TABLE IF NOT EXISTS dimensions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  dimension_type TEXT, -- 'time', 'geography', 'product', 'customer', etc.
  scd_type INTEGER CHECK (scd_type IN (0, 1, 2, 3)), -- Slowly Changing Dimension type
  attributes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Facts table - Fact measures for data modeling
CREATE TABLE IF NOT EXISTS facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  measures JSONB NOT NULL DEFAULT '[]', -- Array of measure definitions
  grain TEXT, -- Granularity description
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- ER Diagram States table - Save diagram layout and configuration
CREATE TABLE IF NOT EXISTS diagram_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  layout JSONB NOT NULL DEFAULT '{}', -- Node positions, zoom level, viewport, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id) -- One diagram state per project
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_source_files_project_id ON source_files(project_id);
CREATE INDEX IF NOT EXISTS idx_templates_source_file_id ON templates(source_file_id);
CREATE INDEX IF NOT EXISTS idx_entities_project_id ON entities(project_id);
CREATE INDEX IF NOT EXISTS idx_entity_fields_entity_id ON entity_fields(entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_project_id ON relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_relationships_from_entity ON relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_to_entity ON relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_dimensions_project_id ON dimensions(project_id);
CREATE INDEX IF NOT EXISTS idx_facts_project_id ON facts(project_id);
CREATE INDEX IF NOT EXISTS idx_diagram_states_project_id ON diagram_states(project_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagram_states ENABLE ROW LEVEL SECURITY;

-- Projects policies - Users can only access their own projects
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Source files policies - Users can access files in their projects
CREATE POLICY "Users can view source files in their projects" ON source_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = source_files.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create source files in their projects" ON source_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = source_files.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update source files in their projects" ON source_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = source_files.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete source files in their projects" ON source_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = source_files.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Templates policies
CREATE POLICY "Users can view templates in their projects" ON templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM source_files sf
      JOIN projects p ON p.id = sf.project_id
      WHERE sf.id = templates.source_file_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create templates in their projects" ON templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM source_files sf
      JOIN projects p ON p.id = sf.project_id
      WHERE sf.id = templates.source_file_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update templates in their projects" ON templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM source_files sf
      JOIN projects p ON p.id = sf.project_id
      WHERE sf.id = templates.source_file_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete templates in their projects" ON templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM source_files sf
      JOIN projects p ON p.id = sf.project_id
      WHERE sf.id = templates.source_file_id
      AND p.user_id = auth.uid()
    )
  );

-- Entities policies
CREATE POLICY "Users can view entities in their projects" ON entities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = entities.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create entities in their projects" ON entities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = entities.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update entities in their projects" ON entities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = entities.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete entities in their projects" ON entities
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = entities.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Entity fields policies
CREATE POLICY "Users can view entity fields in their projects" ON entity_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM entities e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = entity_fields.entity_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create entity fields in their projects" ON entity_fields
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM entities e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = entity_fields.entity_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update entity fields in their projects" ON entity_fields
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM entities e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = entity_fields.entity_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete entity fields in their projects" ON entity_fields
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM entities e
      JOIN projects p ON p.id = e.project_id
      WHERE e.id = entity_fields.entity_id
      AND p.user_id = auth.uid()
    )
  );

-- Relationships policies
CREATE POLICY "Users can view relationships in their projects" ON relationships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationships.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create relationships in their projects" ON relationships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationships.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update relationships in their projects" ON relationships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationships.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete relationships in their projects" ON relationships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationships.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Dimensions policies
CREATE POLICY "Users can view dimensions in their projects" ON dimensions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = dimensions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create dimensions in their projects" ON dimensions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = dimensions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update dimensions in their projects" ON dimensions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = dimensions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete dimensions in their projects" ON dimensions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = dimensions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Facts policies
CREATE POLICY "Users can view facts in their projects" ON facts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = facts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create facts in their projects" ON facts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = facts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update facts in their projects" ON facts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = facts.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete facts in their projects" ON facts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = facts.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Diagram states policies
CREATE POLICY "Users can view diagram states in their projects" ON diagram_states
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = diagram_states.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create diagram states in their projects" ON diagram_states
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = diagram_states.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update diagram states in their projects" ON diagram_states
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = diagram_states.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete diagram states in their projects" ON diagram_states
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = diagram_states.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Create a storage bucket for source files
INSERT INTO storage.buckets (id, name, public)
VALUES ('source-files', 'source-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for source files bucket
CREATE POLICY "Users can upload files to their projects" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'source-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'source-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'source-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'source-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
