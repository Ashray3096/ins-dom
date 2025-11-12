-- Migration: Create pipeline deployments table for Dagster pipeline code storage
-- Version 2: Fixed migration with proper cleanup

-- Drop existing tables if they exist (to ensure clean state)
DROP TABLE IF EXISTS pipeline_runs CASCADE;
DROP TABLE IF EXISTS pipeline_deployments CASCADE;

-- Pipeline Deployments: Track generated Dagster pipelines
CREATE TABLE pipeline_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,

  -- Pipeline Metadata
  version INTEGER NOT NULL DEFAULT 1,
  pipeline_name TEXT NOT NULL,
  description TEXT,

  -- Generated Dagster Python Code
  python_code TEXT NOT NULL,

  -- Pipeline Configuration (metadata about what was generated)
  config JSONB NOT NULL DEFAULT '{}',

  -- Dagster Deployment Info
  dagster_code_location TEXT,
  dagster_deployment_id TEXT,
  deployment_status TEXT NOT NULL DEFAULT 'draft',

  -- Deployment Tracking
  deployed_at TIMESTAMPTZ,
  deployed_by UUID REFERENCES auth.users(id),
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(pipeline_id, version)
);

-- Pipeline Runs: Track execution history
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_deployment_id UUID NOT NULL REFERENCES pipeline_deployments(id) ON DELETE CASCADE,

  -- Dagster Run Info
  dagster_run_id TEXT UNIQUE,
  run_status TEXT NOT NULL,

  -- Execution Details
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Statistics
  records_processed INTEGER DEFAULT 0,
  records_loaded INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Logs and Errors
  error_message TEXT,
  run_logs JSONB DEFAULT '[]',

  -- Metadata
  triggered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pipeline_deployments_pipeline_id ON pipeline_deployments(pipeline_id);
CREATE INDEX idx_pipeline_deployments_status ON pipeline_deployments(deployment_status);
CREATE INDEX idx_pipeline_deployments_created_by ON pipeline_deployments(created_by);
CREATE INDEX idx_pipeline_runs_deployment_id ON pipeline_runs(pipeline_deployment_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(run_status);
CREATE INDEX idx_pipeline_runs_dagster_run_id ON pipeline_runs(dagster_run_id);

-- Enable RLS
ALTER TABLE pipeline_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pipeline_deployments
CREATE POLICY "Users can view their own pipeline deployments" ON pipeline_deployments
  FOR SELECT USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_deployments.pipeline_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create pipeline deployments for their pipelines" ON pipeline_deployments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_deployments.pipeline_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own pipeline deployments" ON pipeline_deployments
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_deployments.pipeline_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own pipeline deployments" ON pipeline_deployments
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = pipeline_deployments.pipeline_id
      AND p.created_by = auth.uid()
    )
  );

-- RLS Policies for pipeline_runs
CREATE POLICY "Users can view pipeline runs for their deployments" ON pipeline_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pipeline_deployments pd
      JOIN pipelines p ON p.id = pd.pipeline_id
      WHERE pd.id = pipeline_runs.pipeline_deployment_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create pipeline runs for their deployments" ON pipeline_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pipeline_deployments pd
      JOIN pipelines p ON p.id = pd.pipeline_id
      WHERE pd.id = pipeline_runs.pipeline_deployment_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update pipeline runs for their deployments" ON pipeline_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM pipeline_deployments pd
      JOIN pipelines p ON p.id = pd.pipeline_id
      WHERE pd.id = pipeline_runs.pipeline_deployment_id
      AND p.created_by = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE pipeline_deployments IS 'Stores auto-generated Dagster pipeline Python code and deployment metadata';
COMMENT ON TABLE pipeline_runs IS 'Tracks execution history of deployed pipelines';
COMMENT ON COLUMN pipeline_deployments.python_code IS 'Complete Dagster pipeline Python module with assets, transformations, and dependencies';
COMMENT ON COLUMN pipeline_deployments.config IS 'Metadata about generated pipeline structure for UI display';
