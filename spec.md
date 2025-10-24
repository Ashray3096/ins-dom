Inspector Dom - Data Extraction Pipeline Application

Technical Specification for Implementation

1. PROJECT OVERVIEW

Mission

Build a production-ready web application that transforms unstructured data sources (PDFs, HTML, emails) into structured entities through a visual template builder, automatically generating Dagster data pipelines based on entity relationships.

Core Value Proposition

No-code template creation: Business users can define extraction patterns visually

Dynamic pipeline generation: System automatically creates Dagster pipelines from entity definitions

Scalable data processing: Test with samples, deploy to production S3 datasets

Full lineage tracking: From raw artifact → template → entity → ER diagram → pipeline

2. ARCHITECTURE OVERVIEW

Tech Stack

Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui

Backend: Next.js API Routes, Supabase (PostgreSQL + Auth + Storage)

Pipeline Engine: Dagster (Python), Dagster Components Architecture

AI Extraction: Claude API (Anthropic) for intelligent data extraction

Storage: Supabase Storage (artifacts), S3 (production datasets)

MCP Servers: Atlassian, Supabase, shadcn tooling (for local development)

Repository Structure

inspector-dom/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/                   # Auth pages (login, signup)
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── providers/            # Provider management
│   │   ├── sources/              # Source configuration
│   │   ├── templates/            # Template builder
│   │   ├── entities/             # Entity management
│   │   ├── pipelines/            # Pipeline monitoring
│   ├── api/                      # API routes
│   │   ├── extract/              # Extraction endpoints
│   │   ├── pipelines/            # Dagster integration
│   │   ├── templates/            # Template operations
│   └── layout.tsx
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── providers/                # Provider-specific components
│   ├── templates/                # Template editor (JSON/YAML)
│   ├── entities/                 # Entity relationship UI
│   ├── extraction/               # AI extraction preview & correction
├── lib/                          # Shared utilities
│   ├── supabase/                 # Supabase clients
│   ├── dagster/                  # Dagster API client
│   ├── extractors/               # File parsing utilities (PDF, HTML)
│   ├── ai/                       # AI extraction with Claude API
│   └── config.ts                 # Environment configuration
├── supabase/                     # Supabase configuration
│   ├── migrations/               # Database migrations
│   └── seed.sql                  # Seed data
└── types/                        # TypeScript types

consumeriq-dagster-pipeline/     # Separate Dagster repository
├── inspector_dom/
│   ├── components/               # Dagster Components
│   │   ├── universal_io_manager/
│   │   └── entity_pipeline/
│   ├── assets/                   # Asset definitions
│   │   ├── nabca_assets.py
│   │   ├── ttb_assets.py
│   └── resources/                # Shared resources
└── setup.py


3. DATABASE SCHEMA

Core Tables

-- Providers: Organizations that supply data
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  website_url TEXT,
  code_location_name TEXT, -- Dagster code location
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sources: Individual data sources within providers
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'url', 's3_bucket', 'api', 'file_upload'
  configuration JSONB NOT NULL,
  -- Examples:
  -- { "url": "https://example.com/data.pdf" }
  -- { "bucket": "my-bucket", "prefix": "data/", "pattern": "*.pdf", "test_mode": true, "test_limit": 10 }
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifacts: Raw extracted content from sources
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL, -- 'pdf', 'html', 'email', 'json'
  raw_content JSONB, -- Structured representation
  file_path TEXT, -- Path in Supabase Storage if file
  metadata JSONB, -- File size, page count, etc.
  extraction_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates: Define how to extract data from artifacts using AI
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  artifact_type TEXT NOT NULL, -- Must match artifact type
  
  -- AI Extraction Configuration
  ai_prompt TEXT NOT NULL, -- Instructions for Claude API
  expected_schema JSONB NOT NULL, -- Expected output structure
  -- Example expected_schema:
  -- {
  --   "fields": [
  --     { "name": "product_name", "type": "string", "required": true },
  --     { "name": "price", "type": "number", "required": true },
  --     { "name": "state", "type": "string", "required": false }
  --   ]
  -- }
  
  -- Validation & Correction
  example_inputs JSONB, -- Sample artifacts for testing
  example_outputs JSONB, -- Expected outputs for validation
  user_corrections JSONB, -- Manual corrections applied by users
  -- Example user_corrections:
  -- {
  --   "artifact_id_123": {
  --     "corrected_fields": { "price": 29.99 },
  --     "feedback": "AI extracted wrong column"
  --   }
  -- }
  
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entities: Structured business objects extracted from artifacts
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Product", "Store", "PriceHistory"
  table_name TEXT NOT NULL, -- Database table name (auto-generated)
  schema_definition JSONB NOT NULL,
  -- Structure:
  -- {
  --   "columns": [
  --     { "name": "product_name", "type": "TEXT", "required": true },
  --     { "name": "price", "type": "NUMERIC(10,2)", "required": true }
  --   ],
  --   "primary_key": ["product_name", "state_code"]
  -- }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity Relationships: Define how entities relate to each other
CREATE TABLE entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'one_to_many', 'many_to_one', 'many_to_many'
  foreign_key_column TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_entity_id, to_entity_id, foreign_key_column)
);

-- Pipeline Deployments: Track Dagster pipeline instances
CREATE TABLE pipeline_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  pipeline_name TEXT NOT NULL,
  
  -- Pipeline Definition (stored in DB, not files)
  pipeline_config JSONB NOT NULL,
  -- Contains complete pipeline configuration:
  -- {
  --   "assets": [
  --     {
  --       "name": "extract_artifacts",
  --       "source_config": {...},
  --       "extraction_template": {...}
  --     }
  --   ],
  --   "resources": {...}
  -- }
  
  dagster_location TEXT NOT NULL DEFAULT 'default',
  deployment_status TEXT DEFAULT 'active', -- 'active', 'paused', 'archived'
  schedule_cron TEXT, -- Optional: "0 0 * * *" for daily
  last_run_id TEXT,
  last_run_status TEXT, -- 'SUCCESS', 'FAILURE', 'RUNNING'
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline Runs: Execution history
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_deployment_id UUID REFERENCES pipeline_deployments(id) ON DELETE CASCADE,
  dagster_run_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- 'QUEUED', 'RUNNING', 'SUCCESS', 'FAILURE'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  records_processed INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


Row Level Security (RLS)

-- Enable RLS on all tables
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- Providers: Users can only see their own
CREATE POLICY "Users can view own providers"
  ON providers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own providers"
  ON providers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own providers"
  ON providers FOR UPDATE
  USING (auth.uid() = user_id);

-- Sources: Users can only see sources for their providers
CREATE POLICY "Users can view own sources"
  ON sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM providers
      WHERE providers.id = sources.provider_id
      AND providers.user_id = auth.uid()
    )
  );

-- Apply similar patterns to other tables


4. KEY USER FLOWS

Flow 1: Create Provider & Source (Test Mode)

UI Steps:

User clicks "New Provider"

Fills form: name, description, website

Clicks "Add Source" → "Test with Sample"

Enters single PDF URL: https://nabca.com/sample-prices.pdf

System downloads and stores in artifacts table

Shows preview of extracted content

API Route:

// app/api/sources/create/route.ts
export async function POST(req: Request) {
  const { providerId, name, sourceType, configuration } = await req.json();
  const supabase = createClient();
  
  // Create source
  const { data: source } = await supabase
    .from('sources')
    .insert({ provider_id: providerId, name, source_type: sourceType, configuration })
    .select()
    .single();
  
  // Trigger initial extraction
  await fetch('/api/extract', {
    method: 'POST',
    body: JSON.stringify({ sourceId: source.id })
  });
  
  return Response.json(source);
}


Flow 2: AI-Assisted Template Creation

UI Steps:

User selects artifact to extract from

System shows artifact preview (PDF pages, HTML content)

User describes what to extract: "Extract product name, price, and state code from each row"

System calls Claude API with artifact + user description

Claude returns structured JSON with extracted data

User reviews results, makes corrections if needed

System learns from corrections and saves as template

AI Extraction Component:

// components/extraction/ai-extractor.tsx
'use client';

import { useState } from 'react';

export function AIExtractor({ artifactId }: { artifactId: string }) {
  const [artifact, setArtifact] = useState(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [extractedData, setExtractedData] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  
  const extractWithAI = async () => {
    setIsExtracting(true);
    
    // Call AI extraction API
    const response = await fetch('/api/extract/ai', {
      method: 'POST',
      body: JSON.stringify({
        artifactId,
        userPrompt,
        expectedFields: ['product_name', 'price', 'state_code']
      })
    });
    
    const { data } = await response.json();
    setExtractedData(data);
    setIsExtracting(false);
  };
  
  const saveAsTemplate = async (corrections: any) => {
    await fetch('/api/templates', {
      method: 'POST',
      body: JSON.stringify({
        providerId,
        name: templateName,
        artifactType: 'pdf',
        aiPrompt: userPrompt,
        expectedSchema: {
          fields: [
            { name: 'product_name', type: 'string', required: true },
            { name: 'price', type: 'number', required: true },
            { name: 'state_code', type: 'string', required: false }
          ]
        },
        userCorrections: corrections
      })
    });
  };
  
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left: Artifact Preview */}
      <div className="space-y-4">
        <h3>Source Document</h3>
        <ArtifactPreview artifact={artifact} />
      </div>
      
      {/* Right: AI Extraction */}
      <div className="space-y-4">
        <h3>What to Extract</h3>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Describe what you want to extract: 'Extract all product names, prices, and state codes from the table...'"
          className="w-full h-32"
        />
        
        <button onClick={extractWithAI} disabled={isExtracting}>
          {isExtracting ? 'Extracting...' : 'Extract with AI'}
        </button>
        
        {/* Results Table with Correction UI */}
        {extractedData.length > 0 && (
          <DataTable 
            data={extractedData}
            onCorrect={(rowId, field, newValue) => {
              // Update corrections
            }}
            onSaveTemplate={saveAsTemplate}
          />
        )}
      </div>
    </div>
  );
}


AI Extraction API:

// app/api/extract/ai/route.ts
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const { artifactId, userPrompt, expectedFields } = await req.json();
  const supabase = createClient();
  
  // Get artifact content
  const { data: artifact } = await supabase
    .from('artifacts')
    .select('*, sources(*)')
    .eq('id', artifactId)
    .single();
  
  // Prepare Claude API request
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  
  const systemPrompt = `You are a data extraction assistant. Extract structured data from documents and return JSON.
Expected fields: ${expectedFields.join(', ')}
Return an array of objects with these fields. Be precise and extract all matching records.`;
  
  let content = [];
  
  // Handle different artifact types
  if (artifact.artifact_type === 'pdf') {
    // Get PDF from storage
    const { data: pdfData } = await supabase.storage
      .from('artifacts')
      .download(artifact.file_path);
    
    // Convert to base64 for Claude
    const pdfBase64 = await pdfData.arrayBuffer().then(buf => 
      Buffer.from(buf).toString('base64')
    );
    
    content = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: pdfBase64
        }
      },
      {
        type: 'text',
        text: userPrompt
      }
    ];
  } else if (artifact.artifact_type === 'html') {
    content = [
      {
        type: 'text',
        text: `${userPrompt}\n\nHTML Content:\n${artifact.raw_content}`
      }
    ];
  }
  
  // Call Claude API
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content
      }
    ]
  });
  
  // Parse response
  const extractedText = message.content[0].text;
  const jsonMatch = extractedText.match(/\[[\s\S]*\]/);
  const extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  
  // Store extraction result
  await supabase
    .from('artifacts')
    .update({
      extraction_status: 'completed',
      metadata: {
        ...artifact.metadata,
        ai_extraction: {
          prompt: userPrompt,
          extracted_count: extractedData.length,
          extracted_at: new Date().toISOString()
        }
      }
    })
    .eq('id', artifactId);
  
  return Response.json({ 
    success: true, 
    data: extractedData,
    usage: message.usage
  });
}


Flow 3: Define Entity & Relationships

UI Steps:

User creates entity from template

Maps template fields → entity columns

Defines column types (TEXT, NUMERIC, DATE, etc.)

Sets primary key

Creates relationships to other entities

System generates schema_definition JSONB

Entity Schema Example:

{
  "columns": [
    { "name": "product_id", "type": "TEXT", "required": true },
    { "name": "product_name", "type": "TEXT", "required": true },
    { "name": "state_code", "type": "TEXT", "required": true },
    { "name": "price", "type": "NUMERIC(10,2)", "required": true },
    { "name": "effective_date", "type": "DATE", "required": true }
  ],
  "primary_key": ["product_id", "state_code", "effective_date"],
  "indexes": [
    { "columns": ["state_code"] },
    { "columns": ["effective_date"] }
  ]
}


Flow 4: Generate & Deploy Pipeline

UI Steps:

User clicks "Generate Pipeline" on entity

System creates pipeline configuration in database (no file generation)

Shows pipeline configuration preview (JSON)

User clicks "Deploy Pipeline"

System registers pipeline with Dagster (reads from database)

Pipeline appears in monitoring dashboard

Pipeline Generation API:

// app/api/pipelines/generate/route.ts
export async function POST(req: Request) {
  const { entityId } = await req.json();
  const supabase = createClient();
  
  // Get entity with all relationships
  const { data: entity } = await supabase
    .from('entities')
    .select(`
      *,
      template:templates(*),
      provider:providers(*),
      relationships:entity_relationships(*)
    `)
    .eq('id', entityId)
    .single();
  
  // Generate pipeline configuration (stored in DB, not files)
  const pipelineConfig = {
    assets: [
      {
        name: `${entity.table_name}_artifacts`,
        type: 'source_extraction',
        config: {
          source_id: entity.template.source_id,
          extraction_method: 'ai',
          ai_prompt: entity.template.ai_prompt,
          expected_schema: entity.template.expected_schema
        }
      },
      {
        name: `${entity.table_name}_extracted`,
        type: 'transformation',
        deps: [`${entity.table_name}_artifacts`],
        config: {
          schema: entity.schema_definition,
          validations: entity.template.expected_schema.fields
        }
      },
      {
        name: `${entity.table_name}_loaded`,
        type: 'destination',
        deps: [`${entity.table_name}_extracted`],
        config: {
          table_name: entity.table_name,
          primary_key: entity.schema_definition.primary_key,
          upsert_strategy: 'merge'
        }
      }
    ],
    resources: {
      database: {
        connection_string: process.env.DATABASE_URL
      },
      anthropic: {
        api_key: process.env.ANTHROPIC_API_KEY
      }
    }
  };
  
  // Store pipeline definition in database
  const { data: deployment } = await supabase
    .from('pipeline_deployments')
    .insert({
      entity_id: entityId,
      pipeline_name: `${entity.table_name}_pipeline`,
      pipeline_config: pipelineConfig,
      dagster_location: 'default',
      deployment_status: 'active'
    })
    .select()
    .single();
  
  // No need to write files or reload code locations
  // Dagster will read configuration from database dynamically
  
  return Response.json(deployment);
}


Flow 5: Execute Pipeline (Test → Production)

Test Execution:

// User runs on sample source
await fetch('/api/pipelines/run', {
  method: 'POST',
  body: JSON.stringify({
    pipelineDeploymentId: deployment.id,
    sourceId: sampleSourceId // Single URL source
  })
});


Production Execution:

// User switches to S3 source
await fetch('/api/sources/update', {
  method: 'PUT',
  body: JSON.stringify({
    sourceId: sampleSourceId,
    sourceType: 's3_bucket',
    configuration: {
      bucket: 'inspector-dom-data',
      prefix: 'nabca/monthly/',
      pattern: '*.pdf'
    }
  })
});

// Same pipeline, now processes all S3 files
await fetch('/api/pipelines/run', {
  method: 'POST',
  body: JSON.stringify({
    pipelineDeploymentId: deployment.id,
    sourceId: sampleSourceId // Now S3 source
  })
});


6. DAGSTER INTEGRATION

Database-Driven Pipeline Architecture

Instead of generating Python files, pipelines are defined in the database and loaded dynamically by Dagster.

# consumeriq-dagster-pipeline/inspector_dom/__init__.py

from dagster import Definitions, asset, AssetExecutionContext
from typing import List, Dict, Any
import psycopg2
import json
from anthropic import Anthropic

# Database connection
def get_db_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"))

# Load pipeline definitions from database
def load_pipeline_configs() -> List[Dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, pipeline_name, pipeline_config, entity_id
        FROM pipeline_deployments
        WHERE deployment_status = 'active'
    """)
    
    configs = []
    for row in cursor.fetchall():
        configs.append({
            'id': row[0],
            'name': row[1],
            'config': json.loads(row[2]),
            'entity_id': row[3]
        })
    
    conn.close()
    return configs

# Dynamically create assets from database configurations
def create_assets_from_configs(configs: List[Dict]):
    assets = []
    
    for pipeline_config in configs:
        config = pipeline_config['config']
        pipeline_name = pipeline_config['name']
        
        # Create extraction asset
        @asset(name=f"{pipeline_name}_extract")
        def extract_artifacts(context: AssetExecutionContext):
            """Extract artifacts using AI"""
            asset_config = next(
                (a for a in config['assets'] if a['type'] == 'source_extraction'),
                None
            )
            
            if not asset_config:
                return []
            
            # Get source configuration
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT source_type, configuration
                FROM sources
                WHERE id = %s
            """, (asset_config['config']['source_id'],))
            
            source_type, source_config = cursor.fetchone()
            source_config = json.loads(source_config)
            
            # Handle test mode
            test_mode = source_config.get('test_mode', False)
            test_limit = source_config.get('test_limit', 10)
            
            artifacts = []
            
            if source_type == 'url':
                # Single URL extraction
                context.log.info(f"Extracting from URL: {source_config['url']}")
                artifact = extract_from_url(source_config['url'])
                
                # Use AI to extract structured data
                extracted_data = extract_with_ai(
                    artifact,
                    asset_config['config']['ai_prompt'],
                    asset_config['config']['expected_schema']
                )
                
                artifacts.append(extracted_data)
                
            elif source_type == 's3_bucket':
                # S3 bucket extraction
                import boto3
                s3 = boto3.client('s3')
                
                context.log.info(f"Extracting from S3: {source_config['bucket']}/{source_config['prefix']}")
                
                paginator = s3.get_paginator('list_objects_v2')
                count = 0
                
                for page in paginator.paginate(
                    Bucket=source_config['bucket'],
                    Prefix=source_config['prefix']
                ):
                    for obj in page.get('Contents', []):
                        if test_mode and count >= test_limit:
                            context.log.info(f"Test mode: stopping at {test_limit} files")
                            break
                        
                        if matches_pattern(obj['Key'], source_config.get('pattern', '*')):
                            context.log.info(f"Processing: {obj['Key']}")
                            
                            # Download from S3
                            artifact = extract_from_s3(source_config['bucket'], obj['Key'])
                            
                            # Use AI to extract
                            extracted_data = extract_with_ai(
                                artifact,
                                asset_config['config']['ai_prompt'],
                                asset_config['config']['expected_schema']
                            )
                            
                            artifacts.append(extracted_data)
                            count += 1
                    
                    if test_mode and count >= test_limit:
                        break
            
            context.log.info(f"Extracted {len(artifacts)} artifacts")
            return artifacts
        
        # Create transformation asset
        @asset(name=f"{pipeline_name}_transform", deps=[extract_artifacts])
        def transform_data(context: AssetExecutionContext, extract_artifacts):
            """Validate and transform extracted data"""
            asset_config = next(
                (a for a in config['assets'] if a['type'] == 'transformation'),
                None
            )
            
            transformed_records = []
            
            for artifact_data in extract_artifacts:
                for record in artifact_data:
                    # Validate against schema
                    validated_record = validate_record(
                        record,
                        asset_config['config']['schema']
                    )
                    transformed_records.append(validated_record)
            
            context.log.info(f"Transformed {len(transformed_records)} records")
            return transformed_records
        
        # Create load asset
        @asset(name=f"{pipeline_name}_load", deps=[transform_data])
        def load_to_database(context: AssetExecutionContext, transform_data):
            """Load data to target table"""
            asset_config = next(
                (a for a in config['assets'] if a['type'] == 'destination'),
                None
            )
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            table_name = asset_config['config']['table_name']
            primary_key = asset_config['config']['primary_key']
            
            # Ensure table exists
            create_table_from_schema(cursor, table_name, asset_config['config'])
            
            # Upsert records
            for record in transform_data:
                upsert_record(cursor, table_name, record, primary_key)
            
            conn.commit()
            context.log.info(f"Loaded {len(transform_data)} records to {table_name}")
        
        assets.extend([extract_artifacts, transform_data, load_to_database])
    
    return assets

# AI Extraction Helper
def extract_with_ai(artifact: Dict, prompt: str, schema: Dict) -> List[Dict]:
    """Use Claude API to extract structured data"""
    anthropic = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    
    system_prompt = f"""You are a data extraction assistant. Extract structured data and return JSON.
Expected fields: {', '.join([f['name'] for f in schema['fields']])}
Return an array of objects with these exact field names."""
    
    # Prepare content based on artifact type
    if artifact['type'] == 'pdf':
        content = [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": artifact['content_base64']
                }
            },
            {"type": "text", "text": prompt}
        ]
    else:
        content = [
            {
                "type": "text",
                "text": f"{prompt}\n\nContent:\n{artifact['content']}"
            }
        ]
    
    message = anthropic.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": content}]
    )
    
    # Parse JSON response
    response_text = message.content[0].text
    json_match = re.search(r'\[[\s\S]*\]', response_text)
    
    if json_match:
        return json.loads(json_match.group(0))
    
    return []

# Create Definitions
pipeline_configs = load_pipeline_configs()
dynamic_assets = create_assets_from_configs(pipeline_configs)

defs = Definitions(
    assets=dynamic_assets,
    resources={
        "database": DatabaseResource(
            connection_string=os.getenv("DATABASE_URL")
        )
    }
)


Key Advantages of Database-Driven Approach

No File Generation: Pipelines defined as JSONB in database

Instant Updates: Change configuration → refresh Dagster → pipeline updated

Version Control: Database tracks all configuration changes

No Git Complexity: No need to commit/push generated code

Easy Testing: Switch between test/production configs without code changes

Universal IO Manager

# consumeriq-dagster-pipeline/inspector_dom/resources/universal_io_manager.py

from dagster import IOManager, InputContext, OutputContext
import psycopg2
import json

class UniversalIOManager(IOManager):
    """
    Handles I/O for all entity tables dynamically
    """
    
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
    
    def handle_output(self, context: OutputContext, obj):
        """Store asset output"""
        if isinstance(obj, list) and len(obj) > 0:
            # Store as metadata for next asset
            context.log_metadata({
                "record_count": len(obj),
                "sample": json.dumps(obj[0])
            })
    
    def load_input(self, context: InputContext):
        """Load input for downstream assets"""
        # Return data from upstream asset
        return context.upstream_output


9. CONFIGURATION & ENVIRONMENT

Environment Variables

# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic API for AI extraction
ANTHROPIC_API_KEY=your-anthropic-api-key

DAGSTER_API_URL=http://localhost:3000/graphql
DAGSTER_WEB_URL=http://localhost:3000

AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1

DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres


Supabase Configuration

// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}


Dagster Configuration

# consumeriq-dagster-pipeline/inspector_dom/__init__.py

from dagster import Definitions, load_assets_from_modules
from .resources.universal_io_manager import UniversalIOManager
from .resources.database import DatabaseResource
import os

defs = Definitions(
    assets=load_assets_from_modules([assets]),
    resources={
        "database": DatabaseResource(
            connection_string=os.getenv("DATABASE_URL")
        ),
        "io_manager": UniversalIOManager(
            connection_string=os.getenv("DATABASE_URL")
        ),
    }
)


7. AI EXTRACTION IMPLEMENTATION GUIDE

Quick Start: Testing AI Extraction

Before building the full UI, validate that AI extraction works with your data:

// scripts/test-ai-extraction.ts
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';

async function testExtraction() {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  
  // Load a sample NABCA PDF
  const pdfPath = './samples/nabca-price-list.pdf';
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');
  
  const userPrompt = `
    Extract all products from this price list.
    For each product, extract:
    - Product name
    - Bottle size (in ML)
    - Price (in dollars)
    - State code (2 letters)
    
    Return as a JSON array.
  `;
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64
          }
        },
        {
          type: 'text',
          text: userPrompt
        }
      ]
    }]
  });
  
  // Parse the response
  const responseText = message.content[0].text;
  console.log('AI Response:', responseText);
  
  // Extract JSON
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const extracted = JSON.parse(jsonMatch[0]);
    console.log(`\nExtracted ${extracted.length} products:`);
    console.log(JSON.stringify(extracted.slice(0, 3), null, 2));
  }
  
  console.log(`\nTokens used: ${message.usage.input_tokens} in, ${message.usage.output_tokens} out`);
  console.log(`Estimated cost: ${(message.usage.input_tokens * 0.003 + message.usage.output_tokens * 0.015) / 1000}`);
}

testExtraction();


Run this before starting development to:

Validate your Anthropic API key works

See extraction quality on real data

Understand token usage and costs

Refine your prompts

Prompt Engineering Tips

Start Specific:

// Bad: Too vague
const prompt = "Get the data from this PDF";

// Good: Specific fields and format
const prompt = `
Extract product information from the price list table.

For each product row, extract:
- product_name: The full product name (text)
- bottle_size_ml: Bottle size in milliliters (number)
- price_usd: Price in US dollars (number, no $ sign)
- state: 2-letter state code (text, uppercase)

Return as JSON array with these exact field names.
Skip header rows and totals.
`;


Provide Examples:

const prompt = `
Extract products with these exact fields:
- product_name (text)
- price (number)
- state (text, 2 letters)

Example output:
[
  {"product_name": "Jack Daniels", "price": 29.99, "state": "CA"},
  {"product_name": "Jameson", "price": 24.99, "state": "NY"}
]

Now extract all products from this document.
`;


Handle Edge Cases:

const prompt = `
Extract products from the table. Rules:
1. If price is listed as "N/A" or blank, set to null
2. Convert all state codes to uppercase
3. If bottle size includes "L", convert to ML (1L = 1000ML)
4. Skip any row that says "Total" or "Subtotal"
5. If product name spans multiple lines, combine into one string

Return JSON array with fields: product_name, price, state, bottle_size_ml
`;


Correction UI Pattern

// components/extraction/correction-table.tsx
'use client';

import { useState } from 'react';

interface ExtractedRecord {
  id: string;
  product_name: string;
  price: number;
  state: string;
}

export function CorrectionTable({ 
  data, 
  onSave 
}: { 
  data: ExtractedRecord[];
  onSave: (corrected: ExtractedRecord[], corrections: any) => void;
}) {
  const [records, setRecords] = useState(data);
  const [corrections, setCorrections] = useState({});
  
  const updateField = (id: string, field: string, value: any) => {
    setRecords(prev => prev.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ));
    
    setCorrections(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3>Review Extracted Data ({records.length} records)</h3>
        <button 
          onClick={() => onSave(records, corrections)}
          className="btn-primary"
        >
          Save & Create Template
        </button>
      </div>
      
      <table className="w-full border">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Price</th>
            <th>State</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className={corrections[record.id] ? 'bg-yellow-50' : ''}>
              <td>
                <input
                  value={record.product_name}
                  onChange={(e) => updateField(record.id, 'product_name', e.target.value)}
                  className="w-full"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={record.price}
                  onChange={(e) => updateField(record.id, 'price', parseFloat(e.target.value))}
                  className="w-full"
                />
              </td>
              <td>
                <input
                  value={record.state}
                  onChange={(e) => updateField(record.id, 'state', e.target.value.toUpperCase())}
                  className="w-full"
                  maxLength={2}
                />
              </td>
              <td>
                {corrections[record.id] && (
                  <span className="text-yellow-600">Modified</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {Object.keys(corrections).length > 0 && (
        <div className="bg-yellow-50 p-4 rounded">
          <p className="font-medium">You've corrected {Object.keys(corrections).length} records</p>
          <p className="text-sm text-gray-600">
            These corrections will be saved to improve future extractions
          </p>
        </div>
      )}
    </div>
  );
}


Learning from Corrections

When users correct AI output, store it and use it to improve future prompts:

// lib/ai/prompt-builder.ts

export function buildPromptWithLearning(
  basePrompt: string,
  pastCorrections: any[]
) {
  if (pastCorrections.length === 0) {
    return basePrompt;
  }
  
  // Analyze common corrections
  const commonIssues = analyzeCorrections(pastCorrections);
  
  // Add learned rules to prompt
  const learnedRules = commonIssues.map(issue => {
    if (issue.type === 'wrong_column') {
      return `- ${issue.field} is usually in column ${issue.correctColumn}, not ${issue.wrongColumn}`;
    }
    if (issue.type === 'format') {
      return `- ${issue.field} should be formatted as ${issue.correctFormat}`;
    }
    return '';
  }).filter(Boolean).join('\n');
  
  return `${basePrompt}

Important corrections from past extractions:
${learnedRules}`;
}

function analyzeCorrections(corrections: any[]) {
  // Simple analysis: find fields that are frequently corrected
  const fieldCounts = {};
  
  for (const correction of corrections) {
    for (const field in correction.corrected_fields) {
      fieldCounts[field] = (fieldCounts[field] || 0) + 1;
    }
  }
  
  return Object.entries(fieldCounts)
    .filter(([_, count]) => count > 2) // Corrected more than twice
    .map(([field, _]) => ({
      type: 'frequent_correction',
      field,
      message: `Pay special attention to ${field}`
    }));
}


Cost Optimization

// lib/ai/cost-optimizer.ts

export async function extractWithCaching(
  artifactId: string,
  prompt: string,
  schema: any
) {
  // Check if we've already extracted this artifact with this prompt
  const cached = await getCachedExtraction(artifactId, prompt);
  
  if (cached) {
    console.log('Using cached extraction - $0.00');
    return cached.result;
  }
  
  // No cache, perform extraction
  const result = await extractWithAI(artifactId, prompt, schema);
  
  // Cache the result
  await cacheExtraction(artifactId, prompt, result);
  
  return result;
}

async function getCachedExtraction(artifactId: string, prompt: string) {
  const supabase = createClient();
  
  const { data } = await supabase
    .from('artifacts')
    .select('metadata')
    .eq('id', artifactId)
    .single();
  
  if (data?.metadata?.ai_extraction) {
    const cached = data.metadata.ai_extraction;
    
    // Check if prompt is similar (simple string comparison)
    if (cached.prompt === prompt) {
      return {
        result: cached.result,
        cached_at: cached.extracted_at
      };
    }
  }
  
  return null;
}


8. TESTING STRATEGY

Unit Tests

// __tests__/lib/extractors/pdf-extractor.test.ts
import { extractFromPDF } from '@/lib/extractors/pdf';

describe('PDF Extractor', () => {
  it('should extract text from PDF', async () => {
    const result = await extractFromPDF('sample.pdf');
    expect(result.pages).toHaveLength(5);
    expect(result.text).toContain('expected content');
  });
});


Integration Tests

// __tests__/api/pipelines/run.test.ts
import { POST } from '@/app/api/pipelines/run/route';

describe('Pipeline Run API', () => {
  it('should trigger Dagster pipeline', async () => {
    const request = new Request('http://localhost/api/pipelines/run', {
      method: 'POST',
      body: JSON.stringify({ pipelineDeploymentId: 'test-id' })
    });
    
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});


E2E Testing Flow

Create test provider

Add sample source (URL)

Build extraction template

Define entity

Generate pipeline

Run pipeline

Verify data in Supabase

8. DEPLOYMENT

Development

# Terminal 1: Next.js
npm run dev

# Terminal 2: Dagster
cd consumeriq-dagster-pipeline
dagster dev

# Terminal 3: Supabase (optional local)
supabase start


Production

Next.js: Deploy to Vercel

vercel --prod


Dagster: Deploy to Dagster Cloud

dagster-cloud deployment deploy \
  --deployment-name prod \
  --python-version 3.11


Database: Supabase hosted (already deployed)

10. KEY IMPLEMENTATION NOTES

Critical Success Factors

AI Extraction Quality: The success of the system depends on Claude API's ability to accurately extract structured data. Implement robust validation and correction workflows.

User Correction Loop: Users WILL need to correct AI mistakes initially. Make this process smooth and ensure the system learns from corrections.

Test Mode Implementation: The test_mode flag with test_limit is critical for cost control and fast iteration during development.

Database-Driven Pipelines: Storing pipeline configurations in JSONB allows instant updates without code deployment, but requires careful schema validation.

Template Versioning: As users refine prompts and corrections, track versions to understand what works and what doesn't.

Proper Error Handling: AI extraction can fail, S3 access can timeout, Dagster runs can crash. Every step needs retry logic and clear error messages.

RLS Security: Every table must have proper Row Level Security policies, especially with multi-user support.

Performance Considerations

AI API Costs: Claude API charges per token. Batch similar artifacts and cache results aggressively.

Artifact Storage: Large PDFs (>10MB) should go to Supabase Storage with references in database, not stored as JSONB.

Batch Processing: When processing S3 sources, fetch files in batches (10-50 at a time) to avoid memory issues.

Database Indexing: Add indexes on:

sources.provider_id (for filtering)

artifacts.source_id (for lineage queries)

pipeline_runs.dagster_run_id (for status lookups)

templates.provider_id (for template library)

Caching Strategy: Cache AI extraction results in artifacts.metadata to avoid re-processing the same document.

AI Extraction Best Practices

Prompt Engineering: Start with clear, specific prompts. Examples:

Good: "Extract product name, price in USD, and 2-letter state code from each row in the table"

Bad: "Get the data from this document"

Schema Validation: Always validate AI output against expected schema before loading to database.

Confidence Scoring: Consider asking Claude to include confidence scores for each extracted field.

Error Recovery: When AI extraction fails, store the error and allow users to manually extract or refine the prompt.

Example-Based Learning: Store successful extractions as examples to improve future prompts.

Database-Driven Pipeline Advantages

No Build Step: Change pipeline config → refresh Dagster → new behavior immediately

Easy Rollback: Keep version history of pipeline_config JSONB

A/B Testing: Run two pipeline configs side-by-side for comparison

Multi-Tenancy: Each tenant's pipelines isolated by RLS

Dynamic Scaling: Add new pipelines without redeploying code

Scalability Path

Phase 1 (MVP - 1 user, 1-5 providers):

Single Dagster instance

Claude API direct calls

Manual pipeline triggers

Local development with Supabase

Phase 2 (Growth - 10 users, 20 providers):

Dagster Cloud deployment

Rate limiting on AI API calls

Scheduled pipeline runs

Multi-user with RLS

Monitoring and alerting

Phase 3 (Scale - 100+ users, 100+ providers):

Queue system (RabbitMQ/SQS) for pipeline triggers

Separate Dagster instances by load

AI extraction caching layer (Redis)

Distributed file processing

Cost tracking per user/provider

Security Considerations

API Key Management: Store Anthropic API key in environment variables, never in database

S3 Access Control: Use temporary credentials (STS) instead of permanent keys

Row Level Security: Test RLS policies thoroughly - users should NEVER see others' data

Rate Limiting: Prevent abuse by limiting AI API calls per user per day

Data Retention: Implement automatic cleanup of old artifacts and pipeline runs

Cost Management

AI API Costs (Anthropic Claude):

~$3 per 1M input tokens, ~$15 per 1M output tokens

Average PDF extraction: ~10K input tokens, ~2K output tokens = $0.06

1000 PDFs/month = ~$60/month

Storage Costs (Supabase):

Free tier: 500MB database + 1GB file storage

Pro: $25/month (8GB database + 100GB storage)

Dagster Costs:

Self-hosted: Free (just compute costs)

Dagster Cloud: Starts at $50/month

Estimated Monthly Cost for MVP: ~$100-150/month

11. IMPLEMENTATION CHECKLIST

Phase 1: Foundation (Weeks 1-2)

[ ] Set up Next.js project with TypeScript

[ ] Configure Supabase (create project, run migrations with updated schema)

[ ] Implement authentication (login, signup, session management)

[ ] Create base UI layout with navigation

[ ] Set up Anthropic API integration for AI extraction

[ ] Create simple file upload/URL input for artifacts

Phase 2: AI-Powered Extraction (Weeks 3-4)

[ ] Build provider CRUD UI

[ ] Implement source configuration form (URL, S3, API with test_mode)

[ ] Create artifact extraction service (PDF, HTML) with file storage

[ ] Build AI extraction API endpoint (Claude API integration)

[ ] Display artifact preview with AI extraction results

[ ] Implement correction UI (users can fix AI mistakes)

[ ] Save corrected results as templates (AI prompt + corrections)

Phase 3: Template Management (Weeks 5-6)

[ ] Build template library UI (view, edit, reuse templates)

[ ] Implement template versioning (track changes to prompts/corrections)

[ ] Create template testing interface (try template on new artifact)

[ ] Add template comparison (show before/after when template changes)

[ ] Build validation layer (alert when extraction quality drops)

Phase 4: Entity & Relationship Management (Weeks 7-8)

[ ] Create entity definition UI (map template fields to entity columns)

[ ] Implement schema builder (column types, constraints, primary keys)

[ ] Build relationship mapper (define foreign keys between entities)

[ ] Generate ER diagram visualization (show entity relationships)

[ ] Auto-create database tables from entity definitions

Phase 5: Database-Driven Pipeline Generation (Weeks 9-10)

[ ] Implement pipeline configuration generator (create JSONB from entities)

[ ] Store pipeline definitions in database (no file generation)

[ ] Build Dagster dynamic asset loader (reads configs from database)

[ ] Integrate AI extraction into Dagster assets

[ ] Create pipeline deployment API (register with Dagster)

[ ] Test pipeline execution with sample data (single source)

Phase 6: Production Features (Weeks 11-12)

[ ] Implement S3 source processing with test_mode support

[ ] Add pipeline scheduling (cron-based triggers)

[ ] Build monitoring dashboard (show pipeline runs, status, errors)

[ ] Create error handling and retry logic

[ ] Implement usage tracking (AI API calls, storage costs)

[ ] Add pipeline run history and logs viewer

Phase 7: Testing & Refinement (Week 13)

[ ] End-to-end testing with real NABCA PDFs

[ ] End-to-end testing with TTB HTML pages

[ ] Test switching from sample → S3 full dataset

[ ] Performance optimization (caching, batch processing)

[ ] Security audit (RLS policies, API authentication)

[ ] UI/UX polish and responsive design

Phase 8: Documentation & Deployment (Week 14)

[ ] User documentation (how to create providers, templates, pipelines)

[ ] API documentation

[ ] Deploy Next.js to Vercel

[ ] Deploy Dagster to Dagster Cloud

[ ] Set up monitoring and alerts

[ ] Create backup and disaster recovery plan

12. SUCCESS METRICS

Technical Metrics

Pipeline execution time < 5 minutes for 1000 records

API response time < 200ms (p95)

Zero data loss during extraction

99.9% uptime for production pipelines

User Metrics

Time to create first template: < 15 minutes

Template reusability: > 80% for similar sources

Pipeline generation: < 5 minutes from entity to deployed pipeline

FINAL NOTES FOR CLAUDE CODE

Implementation Philosophy

Start Simple, Iterate Fast:

Phase 1 Priority: Get AI extraction working with one provider before building the full UI

Test with Real Data: Use actual NABCA PDFs and TTB HTML from day one

User Correction is Key: The system gets smarter as users correct AI mistakes

Database First: All configuration lives in the database for maximum flexibility

AI Extraction Strategy

The Core Innovation: Instead of building complex visual template builders with CSS selectors, we leverage Claude's ability to understand documents and extract structured data. This is:

More Robust: Works across different layouts and formats

Faster to Build: No complex UI needed initially

Better UX: Users describe what they want, not how to extract it

Self-Improving: System learns from corrections

Database-Driven Pipeline Architecture

Why This Approach:

No Code Generation: Avoids Git automation complexity

Instant Updates: Change config → refresh → new behavior

Easy Testing: Switch between test/production without redeployment

Version Control: Database naturally tracks all changes

Critical Implementation Details

Test Mode is Essential:

{
  "bucket": "my-data",
  "prefix": "pdfs/",
  "test_mode": true,
  "test_limit": 10  // Process only 10 files for testing
}


AI Prompt Template:

const systemPrompt = `Extract structured data from this document.

Expected fields:
${schema.fields.map(f => `- ${f.name} (${f.type}${f.required ? ', required' : ''})`).join('\n')}

Return a JSON array with these exact field names. Be precise and extract all records.`;


User Correction Workflow:

// 1. AI extracts data
const aiResult = await extractWithAI(artifact, prompt);

// 2. User reviews and corrects
const correctedResult = await userCorrects(aiResult);

// 3. System learns from corrections
await saveTemplate({
  aiPrompt: prompt,
  userCorrections: correctedResult.changes
});

// 4. Next time, AI uses corrections as examples


Pipeline Config Structure:

{
  "assets": [
    {
      "name": "products_extract",
      "type": "source_extraction",
      "config": {
        "source_id": "uuid",
        "ai_prompt": "Extract product names, prices...",
        "expected_schema": {...}
      }
    },
    {
      "name": "products_transform",
      "type": "transformation",
      "deps": ["products_extract"],
      "config": {
        "validations": [...],
        "transformations": [...]
      }
    },
    {
      "name": "products_load",
      "type": "destination",
      "deps": ["products_transform"],
      "config": {
        "table_name": "products",
        "upsert_strategy": "merge"
      }
    }
  ]
}


Questions to Resolve During Implementation

AI Prompt Management: Should prompts be versioned separately or as part of templates?

Extraction Confidence: Should we ask Claude for confidence scores on each field?

Partial Failures: How to handle when AI successfully extracts 80% of records?

Template Sharing: Should users be able to share templates with others?

Cost Alerts: When to notify users about high AI API costs?

Validation Rules: How strict should schema validation be? (fail vs. warn)

Development Workflow

Daily Development Loop:

# Terminal 1: Next.js (port 3001 to avoid Dagster conflict)
npm run dev -- -p 3001

# Terminal 2: Dagster
cd ../consumeriq-dagster-pipeline
dagster dev

# Terminal 3: Supabase (optional if using cloud)
supabase start

# Test AI extraction
curl -X POST http://localhost:3001/api/extract/ai \
  -H "Content-Type: application/json" \
  -d '{"artifactId": "...", "userPrompt": "..."}'


Success Metrics for MVP

Technical:

AI extraction accuracy > 85% on first try

User correction time < 2 minutes per document

Pipeline execution < 5 minutes for 100 records

API response time < 2 seconds (p95)

User:

Time to create first working pipeline < 30 minutes

Template reusability > 70% for similar documents

User satisfaction score > 4/5

The Path Forward

Weeks 1-4: Foundation + AI Extraction Build the core extraction loop. Everything else is secondary.

Weeks 5-8: Template Management + Entities Make it reusable and scalable.

Weeks 9-12: Pipelines + Production Automate everything and deploy.

Weeks 13-14: Polish + Ship Make it beautiful and reliable.

What Makes This Different

Most data extraction tools require:

Complex template builders

Manual field mapping

Brittle CSS selectors

Expert users

Inspector Dom uses AI to:

Understand documents naturally

Extract data intelligently

Learn from corrections

Serve business users

This is the future of data extraction. Build it right, and you'll have something truly valuable.

Remember: The AI extraction quality determines everything else. Get that right first, then build the rest of the system around it. The architecture is solid, the approach is modern, and the technology is ready. Now it's time to execute.