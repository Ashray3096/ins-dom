# Inspector Dom - End-to-End Testing Guide

## Prerequisites ✅
- Next.js app running on http://localhost:3000
- Dagster running on http://localhost:3001
- Supabase configured and accessible
- You're logged in to the app

---

## Test Scenario: TTB Spirits Report Processing

We'll test the complete flow:
1. Upload a sample document
2. Extract data with AI or Visual Template
3. Create entity model
4. Generate Dagster pipeline
5. Deploy to Dagster
6. Execute pipeline
7. Verify data in database

---

## 🔍 Step 1: Verify Existing Setup

### Check if entities exist:
1. Go to http://localhost:3000/dashboard/entities
2. Look for `raw_ttb` entity
3. If it exists, note the fields it has

### Check if providers exist:
1. Go to http://localhost:3000/dashboard/providers
2. You should see at least one provider (TTB, NABCA, or CUSTOM)
3. If none exist, create one:
   - Name: "TTB"
   - Type: "TTB"
   - Cadence: "MONTHLY"

### Check if sources exist:
1. Go to http://localhost:3000/dashboard/sources
2. If none exist, create one:
   - Name: "TTB Sample Source"
   - Type: "File Upload"
   - Provider: Select the provider you created

---

## 📄 Step 2: Prepare Sample Document

Create a sample HTML file with TTB data:

**File: `ttb-sample.html`**

```html
<!DOCTYPE html>
<html>
<head>
    <title>TTB Report Sample</title>
</head>
<body>
    <div class="report">
        <h1>TTB Spirits Report</h1>

        <div class="product">
            <p>TTB ID 12345</p>
            <p>CT 2024001</p>
            <p>OR 789456</p>
            <p>Product Source: Kentucky Distillery</p>
            <p>Product Type: Bourbon Whiskey</p>
        </div>

        <div class="product">
            <p>TTB ID 12346</p>
            <p>CT 2024002</p>
            <p>OR 789457</p>
            <p>Product Source: Tennessee Distillery</p>
            <p>Product Type: Tennessee Whiskey</p>
        </div>

        <div class="product">
            <p>TTB ID 12347</p>
            <p>CT 2024003</p>
            <p>OR 789458</p>
            <p>Product Source: California Winery</p>
            <p>Product Type: Brandy</p>
        </div>
    </div>
</body>
</html>
```

Save this file on your computer.

---

## 📤 Step 3: Upload Sample Document

1. Go to http://localhost:3000/dashboard/artifacts
2. Click "Upload Artifact" button
3. Select your source (the one you created)
4. Upload `ttb-sample.html`
5. Wait for upload to complete
6. Note the artifact ID (you'll see it in the list)

---

## 🤖 Step 4A: Extract with AI (Easier to test first)

1. Click on your uploaded artifact
2. Click "Extract with AI" button
3. Enter extraction instructions:
   ```
   Extract TTB ID, CT number, OR number, product source, and product type from this document.
   For each product, extract all fields.
   ```
4. Click "Extract"
5. Wait for Claude API to process (~10-30 seconds)
6. Review extracted data
7. **Important**: Click "Save as Template" and name it "TTB Spirits Template"

**Expected Result:**
```json
[
  {
    "ttbid": "12345",
    "ct": "2024001",
    "or": "789456",
    "productsource": "Kentucky Distillery",
    "producttype": "Bourbon Whiskey"
  },
  ...
]
```

---

## 🎨 Step 4B: Build Visual Template (Alternative to AI)

If you want to test visual template building instead:

1. Click on your uploaded artifact
2. Click "Build Visual Template"
3. Click on "TTB ID 12345" in the rendered HTML
4. Field name: `ttbid`
5. Type: `string`
6. Required: ✓
7. Click "Add Field"
8. Repeat for other fields (ct, or, productsource, producttype)
9. Click "Save Template" and name it "TTB Visual Template"

---

## 🗂️ Step 5: Create Entity (If Not Exists)

1. Go to http://localhost:3000/dashboard/entities
2. Click "Create Entity"
3. Fill in:
   - **Name**: `raw_ttb`
   - **Display Name**: "Raw TTB Data"
   - **Entity Type**: INTERIM
   - **Description**: "Raw extracted TTB spirits data"
4. Add fields:
   - `ttbid` (TEXT, required, primary key)
   - `ct` (TEXT)
   - `or` (TEXT)
   - `productsource` (TEXT)
   - `producttype` (TEXT)
5. Click "Create Entity"

---

## 🗄️ Step 6: Create Database Table (REQUIRED - Manual Step)

⚠️ **Critical**: The table must exist before running the pipeline!

1. Go to http://localhost:3000/dashboard/entities
2. Click on "raw_ttb" entity
3. Scroll down to "SQL Preview"
4. Click "Copy SQL"
5. Open Supabase Dashboard: https://supabase.com/dashboard
6. Go to your project → SQL Editor
7. Paste the SQL and click "Run"

**OR use this SQL directly:**

```sql
CREATE TABLE IF NOT EXISTS raw_ttb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ttbid TEXT PRIMARY KEY,
  ct TEXT,
  or TEXT,
  productsource TEXT,
  producttype TEXT,

  -- Metadata fields
  extraction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_artifact_id UUID,
  template_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE raw_ttb ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "raw_ttb_isolation" ON raw_ttb
  FOR ALL USING (true); -- Adjust based on your auth needs
```

---

## ⚙️ Step 7: Create Pipeline

1. Go to http://localhost:3000/dashboard/pipelines
2. Click "Create Pipeline"
3. Fill in:
   - **Name**: "TTB Extraction Pipeline"
   - **Description**: "Extract TTB spirits data"
   - **Provider**: Select your TTB provider
   - **Template**: Select "TTB Spirits Template" (or "TTB Visual Template")
   - **Target Entity**: Select "raw_ttb"
   - **Sources**: Select your source
   - **Schedule**: MANUAL (for testing)
4. Click "Create Pipeline"

---

## 🔧 Step 8: Generate Pipeline Code

1. You'll be on the pipeline detail page
2. Click "Generate Code" button
3. Wait for code generation (~5 seconds)
4. Review the generated Python code
5. You should see:
   - Extraction asset
   - Load asset
   - Utility functions
6. Copy the code (optional - for review)

**Expected Output:**
- Python code for Dagster pipeline
- SQL for table creation (we already did this)
- Dagster configuration

---

## 🚀 Step 9: Deploy Pipeline to Dagster

1. On the same page, click "Deploy Pipeline" button
2. Wait for deployment (~10 seconds)
3. Status should change to "Active"
4. Click "Open in Dagster" link (or go to http://localhost:3001)

---

## ▶️ Step 10: Run Pipeline in Dagster

1. In Dagster UI (http://localhost:3001):
2. Go to "Assets" tab
3. You should see:
   - `extract_raw_ttb`
   - `load_raw_ttb`
4. Click on `load_raw_ttb`
5. Click "Materialize" button (top right)
6. Wait for execution (~30 seconds)
7. Monitor the logs

**Expected Logs:**
```
Starting extraction for raw_ttb
Found 1 artifacts to process
Using AI-extracted fields for <artifact-id>
Extraction complete: 3 successful, 0 failed (100.0% success rate)

Starting load for raw_ttb
Loaded batch 1: 3 records
Load complete: 3 loaded, 0 failed (100.0% success rate)
```

---

## ✅ Step 11: Verify Data in Database

### Option A: Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Your project → Table Editor
3. Find `raw_ttb` table
4. You should see 3 rows with the extracted data

### Option B: SQL Query
1. Supabase → SQL Editor
2. Run:
```sql
SELECT * FROM raw_ttb ORDER BY created_at DESC;
```

**Expected Result:**
```
| ttbid | ct      | or     | productsource         | producttype        |
|-------|---------|--------|-----------------------|-------------------|
| 12345 | 2024001 | 789456 | Kentucky Distillery   | Bourbon Whiskey   |
| 12346 | 2024002 | 789457 | Tennessee Distillery  | Tennessee Whiskey |
| 12347 | 2024003 | 789458 | California Winery     | Brandy            |
```

---

## 🎉 Success Criteria

✅ Document uploaded successfully
✅ Data extracted (AI or Visual Template)
✅ Template saved
✅ Entity created with fields
✅ Database table created
✅ Pipeline created
✅ Code generated successfully
✅ Pipeline deployed to Dagster
✅ Pipeline executed without errors
✅ Data visible in Supabase table

---

## 🐛 Troubleshooting

### Problem: "Table does not exist" error in Dagster

**Solution**: You forgot Step 6! Create the table in Supabase first.

### Problem: "No artifacts found" in Dagster logs

**Solution**:
- Make sure you selected the correct source when creating the pipeline
- Verify artifact is linked to that source

### Problem: "AI extraction failed"

**Solution**:
- Check ANTHROPIC_API_KEY is set in .env.local
- Verify API key is valid
- Check network connectivity

### Problem: "Template extraction returned null"

**Solution**:
- Check template selectors are correct
- For HTML: Verify CSS selectors match document structure
- For PDF: Verify bounding boxes are accurate

### Problem: "Pipeline not appearing in Dagster"

**Solution**:
- Check dagster_home/pipelines/ directory has the .py file
- Check __init__.py is loading modules correctly
- Restart Dagster: `./start-dagster.sh`

### Problem: "Deployment status stuck on 'deploying'"

**Solution**:
- Check browser console for errors
- Check Next.js logs
- Try refreshing the page

---

## 📊 Next Steps After Successful Test

Once you've completed this test:

1. **Try with Real Data**: Upload actual TTB or NABCA reports
2. **Test Visual Template**: Try the visual template builder
3. **Create More Entities**: Build REFERENCE and MASTER entities
4. **Test ER Diagram**: Visualize entity relationships
5. **Test Transformations**: Create pipelines with entity relationships
6. **Schedule Pipelines**: Change from MANUAL to DAILY/HOURLY
7. **Batch Processing**: Upload multiple files to test at scale

---

## 🔄 Testing Different Scenarios

### Scenario 1: Template-First Extraction
- Build visual template first
- Upload multiple similar documents
- Run pipeline - should use template (fast, no AI cost)

### Scenario 2: AI-Only Extraction
- Don't create template
- Upload document
- Extract with AI
- Run pipeline - uses pre-extracted AI data

### Scenario 3: Multi-Document Processing
- Upload 10-20 similar documents
- Create template from first one
- Run pipeline
- Should process all documents quickly

### Scenario 4: Entity Relationships
- Create INTERIM entity (raw_ttb)
- Create REFERENCE entity (products)
- Create MASTER entity (inventory)
- Build pipelines linking them
- Test data flow through all three

---

## 💡 Tips

- **Start Simple**: Test with HTML first (easier than PDF)
- **Small Datasets**: Test with 2-3 records initially
- **Watch Logs**: Keep Dagster logs open to debug issues
- **Iterate**: Fix one issue at a time
- **Save Templates**: Always save templates for reuse

---

## 📝 Report Issues

If you encounter bugs:
1. Note the exact step where it failed
2. Copy error messages from browser console
3. Copy Dagster logs if applicable
4. Check Next.js terminal output
5. Report with reproduction steps
