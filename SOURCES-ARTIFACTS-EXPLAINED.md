# How Sources and Artifacts Work Together

## TL;DR

**Sources = CONFIGURATION (WHERE to get data)**
**Artifacts = ACTUAL FILES (WHAT was collected)**

---

## The Relationship

```
┌─────────────────┐
│    PROVIDER     │  NABCA Pennsylvania
│  (WHO owns it)  │
└────────┬────────┘
         │
         ├──────────────────────────────────┬─────────────────────────────────┐
         ↓                                  ↓                                 ↓
┌─────────────────┐              ┌─────────────────┐             ┌─────────────────┐
│    SOURCE 1     │              │    SOURCE 2     │             │    SOURCE 3     │
│  Configuration  │              │  Configuration  │             │  Configuration  │
│                 │              │                 │             │                 │
│  Type: S3       │              │  Type: URL      │             │  Type: Manual   │
│  Bucket: xyz    │              │  URL: https://  │             │  Upload files   │
│  test_mode: ON  │              │  ...monthly.pdf │             │  manually       │
│  test_limit: 10 │              │                 │             │                 │
└────────┬────────┘              └────────┬────────┘             └────────┬────────┘
         │                                │                                │
         │ SYNC CREATES ↓                 │ FETCH CREATES ↓                │ UPLOAD CREATES ↓
         │                                │                                │
    ┌────┴────┐                      ┌────┴────┐                      ┌────┴────┐
    ↓         ↓                      ↓         ↓                      ↓         ↓
┌─────┐   ┌─────┐                ┌─────┐   ┌─────┐                ┌─────┐   ┌─────┐
│ PDF │   │ PDF │  (10 files)    │ PDF │   │ PDF │                │ PDF │   │ PDF │
│file1│   │file2│                │monthly  │monthly               │manual│  │upload│
└─────┘   └─────┘                │jan.pdf  │feb.pdf               └─────┘  └─────┘
                                 └─────┘   └─────┘
    ARTIFACTS                        ARTIFACTS                        ARTIFACTS
  (Actual files)                   (Actual files)                   (Actual files)
```

---

## Example 1: S3 Source with Test Mode

### Step 1: Configure the Source

You create a source:
```json
{
  "name": "NABCA S3 - Test Mode",
  "provider_id": "...",
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

**At this point:**
- ✅ Source exists in database
- ❌ NO artifacts yet - nothing is in the artifacts table
- ❌ Files are NOT automatically visible

### Step 2: Sync the Source

You click "Sync" button on the Sources page. This triggers:

```javascript
// Backend process:
1. Connect to S3 bucket "nabca-data"
2. List files in "pennsylvania/" matching "*.pdf"
3. Found 500 PDFs
4. test_mode = true, test_limit = 10
5. Process only FIRST 10 files:
   - Download file1.pdf from S3
   - Upload to Supabase Storage
   - Create artifact record with source_id
   - Download file2.pdf from S3
   - Upload to Supabase Storage
   - Create artifact record with source_id
   - ... repeat for 10 files
6. Stop (because test_mode)
```

**After sync:**
- ✅ Source still configured the same
- ✅ 10 artifacts created (in `artifacts` table)
- ✅ 10 PDFs stored in Supabase Storage
- ✅ All 10 artifacts reference this source via `source_id`

### Step 3: Disable Test Mode and Re-sync

You edit the source:
```json
{
  "test_mode": false  // Changed from true
}
```

Click "Sync" again:
```javascript
// Backend process:
1. Connect to S3 bucket "nabca-data"
2. List files in "pennsylvania/" matching "*.pdf"
3. Found 500 PDFs
4. test_mode = false
5. Process ALL 500 files:
   - Skip the 10 already processed
   - Download file11.pdf from S3
   - Create artifact...
   - ... repeat for remaining 490 files
```

**After full sync:**
- ✅ 500 artifacts in database (all reference this source)
- ✅ All 500 PDFs in Supabase Storage

---

## Example 2: File Upload Source

### Step 1: Configure the Source

You create a source:
```json
{
  "name": "Manual NABCA Uploads",
  "provider_id": "...",
  "source_type": "file_upload",
  "configuration": {
    "upload_type": "manual"
  }
}
```

**At this point:**
- ✅ Source exists
- ❌ NO artifacts yet

### Step 2: Upload Files

You go to Artifacts page:
1. Select "Manual NABCA Uploads" source
2. Drag and drop 3 PDFs
3. Files upload

**After upload:**
- ✅ Source unchanged (still just configuration)
- ✅ 3 new artifacts created
- ✅ All 3 artifacts have `source_id` pointing to this source

---

## Example 3: URL Source

### Step 1: Configure the Source

```json
{
  "name": "NABCA Monthly Report",
  "source_type": "url",
  "configuration": {
    "url": "https://nabca.com/reports/latest.pdf"
  }
}
```

### Step 2: Fetch from URL

Click "Sync" button:
```javascript
// Backend:
1. Download from https://nabca.com/reports/latest.pdf
2. Upload to Supabase Storage
3. Create 1 artifact record with source_id
```

**Result:**
- ✅ 1 artifact created from URL

---

## Key Concepts

### Sources Are Templates/Instructions

A source is like a recipe:
- **S3 Source:** "Go to this bucket, get files matching this pattern, but only 10 if test mode"
- **URL Source:** "Download this file from this URL"
- **File Upload:** "Accept manual uploads"

### Artifacts Are the Results

Artifacts are the actual data:
- PDF file stored in Supabase Storage
- Record in `artifacts` table with metadata
- Links back to the source that created it

### Same Source Can Create Many Artifacts

One S3 source can create 500 artifacts (500 PDFs from that bucket).

### Multiple Sources Can Belong to One Provider

```
NABCA Provider
├── S3 Source (Test Mode) → 10 artifacts
├── S3 Source (Full Sync) → 500 artifacts
├── Manual Upload Source → 5 artifacts
└── URL Source → 1 artifact
    Total: 516 artifacts for this provider
```

---

## In the UI

### Sources Page (`/dashboard/sources`)

**Shows:** Configurations only
```
✓ NABCA S3 - Test Mode [S3 Bucket]
  Bucket: nabca-data
  🧪 Test Mode: 10 files
  [Sync] [Edit] [Delete]

✓ Manual Uploads [File Upload]
  Manual upload (manual)
  [Sync] [Edit] [Delete]
```

### Artifacts Page (`/dashboard/artifacts`)

**Shows:** Actual files
```
Select Source: [NABCA S3 - Test Mode ▼]

Uploaded Artifacts (10)
─────────────────────────────────
📄 january-sales.pdf
   PDF • 2.3 MB • via s3_bucket
   Status: pending
   [View]

📄 february-sales.pdf
   PDF • 2.1 MB • via s3_bucket
   Status: pending
   [View]

... (8 more files)
```

---

## Database Structure

```sql
-- Sources table (Configuration)
sources
├── id (UUID)
├── provider_id (WHO owns this)
├── name ("NABCA S3 - Test Mode")
├── source_type ('s3_bucket')
├── configuration (JSONB - bucket, test_mode, etc.)
└── is_active (true/false)

-- Artifacts table (Actual Files)
artifacts
├── id (UUID)
├── source_id (WHICH source created this)
├── original_filename ("january-sales.pdf")
├── file_path (path in Supabase Storage)
├── artifact_type ('pdf')
└── extraction_status ('pending')
```

**Relationship:**
```sql
artifacts.source_id → sources.id → providers.id
```

---

## Common Questions

### Q: If I configure an S3 source, do files appear immediately?

**A:** NO! Configuring a source does NOT fetch files. You must click "Sync" to actually fetch them.

### Q: What happens if I delete a source?

**A:** All artifacts from that source are also deleted (CASCADE).

### Q: Can I have multiple S3 sources from the same bucket?

**A:** Yes! You might have:
- Source 1: `bucket/2024/` (test_mode: true)
- Source 2: `bucket/2023/` (full sync)
- Source 3: `bucket/urgent/` (manual filter)

### Q: Do I need a source to upload files?

**A:** YES! The spec requires files to always belong to a source. But the UI auto-creates a `file_upload` source if you just select a provider (backward compatibility).

---

## Summary

**Sources** = Instructions/Configuration (WHERE/HOW to get data)
**Artifacts** = Results (WHAT was actually collected)

One source can produce many artifacts.
S3 sources need to be synced to create artifacts.
Test mode limits how many artifacts are created during sync.
