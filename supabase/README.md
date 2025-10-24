# Supabase Database Schema

This directory contains the database migrations for the Inspector Dom application.

## Schema Overview

The Inspector Dom database schema supports an AI-powered data extraction platform.

### Core Tables

1. **providers** - Data sources (NABCA, TTB, Custom)
2. **source_files** - Uploaded documents from providers
3. **templates** - Reusable extraction prompts and field schemas
4. **extractions** - AI extraction runs
5. **extracted_records** - Individual data records from extractions
6. **corrections** - User corrections to improve accuracy
7. **pipelines** - Automated extraction workflows (Dagster)
8. **pipeline_runs** - Execution history

### Entity Relationships

```
providers → source_files → extractions → extracted_records → corrections
                              ↑
                          templates
pipelines → pipeline_runs
```

## Running Migrations

### Apply migration to Supabase

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy contents of `migrations/001_inspector_dom_schema.sql`
4. Run the SQL

Or use Supabase CLI:
```bash
supabase link --project-ref your-project-ref
supabase db push
```

## Key Features

- **Row Level Security** - All tables have RLS policies
- **Automatic triggers** - Update timestamps, version tracking
- **Indexes** - Optimized for common queries
- **Views** - extraction_stats for analytics

## See migration file for full schema details
