# NABCA Multi-Entity Pipeline - Implementation Status

## ✅ Phase 1: Foundation (COMPLETED)

### 1. Database Schema
**File:** `supabase/migrations/009_add_multi_entity_pipeline_support.sql`
- ✅ Added `target_entities[]` - array of entity names
- ✅ Added `is_multi_entity` - boolean flag
- ✅ Added check constraint (mutually exclusive: entity_id OR target_entities)
- ✅ Created indexes for lookups
- ✅ Backward compatible with existing pipelines

### 2. Template Configuration
**File:** `src/lib/nabca-template-config.ts`
- ✅ Defined all 8 NABCA table identification patterns
- ✅ Required headers for each table (e.g., "BRAND", "Type", "Rank" for Table 1)
- ✅ Fuzzy matching thresholds (0.75)
- ✅ Column count ranges for validation
- ✅ Linked to field schemas from `nabca-field-schemas.ts`

### 3. Table Identification Functions
**File:** `src/lib/nabca-table-identification.ts`
- ✅ Levenshtein distance algorithm for fuzzy string matching
- ✅ `findHeaderRow()` - Scans data array to locate headers (position-agnostic)
- ✅ `identifyTable()` - Matches tables against patterns with confidence scoring
- ✅ `extractHeaderMapping()` - Maps textract headers to database fields
- ✅ `mapRowToFields()` - Converts data rows to database records
- ✅ `extractNabcaTables()` - Main orchestrator function

**Features:**
- Works regardless of header row position (row 0, 3, 5, etc.)
- Fuzzy matching handles OCR errors
- Confidence scoring (0-1) for validation
- Handles multi-row headers
- Type conversion (TEXT/NUMBER/DATE)

### 4. Auto-Setup API
**File:** `src/app/api/templates/generate-nabca-multi/route.ts`
- ✅ Authentication with Supabase Auth
- ✅ Auto-creates 8 entities (raw_nabca_table_1...8) with correct schemas
- ✅ Creates multi-entity template with table patterns embedded
- ✅ Checks for existing entities (idempotent)
- ✅ Proper error handling

**Usage:**
```bash
POST /api/templates/generate-nabca-multi
Body: { "template_name": "NABCA All Tables" }
```

**Response:**
```json
{
  "success": true,
  "template": { "id": "...", "name": "NABCA All Tables" },
  "entities": {
    "created": ["raw_nabca_table_1", ...],
    "existing": [],
    "total": 8
  },
  "summary": { "message": "...", "totalEntities": 8 }
}
```

---

## ⏳ Phase 2: Pipeline Generation (NOT STARTED)

### What's Needed:

1. **Pipeline Generator Extension**
   - Detect `is_multi_entity` templates in pipeline creation flow
   - Generate Python code with embedded template config
   - Port table identification logic to Python

2. **Filename Parsing for Report Month/Year** ⭐
   - Parse NABCA filename format: `NABCA_YYYY_MM.pdf` or similar
   - Extract report_month and report_year
   - Add these fields to EVERY row inserted (all 8 tables)
   - Example: `NABCA_2024_03.pdf` → report_year='2024', report_month='03'

3. **Async Textract Integration**
   - Use `start_document_analysis` API (not sync API)
   - Poll job status (5-second intervals)
   - Retrieve paginated results (handle 820+ pages)
   - Stream processing (don't load 1.3GB in memory)

4. **Multi-Entity Data Loading**
   - Identify tables using ported identification logic
   - Route data to correct entities
   - Add report_month/report_year to each row
   - Batch inserts (every 100 rows)
   - Progress logging

5. **Dagster Asset**
   - Extended timeout (2+ hours for 718-page PDFs)
   - Proper error handling
   - Retry logic for Textract failures

---

## 🧪 Testing Phase 1 (Foundation Only)

### Test From Browser (Authenticated)

1. **Open Browser Dev Tools Console:**
```javascript
fetch('/api/templates/generate-nabca-multi', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ template_name: 'NABCA All Tables Test' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

2. **Verify Results:**
   - Check response shows `success: true`
   - Check `entities.created` shows 8 entity names
   - Go to Entities page in app - should see 8 new NABCA entities
   - Go to Templates page - should see new multi-entity template

3. **Check Database (if you have access):**
```sql
-- Check entities
SELECT name, display_name FROM entities
WHERE name LIKE 'raw_nabca_table_%'
ORDER BY name;

-- Check template
SELECT id, name, selectors->'isMultiEntity' as is_multi
FROM templates
WHERE name LIKE '%NABCA%';
```

---

## 📋 Next Steps

### Option A: Continue Implementation (Pipeline Generator)
**Time Required:** ~30-40 minutes
**Deliverables:**
- Multi-entity pipeline generator
- Python table identification code
- Async Textract integration
- End-to-end working pipeline

### Option B: Test Foundation & Fix Issues First
**Time Required:** ~10-15 minutes
**Deliverables:**
- Verify entities/template creation works
- Fix any schema/RLS issues
- Confirm foundation is solid before continuing

---

## 🔧 Implementation Notes

### Key Design Decisions:

1. **Position-Agnostic Header Detection**
   - Scans all rows (not just row 0)
   - Handles variable header positions across PDFs
   - Fuzzy matching threshold: 0.75 (75% similarity)

2. **No Data Storage**
   - Template stores patterns only (not data)
   - Textract results processed in-memory
   - Streaming approach for large PDFs

3. **Multi-Entity Architecture**
   - ONE pipeline → 8 entities
   - ONE Textract call per PDF
   - Cost savings: ~7x reduction

4. **Backward Compatibility**
   - Existing single-entity pipelines unaffected
   - New columns are nullable with defaults
   - Check constraint enforces correctness

### Current Limitations:

1. ❌ No UI button yet (test via browser console)
2. ❌ Pipeline generator doesn't support multi-entity templates
3. ❌ No async Textract integration
4. ❌ Can't handle 718-page PDFs yet (will add streaming)

### Files Created:

```
src/lib/nabca-template-config.ts          (170 lines)
src/lib/nabca-table-identification.ts     (320 lines)
src/app/api/templates/generate-nabca-multi/route.ts  (150 lines)
supabase/migrations/009_add_multi_entity_pipeline_support.sql  (26 lines)
test-nabca-setup.sh                       (test script)
```

---

## 💡 Recommendations

**For Testing:**
- Test Phase 1 first (foundation)
- Verify entities/template creation works correctly
- Check field schemas match expectations
- Then proceed to Phase 2 (pipeline generation)

**For Production:**
- Start with small PDFs (10-50 pages) for validation
- Verify table identification accuracy
- Then scale to large PDFs (718 pages) with streaming
- Monitor Textract costs ($50/1000 pages)

---

## 📞 Support

If you encounter issues:
1. Check browser console for detailed error messages
2. Verify you're logged in (authentication required)
3. Check Supabase RLS policies
4. Review entity/template schemas in database

Current implementation provides:
- ✅ Solid foundation for multi-entity extraction
- ✅ Table identification logic (TypeScript)
- ✅ Auto-setup endpoint
- ⏳ Pipeline generation (next step)
- ⏳ Async Textract (next step)
