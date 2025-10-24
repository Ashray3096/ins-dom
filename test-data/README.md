# Test Data for AI Extraction

This directory contains sample files for testing AI extraction capabilities.

## Required Files

To run the AI extraction tests, place a sample PDF here:

```
test-data/
  └── sample.pdf   # Your test PDF (e.g., NABCA price list, TTB report)
```

## Sample Data Sources

### NABCA (State Liquor Control Agencies)
- **URL**: https://nabca.com/
- **Example**: Monthly price lists with product names, sizes, prices, state codes
- **Format**: PDF tables

### TTB (Alcohol and Tobacco Tax and Trade Bureau)
- **URL**: https://www.ttb.gov/
- **Example**: Product registrations, label approvals
- **Format**: HTML tables, PDF reports

## How to Add Test Data

1. Download a sample PDF from one of the sources above
2. Save it as `sample.pdf` in this directory
3. Run the test script:
   ```bash
   npx tsx scripts/test-ai-extraction.ts
   ```

## Expected Output

The test script will:
1. Load the PDF
2. Send it to Claude API with extraction instructions
3. Parse the response as JSON
4. Display extracted records
5. Show token usage and estimated cost
6. Validate accuracy

## Success Criteria

✅ **Good extraction**: 80%+ accuracy, all expected fields present
⚠️  **Needs tuning**: 60-80% accuracy, refine prompt
❌ **Poor extraction**: <60% accuracy, may need different approach

## Notes

- Keep test files under 5MB for fast iteration
- Use diverse samples (different formats, layouts)
- Test with both clean and messy documents
- This directory is gitignored to avoid committing large files
