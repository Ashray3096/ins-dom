/**
 * HTML Extraction API
 *
 * POST /api/extract/html - Extract data from HTML using template selectors
 *
 * Uses jsdom for server-side DOM parsing (same as browser rendering)
 * This ensures selectors created in browser work identically during extraction
 */

import { NextRequest, NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { html, selectors } = body;

    if (!html) {
      return NextResponse.json({ error: 'HTML content required' }, { status: 400 });
    }

    if (!selectors || typeof selectors !== 'object') {
      return NextResponse.json({ error: 'Selectors required' }, { status: 400 });
    }

    // Parse HTML with jsdom (same as browser)
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract data for each field
    const record: Record<string, any> = {};
    const fields = selectors.fields || {};

    console.log(`Extracting ${Object.keys(fields).length} fields...`);

    for (const [fieldName, selector] of Object.entries(fields)) {
      const structural = (selector as any).structural || {};
      const checkboxConfig = (selector as any).checkboxConfig;
      const cssSelector = structural.cssSelector;
      const xpath = structural.xpath;

      console.log(`\n--- Field: ${fieldName} ---`);
      console.log(`CSS: ${cssSelector}`);
      console.log(`XPath: ${xpath}`);
      console.log(`Has checkboxConfig: ${!!checkboxConfig}`);

      let value: string | null = null;

      // Try CSS selector first - but convert nth-of-type to querySelectorAll index
      if (cssSelector) {
        try {
          // Check if selector uses nth-of-type for tables
          const tableNthMatch = cssSelector.match(/table:nth-of-type\((\d+)\)/);

          if (tableNthMatch) {
            // Convert to querySelectorAll approach (counts ALL tables globally)
            const tableIndex = parseInt(tableNthMatch[1]) - 1; // 0-indexed
            const allTables = document.querySelectorAll('table');
            console.log(`Found ${allTables.length} total tables in document`);

            if (tableIndex < allTables.length) {
              const targetTable = allTables[tableIndex];

              // Parse remaining selector to extract row/cell indices
              const remainingSelector = cssSelector.replace(/table:nth-of-type\(\d+\)\s*/, '');
              console.log(`Querying within table ${tableIndex + 1} with: "${remainingSelector}"`);

              // Count rows in this table
              const allRows = targetTable.querySelectorAll('tr');
              console.log(`Table ${tableIndex + 1} has ${allRows.length} rows`);

              // Extract row index from selector
              const rowMatch = remainingSelector.match(/tr:nth-of-type\((\d+)\)/);
              if (rowMatch) {
                const rowIndex = parseInt(rowMatch[1]) - 1; // 0-indexed
                if (rowIndex < allRows.length) {
                  const targetRow = allRows[rowIndex];

                  // Extract cell index
                  const cellMatch = remainingSelector.match(/td:nth-of-type\((\d+)\)/);
                  if (cellMatch) {
                    const cellIndex = parseInt(cellMatch[1]) - 1;
                    const allCells = targetRow.querySelectorAll('td, th');
                    if (cellIndex < allCells.length) {
                      const targetCell = allCells[cellIndex];

                      // Query for div.data or input within cell
                      let finalSelector = remainingSelector
                        .replace(/tr:nth-of-type\(\d+\)\s*/, '')
                        .replace(/td:nth-of-type\(\d+\)\s*/, '');

                      // Fix checkbox selector: :checked doesn't work in jsdom, use [checked] attribute
                      finalSelector = finalSelector.replace(':checked', '[checked]');

                      const element = targetCell.querySelector(finalSelector) || targetCell;
                      console.log(`CSS matched (via indices): ${element ? 'YES' : 'NO'}`);
                      if (element) {
                        // For input/checkbox elements, use 4-method label detection
                        if (element.tagName.toLowerCase() === 'input') {
                          value = getCheckboxLabel(element as any, document);
                          console.log(`Checkbox label extracted: ${value}`);
                        } else {
                          value = element.textContent?.trim() || null;
                        }
                        console.log(`CSS value: ${value?.substring(0, 50)}`);
                      }
                    }
                  }
                } else {
                  console.log(`Row ${rowIndex + 1} exceeds rows in table (${allRows.length})`);
                }
              } else {
                // Fallback to regular querySelector
                const element = targetTable.querySelector(remainingSelector);
                console.log(`CSS matched (via table index): ${element ? 'YES' : 'NO'}`);
                if (element) {
                  value = element.textContent?.trim() || null;
                  console.log(`CSS value: ${value?.substring(0, 50)}`);
                }
              }
            } else {
              console.log(`Table index ${tableIndex + 1} exceeds total tables (${allTables.length})`);
            }
          } else {
            // Regular selector without nth-of-type
            const element = document.querySelector(cssSelector);
            console.log(`CSS matched: ${element ? 'YES' : 'NO'}`);
            if (element) {
              value = element.textContent?.trim() || null;
              console.log(`CSS value: ${value?.substring(0, 50)}`);
            }
          }
        } catch (error) {
          console.log(`CSS selector failed for ${fieldName}:`, error);
        }
      }

      // Fallback to XPath if CSS fails
      if (value === null && xpath) {
        try {
          const result = document.evaluate(
            xpath,
            document,
            null,
            dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );

          console.log(`XPath matched: ${result.singleNodeValue ? 'YES' : 'NO'}`);
          if (result.singleNodeValue) {
            value = result.singleNodeValue.textContent?.trim() || null;
            console.log(`XPath value: ${value?.substring(0, 50)}`);
          }
        } catch (error) {
          console.log(`XPath failed for ${fieldName}:`, error);
        }
      }

      // Handle checkbox/radio groups
      if (checkboxConfig && checkboxConfig.isCheckboxGroup) {
        value = cleanCheckboxValue(value, checkboxConfig);
      }

      // Normalize whitespace
      if (value) {
        value = value.replace(/\s+/g, ' ').trim();
      }

      console.log(`Final value: ${value}`);
      record[fieldName] = value;
    }

    console.log(`\nExtraction complete. Fields with values: ${Object.values(record).filter(v => v).length}`);

    return NextResponse.json({
      success: true,
      data: record,
    });

  } catch (error) {
    console.error('Error extracting from HTML:', error);
    return NextResponse.json(
      {
        error: 'Extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get checkbox label using 4-method detection (from inspector-dom)
 */
function getCheckboxLabel(input: HTMLInputElement, document: Document): string | null {
  // Method 1: Explicit <label for="id">
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label?.textContent?.trim()) {
      return cleanLabelText(label.textContent.trim());
    }
  }

  // Method 2: Input inside <label>
  const labelParent = input.closest('label');
  if (labelParent) {
    // Clone to avoid modifying DOM
    const clone = labelParent.cloneNode(true) as HTMLElement;
    const inputClone = clone.querySelector('input');
    if (inputClone) inputClone.remove();
    const text = clone.textContent?.trim();
    if (text) return cleanLabelText(text);
  }

  // Method 3: Adjacent text nodes (walk siblings until next input)
  let sibling = input.nextSibling;
  while (sibling) {
    if (sibling.nodeType === 3) {
      // Text node
      const text = sibling.textContent?.trim() || '';
      if (text && text.length > 1) {
        return cleanLabelText(text);
      }
    } else if (sibling.nodeType === 1) {
      // Element node
      const elem = sibling as Element;
      if (elem.tagName.toLowerCase() === 'input') {
        // Hit next checkbox, stop
        break;
      }
      const text = elem.textContent?.trim() || '';
      if (text && text.length > 1 && text.length < 100) {
        return cleanLabelText(text);
      }
    }
    sibling = sibling.nextSibling;
  }

  // Method 4: Fallback to value/name attribute
  if (input.value?.trim()) return cleanLabelText(input.value.trim());
  const name = input.getAttribute('name');
  if (name) return cleanLabelText(name);

  return null;
}

/**
 * Clean checkbox label text
 */
function cleanLabelText(text: string): string {
  // Remove form instructions and numbers
  let cleaned = text
    .replace(/\d+\./g, '')  // Remove numbers like "5."
    .replace(/\(Required\)/gi, '')
    .replace(/\(Optional\)/gi, '')
    .replace(/CHECK/gi, '')
    .replace(/SELECT/gi, '')
    .replace(/Fill in/gi, '')
    .trim();

  // Take first meaningful phrase (max 5 words)
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 5) {
    cleaned = words.slice(0, 5).join(' ');
  }

  return cleaned;
}

/**
 * Clean checkbox/radio field values
 */
function cleanCheckboxValue(rawValue: string | null, checkboxConfig: any): string | null {
  if (!rawValue) return null;

  const extractionMode = checkboxConfig.extractionMode || 'checked_only';

  if (extractionMode === 'checked_only') {
    // Extract just the label, remove form markup
    let cleaned = rawValue
      .replace(/\(Required\)/gi, '')
      .replace(/\(Optional\)/gi, '')
      .replace(/CHECK/gi, '')
      .replace(/SELECT/gi, '');

    // Split by newlines and take meaningful lines
    const lines = cleaned.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 2 && line.length < 100);

    // Find line that looks like a label
    for (const line of lines) {
      const lowered = line.toLowerCase();
      if (!lowered.includes('fill in') &&
          !lowered.includes('check') &&
          !lowered.includes('select') &&
          !lowered.includes('applicable')) {
        return line.trim();
      }
    }

    // Fallback
    return lines[0] || rawValue;
  }

  if (extractionMode === 'boolean') {
    return rawValue && rawValue.trim() ? 'true' : 'false';
  }

  return rawValue;
}
