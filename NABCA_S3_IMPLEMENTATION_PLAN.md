# S3-Native NABCA Template System - Implementation Plan

## Current State

**Existing Infrastructure** ✅:
- Sources page with S3 configuration
- S3 sync operation (but downloads files)
- Artifacts table with proper schema
- Template generation system
- S3 client utilities

**Current Problem** ❌:
- Sync downloads entire PDFs and stores as base64 in database
- 2.5 MB PDF → 3.3 MB in database
- Slow sync operations (2-5 minutes)
- Database bloat

---

## The Complete Plan

### Phase 1: Fix S3 Sync to Skip Downloads

**File**: `/src/app/api/sources/[id]/sync/route.ts`

**Changes**:
1. **For PDFs**: Skip download, store only metadata reference
   - No `getS3Object()` call
   - Set `raw_content = null`
   - Set `file_path = null` (no Supabase storage)
   - Store S3 reference in `metadata`:
     ```json
     {
       "s3_key": "raw-pdfs/631_9L_0225.PDF",
       "s3_bucket": "nabca-data",
       "s3_region": "us-east-1",
       "s3_last_modified": "2025-02-01T00:00:00Z",
       "s3_etag": "abc123"
     }
     ```

2. **For HTML/JSON**: Keep existing behavior (download and store)
   - These files are small (< 100 KB typically)
   - Need content for text extraction

**Result**:
- Sync completes in 5-10 seconds instead of 2-5 minutes
- Database stays small (1 KB metadata vs 3.3 MB base64)

---

### Phase 2: Create File Storage Abstraction Layer

**New File**: `/src/lib/file-storage-service.ts`

**Purpose**: Unified interface to read files from S3 or Supabase Storage

```typescript
class FileStorageService {
  // Get file buffer (for processing)
  async getFile(artifact: Artifact): Promise<Buffer>

  // Get file URL (for download/preview)
  async getFileUrl(artifact: Artifact, expiresIn?: number): Promise<string>

  // Get file metadata
  async getFileMetadata(artifact: Artifact): Promise<FileMetadata>
}
```

**Implementation**:
- Check `artifact.metadata?.s3_key`
  - If exists → read from S3
  - If not → read from Supabase Storage (`artifact.file_path`)
- Generate presigned URLs for S3 files (1-hour expiry)
- Cache URLs in memory (optional optimization)

---

### Phase 3: Update Template Generation to Use Storage Service

**Files to Modify**:
1. `/src/app/api/templates/generate/route.ts` (or wherever template generation happens)
2. Any code that reads `artifact.raw_content.base64`

**Changes**:
```typescript
// OLD CODE:
const pdfBuffer = Buffer.from(artifact.raw_content.base64, 'base64');

// NEW CODE:
const fileService = new FileStorageService();
const pdfBuffer = await fileService.getFile(artifact);
```

**Benefits**:
- Works transparently with both S3 and Supabase-stored files
- No breaking changes to existing uploaded files
- Template generation doesn't care where file lives

---

### Phase 4: Add NABCA Template Generation Workflow

**New File**: `/src/app/api/templates/generate-nabca/route.ts`

**Purpose**: Specialized endpoint for NABCA multi-table template generation

**Request**:
```json
{
  "artifactId": "uuid",
  "templateName": "NABCA - February 2025",
  "pageRanges": {
    "brand_leaders": { "start": 3, "end": 4 },
    "current_month_sales": { "start": 5, "end": 6 },
    "ytd_sales": { "start": 7, "end": 8 },
    "rolling_12_month": { "start": 9, "end": 10 },
    "brand_summary": { "start": 11, "end": 346 },
    "vendor_top100": { "start": 365, "end": 366 },
    "vendor_top20_by_class": { "start": 367, "end": 373 },
    "control_states": { "start": 375, "end": 754 }
  }
}
```

**Process**:
1. Get artifact from database
2. Verify it's S3-stored PDF
3. For each page range:
   - Extract pages using `pdf-lib` (already exists)
   - Upload extracted PDF chunk to temp S3 location (or use in-memory)
   - Call Textract async API with S3 reference
   - Poll for results
   - Generate AI extraction rules
4. Combine all 8 sections into single template:
   ```json
   {
     "name": "NABCA - February 2025",
     "extraction_method": "textract",
     "sections": [
       {
         "name": "Brand Leaders",
         "pageRange": { "start": 3, "end": 4 },
         "selectors": { ... },
         "fields": [ ... ]
       },
       // ... 7 more sections
     ]
   }
   ```

**Time Estimate**: 3-5 minutes total (vs 15-20 min for full PDF)

---

### Phase 5: Update Artifacts UI

**File**: Wherever artifacts are displayed (probably `/src/app/dashboard/artifacts/page.tsx` or similar)

**Changes**:

1. **Add Storage Type Badge**:
   ```tsx
   {artifact.metadata?.s3_key ? (
     <Badge variant="blue">S3: {source.name}</Badge>
   ) : (
     <Badge variant="green">Uploaded</Badge>
   )}
   ```

2. **Conditional Action Buttons**:
   ```tsx
   {artifact.metadata?.s3_key && artifact.artifact_type === 'pdf' ? (
     <Button onClick={() => openNabcaTemplateModal(artifact)}>
       Generate NABCA Template
     </Button>
   ) : (
     <Button onClick={() => openStandardTemplateModal(artifact)}>
       Generate Template
     </Button>
   )}
   ```

3. **Download Button**:
   - For S3 files: Generate presigned URL
   - For uploaded files: Use existing Supabase Storage download

---

### Phase 6: Create NABCA Template Generation Modal

**New Component**: `/src/components/templates/nabca-template-modal.tsx`

**UI**:
```
┌─────────────────────────────────────────────────┐
│ Generate NABCA Template                         │
│                                                 │
│ File: 631_9L_0225.PDF (2,532 KB)              │
│ Source: NABCA PDFs (S3)                        │
│                                                 │
│ Template Name:                                  │
│ [NABCA - February 2025                     ]   │
│                                                 │
│ Page Range Configuration:                      │
│ ☑ Table 1: Brand Leaders                       │
│   Pages: [3  ] to [4  ]                        │
│                                                 │
│ ☑ Table 2: Current Month Sales                 │
│   Pages: [5  ] to [6  ]                        │
│                                                 │
│ ☑ Table 3: YTD Sales                           │
│   Pages: [7  ] to [8  ]                        │
│                                                 │
│ ☑ Table 4: Rolling 12-Month Sales              │
│   Pages: [9  ] to [10 ]                        │
│                                                 │
│ ☑ Table 5: Brand Summary (CORE)                │
│   Pages: [11 ] to [346]                        │
│                                                 │
│ ☑ Table 6: Vendor Top 100                      │
│   Pages: [365] to [366]                        │
│                                                 │
│ ☑ Table 7: Vendor Top 20 by Class              │
│   Pages: [367] to [373]                        │
│                                                 │
│ ☑ Table 8: Control States                      │
│   Pages: [375] to [754]                        │
│                                                 │
│ [ Cancel ]              [ Generate Template ]  │
└─────────────────────────────────────────────────┘
```

**Features**:
- Pre-filled with default NABCA page ranges
- Allow user to adjust ranges if needed
- Toggle sections on/off
- Show progress during generation (8 progress bars, one per table)

---

### Phase 7: Update Textract Client for S3 Support

**File**: `/src/lib/textract-client.ts`

**Changes**:
Add support for S3-based document analysis:

```typescript
export async function processDocumentFromS3(
  s3Bucket: string,
  s3Key: string,
  options: {
    featureTypes: FeatureType[];
    region?: string;
  }
): Promise<Block[]> {
  // Start async job
  const startCommand = new StartDocumentAnalysisCommand({
    DocumentLocation: {
      S3Object: {
        Bucket: s3Bucket,
        Name: s3Key,
      },
    },
    FeatureTypes: options.featureTypes,
  });

  const { JobId } = await textractClient.send(startCommand);

  // Poll for completion
  const blocks = await pollForJobCompletion(JobId);

  return blocks;
}
```

**Note**: Based on our test, this is already proven to work!

---

### Phase 8: Update Entity Management

**No changes needed!** Current entity system already works with templates.

The template will have:
```json
{
  "sections": [
    {
      "name": "Brand Leaders",
      "fields": [
        { "name": "brand_name", "type": "string" },
        { "name": "volume", "type": "number" }
      ]
    }
  ]
}
```

When creating entities:
- User can select which section to create entity from
- Import fields from that section
- Map to database columns

---

### Phase 9: Pipeline Generation (Future - Out of Scope for Now)

**Not implementing yet**, but plan:
- Pipeline reads template sections
- For each new file in S3 source:
  - Extract all 8 page ranges
  - Process each with template rules
  - Insert into 8 different entity tables

---

## Complete Workflow (End-to-End)

### Step 1: Configure S3 Source (Already Done)
```
Sources Page → "NABCA PDFs"
Type: S3 Bucket
Bucket: nabca-data
Prefix: raw-pdfs/
Status: Connected
```

### Step 2: Sync Files
```
Click [Sync Now]
→ API lists S3 objects
→ Creates artifact records (metadata only, no download)
→ Takes 5-10 seconds for 10 files
```

### Step 3: View Artifacts
```
Artifacts Page:

📄 631_9L_0225.PDF
   S3: NABCA PDFs | 2,532 KB
   [Generate NABCA Template] [Download] [Delete]
```

### Step 4: Generate NABCA Template
```
Click [Generate NABCA Template]
→ Modal opens with 8 table configurations
→ Adjust page ranges if needed
→ Click [Generate Template]

Progress shown:
✓ Brand Leaders (2 pages) - 15s
✓ Current Month Sales (2 pages) - 15s
✓ YTD Sales (2 pages) - 15s
⏳ Rolling 12-Month (2 pages) - processing...
⏳ Brand Summary (336 pages) - pending...
```

### Step 5: Review Template
```
Templates Page → "NABCA - February 2025"

Sections: 8
Total Fields: 150+
Status: Ready

[View Details] [Create Entities] [Test Extraction]
```

### Step 6: Create Entities (Existing Flow)
```
For each section:
  → Create entity (e.g., "nabca_brand_leaders")
  → Import fields from section
  → Map to database columns
  → Save
```

### Step 7: Generate Pipeline (Future)
```
→ One pipeline processes all 8 sections
→ Reads template configuration
→ Processes all S3 files automatically
```

---

## Database Schema (No Changes Needed!)

Current `artifacts` table already supports this:

```sql
CREATE TABLE artifacts (
  id UUID PRIMARY KEY,
  source_id UUID REFERENCES sources(id),
  artifact_type TEXT,
  file_path TEXT,              -- NULL for S3 files
  file_size BIGINT,
  original_filename TEXT,
  raw_content JSONB,           -- NULL for S3 PDFs
  metadata JSONB,              -- Contains s3_key, s3_bucket, etc.
  extraction_status TEXT,
  created_by UUID
);
```

**For S3 PDFs**:
- `file_path` = NULL
- `raw_content` = NULL
- `metadata.s3_key` = "raw-pdfs/631_9L_0225.PDF"
- `metadata.s3_bucket` = "nabca-data"
- `metadata.s3_region` = "us-east-1"

**For Uploaded Files**:
- `file_path` = "artifacts/uuid/file.pdf"
- `raw_content.base64` = "base64data..."
- `metadata` = file metadata only

---

## Implementation Order

1. **Phase 1**: Fix sync route (30 min)
   - Modify sync to skip PDF downloads
   - Test with S3 source

2. **Phase 2**: Create storage service (45 min)
   - Build abstraction layer
   - Add S3 client methods
   - Add presigned URL generation

3. **Phase 3**: Update existing template generation (30 min)
   - Replace direct `raw_content` access
   - Use storage service
   - Test with both S3 and uploaded files

4. **Phase 4**: Build NABCA template endpoint (2 hours)
   - Create specialized API route
   - Implement page range extraction
   - Integrate with Textract async API
   - Handle 8 sections
   - Combine into single template

5. **Phase 5**: Update artifacts UI (1 hour)
   - Add storage badge
   - Add NABCA template button
   - Update download logic

6. **Phase 6**: Create NABCA modal (1.5 hours)
   - Build UI component
   - Add page range configuration
   - Add progress tracking
   - Handle errors

7. **Phase 7**: Update Textract client (30 min)
   - Add S3 document processing
   - Add pagination handling
   - Add error handling

**Total Estimated Time**: 6-7 hours

---

## What Stays The Same

**No Changes Needed**:
- ✅ Sources page and configuration
- ✅ Database schema (already supports this)
- ✅ Existing upload flow
- ✅ Entity management
- ✅ Template viewing
- ✅ Pipeline deployment (future feature)

**Backward Compatible**:
- ✅ Existing uploaded files still work
- ✅ Existing templates still work
- ✅ Existing entities still work

---

## Testing Plan

1. **Test S3 sync**: Sync 10 files, verify no downloads, check metadata
2. **Test storage service**: Read S3 file, read uploaded file
3. **Test template generation**: Generate template from S3 PDF
4. **Test NABCA workflow**: Generate 8-section template
5. **Test downloads**: Download S3 file via presigned URL
6. **Test backward compatibility**: Verify existing uploads still work

---

## Success Metrics

**Performance**:
- ✅ Sync 10 files in < 10 seconds (vs 2-5 minutes)
- ✅ NABCA template generation in 3-5 minutes (vs 15-20 minutes)
- ✅ Database size: 10 KB per artifact (vs 3 MB)

**Functionality**:
- ✅ Can sync S3 files without downloading
- ✅ Can generate templates from S3 files
- ✅ Can download S3 files via presigned URLs
- ✅ Existing uploaded files still work
- ✅ 8-section NABCA template created successfully

---

## Risks and Mitigations

**Risk 1**: S3 credentials/permissions
- **Mitigation**: Use environment variables, test connection before sync

**Risk 2**: Textract API rate limits
- **Mitigation**: Process sections sequentially, add retry logic

**Risk 3**: Large page ranges (336 pages for Brand Summary)
- **Mitigation**: Tested with 772-page PDF, works fine with async API

**Risk 4**: Breaking existing uploads
- **Mitigation**: Storage service checks both paths, backward compatible

**Risk 5**: Presigned URL expiry
- **Mitigation**: 1-hour expiry, regenerate on-demand if expired

---

## Status: Ready for Implementation

**Test Validation**: ✅ S3 Textract async API proven to work (11.4 minutes for 700+ page PDF)

**Next Steps**: Begin Phase 1 implementation
