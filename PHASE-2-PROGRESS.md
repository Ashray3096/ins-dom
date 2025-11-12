# Phase 2: Universal Template Wizard - Progress

## ✅ MAJOR REDESIGN COMPLETED

The wizard has been completely redesigned from a 5-step to a 3-step flow with visual selection integration:

### Old Architecture (Replaced)
- 5 steps: Welcome → Strategy → **Configure** (text inputs) → Fields → Entity
- Manual text inputs for selectors (CSS, XPath, JSONPath, etc.)
- ❌ User had to type selectors manually - not practical!

### New Architecture (Current)
- **3 steps: Strategy Selection → Visual Selection → Field Mapping**
- Visual selection from actual document using existing selector components
- ✅ Click-to-select approach - much better UX!

## ✅ What We Just Implemented

### Step 1: Strategy Selection ✅ COMPLETED

**Combined welcome message + strategy selection:**
- 6 extraction strategies with icons and descriptions
- Dynamic filtering based on artifact type (HTML sees DOM Selection, PDF sees Table Detection, etc.)
- Interactive card selection with radio buttons
- Visual feedback (blue highlight when selected)
- Disabled "Next" button until strategy is selected
- Shows artifact name and type at the top

### Step 2: Visual Selection ✅ COMPLETED

**Launches appropriate visual selector based on strategy:**
- **DOM Selection (HTML)**: Opens `VisualDOMSelector` in full-screen modal
  - Click elements to select
  - Auto-generates CSS selectors and XPath
  - Supports arrays, regex patterns, checkbox groups
- **Table Detection / OCR Text / Key-Value (PDF)**: Opens `PDFVisualSelector`
  - Drag to select regions on PDF
  - Returns bounding boxes with percentage-based coordinates
  - Works across multiple pages
- **JSON Path**: (Placeholder - needs JSON tree selector component)
- **AI Extraction**: Simple textarea for prompt input (no visual selection needed)

**Features:**
- "Open Visual Selector" button launches the selector
- Shows selection count after user completes selection
- Validates that selections were made before allowing "Next"
- Modal closes after selections are saved

### Step 3: Field Mapping 🚧 PLACEHOLDER

**Coming next:**
- Split view: selections on left, field library search on right
- Search existing fields or create new ones
- Map each selection to a field from the library
- Validates all selections are mapped before saving

---

## 🎯 Available Extraction Strategies

| Strategy | Icon | Supported Types | Description |
|----------|------|-----------------|-------------|
| **Table Detection** | 📊 | PDF, HTML | Automatically detect and extract tables |
| **DOM Selection** | 🖱️ | HTML | Select HTML elements using CSS selectors |
| **JSON Path** | 🌳 | JSON | Extract data using JSONPath expressions |
| **Key-Value** | # | PDF, HTML, Image | Extract key-value pairs (invoices, forms) |
| **OCR Text** | 📝 | PDF, Image | Extract text from scanned documents |
| **AI Extraction** | 🧠 | All types | Use AI to intelligently extract data |

---

## 🧪 How to Test (Updated for New 3-Step Flow)

### Prerequisites
1. Make sure dev server is running: `http://localhost:3003`
2. Run the database migration first (see below)

### Test Step 1: Strategy Selection

1. Open browser: `http://localhost:3003`
2. Navigate to **Artifacts** page
3. Find an HTML artifact
4. Click **"Create Template (NEW)"** button (purple-blue gradient)
5. Wizard opens directly to strategy selection
6. Should see artifact name at top
7. Should see 3 strategies for HTML:
   - ✅ Table Detection
   - ✅ DOM Selection
   - ✅ AI Extraction
8. Click **DOM Selection** → card highlights blue
9. Click **"Next"** → proceeds to Visual Selection step

### Test Step 2: Visual Selection

1. Should see "Visual Selection" heading
2. Should see "Open Visual Selector" button
3. Click the button
4. **VisualDOMSelector opens in full-screen modal**
5. Click on elements in the HTML to select them
6. Add field names for each selection
7. Click "Save" in the selector
8. Modal closes, returns to wizard
9. Should see "X fields selected" green message
10. Click **"Next"** → proceeds to Field Mapping step

### Test Step 3: Field Mapping (Placeholder)

1. Should see "Map to Field Library" heading
2. Shows placeholder message (UI not built yet)
3. Click **"Create Template"** → wizard closes

### Test Different Strategies

**For PDF with Table Detection:**
1. Open a PDF artifact
2. Click "Create Template (NEW)"
3. Select **Table Detection**
4. Click "Next"
5. Click "Open Visual Selector"
6. Should open **PDFVisualSelector** to select table regions

**For AI Extraction:**
1. Select **AI Extraction** strategy
2. Click "Next"
3. Should see textarea for prompt (no visual selector button)
4. Type a prompt describing what to extract
5. "Next" button enables when prompt is not empty

---

## 📋 What's Next

### Immediate Next Steps:

1. **✅ FIRST: Run Database Migration**
   ```bash
   # Run this in Supabase SQL editor:
   supabase/migrations/012_update_templates_for_universal.sql
   ```
   This adds `extraction_strategy` and `strategy_config` columns to templates table.

2. **🚧 Build Field Mapping UI (Step 3)**
   - Split view: selections on left, field library search on right
   - Search field library with filters
   - Map each selection to a field
   - Option to create new field inline
   - Validate all selections are mapped

3. **🚧 Create Save API Endpoint**
   - `POST /api/templates/universal`
   - Save template with:
     - `extraction_strategy` (one per template)
     - `strategy_config` (JSONB with strategy settings)
     - `sample_artifact_id` (reference to source file)
   - Save all template_fields with:
     - `field_id` (from field_library)
     - `extraction_config` (JSONB with field-specific config)

4. **🚧 Add JSON Path Selector**
   - Build visual JSON tree explorer
   - Click to select paths
   - Generate JSONPath expressions
   - Currently just a placeholder

### Architecture Improvements (Future):

- Add table detection UI (auto-detect tables in PDF/HTML)
- Add form field detection (auto-detect form inputs)
- Add data validation rules per field
- Add test extraction with sample data

---

## 🎨 UI Features Implemented

### Visual Design
- **3-Step Progress Bar**: Shows current position (Strategy → Visual → Mapping)
- **Strategy Cards**: 2-column grid layout with icons
- **Selection State**: Blue border + blue background when selected
- **Radio Indicator**: Top-right corner with filled dot
- **Visual Selector Button**: Large purple-blue gradient button
- **Selection Feedback**: Green banner showing count of selected fields
- **Modal Integration**: Full-screen visual selectors open in dialog

### Interaction Design
- **Smart Navigation**: Next button disabled until requirements met
- **Dynamic Filtering**: Only shows strategies compatible with artifact type
- **Conditional UI**: Shows different UI based on strategy (prompt vs visual selector)
- **Modal Management**: Visual selectors open/close with state management
- **Selection Persistence**: Selections are saved when returning from visual selector

---

## 🔍 Technical Implementation

### Files Modified

**`src/components/templates/universal-wizard.tsx`** (Completely Redesigned)
- Changed from 5-step to 3-step wizard
- Integrated `VisualDOMSelector` and `PDFVisualSelector` components
- Added modal management for visual selectors
- Unified selection format with `VisualSelection` interface
- Smart button states based on strategy and step

**Key Changes:**
```typescript
// Old: 5 steps with text inputs
type WizardStep = 'welcome' | 'strategy' | 'configure' | 'fields' | 'entity';

// New: 3 steps with visual selection
type WizardStep = 'strategy' | 'visual' | 'mapping';

// Unified selection format
interface VisualSelection {
  // DOM fields (xpath, cssSelector, sampleValue, etc.)
  // PDF fields (pageNumber, boundingBox, textContent, etc.)
}

// Visual selector integration
{showVisualSelector && selectedStrategy === 'dom_selection' && (
  <Dialog>
    <VisualDOMSelector
      artifact={artifact}
      onSave={handleVisualSelectionComplete}
      onCancel={() => setShowVisualSelector(false)}
    />
  </Dialog>
)}
```

### Component Integration
- **VisualDOMSelector**: Opens for `dom_selection` strategy
- **PDFVisualSelector**: Opens for `table_detection`, `ocr_text`, `key_value` strategies
- **AI Extraction**: Shows textarea, no visual selector needed
- **JSON Path**: Placeholder (needs JSON tree selector component)

---

## ✅ Success Criteria (Updated for 3-Step Wizard)

### Step 1: Strategy Selection
- [ ] Wizard opens directly to strategy selection (no welcome step)
- [ ] Shows artifact name and type at top
- [ ] Only shows strategies compatible with artifact type
- [ ] Strategy cards highlight blue when selected
- [ ] Next button disabled until strategy selected
- [ ] Clicking Next advances to Visual Selection step

### Step 2: Visual Selection
- [ ] Shows "Open Visual Selector" button for DOM/PDF strategies
- [ ] Shows textarea for AI Extraction strategy
- [ ] Clicking button opens appropriate visual selector in modal
- [ ] Visual selector (VisualDOMSelector or PDFVisualSelector) works correctly
- [ ] After saving selections, modal closes and returns to wizard
- [ ] Shows green "X fields selected" message
- [ ] Next button disabled until selections are made
- [ ] Clicking Next advances to Field Mapping step

### Step 3: Field Mapping
- [ ] Shows placeholder message (UI not built yet)
- [ ] "Create Template" button is enabled
- [ ] Clicking button closes wizard (saving not implemented yet)

### General
- [ ] No console errors
- [ ] Can navigate back through steps
- [ ] Progress bar updates correctly
- [ ] Cancel button closes wizard

---

## 🚀 Ready to Test!

The **Universal Wizard has been completely redesigned** with a 3-step flow and visual selection integration!

### What Changed:
1. ✅ **Wizard Structure**: Simplified from 5 steps to 3 steps
2. ✅ **Visual Selection**: Integrated existing VisualDOMSelector and PDFVisualSelector components
3. ✅ **Better UX**: Click-to-select instead of manual text input
4. 🚧 **Field Mapping**: Placeholder UI (next to implement)

### Before Testing:
**⚠️ IMPORTANT**: Run the database migration first!
```sql
-- In Supabase SQL editor, run:
supabase/migrations/012_update_templates_for_universal.sql
```

### Test Instructions:
See the detailed test instructions above. The wizard now:
- Opens directly to strategy selection
- Launches visual selectors for DOM/PDF strategies
- Shows prompt textarea for AI extraction
- Captures selections and shows count
- Advances to field mapping step (placeholder)

### Dev Server:
```
http://localhost:3003
```

### Next Steps:
After you test and confirm this works:
1. Build the Field Mapping UI (Step 3)
2. Create the save API endpoint
3. Connect everything end-to-end
