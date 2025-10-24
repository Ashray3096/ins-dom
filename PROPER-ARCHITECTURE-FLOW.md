# Proper Architecture Flow Per Spec

## The Correct Three-Tier Architecture

```
┌─────────────┐
│  PROVIDERS  │  WHO provides the data?
│             │  - NABCA, TTB, Custom
└──────┬──────┘
       │
       ├─────────────────────────────────┐
       ↓                                 ↓
┌─────────────┐                   ┌─────────────┐
│   SOURCES   │  WHERE/HOW?       │   SOURCES   │
│             │                   │             │
│ S3 Bucket   │                   │ File Upload │
│ test_mode:  │                   │  manual     │
│   true      │                   │             │
│ test_limit: │                   │             │
│   10 files  │                   │             │
└──────┬──────┘                   └──────┬──────┘
       │                                 │
       ↓                                 ↓
┌─────────────┐                   ┌─────────────┐
│  ARTIFACTS  │  Actual files     │  ARTIFACTS  │
│             │                   │             │
│ file1.pdf   │                   │ manual.pdf  │
│ file2.pdf   │                   │             │
│ ...10 files │                   │             │
└─────────────┘                   └─────────────┘
```

## User Flow Per Spec

### Step 1: Create Provider
**Page:** `/dashboard/providers`

User creates a provider:
- Name: "NABCA Pennsylvania"
- Type: NABCA
- Description: "Pennsylvania state data"

### Step 2: Configure Sources (MISSING - WE NEED TO BUILD THIS!)
**Page:** `/dashboard/sources` (needs to be rebuilt)

User creates sources for this provider:

#### Source A: S3 Bucket (Test Mode)
```json
{
  "name": "NABCA S3 - Test Mode",
  "source_type": "s3_bucket",
  "configuration": {
    "bucket": "nabca-data",
    "prefix": "pennsylvania/",
    "pattern": "*.pdf",
    "test_mode": true,
    "test_limit": 10
  }
}
```
**Purpose:** Process only 10 PDFs first to test extraction

#### Source B: Manual File Upload
```json
{
  "name": "Manual NABCA Uploads",
  "source_type": "file_upload",
  "configuration": {
    "upload_type": "manual"
  }
}
```
**Purpose:** Upload individual files manually

#### Source C: URL Source
```json
{
  "name": "NABCA Monthly Report",
  "source_type": "url",
  "configuration": {
    "url": "https://nabca.com/reports/latest.pdf"
  }
}
```
**Purpose:** Fetch from a URL automatically

### Step 3: View/Upload Artifacts
**Page:** `/dashboard/artifacts`

User selects a **SOURCE** (not provider):
- If source is "Manual NABCA Uploads" → Show file uploader
- If source is "NABCA S3 - Test Mode" → Show sync button (process 10 files)
- If source is "NABCA Monthly Report" → Show fetch button

The artifacts table shows which source each file came from.

## What's Currently Wrong

### Current Implementation (WRONG):
```
/dashboard/providers → CREATE providers ✅
/dashboard/artifacts → SELECT provider, upload directly ❌
```

**Problem:** No source configuration layer! Can't configure:
- S3 with test_mode
- URL sources
- API sources
- Different upload configurations

### Correct Implementation (PER SPEC):
```
/dashboard/providers → CREATE providers ✅
/dashboard/sources   → CREATE/CONFIGURE sources for providers ✅
/dashboard/artifacts → SELECT source, view/upload files ✅
```

## What We Need to Build

### 1. Sources Management Page (`/dashboard/sources`)

**Features:**
- List all sources grouped by provider
- Create new source button → Opens modal with source type selector
- Source type forms:
  - **S3 Bucket**: bucket, prefix, pattern, test_mode toggle, test_limit
  - **URL**: url input
  - **API**: endpoint, method, auth settings
  - **File Upload**: Just name (config is simple)
- Edit/delete sources
- Show artifact count per source
- Sync button for S3/URL/API sources

### 2. Update Artifacts Page

**Changes needed:**
- Change dropdown from "Select Provider" to "Select Source"
- Show source info (type, configuration summary)
- File uploader only shows if source_type = 'file_upload'
- For S3/URL/API sources, show "Sync" button instead

## Example UI Flow

### Creating an S3 Source with Test Mode

1. User goes to `/dashboard/sources`
2. Clicks "Create Source"
3. Modal opens:
   ```
   Select Provider: [NABCA Pennsylvania ▼]

   Source Type: [○ URL  ○ S3 Bucket  ○ API  ○ File Upload]
   ```
4. User selects "S3 Bucket"
5. Form appears:
   ```
   Name: [NABCA PDFs - Test Mode]

   S3 Configuration:
   Bucket: [nabca-data]
   Prefix: [pennsylvania/]
   Pattern: [*.pdf]

   ☑ Test Mode (process limited files first)
   Test Limit: [10] files

   Region (optional): [us-east-1]

   [Cancel]  [Create Source]
   ```
6. User saves
7. Source appears in list with "Sync" button
8. User clicks "Sync" → Process only 10 files
9. User goes to artifacts page → Sees 10 files from this source
10. User goes back to sources, disables test_mode, syncs again → Processes all files

## Storage Setup

Create this bucket in Supabase Storage:

**Bucket Name:** `artifacts`
**Settings:**
- Public: No (private)
- File size limit: 10MB
- Allowed MIME types: application/pdf, text/html, message/rfc822, application/json

**RLS Policies:**
```sql
-- Users can upload to their own provider folders
CREATE POLICY "Users can upload artifacts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'artifacts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can read their own artifacts
CREATE POLICY "Users can read their artifacts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'artifacts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## Next Steps

1. ✅ Create `artifacts` bucket in Supabase Storage
2. ✅ Build Sources management page
3. ✅ Update Artifacts page to select sources
4. ⏭️ Implement S3 sync (with test_mode support)
5. ⏭️ Implement URL fetch
6. ⏭️ Implement API sync

## Summary

**The key insight:** Sources are the CONFIGURATION layer that tells the system WHERE and HOW to get data. This is what enables:
- Test mode (process 10 files before all)
- Multiple data sources for same provider
- Scheduled syncs
- Different authentication methods

Without the Sources layer, you can only do manual uploads!
