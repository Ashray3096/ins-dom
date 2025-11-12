# Universal Template Architecture - Final Plan

## 🎯 Core Concept

**One Template = One Document Structure = One Extraction Strategy**

- Template is **source-independent** and reusable across multiple sources
- Created from a **sample artifact** but not tied to it
- Contains **multiple fields** all using the **same extraction strategy**
- Flows into **Entity** creation, then **Pipeline** orchestration

---

## 🏗️ Database Schema

### **Templates Table**
```sql
CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,

  -- Extraction strategy for ALL fields in this template
  extraction_strategy TEXT NOT NULL,
  -- Options: 'dom_selection', 'table_detection', 'json_path',
  --          'key_value', 'ocr_text', 'ai_extraction'

  -- Optional strategy-level configuration
  strategy_config JSONB,

  -- Reference to sample artifact used to create this template
  sample_artifact_id UUID REFERENCES artifacts(id),

  -- NO source_id - template is source-independent
  -- NO entity_id - entity is created separately and links back

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

### **Template Fields Table** (Already exists from Phase 1)
```sql
CREATE TABLE template_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  field_id UUID REFERENCES field_library(id) ON DELETE CASCADE,

  -- Field-specific extraction config (uses template's strategy)
  extraction_config JSONB NOT NULL,
  -- Examples:
  --   DOM Selection: { cssSelector: ".vendor", xpath: "//div[@class='vendor']" }
  --   Table Detection: { tableIndex: 0, columnName: "Vendor" }
  --   JSON Path: { path: "$.data.vendor" }
  --   AI Extraction: { prompt: "Extract vendor name" }

  transformations TEXT[] DEFAULT ARRAY[]::TEXT[],
  display_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,

  UNIQUE(template_id, field_id),

  created_at TIMESTAMP DEFAULT NOW()
);
```

### **Pipelines Table** (Links Source + Template + Entity)
```sql
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,

  -- WHERE to get files from
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,

  -- HOW to extract data
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,

  -- WHERE to load data
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,

  -- Pipeline status and execution info
  status TEXT DEFAULT 'draft', -- 'draft', 'active', 'paused', 'failed'
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

---

## 📋 Complete Workflow

### **Phase 1: Template Creation**

**User Flow:**
```
1. User goes to /dashboard/artifacts
2. Finds a sample artifact (e.g., invoice_001.html from NABCA source)
3. Clicks "Create Template (NEW)" button (5th button)
4. Universal Wizard opens
```

**Wizard Steps:**

**Step 1: Welcome + Strategy Selection**
```
┌────────────────────────────────────────────────────┐
│ Create Universal Template                          │
├────────────────────────────────────────────────────┤
│                                                    │
│ Template Name: [_________________________]        │
│                                                    │
│ Sample Artifact: invoice_001.html (PDF)           │
│                                                    │
│ Select Extraction Strategy:                        │
│                                                    │
│ ┌──────────────┐ ┌──────────────┐                │
│ │ 📊 Table     │ │ 🖱️ DOM       │                │
│ │ Detection    │ │ Selection    │                │
│ └──────────────┘ └──────────────┘                │
│                                                    │
│ ┌──────────────┐ ┌──────────────┐                │
│ │ 🌳 JSON Path │ │ 🧠 AI        │                │
│ │              │ │ Extraction   │                │
│ └──────────────┘ └──────────────┘                │
│                                                    │
│ [Cancel]                            [Next]        │
└────────────────────────────────────────────────────┘
```

**Step 2: Visual Field Selection**
```
┌────────────────────────────────────────────────────┐
│ Select Fields to Extract                           │
├────────────────────────────────────────────────────┤
│                                                    │
│ Strategy: DOM Selection                           │
│                                                    │
│ Click below to visually select fields:            │
│                                                    │
│ ┌────────────────────────────────────────────┐   │
│ │  [🎯 Open Visual Selector]                 │   │
│ └────────────────────────────────────────────┘   │
│                                                    │
│ Selected Fields: 5                                 │
│ ┌────────────────────────────────────────────┐   │
│ │ ✅ Element 1: CSS .vendor-name              │   │
│ │    Sample: "Acme Corporation"               │   │
│ │                                             │   │
│ │ ✅ Element 2: CSS .invoice-date             │   │
│ │    Sample: "2024-01-15"                     │   │
│ │                                             │   │
│ │ ✅ Element 3: CSS .total-amount             │   │
│ │    Sample: "$1,500.00"                      │   │
│ │                                             │   │
│ │ ... (3 more)                                │   │
│ │                                             │   │
│ │ [Edit Selections]                           │   │
│ └────────────────────────────────────────────┘   │
│                                                    │
│ [Back]                              [Next]        │
└────────────────────────────────────────────────────┘
```

**Visual Selector Opens:**
- For DOM Selection → `VisualDOMSelector` component (full-screen)
- For Table Detection → `TableSelector` component
- For JSON Path → `JSONTreeSelector` component
- User selects multiple elements/fields
- Returns array of selections with extraction configs

**Step 3: Map to Field Library**
```
┌────────────────────────────────────────────────────┐
│ Map Fields to Library                              │
├────────────────────────────────────────────────────┤
│                                                    │
│ Left Side: Selected Elements                       │
│ ┌────────────────────────┐                        │
│ │ ☐ Element 1            │                        │
│ │   CSS: .vendor-name    │                        │
│ │   Sample: "Acme Corp"  │                        │
│ │   → Not mapped         │                        │
│ │                        │                        │
│ │ ☑ Element 2            │                        │
│ │   CSS: .invoice-date   │                        │
│ │   Sample: "2024-01"    │                        │
│ │   → invoice_date       │                        │
│ └────────────────────────┘                        │
│                                                    │
│ Right Side: Field Library Search                   │
│ ┌────────────────────────┐                        │
│ │ [Search fields...]     │                        │
│ │                        │                        │
│ │ Results:               │                        │
│ │ • vendor_name (TEXT)   │                        │
│ │   [Map This Field]     │                        │
│ │                        │                        │
│ │ • invoice_date (DATE)  │                        │
│ │   [Map This Field]     │                        │
│ └────────────────────────┘                        │
│                                                    │
│ [Back]                    [Save Template]         │
└────────────────────────────────────────────────────┘
```

**Result:**
- Template saved to database
- Contains extraction_strategy + multiple fields
- Each field has extraction_config + field_library reference
- sample_artifact_id stored for reference

**Example Template Data:**
```json
{
  "id": "tmpl-uuid-1",
  "name": "NABCA Invoice HTML Template",
  "extraction_strategy": "dom_selection",
  "sample_artifact_id": "artifact-invoice-001",
  "fields": [
    {
      "field_id": "field-lib-vendor-name",
      "extraction_config": {
        "cssSelector": ".vendor-name",
        "xpath": "//div[@class='vendor-name']"
      },
      "display_order": 0
    },
    {
      "field_id": "field-lib-invoice-date",
      "extraction_config": {
        "cssSelector": ".invoice-date",
        "xpath": "//span[@class='invoice-date']"
      },
      "display_order": 1
    },
    {
      "field_id": "field-lib-total-amount",
      "extraction_config": {
        "cssSelector": ".total-amount",
        "xpath": "//div[@class='total-amount']"
      },
      "display_order": 2
    }
  ]
}
```

---

### **Phase 2: Entity Creation**

**User Flow:**
```
1. User goes to /dashboard/entities
2. Clicks "Create Entity"
3. Enters entity name: "invoices"
4. Clicks "Import Fields from Template"
5. Selects template: "NABCA Invoice HTML Template"
6. System shows template fields
7. User maps to entity columns (or auto-maps)
8. Clicks "Create Entity"
```

**Entity Import UI:**
```
┌────────────────────────────────────────────────────┐
│ Create Entity                                      │
├────────────────────────────────────────────────────┤
│                                                    │
│ Entity Name: [invoices______________]             │
│                                                    │
│ Import from Template:                              │
│ [NABCA Invoice HTML Template ▼]                   │
│                                                    │
│ Template Fields → Entity Columns:                  │
│ ┌────────────────────────────────────────────┐   │
│ │ ☑ vendor_name    → vendor_name (TEXT)      │   │
│ │ ☑ invoice_date   → invoice_date (DATE)     │   │
│ │ ☑ total_amount   → total_amount (NUMERIC)  │   │
│ └────────────────────────────────────────────┘   │
│                                                    │
│ Additional Columns:                                │
│ • id (UUID) - Auto-generated                       │
│ • created_at (TIMESTAMP) - Auto-generated          │
│                                                    │
│ [Cancel]                    [Create Entity]       │
└────────────────────────────────────────────────────┘
```

**Result:**
- Entity table created in database with columns
- Entity record saved with field mappings
- Template remains source-independent

```sql
-- Generated entity table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_name TEXT,
  invoice_date DATE,
  total_amount NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### **Phase 3: Pipeline Creation**

**User Flow:**
```
1. User goes to /dashboard/pipelines
2. Clicks "Create Pipeline"
3. Enters pipeline name
4. Selects:
   - Source: "NABCA S3 Bucket" (has 1000 HTML files)
   - Template: "NABCA Invoice HTML Template"
   - Entity: "invoices"
5. Clicks "Generate Pipeline"
6. System generates Dagster pipeline code
7. User clicks "Run Pipeline"
8. Pipeline processes ALL files in source
```

**Pipeline Creation UI:**
```
┌────────────────────────────────────────────────────┐
│ Create Pipeline                                    │
├────────────────────────────────────────────────────┤
│                                                    │
│ Pipeline Name: [NABCA Invoice Pipeline_______]    │
│                                                    │
│ Source (Where to get files):                       │
│ [NABCA S3 Bucket ▼]                               │
│ Files: 1,000 HTML files                            │
│                                                    │
│ Template (How to extract):                         │
│ [NABCA Invoice HTML Template ▼]                   │
│ Strategy: DOM Selection                            │
│ Fields: 3 fields                                   │
│                                                    │
│ Entity (Where to load):                            │
│ [invoices ▼]                                       │
│ Table: invoices                                    │
│ Columns: 3 data columns                            │
│                                                    │
│ [Cancel]                  [Generate Pipeline]     │
└────────────────────────────────────────────────────┘
```

**Result:**
- Pipeline record created in database
- Dagster pipeline code generated
- Links Source → Template → Entity

**Generated Dagster Pipeline:**
```python
@asset
def extract_nabca_invoices(context):
    """
    Extract invoice data from NABCA HTML files
    """
    # Get source configuration
    source = get_source(source_id='source-nabca-s3')

    # Get template configuration
    template = get_template(template_id='tmpl-uuid-1')
    # template.extraction_strategy = 'dom_selection'
    # template.fields = [vendor_name, invoice_date, total_amount]

    # Get all files from source
    files = source.list_files()  # 1000 HTML files

    results = []
    for file in files:
        # Load file content
        html_content = source.download_file(file)

        # Extract using DOM Selection strategy
        if template.extraction_strategy == 'dom_selection':
            data = extract_with_dom_selection(html_content, template.fields)
            # data = {
            #   'vendor_name': 'Acme Corp',
            #   'invoice_date': '2024-01-15',
            #   'total_amount': 1500.00
            # }

        results.append(data)

    return results

@asset
def load_invoices(context, extract_nabca_invoices):
    """
    Load extracted data into invoices entity
    """
    entity = get_entity(entity_id='entity-invoices')

    # Insert into invoices table
    with get_db_connection() as conn:
        for record in extract_nabca_invoices:
            conn.execute(
                "INSERT INTO invoices (vendor_name, invoice_date, total_amount) VALUES (%s, %s, %s)",
                record['vendor_name'], record['invoice_date'], record['total_amount']
            )

    context.log.info(f"Loaded {len(extract_nabca_invoices)} records into invoices table")
```

---

## 🔄 Data Flow Summary

```
┌─────────────────────────────────────────────────────────┐
│ 1. TEMPLATE CREATION                                    │
│                                                         │
│ Artifact (sample) ──→ Wizard ──→ Template              │
│                                    ├─ extraction_strategy│
│                                    ├─ sample_artifact_id │
│                                    └─ fields[]           │
│                                       ├─ field_library_id│
│                                       └─ extraction_config│
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. ENTITY CREATION                                      │
│                                                         │
│ Template ──→ Import ──→ Entity                         │
│   fields[]              ├─ table_name                   │
│                         └─ columns[]                    │
│                            (mapped from template fields) │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. PIPELINE ORCHESTRATION                               │
│                                                         │
│ Source ──┐                                              │
│          ├──→ Pipeline ──→ Extract & Load              │
│ Template─┤                                              │
│          │                                              │
│ Entity ──┘                                              │
│                                                         │
│ Source (1000 files) ──→ Template (extraction rules)    │
│                    ──→ Entity (database table)         │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Key Benefits

1. **Source Independence**: Template can be reused across multiple sources with same document structure
2. **One Strategy**: Simple, predictable - one extraction method per template
3. **Multiple Fields**: Rich data extraction with multiple fields per template
4. **Field Reusability**: Field library ensures consistent field definitions
5. **Template → Entity**: Clear mapping from extraction to storage
6. **Scalable Orchestration**: Pipeline processes thousands of files automatically
7. **Traceability**: sample_artifact_id tracks where template came from

---

## 🚀 Implementation Order

### Phase 2A: Template Creation (Current)
1. Update database schema (remove artifact_id, add sample_artifact_id)
2. Redesign wizard (3 steps: Welcome+Strategy, Visual Selection, Field Mapping)
3. Integrate existing visual selectors (VisualDOMSelector, etc.)
4. Save template API endpoint

### Phase 2B: Entity Import
1. Add "Import from Template" feature to entity creation
2. Auto-generate entity columns from template fields
3. Allow column name customization

### Phase 2C: Pipeline Generation
1. Create pipeline creation UI
2. Generate Dagster code from Source + Template + Entity
3. Execute pipeline on all source files

---

## 📝 Example Complete Scenario

**Scenario: Processing 1000 NABCA Invoice HTML Files**

1. **Template Creation** (one-time setup)
   - Sample: invoice_001.html
   - Template: "NABCA Invoice Template"
   - Strategy: DOM Selection
   - Fields: vendor_name, invoice_date, total_amount

2. **Entity Creation** (one-time setup)
   - Entity: "invoices" table
   - Columns imported from template

3. **Pipeline Execution** (repeatable)
   - Source: NABCA S3 Bucket (1000 files)
   - Template: NABCA Invoice Template
   - Entity: invoices
   - Result: 1000 records loaded into invoices table

4. **Reusability**
   - Same template can process new files added to source
   - Same template can be used with different sources (if structure matches)
   - Same entity can receive data from multiple templates/pipelines

---

## 🎯 Ready for Implementation

This architecture is:
- ✅ Source-independent
- ✅ Scalable (one template → many files)
- ✅ Reusable (field library integration)
- ✅ Clear workflow (Template → Entity → Pipeline)
- ✅ Flexible (supports all extraction strategies)

**Approved for implementation!**
