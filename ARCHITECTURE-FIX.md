# Architecture Fix: Aligning with Spec

## Summary

This document describes the architecture changes made to align the codebase with the spec's three-tier architecture:

```
OLD (Incorrect):
providers → artifacts (direct reference via provider_id)

NEW (Correct per Spec):
providers → sources (configuration) → artifacts (files)
```

## What Was Changed

### 1. Database Migrations

#### `supabase/migrations/004_create_sources_table.sql`
- **Created**: `sources` table per spec section 3
- **Purpose**: Configuration layer defining WHERE data comes from
- **Fields**:
  - `source_type`: 'url' | 's3_bucket' | 'api' | 'file_upload'
  - `configuration`: JSONB (URL, S3 settings with test_mode, API credentials, etc.)
  - `is_active`: Enable/disable sources
  - `last_sync_at`: Track sync status

#### `supabase/migrations/005_update_artifacts_reference_sources.sql`
- **Added**: `source_id` column to artifacts table
- **Updated**: RLS policies to work through sources → providers chain
- **Included**: Migration helper function `migrate_artifacts_to_sources()`
- **Note**: Keeps `provider_id` temporarily for backward compatibility

### 2. TypeScript Types

#### `src/types/artifacts.ts`
- Changed `provider_id` → `source_id`
- Updated nested relationship: `artifact.source.provider` instead of `artifact.provider`

#### `src/types/sources.ts`
- Added complete Source interfaces
- Added configuration types for all 4 source types
- Includes `test_mode` and `test_limit` for S3 sources

### 3. API Endpoints

#### `src/app/api/sources/route.ts` (Replaced)
- **OLD**: Worked with `source_files` table (Phase 1 - not in spec)
- **NEW**: Works with `sources` table (configuration layer)
- **GET**: List source configurations with filters
- **POST**: Create new source configuration

#### `src/app/api/sources/[id]/route.ts` (Replaced)
- **GET**: Get single source configuration
- **PUT**: Update source configuration
- **DELETE**: Delete source (prevents deletion if artifacts exist)

#### `src/app/api/artifacts/route.ts` (Updated)
- Updated query to join: `artifacts → sources → providers`
- Added `source_id` filter
- Provider filter now works through sources relationship

#### `src/app/api/upload/route.ts` (Updated)
- **NEW**: Accepts `sourceId` OR `providerId`
- **Logic**: If providerId provided, finds or creates a `file_upload` source automatically
- **Result**: Creates artifact with `source_id` reference

### 4. UI Components

#### `src/app/dashboard/artifacts/page.tsx` (Updated)
- Updated to display source type (e.g., "via file_upload")
- Works with new artifact.source.provider nested structure

## Why This Change Was Necessary

### Problems with Old Architecture:
1. ❌ **No configuration layer** - Can't support different source types (URL, S3, API)
2. ❌ **No test_mode support** - Can't test with limited files before processing all
3. ❌ **Artifacts referenced providers directly** - Violated spec's three-tier design
4. ❌ **Confusion with source_files table** - Had two different "sources" concepts

### Benefits of New Architecture:
1. ✅ **Follows spec exactly** - Three-tier: providers → sources → artifacts
2. ✅ **Supports all source types** - URL, S3 (with test_mode), API, file_upload
3. ✅ **Test mode for S3** - Process only N files in test mode before full sync
4. ✅ **Clear separation** - Configuration (sources) vs. files (artifacts)
5. ✅ **Extensible** - Easy to add new source types

## How to Run Migrations

### Step 1: Run Database Migrations

In Supabase SQL Editor, run these in order:

```sql
-- 1. Create sources table
-- Run: supabase/migrations/004_create_sources_table.sql

-- 2. Update artifacts table
-- Run: supabase/migrations/005_update_artifacts_reference_sources.sql
```

### Step 2: Migrate Existing Data (if any)

If you have existing artifacts with `provider_id` but no `source_id`:

```sql
-- Run the migration helper function
SELECT migrate_artifacts_to_sources();

-- This will:
-- 1. Find all artifacts with provider_id but no source_id
-- 2. Create or find a file_upload source for each provider
-- 3. Update artifacts to reference that source
```

### Step 3: Verify Migration

```sql
-- Check that all artifacts have source_id
SELECT COUNT(*) FROM artifacts WHERE source_id IS NULL;
-- Should return 0

-- Check sources were created
SELECT * FROM sources;
-- Should see file_upload sources for each provider

-- Verify relationships work
SELECT
  a.id,
  a.original_filename,
  s.name as source_name,
  s.source_type,
  p.name as provider_name
FROM artifacts a
JOIN sources s ON s.id = a.source_id
JOIN providers p ON p.id = s.provider_id
LIMIT 10;
```

### Step 4: (Optional) Clean Up After Migration

Once verified, you can make source_id required and remove provider_id:

```sql
-- Make source_id required
ALTER TABLE artifacts ALTER COLUMN source_id SET NOT NULL;

-- Drop old provider_id column
ALTER TABLE artifacts DROP COLUMN provider_id;
```

## Testing Checklist

### 1. Test Provider → Source → Artifact Flow

#### A. Create Provider
```bash
# Use existing provider or create new one via UI
```

#### B. Upload File (Automatic Source Creation)
- Go to `/dashboard/artifacts`
- Select a provider
- Upload a PDF file
- **Expected**: Should automatically create a `file_upload` source if none exists
- **Expected**: Artifact should be created with `source_id` reference

#### C. Verify in Database
```sql
-- Check source was created
SELECT * FROM sources WHERE source_type = 'file_upload';

-- Check artifact references source
SELECT
  a.original_filename,
  s.name as source_name,
  p.name as provider_name
FROM artifacts a
JOIN sources s ON s.id = a.source_id
JOIN providers p ON p.id = s.provider_id;
```

### 2. Test Sources API

#### List Sources
```bash
curl -X GET 'http://localhost:3000/api/sources?provider_id=<PROVIDER_ID>' \
  -H 'Cookie: <session-cookie>'
```

#### Create Source (S3 with Test Mode)
```bash
curl -X POST 'http://localhost:3000/api/sources' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <session-cookie>' \
  -d '{
    "provider_id": "<PROVIDER_ID>",
    "name": "S3 NABCA PDFs - Test Mode",
    "source_type": "s3_bucket",
    "configuration": {
      "bucket": "my-bucket",
      "prefix": "nabca/",
      "pattern": "*.pdf",
      "test_mode": true,
      "test_limit": 10
    }
  }'
```

#### Update Source
```bash
curl -X PUT 'http://localhost:3000/api/sources/<SOURCE_ID>' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <session-cookie>' \
  -d '{
    "configuration": {
      "bucket": "my-bucket",
      "prefix": "nabca/",
      "pattern": "*.pdf",
      "test_mode": false
    }
  }'
```

### 3. Test Artifacts API

#### List Artifacts by Source
```bash
curl -X GET 'http://localhost:3000/api/artifacts?source_id=<SOURCE_ID>' \
  -H 'Cookie: <session-cookie>'
```

#### List Artifacts by Provider (should still work)
```bash
curl -X GET 'http://localhost:3000/api/artifacts?provider_id=<PROVIDER_ID>' \
  -H 'Cookie: <session-cookie>'
```

### 4. Test Upload API

#### Upload with Provider ID (auto-creates source)
```bash
curl -X POST 'http://localhost:3000/api/upload' \
  -H 'Cookie: <session-cookie>' \
  -F 'file=@test.pdf' \
  -F 'providerId=<PROVIDER_ID>'
```

#### Upload with Source ID (direct)
```bash
curl -X POST 'http://localhost:3000/api/upload' \
  -H 'Cookie: <session-cookie>' \
  -F 'file=@test.pdf' \
  -F 'sourceId=<SOURCE_ID>'
```

## Breaking Changes

### For Existing Artifacts

If you have existing artifacts in the database:
1. They currently have `provider_id` but no `source_id`
2. **Must run migration function**: `SELECT migrate_artifacts_to_sources();`
3. This will create `file_upload` sources and link artifacts to them

### For Frontend Code

- Artifact interface changed from `artifact.provider` to `artifact.source.provider`
- Upload flow now creates sources automatically (backward compatible with providerId)

### For API Clients

- Upload API still accepts `providerId` for backward compatibility
- Artifacts API still supports filtering by `provider_id`
- But internally everything works through sources now

## Next Steps

1. ✅ **Run migrations** (004 and 005)
2. ✅ **Run data migration function** (if existing artifacts)
3. ⏭️ **Build Source Management UI** (create/edit sources with different types)
4. ⏭️ **Implement S3 Source Processing** (with test_mode support)
5. ⏭️ **Test complete flow** with all source types

## Future Enhancements

With the sources layer now in place, we can implement:

1. **URL Sources**: Fetch PDFs from URLs
2. **S3 Sources with Test Mode**: Process 10 files first, then all
3. **API Sources**: Pull data from external APIs
4. **Scheduled Sync**: Sync sources on schedule (daily, weekly, etc.)
5. **Source Status Tracking**: Track when each source was last synced

## Questions?

If anything is unclear or needs adjustment, please let me know!
