# Universal Architecture Migration Plan
**Strategy: Parallel Implementation with Safe Cutover**

## Overview
Build the new universal extraction architecture alongside existing functionality. Once proven stable, deprecate the old 4-button system.

---

## Phase 0: Current State (Unchanged)

### Existing 4 Buttons (Keep Working)
1. **Build Visual Template** (HTML only) → `/api/templates/visual`
2. **Build Smart Template** (PDF only) → `/api/templates/textract`
3. **Generate NABCA Template** (S3 PDF only) → `/api/templates/generate-nabca-multi`
4. **Extract Data** (AI, any artifact) → `/api/extraction/ai`

### Existing Tables (Unchanged)
- `providers` ✅
- `sources` ✅
- `artifacts` ✅
- `templates` ✅ (has `artifact_type`, `extraction_method`, `selectors` columns)
- `entities` ✅

**Strategy: Keep all 4 buttons functional during Phase 1-3. No breaking changes.**

---

## Phase 1: Foundation (Week 1-2)
**Goal: Add field library infrastructure without touching existing flows**

### 1.1 Database Schema - New Tables

#### A. `field_library` Table (New)
```sql
CREATE TABLE field_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic Info
  name TEXT NOT NULL UNIQUE,              -- 'vendor_name', 'sales_l12m'
  label TEXT NOT NULL,                    -- 'Vendor Name', 'Sales (L12M)'
  description TEXT,                       -- Human-readable description

  -- Field Properties
  field_type TEXT NOT NULL CHECK (field_type IN (
    'TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'EMAIL', 'URL', 'PHONE', 'JSON'
  )),

  -- Classification & Categorization
  classification TEXT CHECK (classification IN (
    'PII', 'PCI', 'PHI', 'PUBLIC', 'INTERNAL', 'CONFIDENTIAL'
  )),
  category TEXT,                          -- 'vendor', 'sales', 'product', 'date'
  tags TEXT[],                            -- ['supplier', 'company', 'distributor']

  -- Validation Rules (JSON)
  validation_rules JSONB,                 -- { max_length: 255, pattern: '^[A-Z]' }

  -- Transformation Pipeline (Array of transformations)
  transformations TEXT[],                 -- ['trim', 'uppercase', 'remove_commas']

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,          -- How many templates use this field
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Versioning
  version INTEGER DEFAULT 1,
  is_deprecated BOOLEAN DEFAULT FALSE,
  deprecated_reason TEXT,
  replaced_by UUID REFERENCES field_library(id)
);

-- Indexes
CREATE INDEX idx_field_library_name ON field_library(name);
CREATE INDEX idx_field_library_category ON field_library(category);
CREATE INDEX idx_field_library_tags ON field_library USING GIN(tags);
CREATE INDEX idx_field_library_created_by ON field_library(created_by);

-- RLS Policies
ALTER TABLE field_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all fields"
  ON field_library FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create fields"
  ON field_library FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own fields"
  ON field_library FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);
```

#### B. `template_fields` Table (New - Junction Table)
```sql
CREATE TABLE template_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relationships
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES field_library(id) ON DELETE CASCADE,

  -- Extraction Configuration (varies by strategy)
  extraction_config JSONB NOT NULL,
  -- Examples:
  --   table_detection:  { column_index: 3, header_match: "Vendor" }
  --   dom_selection:    { selector: "td.vendor-name", attribute: "textContent" }
  --   json_path:        { path: "$.vendors[*].name" }
  --   key_value:        { key_pattern: "Vendor.*Name" }

  -- Field-specific transformations (overrides field_library defaults)
  transformations TEXT[],

  -- Display order in template
  display_order INTEGER NOT NULL,

  -- Required field?
  is_required BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  UNIQUE(template_id, field_id)
);

CREATE INDEX idx_template_fields_template ON template_fields(template_id);
CREATE INDEX idx_template_fields_field ON template_fields(field_id);

-- RLS: Inherit from template
ALTER TABLE template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view template fields"
  ON template_fields FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_fields.template_id
    )
  );

CREATE POLICY "Users can manage template fields"
  ON template_fields FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_fields.template_id
      AND templates.created_by = auth.uid()
    )
  );
```

#### C. `entity_fields` Table (Enhanced - Add field_library reference)
```sql
-- Add field_library_id to existing entity metadata
-- Option 1: Add column to entities table
ALTER TABLE entities ADD COLUMN field_library_mapping JSONB;
-- Structure: { "field_name": "field_library_id" }

-- This allows entities to reference field definitions from library
-- Example:
-- {
--   "vendor_name": "uuid-of-vendor-name-field",
--   "sales_l12m": "uuid-of-sales-l12m-field"
-- }
```

### 1.2 Seed Field Library with NABCA Fields

Create migration script to populate field library from existing NABCA schemas:

```typescript
// supabase/migrations/XXX_seed_field_library.sql
-- Seed from existing NABCA field schemas
INSERT INTO field_library (name, label, field_type, category, description, classification, transformations)
VALUES
  -- From TABLE_1_BRAND_LEADERS
  ('report_month', 'Report Month', 'TEXT', 'date', 'Month of the report', 'PUBLIC', ARRAY['trim']),
  ('report_year', 'Report Year', 'TEXT', 'date', 'Year of the report', 'PUBLIC', ARRAY['trim']),
  ('brand_name', 'Brand Name', 'TEXT', 'product', 'Name of the brand', 'PUBLIC', ARRAY['trim']),
  ('brand_type', 'Brand Type', 'TEXT', 'product', 'Type/category of brand', 'PUBLIC', ARRAY['trim']),

  -- From TABLE_6_VENDOR_TOP_100
  ('vendor_name', 'Vendor Name', 'TEXT', 'vendor', 'Company/vendor supplying products', 'INTERNAL', ARRAY['trim', 'uppercase']),
  ('vendor_rank', 'Vendor Rank', 'NUMBER', 'vendor', 'Ranking position', 'PUBLIC', ARRAY['parse_number']),
  ('market_share', 'Market Share', 'NUMBER', 'sales', 'Percentage of market share', 'INTERNAL', ARRAY['remove_percent', 'parse_number']),
  ('sales_l12m', 'Sales (L12M)', 'NUMBER', 'sales', 'Sales for last 12 months', 'INTERNAL', ARRAY['remove_commas', 'parse_number']),

  -- Add all 80+ fields from 8 NABCA tables...
  ;
```

### 1.3 API Routes for Field Library

#### `/api/fields/route.ts` (New)
```typescript
// GET /api/fields - List all fields
// POST /api/fields - Create new field
// GET /api/fields?category=vendor - Filter by category
// GET /api/fields?search=vendor - Search by name/label/tags
```

#### `/api/fields/[id]/route.ts` (New)
```typescript
// GET /api/fields/:id - Get field details
// PUT /api/fields/:id - Update field
// DELETE /api/fields/:id - Mark as deprecated
```

#### `/api/fields/[id]/usage/route.ts` (New)
```typescript
// GET /api/fields/:id/usage - Show which templates use this field
```

### 1.4 UI: Field Library Management Page

**Route: `/dashboard/fields`** (New page)

Features:
- List all fields with search/filter
- Create new field
- Edit existing field
- View usage statistics
- Tag management
- Category filtering

**No integration with templates yet - just field CRUD operations**

### 1.5 Testing Phase 1
- [ ] Create 10 test fields via UI
- [ ] Search/filter works
- [ ] Field versioning works
- [ ] RLS policies work correctly
- [ ] Migration script runs successfully

**✅ Phase 1 Complete: Field library exists, old functionality untouched**

---

## Phase 2: New Template Builder (Week 3-4)
**Goal: Add 5th button with universal wizard**

### 2.1 Add 5th Button to Artifacts Page

**File: `/src/app/dashboard/artifacts/page.tsx`**

```typescript
// Keep existing 4 buttons:
{artifact.artifact_type === 'html' && (
  <Button onClick={() => setVisualBuilderArtifact(artifact)}>
    Build Visual Template (OLD)
  </Button>
)}

{artifact.artifact_type === 'pdf' && (
  <Button onClick={() => setTextractBuilderArtifact(artifact)}>
    Build Smart Template (OLD)
  </Button>
)}

{artifact.metadata?.s3_key && artifact.artifact_type === 'pdf' && (
  <Button onClick={() => setNabcaTemplateArtifact(artifact)}>
    Generate NABCA Template (OLD)
  </Button>
)}

<Button onClick={() => setAiExtractingArtifact(artifact)}>
  Extract Data (OLD)
</Button>

// NEW 5th BUTTON - Works for ALL artifact types!
<Button
  onClick={() => setUniversalTemplateWizard(artifact)}
  variant="default"
  className="bg-gradient-to-r from-purple-600 to-blue-600"
>
  <Wand2 className="w-4 h-4 mr-2" />
  Create Template (NEW)
</Button>
```

### 2.2 Universal Template Wizard Component

**File: `/src/components/templates/universal-wizard.tsx`** (New)

Multi-step wizard:

#### Step 1: Strategy Selection
```
┌─────────────────────────────────────────┐
│  Create Template                        │
├─────────────────────────────────────────┤
│  Artifact: NABCA_October_2024.pdf      │
│  Type: PDF                              │
│  Source: NABCA S3 Bucket                │
│                                         │
│  Select Extraction Strategy:            │
│                                         │
│  ○ Table Detection (AWS Textract)       │
│    Best for: Structured tables in PDFs  │
│    → Detects tables automatically       │
│                                         │
│  ○ Key-Value Extraction                 │
│    Best for: Forms with labels          │
│    → Finds "Label: Value" pairs         │
│                                         │
│  ○ OCR Text Extraction                  │
│    Best for: Plain text documents       │
│    → Extracts all text                  │
│                                         │
│  ○ AI-Powered Extraction                │
│    Best for: Unstructured content       │
│    → Uses Claude to understand layout   │
│                                         │
│  [Cancel]  [Next: Configure Strategy]   │
└─────────────────────────────────────────┘
```

#### Step 2: Configure Strategy (Adapts to selection)

**If Table Detection selected:**
```
┌─────────────────────────────────────────┐
│  Configure Table Detection              │
├─────────────────────────────────────────┤
│  [PDF Preview with detected tables]     │
│                                         │
│  Detected 8 tables:                     │
│  ☑ Table 1: Brand Leaders (p.3-4)       │
│  ☑ Table 2: Current Month (p.5-6)       │
│  ☑ Table 3: YTD Sales (p.7-8)           │
│  ... (expand to show all)               │
│                                         │
│  Table Identification Method:           │
│  ☑ Header matching                      │
│  ☑ Title keywords                       │
│  ☑ Sequential order                     │
│                                         │
│  [Back]  [Next: Map Fields]             │
└─────────────────────────────────────────┘
```

**If DOM Selection selected (HTML):**
```
┌─────────────────────────────────────────┐
│  Configure DOM Selection                │
├─────────────────────────────────────────┤
│  [HTML Preview with interactive overlay]│
│                                         │
│  Click elements to select:              │
│  Container: ✓ table.vendors-list        │
│  Rows: ✓ tbody > tr                     │
│                                         │
│  Current XPath:                         │
│  //table[@class='vendors-list']//tr     │
│                                         │
│  [Back]  [Next: Map Fields]             │
└─────────────────────────────────────────┘
```

#### Step 3: Field Mapping (Same for ALL strategies!)
```
┌─────────────────────────────────────────┐
│  Map Fields from Library                │
├─────────────────────────────────────────┤
│  Detected Columns:    Map to Field:     │
│                                         │
│  Column 1: "Vendor"                     │
│  └→ [Search field library...]           │
│      → vendor_name ✓                    │
│        (Used in 12 templates)           │
│                                         │
│  Column 2: "Sales Amount"               │
│  └→ [Search field library...]           │
│      → sales_l12m ✓                     │
│      → sales_current_month              │
│      → sales_ytd                        │
│                                         │
│  Column 3: "% Share"                    │
│  └→ [Search field library...]           │
│      → market_share ✓                   │
│                                         │
│  + Add field from library               │
│  + Create new field                     │
│                                         │
│  Transformations (per field):           │
│  vendor_name: [trim, uppercase]         │
│  sales_l12m: [remove_commas, parse_num] │
│                                         │
│  [Back]  [Next: Target Entity]          │
└─────────────────────────────────────────┘
```

#### Step 4: Entity Selection
```
┌─────────────────────────────────────────┐
│  Select Target Entity                   │
├─────────────────────────────────────────┤
│  Where should extracted data go?        │
│                                         │
│  ○ Existing Entity:                     │
│    [Select entity dropdown...]          │
│    → raw_nabca_table_6                  │
│    → raw_nabca_table_7                  │
│    → vendor_master                      │
│                                         │
│  ○ Create New Entity:                   │
│    Name: [vendor_sales_2024________]    │
│    Type: ○ INTERIM  ○ REFERENCE  ○ MASTER
│                                         │
│    Import fields from template? ☑ Yes   │
│    (Creates entity with same fields)    │
│                                         │
│  [Back]  [Create Template]              │
└─────────────────────────────────────────┘
```

### 2.3 New Template API Routes

#### `/api/templates/universal/route.ts` (New)
```typescript
/**
 * POST /api/templates/universal
 *
 * Creates template using field library approach
 *
 * Body:
 * {
 *   name: "NABCA Vendor Extract",
 *   artifact_id: "uuid",
 *   extraction_strategy: "table_detection",
 *   strategy_config: { ... },  // Strategy-specific config
 *   field_mappings: [
 *     {
 *       field_library_id: "uuid",
 *       extraction_config: { column_index: 3 },
 *       transformations: ["trim"]
 *     }
 *   ],
 *   target_entity_id: "uuid"
 * }
 *
 * Creates:
 * 1. Template record in templates table
 * 2. Records in template_fields junction table
 * 3. Links to field_library entries
 * 4. Optionally creates new entity
 */
```

### 2.4 Backend: Universal Extraction Engine

#### `/src/lib/extraction/universal-extractor.ts` (New)
```typescript
export interface ExtractionStrategy {
  name: string;
  execute(artifact: Artifact, config: any, fields: TemplateField[]): Promise<ExtractedData>;
}

export class UniversalExtractor {
  private strategies: Map<string, ExtractionStrategy>;

  constructor() {
    this.strategies = new Map([
      ['table_detection', new TableDetectionStrategy()],
      ['dom_selection', new DomSelectionStrategy()],
      ['json_path', new JsonPathStrategy()],
      ['key_value', new KeyValueStrategy()],
      ['ocr_text', new OcrTextStrategy()],
      ['ai_extraction', new AIExtractionStrategy()],
    ]);
  }

  async extract(
    artifact: Artifact,
    template: Template,
    templateFields: TemplateField[]
  ): Promise<ExtractedData> {
    // 1. Get strategy
    const strategy = this.strategies.get(template.extraction_method);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${template.extraction_method}`);
    }

    // 2. Execute extraction
    const rawData = await strategy.execute(
      artifact,
      template.selectors,
      templateFields
    );

    // 3. Apply field transformations
    const transformedData = await this.applyTransformations(
      rawData,
      templateFields
    );

    // 4. Validate against field rules
    const validatedData = await this.validateData(
      transformedData,
      templateFields
    );

    return validatedData;
  }

  private async applyTransformations(
    data: any[],
    fields: TemplateField[]
  ): Promise<any[]> {
    // Apply transformations from field_library
    // + template-specific overrides
  }

  private async validateData(
    data: any[],
    fields: TemplateField[]
  ): Promise<any[]> {
    // Validate against field_library validation_rules
  }
}
```

#### Strategy Implementations

**`/src/lib/extraction/strategies/table-detection.ts`** (New)
```typescript
export class TableDetectionStrategy implements ExtractionStrategy {
  async execute(
    artifact: Artifact,
    config: any,
    fields: TemplateField[]
  ): Promise<ExtractedData> {
    // 1. Call AWS Textract (existing logic)
    // 2. Identify tables using config.tablePatterns
    // 3. Map columns to fields using templateFields
    // 4. Return structured data
  }
}
```

**`/src/lib/extraction/strategies/dom-selection.ts`** (New)
```typescript
export class DomSelectionStrategy implements ExtractionStrategy {
  async execute(
    artifact: Artifact,
    config: any,
    fields: TemplateField[]
  ): Promise<ExtractedData> {
    // 1. Load HTML content
    // 2. Apply CSS selectors from templateFields
    // 3. Extract values
    // 4. Return structured data
  }
}
```

**`/src/lib/extraction/strategies/json-path.ts`** (New)
```typescript
export class JsonPathStrategy implements ExtractionStrategy {
  async execute(
    artifact: Artifact,
    config: any,
    fields: TemplateField[]
  ): Promise<ExtractedData> {
    // 1. Parse JSON content
    // 2. Apply JSONPath queries from templateFields
    // 3. Extract values
    // 4. Return structured data
  }
}
```

### 2.5 Testing Phase 2
- [ ] Create template from PDF using 5th button
- [ ] Create template from HTML using 5th button
- [ ] Create template from JSON using 5th button
- [ ] Field mapping works correctly
- [ ] Strategy-specific config saved correctly
- [ ] Template uses field_library references
- [ ] Old 4 buttons still work

**✅ Phase 2 Complete: Universal template creation works, coexists with old system**

---

## Phase 3: Universal Pipeline Generator (Week 5-6)
**Goal: Generate Dagster pipelines that use universal extractor**

### 3.1 Enhanced Pipeline Config Schema

```typescript
// Pipeline now supports templates created via universal wizard
interface PipelineConfig {
  id: string;
  name: string;
  sources: SourceConfig[];
  isUniversal: boolean; // NEW FLAG!
}

interface SourceConfig {
  source_id: string;
  templates: TemplateConfig[];
}

interface TemplateConfig {
  template_id: string;
  artifact_type: string;      // Filter artifacts by type
  extraction_strategy: string; // Route to correct extractor
  field_mappings: FieldMapping[]; // From template_fields table
}
```

### 3.2 Universal Pipeline Code Generator

**File: `/src/lib/pipelines/universal-code-generator.ts`** (New)

```python
# Generated Dagster pipeline (example)
from dagster import asset, AssetExecutionContext
from inspector_dom.extractors import UniversalExtractor

@asset
def extract_vendor_data(context: AssetExecutionContext):
    """
    Extract vendor data using universal template
    Template: NABCA Vendor Extract (Universal)
    Strategy: table_detection
    Fields: vendor_name, sales_l12m, market_share (from field library)
    """

    # 1. Fetch template config (includes field_library refs)
    template = fetch_template("nabca-vendor-extract-universal")

    # 2. Fetch artifacts
    artifacts = fetch_artifacts(
        source_id="nabca-s3",
        artifact_type="pdf"
    )

    # 3. Initialize universal extractor
    extractor = UniversalExtractor(strategy="table_detection")

    # 4. Extract data
    results = []
    for artifact in artifacts:
        try:
            data = extractor.extract(
                artifact=artifact,
                template=template,
                fields=template.fields  # Uses field_library definitions!
            )
            results.extend(data)
        except Exception as e:
            context.log.error(f"Failed to extract {artifact.id}: {e}")

    # 5. Insert to entity table
    insert_to_entity(
        entity_id=template.target_entity_id,
        data=results
    )

    return {
        "artifacts_processed": len(artifacts),
        "records_extracted": len(results)
    }
```

### 3.3 Pipeline Management UI

**File: `/src/app/dashboard/pipelines/page.tsx`** (Enhanced)

Show both old and new pipelines:

```typescript
<div className="space-y-4">
  {pipelines.map(pipeline => (
    <Card key={pipeline.id}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{pipeline.name}</CardTitle>
          {pipeline.isUniversal && (
            <Badge variant="default" className="bg-purple-600">
              Universal
            </Badge>
          )}
          {!pipeline.isUniversal && (
            <Badge variant="secondary">
              Legacy
            </Badge>
          )}
        </div>
      </CardHeader>
      {/* ... */}
    </Card>
  ))}
</div>
```

### 3.4 Testing Phase 3
- [ ] Generate pipeline from universal template
- [ ] Pipeline code includes field_library logic
- [ ] Run pipeline in Dagster
- [ ] Data extracted correctly
- [ ] Transformations applied correctly
- [ ] Validation rules enforced
- [ ] Old pipelines still work

**✅ Phase 3 Complete: Universal pipelines work, old pipelines untouched**

---

## Phase 4: Comparison & Validation (Week 7)
**Goal: Prove new system works as well or better than old**

### 4.1 Side-by-Side Testing

Create same template using both approaches:

**Test 1: NABCA Table 6 (Vendor Top 100)**

Old way:
1. Click "Generate NABCA Template" (button 3)
2. Hardcoded schema from `nabca-field-schemas.ts`
3. Run old pipeline

New way:
1. Click "Create Template (NEW)" (button 5)
2. Select "Table Detection" strategy
3. Map to field_library fields
4. Run universal pipeline

Compare:
- Extraction accuracy (records extracted)
- Data quality (validation errors)
- Performance (execution time)
- Flexibility (can I modify fields easily?)

### 4.2 Success Criteria

| Metric | Old System | New System | Pass? |
|--------|-----------|-----------|-------|
| Records extracted | 100 | ≥100 | ✅ |
| Extraction time | 5 min | ≤7 min | ✅ |
| Field modifications | Edit code | Edit UI | ✅ |
| Multi-source support | No | Yes | ✅ |
| Field reusability | No | Yes | ✅ |

### 4.3 User Acceptance Testing

- [ ] Create 5 templates using new system
- [ ] Test all extraction strategies
- [ ] Test field library search/filter
- [ ] Test field reuse across templates
- [ ] Test entity creation from template
- [ ] Test pipeline generation and execution
- [ ] Verify data quality matches old system

**✅ Phase 4 Complete: New system validated**

---

## Phase 5: Migration & Deprecation (Week 8)
**Goal: Move users to new system, deprecate old buttons**

### 5.1 Migration Path for Existing Templates

Option A: Keep old templates as-is
- Mark as "Legacy"
- Still functional
- Don't migrate

Option B: Auto-migrate to field library
```typescript
// Migration script
async function migrateTemplateToFieldLibrary(templateId: string) {
  // 1. Get old template
  const template = await fetchTemplate(templateId);

  // 2. For each field in template.fields:
  //    - Check if field exists in field_library
  //    - If not, create it
  //    - Link via template_fields table

  // 3. Mark template as migrated
  await updateTemplate(templateId, { isMigrated: true });
}
```

### 5.2 Deprecation Plan

**Week 8, Day 1-3: Add deprecation warnings**
```typescript
// On old buttons
<Button onClick={...}>
  <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
  Build Smart Template (DEPRECATED)
</Button>

<Alert variant="warning">
  This button is deprecated. Please use "Create Template (NEW)" instead.
  Old button will be removed in 2 weeks.
</Alert>
```

**Week 8, Day 4-7: Migration period**
- Send email to users
- Provide migration guide
- Offer support

**Week 9: Remove old buttons**
```typescript
// Remove buttons 1-4
// Keep only button 5 (rename to "Create Template")

<Button onClick={() => setUniversalTemplateWizard(artifact)}>
  <Wand2 className="w-4 h-4 mr-2" />
  Create Template
</Button>
```

### 5.3 Code Cleanup

Files to deprecate/remove:
- `/api/templates/visual` → Keep but mark deprecated
- `/api/templates/textract` → Keep but mark deprecated
- `/api/templates/generate-nabca-multi` → Keep but mark deprecated
- `/components/extraction/visual-dom-selector.tsx` → Archive
- `/components/extraction/textract-rule-builder.tsx` → Archive

Files to keep:
- `/lib/nabca-field-schemas.ts` → Migrate to field_library seed data
- `/lib/nabca-template-config.ts` → Archive as reference

**✅ Phase 5 Complete: Old system deprecated, new system is default**

---

## Rollback Plan

If new system has critical issues:

1. **Immediate rollback**: Keep both buttons, disable new button
2. **Fix issues**: Debug in staging
3. **Re-enable**: Once fixed, re-enable new button

Files to preserve for rollback:
- All Phase 0 code (existing 4 buttons)
- Old API routes
- Old pipeline generator

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | Week 1-2 | Field library infrastructure |
| Phase 2 | Week 3-4 | 5th button + universal wizard |
| Phase 3 | Week 5-6 | Universal pipeline generator |
| Phase 4 | Week 7 | Testing & validation |
| Phase 5 | Week 8 | Migration & deprecation |
| **Total** | **8 weeks** | **Universal system live** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| New system breaks existing flows | Parallel implementation, no shared code |
| Performance degradation | Side-by-side testing in Phase 4 |
| User resistance to change | Deprecation warnings, migration support |
| Field library complexity | Start with simple fields, iterate |
| Migration data loss | Keep old templates functional, migrate copy |

---

## Success Metrics

After Phase 5 completion:

✅ 100% of new templates use field_library
✅ 0 hardcoded field schemas in code
✅ Template creation time reduced 50%
✅ Field reuse rate >70%
✅ Support for 6+ artifact types
✅ Support for 6+ extraction strategies
✅ Zero breaking changes to existing pipelines

---

## Next Steps

1. Review this plan
2. Confirm Phase 1 database schema
3. Create Phase 1 migration files
4. Build field library UI
5. Test Phase 1 thoroughly before proceeding

**Ready to begin Phase 1?**
