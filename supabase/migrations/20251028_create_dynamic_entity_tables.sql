-- Migration: Create function to dynamically create entity tables
-- This allows pipelines to create tables for their target entities

-- Create function to safely create entity tables
CREATE OR REPLACE FUNCTION create_entity_table(
  table_name TEXT,
  columns JSONB
) RETURNS TEXT AS $$
DECLARE
  column_def TEXT;
  sql TEXT;
  col JSONB;
BEGIN
  -- Start building the CREATE TABLE statement
  sql := 'CREATE TABLE IF NOT EXISTS ' || quote_ident(table_name) || ' (';
  sql := sql || 'id UUID PRIMARY KEY DEFAULT gen_random_uuid(),';

  -- Add user-defined columns
  FOR col IN SELECT * FROM jsonb_array_elements(columns)
  LOOP
    column_def := quote_ident(col->>'name') || ' ' || (col->>'type');

    IF (col->>'required')::BOOLEAN THEN
      column_def := column_def || ' NOT NULL';
    END IF;

    sql := sql || column_def || ',';
  END LOOP;

  -- Add metadata columns
  sql := sql || 'extraction_date TIMESTAMPTZ,';
  sql := sql || 'source_artifact_id UUID,';
  sql := sql || 'source_filename TEXT,';
  sql := sql || 'created_at TIMESTAMPTZ DEFAULT NOW(),';
  sql := sql || 'updated_at TIMESTAMPTZ DEFAULT NOW()';
  sql := sql || ');';

  -- Execute the statement
  EXECUTE sql;

  -- Enable RLS
  EXECUTE 'ALTER TABLE ' || quote_ident(table_name) || ' ENABLE ROW LEVEL SECURITY;';

  -- Create RLS policy
  EXECUTE 'CREATE POLICY "Users can access their own data" ON ' || quote_ident(table_name) ||
          ' FOR ALL USING (true);'; -- Adjust based on your auth requirements

  RETURN 'Table ' || table_name || ' created successfully';

EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Error creating table: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_entity_table(TEXT, JSONB) TO authenticated;

-- Example: Create the raw_ttb table
SELECT create_entity_table(
  'raw_ttb',
  '[
    {"name": "ttbid", "type": "TEXT", "required": false},
    {"name": "ct", "type": "TEXT", "required": false},
    {"name": "or", "type": "TEXT", "required": false},
    {"name": "productsource", "type": "TEXT", "required": false},
    {"name": "producttype", "type": "TEXT", "required": false}
  ]'::JSONB
);

-- Add comment
COMMENT ON FUNCTION create_entity_table IS 'Dynamically creates entity tables with proper RLS policies';
