/**
 * Cascade Rule-Based Extraction Engine
 *
 * Three-layer extraction strategy:
 * Layer 1: Structural (XPath/CSS) - < 1ms, works when structure is identical
 * Layer 2: Pattern (Regex) - < 10ms, works when structure changes but pattern stays same
 * Layer 3: AI Fallback - 3000ms, $$$ - triggered at higher level
 *
 * This enables 95-99% cost reduction by avoiding AI calls
 */

import * as cheerio from 'cheerio';
import { xpath } from 'xpath-ts2';
import { DOMParser } from '@xmldom/xmldom';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export interface TemplateSelectors {
  // New cascade format
  fields?: Record<string, CascadeFieldSelector>;

  // For PDF
  structural?: {
    tableRules?: TableRules;
  };
  patterns?: Record<string, PatternSelector>;
}

export interface CascadeFieldSelector {
  structural?: StructuralSelector;
  pattern?: PatternSelector;
  validation?: ValidationRules;
}

export interface StructuralSelector {
  xpath?: string;
  cssSelector?: string;
  sampleValue: string;
  elementInfo?: {
    tagName: string;
    className: string;
    id: string;
  };
  checkboxConfig?: {
    isCheckboxGroup: boolean;
    inputType: 'checkbox' | 'radio';
    allOptions: string[];
    multiSelect: boolean;
  };
}

export interface PatternSelector {
  primary: string;
  fallback?: string;
  location?: string;
  extractionType: 'regex';
  group: number;
}

export interface ValidationRules {
  format?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  allowedValues?: string[];
  pattern?: string;
}

export interface TableRules {
  pageNumber: number;
  tableIndex: number;
  hasHeader: boolean;
  columnMappings: Record<string, ColumnMapping>;
  startRow?: number;
  notes?: string;
}

export interface ColumnMapping {
  columnIndex: number;
  columnHeader?: string;
}

export interface ExtractionResult {
  success: boolean;
  data?: Record<string, any>[];
  fields?: string[];
  error?: string;
  method: 'xpath' | 'css' | 'regex' | 'regex_fallback' | 'table' | 'failed';
  failedFields?: string[]; // Fields that couldn't be extracted
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract label text from checked checkbox/radio inputs
 * Uses multiple methods to find labels associated with inputs
 */
function extractCheckboxLabels(
  $: cheerio.CheerioAPI,
  selector: string,
  inputType: 'checkbox' | 'radio'
): string | null {
  const checkedInputs = $(selector);

  if (checkedInputs.length === 0) {
    return null;
  }

  const labels: string[] = [];

  checkedInputs.each((_, input) => {
    const $input = $(input);
    let labelText = '';

    // Method 1: Check for <label> with matching 'for' attribute
    const inputId = $input.attr('id');
    if (inputId) {
      const $label = $(`label[for="${inputId}"]`);
      if ($label.length > 0) {
        labelText = $label.text().trim();
      }
    }

    // Method 2: Check if input is inside a <label>
    if (!labelText) {
      const $parentLabel = $input.closest('label');
      if ($parentLabel.length > 0) {
        // Clone to remove input text, get only label text
        const $clone = $parentLabel.clone();
        $clone.find('input').remove();
        labelText = $clone.text().trim();
      }
    }

    // Method 3: Check for adjacent text node or label (next sibling)
    if (!labelText) {
      let $sibling = $input.next();
      if ($sibling.length > 0) {
        if ($sibling.is('label')) {
          labelText = $sibling.text().trim();
        } else {
          // Sometimes label text is directly in the next element
          const siblingText = $sibling.text().trim();
          if (siblingText && siblingText.length < 100) {
            labelText = siblingText;
          }
        }
      }
    }

    // Method 4: Check parent element's text (excluding input)
    if (!labelText) {
      const $parent = $input.parent();
      if ($parent.length > 0) {
        const $parentClone = $parent.clone();
        $parentClone.find('input').remove();
        const parentText = $parentClone.text().trim();
        if (parentText && parentText.length < 100) {
          labelText = parentText;
        }
      }
    }

    // Method 5: Fallback to value attribute
    if (!labelText) {
      labelText = $input.attr('value') || $input.attr('name') || '';
    }

    if (labelText) {
      labels.push(labelText);
    }
  });

  if (labels.length === 0) {
    return null;
  }

  // For radio buttons, return single value
  // For checkboxes, return comma-separated values
  return inputType === 'radio' ? labels[0] : labels.join(', ');
}

// ═══════════════════════════════════════════════════════════════
// CASCADE EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Extract a single field using cascade strategy
 * Returns: { value, method } or null if all layers fail
 */
function extractFieldCascade(
  fieldName: string,
  fieldSelector: CascadeFieldSelector,
  htmlContent: string,
  $: cheerio.CheerioAPI,
  doc: Document
): { value: string | null; method: 'xpath' | 'css' | 'regex' | 'regex_fallback' | 'failed' } {
  // ═════ LAYER 1: STRUCTURAL (XPath/CSS) ═════
  if (fieldSelector.structural) {
    // For checkbox/radio fields, skip XPath and use CSS directly (more reliable)
    const isCheckboxField = fieldSelector.structural.checkboxConfig !== undefined;

    // Try XPath first (most precise) - skip for checkbox fields
    if (fieldSelector.structural.xpath && !isCheckboxField) {
      try {
        const result = xpath.select(fieldSelector.structural.xpath, doc);
        if (Array.isArray(result) && result.length > 0) {
          const node = result[0] as any;
          const value = (node.textContent || node.nodeValue || '').trim();
          if (value) {
            console.log(`✅ [${fieldName}] Extracted via XPath`);
            return { value, method: 'xpath' };
          }
        }
      } catch (xpathError) {
        console.warn(`⚠️  [${fieldName}] XPath failed:`, xpathError);
      }
    }

    // Try CSS selector as backup
    if (fieldSelector.structural.cssSelector) {
      try {
        // Check if this is a checkbox/radio field
        const isCheckboxField = fieldSelector.structural.checkboxConfig ||
                                fieldSelector.structural.cssSelector.includes(':checked');

        if (isCheckboxField && fieldSelector.structural.checkboxConfig) {
          // Extract checkbox labels using specialized helper
          const value = extractCheckboxLabels(
            $,
            fieldSelector.structural.cssSelector,
            fieldSelector.structural.checkboxConfig.inputType
          );
          if (value) {
            console.log(`✅ [${fieldName}] Extracted checkbox/radio via CSS selector: "${value}"`);
            return { value, method: 'css' };
          }
        } else {
          // Normal text extraction
          const element = $(fieldSelector.structural.cssSelector).first();
          const value = element.text().trim();
          if (value) {
            console.log(`✅ [${fieldName}] Extracted via CSS selector`);
            return { value, method: 'css' };
          }
        }
      } catch (cssError) {
        console.warn(`⚠️  [${fieldName}] CSS selector failed:`, cssError);
      }
    }
  }

  // ═════ LAYER 2: PATTERN (Regex) ═════
  if (fieldSelector.pattern) {
    // Try primary regex pattern
    if (fieldSelector.pattern.primary) {
      try {
        const regex = new RegExp(fieldSelector.pattern.primary, 'i');
        const match = htmlContent.match(regex);
        if (match && match[fieldSelector.pattern.group]) {
          const value = match[fieldSelector.pattern.group].trim();
          console.log(`✅ [${fieldName}] Extracted via primary regex pattern`);
          return { value, method: 'regex' };
        }
      } catch (regexError) {
        console.warn(`⚠️  [${fieldName}] Primary regex failed:`, regexError);
      }
    }

    // Try fallback regex pattern
    if (fieldSelector.pattern.fallback) {
      try {
        const regex = new RegExp(fieldSelector.pattern.fallback, 'i');
        const match = htmlContent.match(regex);
        if (match && match[fieldSelector.pattern.group]) {
          const value = match[fieldSelector.pattern.group].trim();
          console.log(`✅ [${fieldName}] Extracted via fallback regex pattern`);
          return { value, method: 'regex_fallback' };
        }
      } catch (regexError) {
        console.warn(`⚠️  [${fieldName}] Fallback regex failed:`, regexError);
      }
    }
  }

  // ═════ ALL LAYERS FAILED ═════
  console.error(`❌ [${fieldName}] All extraction layers failed`);
  return { value: null, method: 'failed' };
}

/**
 * Extract data from HTML using cascade strategy
 */
export async function extractFromHTMLWithRules(
  htmlContent: string,
  selectors: TemplateSelectors
): Promise<ExtractionResult> {
  try {
    if (!selectors.fields) {
      return {
        success: false,
        error: 'No field selectors provided',
        method: 'failed'
      };
    }

    const $ = cheerio.load(htmlContent);
    const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    const fields = Object.keys(selectors.fields);
    const extractedData: Record<string, any> = {};
    const methods: Record<string, string> = {};
    const failedFields: string[] = [];

    console.log('═══════════════════════════════════════');
    console.log('🔄 Starting cascade extraction...');
    console.log(`Fields to extract: ${fields.join(', ')}`);
    console.log('═══════════════════════════════════════');

    // Extract each field using cascade strategy
    for (const [fieldName, fieldSelector] of Object.entries(selectors.fields)) {
      const result = extractFieldCascade(fieldName, fieldSelector, htmlContent, $, doc);
      extractedData[fieldName] = result.value;
      methods[fieldName] = result.method;

      if (result.method === 'failed') {
        failedFields.push(fieldName);
      }
    }

    console.log('═══════════════════════════════════════');
    console.log('📊 Extraction Summary:');
    console.log(`Total fields: ${fields.length}`);
    console.log(`Successful: ${fields.length - failedFields.length}`);
    console.log(`Failed: ${failedFields.length}`);
    if (failedFields.length > 0) {
      console.log(`Failed fields: ${failedFields.join(', ')}`);
    }
    console.log('Method breakdown:', methods);
    console.log('═══════════════════════════════════════');

    // Check if we got any data
    const hasData = Object.values(extractedData).some(v => v !== null);

    if (!hasData) {
      return {
        success: false,
        error: 'No data extracted using cascade rules. All layers failed.',
        method: 'failed',
        failedFields
      };
    }

    // Determine primary method used (most common)
    const methodCounts: Record<string, number> = {};
    Object.values(methods).forEach(m => {
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    });
    const primaryMethod = Object.keys(methodCounts).reduce((a, b) =>
      methodCounts[a] > methodCounts[b] ? a : b
    ) as ExtractionResult['method'];

    return {
      success: true,
      data: [extractedData],
      fields,
      method: primaryMethod,
      failedFields: failedFields.length > 0 ? failedFields : undefined
    };
  } catch (error) {
    console.error('HTML cascade extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cascade extraction failed',
      method: 'failed'
    };
  }
}

/**
 * Extract data from PDF using cascade strategy
 *
 * PDF extraction is more complex - it can use:
 * - Table structure rules (for tabular data)
 * - Regex patterns (for form fields)
 *
 * Note: This is a simplified implementation. Full PDF support would require:
 * - pdf2json or similar for table structure
 * - Text extraction with position coordinates
 */
export async function extractFromPDFWithRules(
  pdfContent: any,
  selectors: TemplateSelectors
): Promise<ExtractionResult> {
  try {
    console.log('═══════════════════════════════════════');
    console.log('🔄 Starting PDF cascade extraction...');
    console.log('═══════════════════════════════════════');

    // Try table-based extraction first
    if (selectors.structural?.tableRules) {
      const tableRules = selectors.structural.tableRules;
      const fields = Object.keys(tableRules.columnMappings);

      // Check if PDF has table structure
      if (pdfContent.tables && Array.isArray(pdfContent.tables)) {
        const table = pdfContent.tables[tableRules.tableIndex];

        if (table) {
          const extractedData: Record<string, any>[] = [];
          const startRow = tableRules.startRow || (tableRules.hasHeader ? 1 : 0);

          // Extract each row using column mappings
          for (let i = startRow; i < table.rows.length; i++) {
            const row = table.rows[i];
            const record: Record<string, any> = {};

            for (const [fieldName, mapping] of Object.entries(tableRules.columnMappings)) {
              const cellValue = row[mapping.columnIndex];
              record[fieldName] = cellValue || null;
            }

            extractedData.push(record);
          }

          if (extractedData.length > 0) {
            console.log(`✅ Extracted ${extractedData.length} rows via table rules`);
            return {
              success: true,
              data: extractedData,
              fields,
              method: 'table'
            };
          }
        }
      }
    }

    // Fallback to pattern-based extraction (for form fields)
    if (selectors.patterns) {
      const pdfText = typeof pdfContent === 'string' ? pdfContent : pdfContent.text || '';
      const fields = Object.keys(selectors.patterns);
      const extractedData: Record<string, any> = {};
      const methods: Record<string, string> = {};
      const failedFields: string[] = [];

      for (const [fieldName, pattern] of Object.entries(selectors.patterns)) {
        let value: string | null = null;

        // Try primary pattern
        try {
          const regex = new RegExp(pattern.primary, 'i');
          const match = pdfText.match(regex);
          if (match && match[pattern.group]) {
            value = match[pattern.group].trim();
            methods[fieldName] = 'regex';
          }
        } catch (regexError) {
          console.warn(`⚠️  [${fieldName}] Primary regex failed:`, regexError);
        }

        // Try fallback pattern if needed
        if (!value && pattern.fallback) {
          try {
            const regex = new RegExp(pattern.fallback, 'i');
            const match = pdfText.match(regex);
            if (match && match[pattern.group]) {
              value = match[pattern.group].trim();
              methods[fieldName] = 'regex_fallback';
            }
          } catch (regexError) {
            console.warn(`⚠️  [${fieldName}] Fallback regex failed:`, regexError);
          }
        }

        extractedData[fieldName] = value;
        if (!value) {
          failedFields.push(fieldName);
        }
      }

      const hasData = Object.values(extractedData).some(v => v !== null);

      if (hasData) {
        console.log('✅ Extracted data via regex patterns');
        return {
          success: true,
          data: [extractedData],
          fields,
          method: 'regex',
          failedFields: failedFields.length > 0 ? failedFields : undefined
        };
      }
    }

    // All methods failed
    return {
      success: false,
      error: 'PDF extraction failed. No table structure or pattern matches found.',
      method: 'failed'
    };
  } catch (error) {
    console.error('PDF cascade extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF extraction failed',
      method: 'failed'
    };
  }
}

/**
 * Main extraction function that routes to appropriate engine
 */
export async function extractWithRules(
  content: string | any,
  artifactType: string,
  selectors: TemplateSelectors
): Promise<ExtractionResult> {
  console.log(`\n🚀 Cascade Extraction Engine v1.0`);
  console.log(`📄 Artifact Type: ${artifactType}`);
  console.log(`⚙️  Extraction Layers: Structural → Pattern → AI Fallback\n`);

  if (artifactType === 'html') {
    return extractFromHTMLWithRules(content as string, selectors);
  } else if (artifactType === 'pdf') {
    return extractFromPDFWithRules(content, selectors);
  } else {
    return {
      success: false,
      error: `Unsupported artifact type for rule extraction: ${artifactType}`,
      method: 'failed'
    };
  }
}
