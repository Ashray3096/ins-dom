# Inspector Dom - Updated Technical Specification
## Current Implementation Status & Remaining Work

**Last Updated**: October 2025
**Status**: Prompts 1-17 Completed ✅

---

## 🎯 What Inspector Dom Actually Is

Inspector Dom is a **visual data pipeline builder** that allows business analysts to extract data from documents (PDFs, HTML) and automatically generate production data pipelines - all without writing code.

### The Unique Innovation

**Traditional Approach**: Developers write extraction code → Deploy → Maintain
**Inspector Dom**: Click elements → Build template → Auto-generate pipeline → Deploy

### The Three Pillars

1. **Visual Template Building**: Click on elements in documents to build extraction templates
2. **Entity Modeling**: Draw your data model visually (like dbdiagram.io)
3. **Auto-Generated Pipelines**: System writes Dagster code based on your entity model

---

## 📊 Current Implementation Status

### ✅ Completed (Prompts 1-17)

#### Foundation
- Next.js 14 project with App Router
- Supabase authentication
- Database schema (providers, sources, artifacts, templates, entities)
- Dashboard layout and navigation
- Shadcn UI components

#### Provider & Source Management
- CRUD operations for providers
- Source configuration (URL, S3, file upload)
- File upload to Supabase Storage

#### AI Extraction
- Anthropic Claude API integration
- PDF and HTML extraction
- Extraction prompts and cost tracking
- Basic extraction UI

#### Template System (Partial)
- Template creation from extraction
- Template storage
- Basic template reuse

### ❌ Not Yet Built (Critical Features)

#### Visual Template Builder
- **DOM Element Selection**: Click on elements to select them
- **Pattern Detection**: Auto-detect similar elements
- **Field Mapping**: Map selected elements to database fields
- **Visual Feedback**: Highlight selected elements

#### Entity Modeling System
- **Three-Tier Entities**: Interim → Reference → Master
- **Visual Entity Designer**: Drag-drop field creation
- **Relationship Builder**: Define relationships between entities
- **ER Diagram**: Interactive visualization of data model

#### Pipeline Generation
- **Auto-Generation**: Generate Dagster code from entity model
- **Deployment**: Deploy pipelines to Dagster
- **Monitoring**: Track pipeline runs and status

#### Production Features
- **S3 Batch Processing**: Process thousands of files
- **Template Versioning**: A/B test template changes
- **AI Fallback**: Smart fallback when templates fail
- **Cost Optimization**: Track and optimize costs

---

## 🏗️ Architecture Clarification

### Data Flow

```
1. SAMPLE PHASE (Template Building)
   Provider → Source → Upload Sample → AI Extract → Build Template → Save

2. ENTITY MODELING PHASE
   Create Entities → Define Relationships → Generate ER Diagram

3. PIPELINE GENERATION PHASE
   Entity Model + Templates → Generate Dagster Code → Deploy

4. PRODUCTION PHASE
   S3 Bucket → Dagster Pipeline → Extract (Template/AI) → Transform → Load → Database
```

### The Smart Template-First Approach

```
For each document:
1. Try template extraction (fast, cheap) - 95% success
2. If template fails → AI fallback (slower, expensive) - 4% of cases
3. If AI fails → Human review - 1% of cases

Result: 95% automation with minimal cost
```

---

## 🔑 Key Concepts

### Providers
Organizations that provide data (e.g., NABCA, TTB, California ABC)

### Sources
Specific data feeds within a provider:
- **URL**: Single file endpoint
- **S3**: Bucket with multiple files
- **API**: REST endpoint (future)
- **File Upload**: Manual upload

### Artifacts
Database records representing processed files. Contains:
- `raw_content`: Extracted structured data
- `metadata`: AI extraction results, costs, statistics

### Templates
Reusable extraction patterns containing:
- DOM selectors (for visual selection)
- AI prompts
- Field mappings
- User corrections

### Entities (Three Types)
1. **Interim**: Raw extracted data as-is
2. **Reference**: Lookup tables and dimensions
3. **Master**: Core business objects

### Pipelines
Dagster code auto-generated from entity models that:
- Extracts data using templates
- Transforms through entity relationships
- Loads into final database tables

---

## 🎨 What Makes Inspector Dom Special

### 1. Visual Template Building
```
User: *clicks on price in PDF*
System: "This is $24.99, what field is this?"
User: "retail_price"
System: *saves CSS selector/XPath*
Result: Template that works on similar documents
```

### 2. Entity-Driven Pipeline Generation
```
User: *draws entities and relationships*
System: *generates complete Dagster pipeline*
User: *clicks deploy*
Result: Production pipeline running in Dagster
```

### 3. Intelligent Adaptation
```
Document format changes slightly
→ Template extraction fails on 3 fields
→ AI extracts just those 3 fields
→ System updates template
→ Future documents work perfectly
```

---

## 📈 Implementation Priorities

### Phase 1: MVP Features (Weeks 3-4)
1. **DOM Element Selection** - The core differentiator
2. **Correction UI** - Learn from user fixes
3. **Entity Modeling** - Three-tier system
4. **ER Diagram** - Visualize relationships
5. **Pipeline Generation** - Auto-create Dagster code

### Phase 2: Scale Features (Weeks 5-6)
1. **S3 Integration** - Batch processing
2. **Template Versioning** - Handle format changes
3. **AI Fallback** - 95% automation
4. **Monitoring** - Track everything

### Phase 3: Polish (Weeks 7-8)
1. **Testing** - E2E test suite
2. **Performance** - Optimize speed
3. **Documentation** - User and API docs
4. **Deployment** - Production ready

---

## 🚨 Common Confusions to Avoid

### "Artifacts" Clarification
- **In Inspector Dom**: Database records of processed files
- **In Claude**: Documents/code blocks in the chat interface
- These are completely different things!

### Template Building Methods
- **Primary**: Visual DOM selection (click elements)
- **Fallback**: AI extraction with corrections
- **Not**: Manual coding of selectors

### Pipeline Generation
- **Automatic**: From entity model
- **Not**: Manual Python coding
- **Not**: Pre-built static pipelines

### Production Processing
- **Direct**: S3 → Dagster → Database
- **Not**: Re-uploading files through UI
- **Not**: Processing through web app

---

## 💡 Success Criteria

### For Templates
- User can build template in < 5 minutes
- Template works on 95% of similar documents
- Failures trigger smart AI fallback

### For Entities
- Visual modeling requires no SQL knowledge
- ER diagram auto-updates with changes
- Relationships enforce data integrity

### For Pipelines
- Zero Python code written by user
- Pipeline deploys in one click
- Monitoring shows real-time status

### For Production
- Processes 10,000+ documents reliably
- Costs < $0.01 per document average
- 95% full automation rate

---

## 🛠️ Technical Stack Confirmation

### Frontend
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- Shadcn/ui components
- React Flow (ER diagrams)

### Backend
- Supabase (auth, database, storage)
- Anthropic Claude API (AI extraction)
- Dagster (pipeline orchestration)
- PostgreSQL (data warehouse)

### Infrastructure
- Vercel (Next.js hosting)
- Dagster Cloud (pipeline hosting)
- AWS S3 (document storage)
- Supabase (database hosting)

---

## 📝 Implementation Notes

### DOM Selection Implementation
- HTML: Use iframe with injected selection script
- PDF: Use pdf.js with text layer selection
- Track: CSS selectors, XPath, text content
- Store: Selectors array in templates table

### Entity Model Storage
```sql
entities.schema_definition = {
  "columns": [
    {"name": "product_id", "type": "uuid", "primary": true},
    {"name": "name", "type": "text", "required": true},
    {"name": "price", "type": "numeric"}
  ],
  "entity_type": "REFERENCE",
  "table_name": "product_catalog"
}
```

### Pipeline Configuration
```python
# Auto-generated from entity model
@asset
def extract_nabca_prices():
    # Use template to extract
    
@asset
def transform_to_products(extract_nabca_prices):
    # Apply entity transformations
    
@asset
def load_product_catalog(transform_to_products):
    # Load to final table
```

---

## 🎯 Next Steps

1. **Share this spec with Claude Code** (Prompt 18)
2. **Build Correction UI** (Prompt 19)
3. **Build DOM Selection** (Prompt 20)
4. **Build Entity Modeling** (Prompts 21-24)
5. **Build ER Diagram** (Prompt 25)
6. **Generate Pipelines** (Prompts 29-30)

Focus on what makes Inspector Dom unique - the visual building experience!

---

## 🚀 The Vision

A business analyst with no coding experience can:
1. Upload a sample document
2. Click on the data they want
3. Draw their data model
4. Click deploy
5. Process 10,000 documents automatically

That's the magic of Inspector Dom! 🎩✨
