-- Query to see all your pipeline deployments
-- Run this in Supabase SQL Editor

SELECT
  id,
  pipeline_name,
  version,
  deployment_status,
  dagster_code_location,
  dagster_deployment_id,
  deployed_at,
  created_at,
  LENGTH(python_code) as code_size_bytes
FROM pipeline_deployments
ORDER BY created_at DESC;

-- To see the actual Python code for a specific deployment:
-- SELECT python_code FROM pipeline_deployments WHERE id = 'your-deployment-id';
