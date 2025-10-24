/**
 * Prompt Engineering Utilities
 *
 * Build optimized prompts for Claude API based on templates and user corrections
 */

export interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  description?: string;
}

export interface PromptOptions {
  fields: FieldSchema[];
  userPrompt?: string;
  examples?: Array<Record<string, any>>;
  rules?: string[];
  corrections?: any[];
}

/**
 * Build system prompt for extraction
 */
export function buildSystemPrompt(options: PromptOptions): string {
  const { fields } = options;

  const fieldDescriptions = fields
    .map(f => `- ${f.name} (${f.type}${f.required ? ', required' : ', optional'})${f.description ? ': ' + f.description : ''}`)
    .join('\n');

  return `You are a data extraction assistant. Extract structured data from documents and return JSON.

Expected fields:
${fieldDescriptions}

Return an array of objects with these exact field names. Be precise and extract all matching records.`;
}

/**
 * Build user prompt with examples and rules
 */
export function buildUserPrompt(options: PromptOptions): string {
  const { userPrompt, examples, rules } = options;

  let prompt = userPrompt || 'Extract all data from this document.';

  // Add examples if provided
  if (examples && examples.length > 0) {
    prompt += '\n\nExample output format:\n';
    prompt += JSON.stringify(examples.slice(0, 2), null, 2);
  }

  // Add rules if provided
  if (rules && rules.length > 0) {
    prompt += '\n\nRules:\n';
    rules.forEach((rule, index) => {
      prompt += `${index + 1}. ${rule}\n`;
    });
  }

  return prompt;
}

/**
 * Build enhanced prompt with learning from corrections
 */
export function buildPromptWithLearning(
  basePrompt: string,
  pastCorrections: any[]
): string {
  if (!pastCorrections || pastCorrections.length === 0) {
    return basePrompt;
  }

  // Analyze common corrections
  const commonIssues = analyzeCorrections(pastCorrections);

  if (commonIssues.length === 0) {
    return basePrompt;
  }

  // Add learned rules to prompt
  const learnedRules = commonIssues
    .map(issue => {
      if (issue.type === 'wrong_column') {
        return `- ${issue.field} is usually in column ${issue.correctColumn}, not ${issue.wrongColumn}`;
      }
      if (issue.type === 'format') {
        return `- ${issue.field} should be formatted as ${issue.correctFormat}`;
      }
      if (issue.type === 'frequent_correction') {
        return `- Pay special attention to ${issue.field} - users often need to correct this field`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');

  return `${basePrompt}

Important corrections from past extractions:
${learnedRules}`;
}

/**
 * Analyze corrections to identify patterns
 */
function analyzeCorrections(corrections: any[]): Array<{
  type: string;
  field: string;
  message?: string;
  correctColumn?: string;
  wrongColumn?: string;
  correctFormat?: string;
}> {
  // Count corrections per field
  const fieldCounts: Record<string, number> = {};

  for (const correction of corrections) {
    if (correction.corrected_fields) {
      for (const field in correction.corrected_fields) {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      }
    }
  }

  // Return fields that are frequently corrected (more than 2 times)
  return Object.entries(fieldCounts)
    .filter(([_, count]) => count > 2)
    .map(([field, _]) => ({
      type: 'frequent_correction',
      field,
      message: `Pay special attention to ${field}`,
    }));
}

/**
 * Common prompt templates for different document types
 */
export const PROMPT_TEMPLATES = {
  PRICE_LIST: (productType: string) => ({
    userPrompt: `Extract all ${productType} products from the price list table.

For each product row, extract:
- Product name (full name including brand)
- Bottle size (convert to milliliters if in liters)
- Price (numeric value only, no currency symbols)
- State code (2-letter uppercase code)

Skip header rows, footer rows, and any totals.`,
    rules: [
      'Convert "L" to ML (1L = 1000ML)',
      'Remove $ signs from prices',
      'Uppercase all state codes',
      'Skip any row with "Total" or "Subtotal"',
      'If price is N/A or blank, set to null',
    ],
    examples: [
      {
        product_name: 'Jack Daniels Tennessee Whiskey',
        bottle_size_ml: 750,
        price: 29.99,
        state: 'CA',
      },
      {
        product_name: 'Jameson Irish Whiskey',
        bottle_size_ml: 1000,
        price: 34.99,
        state: 'NY',
      },
    ],
  }),

  /**
   * NABCA Sales Report Template
   * Optimized for NABCA monthly sales reports with brand sales data
   */
  NABCA_SALES: () => ({
    userPrompt: `Extract ALL individual brand records from the sales tables.

IMPORTANT INSTRUCTIONS:
1. ONLY extract rows that represent individual brands/products (detail rows)
2. SKIP category summary rows (rows like "TOTAL VODKA", "DOM WHSKY-BLND", etc.)
3. SKIP grand total rows (rows like "TOTAL ALL SPIRITS")
4. Extract EVERY brand across ALL table sections

For each brand row, extract:
- brand_name: The brand/product name ONLY (remove any category suffix codes)
- bottle_size: Keep original format (e.g., "9L", "1.75L", "750ml")
- case_sales_ytd: Year-to-date case sales (number)
- case_sales_12m: Rolling 12-month case sales (number)
- category: The product category classification

CRITICAL RULES:
1. Remove category suffix from brand_name:
   ❌ "TITO HANDMADE VODKA-CLASSIC-DOM"
   ✅ "TITO HANDMADE VODKA"

2. Clean abbreviated brand names where obvious:
   - "J DNL BLACK LBL" → "JACK DANIELS BLACK LABEL"
   - "CPTMRG" → "CAPTAIN MORGAN"
   - But keep as-is if unclear

3. For empty/missing values, use null

4. Category should be the product type classification:
   ✅ "VODKA-CLASSIC-DOM"
   ✅ "DOM WHSKY-STRT-BRBN/TN"

5. Skip rows where brand_name equals category (these are summary rows)`,
    rules: [
      'Extract only detail rows with specific brands',
      'Remove category suffix from brand names (everything after last hyphen if it looks like a category code)',
      'Keep original bottle size format',
      'Use null for empty values, not empty strings',
      'Skip all rows containing "TOTAL" in any field',
      'Skip rows where brand_name is just a category without a specific brand',
    ],
    examples: [
      {
        brand_name: 'TITO HANDMADE VODKA',
        bottle_size: '9L',
        case_sales_ytd: 2109668,
        case_sales_12m: 3775466,
        category: 'VODKA-CLASSIC-DOM',
      },
      {
        brand_name: 'JACK DANIELS BLACK LABEL',
        bottle_size: '9L',
        case_sales_ytd: 546987,
        case_sales_12m: 991016,
        category: 'DOM WHSKY-STRT-BRBN/TN',
      },
      {
        brand_name: 'MEZCAL',
        bottle_size: '1.75L',
        case_sales_ytd: null,
        case_sales_12m: null,
        category: 'MEZCAL',
      },
    ],
  }),

  TABULAR_DATA: () => ({
    userPrompt: `Extract all rows from the table in this document.

For each row, extract all columns as specified in the field list.

Rules:
1. Skip header rows
2. Skip empty rows
3. Maintain data types (numbers as numbers, text as text)
4. Handle missing values as null`,
    rules: [
      'Preserve original data types',
      'Use null for missing values',
      'Skip headers and footers',
      'Extract all visible rows',
    ],
  }),

  FORM_DATA: () => ({
    userPrompt: `Extract form field values from this document.

Identify labeled fields and their corresponding values.

Rules:
1. Match labels to values accurately
2. Handle multi-line values
3. Preserve formatting where relevant`,
    rules: [
      'Match field labels to values',
      'Combine multi-line text',
      'Preserve date and number formats',
    ],
  }),
};

/**
 * Get recommended prompt template based on document characteristics
 */
export function getRecommendedTemplate(
  documentType: string,
  contentHints?: string[]
): ReturnType<typeof PROMPT_TEMPLATES.TABULAR_DATA> {
  // Simple heuristic-based recommendation
  if (contentHints?.some(hint => hint.includes('price') || hint.includes('product'))) {
    return PROMPT_TEMPLATES.PRICE_LIST('beverage');
  }

  if (contentHints?.some(hint => hint.includes('table') || hint.includes('row'))) {
    return PROMPT_TEMPLATES.TABULAR_DATA();
  }

  if (contentHints?.some(hint => hint.includes('form') || hint.includes('field'))) {
    return PROMPT_TEMPLATES.FORM_DATA();
  }

  // Default to tabular data
  return PROMPT_TEMPLATES.TABULAR_DATA();
}
