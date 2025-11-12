-- Migration: Create execute_sql Function
-- This function allows the API to dynamically create tables

CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;

COMMENT ON FUNCTION execute_sql IS 'Allows authenticated users to execute arbitrary SQL for table creation';
