-- Drop All Tables Script
-- Use this to reset your database before running the main migration
-- WARNING: This will delete ALL data!

-- Drop views first
DROP VIEW IF EXISTS extraction_stats CASCADE;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS pipeline_runs CASCADE;
DROP TABLE IF EXISTS pipelines CASCADE;
DROP TABLE IF EXISTS corrections CASCADE;
DROP TABLE IF EXISTS extracted_records CASCADE;
DROP TABLE IF EXISTS extractions CASCADE;
DROP TABLE IF EXISTS template_versions CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS source_files CASCADE;
DROP TABLE IF EXISTS providers CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_source_file_status() CASCADE;
DROP FUNCTION IF EXISTS increment_template_version() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Extension (don't drop, it's harmless to keep)
-- DROP EXTENSION IF EXISTS "uuid-ossp";
