# AI Extraction Quick Start Guide

This guide will help you test AI-powered data extraction with Claude API.

## Prerequisites

1. **Anthropic API Key**
   - Sign up at https://console.anthropic.com/
   - Create an API key
   - Copy the key (starts with `sk-ant-...`)

2. **Test PDF**
   - Download a sample document with structured data (e.g., price list, data table)
   - Save as `test-data/sample.pdf`

## Setup

### Step 1: Configure Environment Variables

Add your Anthropic API key to `.env.local`:

```bash
# Copy the example file if you haven't already
cp .env.local.example .env.local

# Edit .env.local and add your key
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 2: Add Test Data

Place a test PDF in the test-data directory:

```bash
# Example structure
test-data/
  └── sample.pdf    # Your test document
```

**Recommended test documents:**
- NABCA monthly price lists (tabular data)
- TTB product reports (structured tables)
- Invoice PDFs with line items
- Any PDF with repeating data patterns

### Step 3: Run the Test Script

```bash
npx tsx scripts/test-ai-extraction.ts
```

## What the Test Does

The script will:

1. ✅ Load your test PDF
2. ✅ Convert it to base64 for Claude API
3. ✅ Send extraction request with structured prompt
4. ✅ Parse the JSON response
5. ✅ Display extracted records
6. ✅ Show token usage and cost estimates
7. ✅ Validate field accuracy

## Expected Output

```
╔════════════════════════════════════════════════════════════╗
║   Inspector Dom - AI Extraction Test                      ║
╚════════════════════════════════════════════════════════════╝

🤖 Starting AI Extraction Test
================================

📄 File: ./test-data/sample.pdf
📊 File size: 1.24 MB
🎯 Media type: application/pdf

💬 User Prompt:
"Extract all products from this document..."

⏳ Calling Claude API...

✅ API call completed in 8.42s

📝 Raw Response:
────────────────────────────────────────────────────────────
[
  {
    "product_name": "Jack Daniels Tennessee Whiskey",
    "bottle_size_ml": 750,
    "price": 29.99,
    "state": "CA"
  },
  ...
]
────────────────────────────────────────────────────────────

✨ Extraction Results:
   Records extracted: 156

📋 Sample Records (first 3):
────────────────────────────────────────────────────────────

Record 1:
  product_name: Jack Daniels Tennessee Whiskey
  bottle_size_ml: 750
  price: 29.99
  state: CA

Record 2:
  product_name: Jameson Irish Whiskey
  bottle_size_ml: 750
  price: 24.99
  state: CA
...
────────────────────────────────────────────────────────────

💰 Usage & Cost:
   Input tokens:  12,456
   Output tokens: 2,891
   Estimated cost: $0.0807

🔍 Validation:
   ✅ All expected fields present
   📊 Estimated accuracy: 94%

🎉 Test completed successfully!

Next steps:
1. Review the extracted data above
2. If accuracy is >80%, proceed to build the API
3. If accuracy is low, refine the prompt and try again
```

## Success Criteria

| Accuracy | Action |
|----------|--------|
| **>80%** | ✅ Excellent! Proceed to build the production API |
| **60-80%** | ⚠️ Good but needs tuning. Refine the prompt and retry |
| **<60%** | ❌ Poor extraction. Check document quality or try different approach |

## Troubleshooting

### Error: ANTHROPIC_API_KEY not found
```bash
# Make sure .env.local exists and contains:
ANTHROPIC_API_KEY=sk-ant-your-actual-key
```

### Error: File not found
```bash
# Check the file path
ls -la test-data/sample.pdf

# Make sure the file exists
```

### Low Accuracy (<60%)

**Possible causes:**
1. **Document quality**: Scanned PDFs work less well than native PDFs
2. **Complex layouts**: Multi-column or nested tables can confuse extraction
3. **Prompt clarity**: Vague instructions lead to poor results

**Solutions:**
1. **Refine the prompt**: Be more specific about what to extract
2. **Add examples**: Show Claude what the output should look like
3. **Break it down**: Extract different sections separately
4. **Try different pages**: Some pages may extract better than others

### Example: Improving a Prompt

**Bad (vague):**
```
"Get the data from this PDF"
```

**Good (specific):**
```
Extract all products from the price list table.

For each product row, extract:
- product_name: Full product name (text)
- bottle_size_ml: Size in milliliters (number)
- price: Price in dollars (number, no $ sign)
- state: 2-letter state code (text, uppercase)

Skip header rows and totals.
```

**Better (with examples):**
```
Extract all products from the price list table.

Expected fields:
- product_name (text)
- bottle_size_ml (number)
- price (number)
- state (text, 2 letters)

Example output:
[
  {"product_name": "Jack Daniels", "bottle_size_ml": 750, "price": 29.99, "state": "CA"},
  {"product_name": "Jameson", "bottle_size_ml": 750, "price": 24.99, "state": "NY"}
]

Rules:
1. Convert "L" to ML (1L = 1000ML)
2. Remove $ signs from prices
3. Uppercase all state codes
4. Skip any row with "Total" or "Subtotal"
```

## Cost Estimation

Claude API pricing (as of Jan 2025):
- **Input**: $3 per 1M tokens (~$0.003 per 1K tokens)
- **Output**: $15 per 1M tokens (~$0.015 per 1K tokens)

**Typical costs:**
- Small PDF (1-2 pages): $0.02 - $0.05
- Medium PDF (5-10 pages): $0.10 - $0.30
- Large PDF (20+ pages): $0.50 - $2.00

**For 1000 documents/month:**
- Small: ~$20-50/month
- Medium: ~$100-300/month
- Large: ~$500-2000/month

## Next Steps

Once the test succeeds (>80% accuracy):

1. ✅ **Build the API** - Create `/api/extract/ai` endpoint
2. ✅ **Add UI** - "Extract with AI" button in file viewer
3. ✅ **Enable corrections** - Users can fix mistakes
4. ✅ **Save as templates** - Reuse prompts across files
5. ✅ **Deploy pipelines** - Automate extraction at scale

## Support

**Issues:**
- Check the console output for detailed error messages
- Verify API key is valid: https://console.anthropic.com/
- Ensure PDF is readable (not password-protected or corrupted)

**Questions:**
- Review the spec in the main README
- Check existing implementation in `src/`
- See database schema in `supabase/schema.sql`

---

**Ready to extract data? Run the test now:**

```bash
npx tsx scripts/test-ai-extraction.ts
```
