# Dagster Component Architecture Migration Plan

## Overview

This document outlines the migration from traditional Dagster asset-based pipelines to a component-based architecture with GraphQL API integration.

**Key Requirements:**
- ✅ No Dagster UI usage
- ✅ GraphQL API for programmatic execution
- ✅ Runtime configuration from database
- ✅ Single universal component instead of per-pipeline files
- ✅ Execute pipelines via GraphQL mutations from Next.js
- ✅ Monitor runs via GraphQL queries

---

## Current Architecture (Traditional Assets)

### File Structure
```
dagster_home/
├── workspace.yaml                    # Workspace configuration
├── pipelines/
│   ├── __init__.py                  # Dynamic asset loader
│   ├── raw_ttb_v1.py                # Hardcoded TTB pipeline
│   └── nabca_all_tables_v1.py       # Hardcoded NABCA pipeline
```

### Current Approach
```python
# dagster_home/pipelines/raw_ttb_v1.py
@asset(
    name="extract_raw_ttb",
    description="Extract data from source artifacts using template",
    compute_kind="extraction",
    retry_policy=RetryPolicy(max_retries=3),
)
def extract_raw_ttb(context: AssetExecutionContext) -> Dict[str, Any]:
    # ❌ Hardcoded source IDs
    source_ids = ["753349ee-92cf-4ea1-8859-0a97e32b642f"]

    # ❌ Hardcoded template ID
    template_id = "98b382f1-b1f3-41ec-8ba6-372af573c7bc"

    # ❌ Hardcoded extraction logic
    # Extract data using template...

    return results
```

### Problems with Current Approach:
1. **Hardcoded Configuration**: Each pipeline has hardcoded IDs and logic
2. **New File Per Pipeline**: Must create new `.py` file for each pipeline
3. **No Runtime Config**: Configuration is in code, not database
4. **Dagster UI Dependency**: Uses Dagster UI for execution and monitoring
5. **Not Scalable**: Can't create pipelines dynamically from UI

---

## Required Architecture (Components)

### Component-Based Design

```
dagster_home/
├── workspace.yaml
├── components/
│   ├── __init__.py
│   ├── universal_extraction.py      # ✅ Single universal extraction component
│   └── universal_loading.py         # ✅ Single universal loading component
```

### Universal Extraction Component
```python
# dagster_home/components/universal_extraction.py
from dagster import op, job, OpExecutionContext, Config
from typing import Dict, Any, List
import requests

class ExtractionConfig(Config):
    """Runtime configuration from database"""
    pipeline_id: str
    source_ids: List[str]
    template_id: str
    extraction_strategy: str  # dom_selection, table_detection, etc.
    strategy_config: Dict[str, Any]
    field_mappings: List[Dict[str, Any]]

@op(
    description="Universal extraction operation - works for all extraction strategies",
    required_resource_keys={"supabase"},
)
def extract_data(context: OpExecutionContext, config: ExtractionConfig) -> Dict[str, Any]:
    """
    Universal extraction operation that handles all strategies:
    - DOM Selection (HTML)
    - Table Detection (PDF, HTML)
    - JSON Path (JSON)
    - Key-Value Extraction (PDF, Forms)
    - OCR Text Extraction (PDF, Images)
    - AI Extraction (All types)
    """

    # Fetch runtime configuration from Supabase
    supabase = context.resources.supabase

    # Get template details
    template = supabase.table("templates")\
        .select("*, template_fields(*, field_library(*))")\
        .eq("id", config.template_id)\
        .single()\
        .execute()

    # Get artifacts to process
    artifacts = supabase.table("artifacts")\
        .select("*")\
        .in_("id", config.source_ids)\
        .execute()

    results = []

    # Process each artifact using the template's extraction strategy
    for artifact in artifacts.data:
        context.log.info(f"Processing artifact: {artifact['original_filename']}")

        # Route to appropriate extraction service
        extraction_result = None

        if template.data["extraction_strategy"] == "dom_selection":
            extraction_result = extract_with_dom_selection(
                artifact,
                template.data["template_fields"],
                template.data["strategy_config"]
            )

        elif template.data["extraction_strategy"] == "table_detection":
            extraction_result = extract_with_table_detection(
                artifact,
                template.data["template_fields"],
                template.data["strategy_config"]
            )

        elif template.data["extraction_strategy"] == "json_path":
            extraction_result = extract_with_json_path(
                artifact,
                template.data["template_fields"],
                template.data["strategy_config"]
            )

        elif template.data["extraction_strategy"] == "ai_extraction":
            # Call Inspector Dom AI extraction service
            extraction_result = extract_with_ai(
                artifact,
                template.data["template_fields"],
                template.data["strategy_config"]
            )

        # Validate extracted data against field definitions
        validated_data = validate_extraction(
            extraction_result,
            template.data["template_fields"]
        )

        results.append({
            "artifact_id": artifact["id"],
            "extracted_data": validated_data,
            "extraction_metadata": {
                "strategy": template.data["extraction_strategy"],
                "field_count": len(validated_data),
                "extraction_timestamp": context.run.run_id,
            }
        })

    context.log.info(f"Extracted data from {len(results)} artifacts")

    return {
        "pipeline_id": config.pipeline_id,
        "template_id": config.template_id,
        "results": results,
        "total_artifacts": len(results),
    }


def extract_with_dom_selection(artifact, field_mappings, config):
    """Extract data using CSS selectors/XPath from HTML"""
    # Implementation for DOM-based extraction
    pass

def extract_with_table_detection(artifact, field_mappings, config):
    """Extract data from detected tables"""
    # Implementation for table detection
    pass

def extract_with_json_path(artifact, field_mappings, config):
    """Extract data using JSONPath expressions"""
    # Implementation for JSON extraction
    pass

def extract_with_ai(artifact, field_mappings, config):
    """Extract data using AI model"""
    # Call Inspector Dom AI service
    pass

def validate_extraction(data, field_mappings):
    """Validate and transform extracted data"""
    # Apply validation rules and transformations
    pass


# Create job with the universal op
@job(
    name="universal_extraction_job",
    description="Universal extraction job that works for any template",
)
def universal_extraction_job():
    extract_data()
```

### Universal Loading Component
```python
# dagster_home/components/universal_loading.py
from dagster import op, job, OpExecutionContext, Config, In
from typing import Dict, Any

class LoadingConfig(Config):
    """Runtime configuration for loading"""
    pipeline_id: str
    entity_id: str
    load_strategy: str  # append, upsert, replace
    batch_size: int = 100

@op(
    description="Universal loading operation - loads to any entity",
    required_resource_keys={"supabase"},
    ins={"extraction_results": In(Dict[str, Any])},
)
def load_data(context: OpExecutionContext, config: LoadingConfig, extraction_results: Dict[str, Any]):
    """
    Universal loading operation that handles all entity types
    """
    supabase = context.resources.supabase

    # Get entity configuration
    entity = supabase.table("entities")\
        .select("*")\
        .eq("id", config.entity_id)\
        .single()\
        .execute()

    context.log.info(f"Loading to entity: {entity.data['name']}")

    # Transform extraction results to entity schema
    transformed_records = transform_to_entity_schema(
        extraction_results["results"],
        entity.data
    )

    # Load data based on strategy
    if config.load_strategy == "append":
        # Insert all records
        result = supabase.table(entity.data["table_name"])\
            .insert(transformed_records)\
            .execute()

    elif config.load_strategy == "upsert":
        # Upsert based on unique keys
        result = supabase.table(entity.data["table_name"])\
            .upsert(transformed_records, on_conflict=entity.data["unique_fields"])\
            .execute()

    elif config.load_strategy == "replace":
        # Delete existing and insert new
        supabase.table(entity.data["table_name"]).delete().execute()
        result = supabase.table(entity.data["table_name"])\
            .insert(transformed_records)\
            .execute()

    # Record run metadata
    run_metadata = {
        "pipeline_id": config.pipeline_id,
        "entity_id": config.entity_id,
        "records_loaded": len(transformed_records),
        "load_strategy": config.load_strategy,
        "dagster_run_id": context.run.run_id,
    }

    supabase.table("pipeline_runs")\
        .insert(run_metadata)\
        .execute()

    context.log.info(f"Loaded {len(transformed_records)} records")

    return run_metadata


def transform_to_entity_schema(extraction_results, entity_config):
    """Transform extracted data to match entity schema"""
    # Map template fields to entity columns
    pass


@job(
    name="universal_loading_job",
    description="Universal loading job that works for any entity",
)
def universal_loading_job():
    load_data()
```

### Combined Pipeline Job
```python
# dagster_home/components/__init__.py
from dagster import job, Definitions, resource
from .universal_extraction import extract_data
from .universal_loading import load_data

@job(
    name="universal_pipeline",
    description="Complete ETL pipeline: Extract → Load",
)
def universal_pipeline():
    extraction_results = extract_data()
    load_data(extraction_results)

# Define resources
@resource
def supabase_resource(context):
    from supabase import create_client
    return create_client(
        context.resource_config["url"],
        context.resource_config["key"]
    )

# Export definitions
definitions = Definitions(
    jobs=[universal_pipeline],
    resources={
        "supabase": supabase_resource.configured({
            "url": {"env": "SUPABASE_URL"},
            "key": {"env": "SUPABASE_SERVICE_ROLE_KEY"},
        })
    },
)
```

---

## GraphQL API Integration

### Next.js GraphQL Client Service

```typescript
// src/lib/dagster/client.ts
import { GraphQLClient } from 'graphql-request';

const DAGSTER_GRAPHQL_ENDPOINT = process.env.DAGSTER_GRAPHQL_URL || 'http://localhost:3000/graphql';

export const dagsterClient = new GraphQLClient(DAGSTER_GRAPHQL_ENDPOINT, {
  headers: {
    'Content-Type': 'application/json',
  },
});

// GraphQL mutations and queries
export const LAUNCH_PIPELINE_RUN = `
  mutation LaunchPipelineRun($runConfigData: RunConfigData!) {
    launchRun(
      executionParams: {
        selector: {
          repositoryLocationName: "inspector_dom_pipelines"
          repositoryName: "__repository__"
          pipelineName: "universal_pipeline"
        }
        runConfigData: $runConfigData
      }
    ) {
      __typename
      ... on LaunchRunSuccess {
        run {
          id
          runId
          status
          pipelineName
        }
      }
      ... on RunConfigValidationInvalid {
        errors {
          message
          reason
        }
      }
      ... on PipelineNotFoundError {
        message
      }
    }
  }
`;

export const GET_RUN_STATUS = `
  query GetRunStatus($runId: ID!) {
    runOrError(runId: $runId) {
      __typename
      ... on Run {
        id
        runId
        status
        stats {
          stepsSucceeded
          stepsFailed
        }
        stepStats {
          stepKey
          status
          startTime
          endTime
        }
      }
    }
  }
`;

export const GET_RUN_LOGS = `
  query GetRunLogs($runId: ID!, $cursor: String) {
    logsForRun(runId: $runId, afterCursor: $cursor) {
      results {
        __typename
        ... on MessageEvent {
          message
          timestamp
          level
        }
      }
    }
  }
`;

export async function launchPipelineRun(pipelineId: string) {
  // Fetch pipeline configuration from Supabase
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select(`
      *,
      sources(*),
      template:templates(*),
      entity:entities(*)
    `)
    .eq('id', pipelineId)
    .single();

  // Build run configuration
  const runConfig = {
    ops: {
      extract_data: {
        config: {
          pipeline_id: pipeline.id,
          source_ids: pipeline.sources.map(s => s.id),
          template_id: pipeline.template.id,
          extraction_strategy: pipeline.template.extraction_strategy,
          strategy_config: pipeline.template.strategy_config,
        }
      },
      load_data: {
        config: {
          pipeline_id: pipeline.id,
          entity_id: pipeline.entity.id,
          load_strategy: pipeline.load_strategy || 'append',
          batch_size: 100,
        }
      }
    },
    resources: {
      supabase: {
        config: {
          url: process.env.SUPABASE_URL,
          key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        }
      }
    }
  };

  // Launch the run via GraphQL
  const response = await dagsterClient.request(LAUNCH_PIPELINE_RUN, {
    runConfigData: JSON.stringify(runConfig),
  });

  return response.launchRun;
}

export async function getRunStatus(runId: string) {
  const response = await dagsterClient.request(GET_RUN_STATUS, { runId });
  return response.runOrError;
}

export async function getRunLogs(runId: string, cursor?: string) {
  const response = await dagsterClient.request(GET_RUN_LOGS, { runId, cursor });
  return response.logsForRun;
}
```

### API Route for Pipeline Execution

```typescript
// src/app/api/pipelines/[id]/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { launchPipelineRun, getRunStatus } from '@/lib/dagster/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pipelineId = params.id;

    // Launch the Dagster run via GraphQL
    const launchResult = await launchPipelineRun(pipelineId);

    if (launchResult.__typename === 'LaunchRunSuccess') {
      const { run } = launchResult;

      // Save run record to Supabase
      const supabase = createClient();
      await supabase.from('pipeline_runs').insert({
        pipeline_id: pipelineId,
        dagster_run_id: run.runId,
        status: run.status,
        started_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        runId: run.runId,
        status: run.status,
      });
    } else {
      return NextResponse.json(
        { error: 'Failed to launch run', details: launchResult },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error launching pipeline:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const runId = searchParams.get('runId');

    if (!runId) {
      return NextResponse.json(
        { error: 'runId is required' },
        { status: 400 }
      );
    }

    // Get run status from Dagster via GraphQL
    const status = await getRunStatus(runId);

    return NextResponse.json({
      success: true,
      run: status,
    });
  } catch (error) {
    console.error('Error getting run status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Database Schema Updates

### Pipeline Runs Table
```sql
-- Track Dagster run executions
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  dagster_run_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- STARTED, SUCCESS, FAILURE, CANCELED
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  records_extracted INTEGER,
  records_loaded INTEGER,
  error_message TEXT,
  logs JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_runs_pipeline_id ON pipeline_runs(pipeline_id);
CREATE INDEX idx_pipeline_runs_dagster_run_id ON pipeline_runs(dagster_run_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
```

---

## Comparison: Traditional vs Component

| Aspect | Traditional Assets (Current) | Components (Required) |
|--------|------------------------------|----------------------|
| **Configuration** | Hardcoded in `.py` files | Runtime from database |
| **Pipeline Creation** | New file per pipeline | Database record only |
| **Execution** | Dagster UI or CLI | GraphQL API from Next.js |
| **Monitoring** | Dagster UI | GraphQL queries |
| **Scalability** | Limited (must deploy code) | Unlimited (data-driven) |
| **Reusability** | Copy-paste code | Single universal component |
| **User Control** | Requires developer | Self-service in UI |

---

## Implementation Steps

### Phase 1: Create Universal Components ✅
1. Create `dagster_home/components/` directory
2. Implement `universal_extraction.py` with all strategy handlers
3. Implement `universal_loading.py` with entity mapping
4. Update `workspace.yaml` to load from components
5. Test with sample pipeline configuration

### Phase 2: GraphQL Client Integration ✅
1. Install `graphql-request` package in Next.js
2. Create `src/lib/dagster/client.ts` with GraphQL operations
3. Implement `launchPipelineRun()` function
4. Implement `getRunStatus()` and `getRunLogs()` functions
5. Test GraphQL connectivity

### Phase 3: Update API Routes ✅
1. Replace `/api/pipelines/[id]/test-run` simulation with real Dagster execution
2. Create `/api/pipelines/[id]/run` endpoint for launching runs
3. Create `/api/pipelines/[id]/status` endpoint for monitoring
4. Update UI to call new endpoints

### Phase 4: Database Schema ✅
1. Create `pipeline_runs` table migration
2. Add indexes for performance
3. Update `pipelines` table if needed (add `load_strategy` column)

### Phase 5: Remove Legacy Code ✅
1. Archive `dagster_home/pipelines/raw_ttb_v1.py`
2. Archive `dagster_home/pipelines/nabca_all_tables_v1.py`
3. Update `dagster_home/pipelines/__init__.py` to load components only
4. Keep Dagster daemon running (for GraphQL server)
5. Document that Dagster UI is not used

### Phase 6: Testing ✅
1. Test extraction with all strategies (DOM, table, JSON, AI)
2. Test loading with different strategies (append, upsert, replace)
3. Test error handling and retries
4. Test monitoring and logging
5. Performance testing with large datasets

---

## Architecture Diagram

### Old Approach (Traditional Assets)
```
┌─────────────────────────────────────────────────────────────┐
│                       Dagster UI                             │
│  (Used for execution, monitoring, and configuration)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              Dagster Daemon + Code Server                    │
├─────────────────────────────────────────────────────────────┤
│  pipelines/                                                  │
│  ├── raw_ttb_v1.py        ← Hardcoded pipeline              │
│  ├── nabca_all_tables.py  ← Hardcoded pipeline              │
│  └── __init__.py          ← Loads all pipeline files        │
└─────────────────────────────────────────────────────────────┘

Problems:
❌ Must use Dagster UI
❌ Hardcoded configuration
❌ New file per pipeline
❌ Not scalable
```

### New Approach (Components + GraphQL)
```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Application                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Pipeline UI (Create, Configure, Run, Monitor)         │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  GraphQL Client (/lib/dagster/client.ts)               │ │
│  │  - launchPipelineRun()                                 │ │
│  │  - getRunStatus()                                      │ │
│  │  - getRunLogs()                                        │ │
│  └──────────────────────┬─────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          │ GraphQL API calls
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Dagster Daemon + GraphQL Server                 │
│              (NO UI - API only)                              │
├─────────────────────────────────────────────────────────────┤
│  components/                                                 │
│  ├── universal_extraction.py  ← Works for ALL strategies    │
│  ├── universal_loading.py     ← Works for ALL entities      │
│  └── __init__.py              ← Exports universal jobs      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Reads runtime config
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ pipelines          (Pipeline definitions)              │ │
│  │ templates          (Extraction strategies + configs)   │ │
│  │ entities           (Target schema definitions)         │ │
│  │ pipeline_runs      (Execution history + status)        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Benefits:
✅ No Dagster UI needed
✅ Runtime configuration from database
✅ Single universal component
✅ Fully scalable
✅ Self-service pipeline creation
```

---

## Key Benefits

### For Users:
1. **Self-Service**: Create and run pipelines entirely from Next.js UI
2. **No Code Required**: All configuration via visual interface
3. **Instant Deployment**: No code deployment needed for new pipelines
4. **Real-Time Monitoring**: See execution status and logs in Next.js

### For Developers:
1. **Single Code Path**: One universal component for all pipelines
2. **No Hardcoded Logic**: All configuration from database
3. **Easy Testing**: Test components with different configs
4. **Maintainable**: Changes in one place affect all pipelines

### For Architecture:
1. **Scalable**: Add unlimited pipelines without code changes
2. **Decoupled**: Next.js and Dagster communicate via GraphQL
3. **Flexible**: Easy to add new extraction strategies or loading methods
4. **Observable**: Complete execution history in database

---

## Next Actions

### Immediate (After Wizard Testing):
1. ✅ Implement universal extraction component
2. ✅ Implement universal loading component
3. ✅ Create GraphQL client service
4. ✅ Update API routes to use GraphQL
5. ✅ Test end-to-end with sample pipeline

### Future Enhancements:
1. Add retry logic with exponential backoff
2. Add data quality checks in extraction component
3. Add incremental extraction (delta loads)
4. Add data transformation layer
5. Add pipeline scheduling via cron expressions

---

## Testing Checklist

### Component Testing:
- [ ] Universal extraction works for each strategy (DOM, table, JSON, AI)
- [ ] Universal loading works for each strategy (append, upsert, replace)
- [ ] Configuration is correctly read from database
- [ ] Field mappings are correctly applied
- [ ] Validation rules are enforced

### GraphQL Integration Testing:
- [ ] Can launch runs via GraphQL from Next.js
- [ ] Can query run status via GraphQL
- [ ] Can retrieve logs via GraphQL
- [ ] Error handling works correctly
- [ ] Authentication works (if needed)

### End-to-End Testing:
- [ ] Create pipeline in UI
- [ ] Launch run from UI
- [ ] Monitor execution in real-time
- [ ] View logs in UI
- [ ] Verify data loaded correctly in entity table
- [ ] Check pipeline_runs record created

---

## Questions to Resolve

1. **Authentication**: Does Dagster GraphQL need authentication? If so, how do we configure it?
2. **Error Handling**: How should we handle partial failures (some artifacts succeed, others fail)?
3. **Retry Strategy**: Should retries be configured at Dagster op level or in Next.js?
4. **Logging**: Should logs be stored in Supabase or only retrieved from Dagster?
5. **Scheduling**: Do we need Dagster sensors/schedules or will Next.js handle scheduling?

---

## Resources

- [Dagster Components Documentation](https://docs.dagster.io/concepts/components)
- [Dagster GraphQL API Reference](https://docs.dagster.io/concepts/webserver/graphql)
- [GraphQL Request Library](https://github.com/jasonkuhrt/graphql-request)
- Inspector Dom Documentation (internal)

---

**Status**: 📋 Plan documented - ready for implementation after wizard testing
**Last Updated**: 2025-11-11
**Next Review**: After completing Phase 2 wizard testing
