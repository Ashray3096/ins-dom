/**
 * NABCA Table Identification Functions
 *
 * These functions identify which NABCA table a detected Textract table represents
 * by comparing headers against known patterns using fuzzy matching.
 */

import type { TableIdentificationPattern } from './nabca-template-config';
import { NABCA_MULTI_ENTITY_TEMPLATE } from './nabca-template-config';

// ═══════════════════════════════════════════════════════════════
// FUZZY STRING MATCHING
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate Levenshtein distance between two strings
 * (measure of how different two strings are)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0-1)
 * 1.0 = identical, 0.0 = completely different
 */
export function fuzzyMatch(str1: string, str2: string): number {
  // Normalize strings: lowercase, trim whitespace
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(s1, s2);
  return 1.0 - distance / maxLen;
}

/**
 * Find best match for a header from list of candidates
 * Returns: { match: string, score: number } or null
 */
export function findBestHeaderMatch(
  header: string,
  candidates: string[],
  threshold: number = 0.7
): { match: string; score: number } | null {
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = fuzzyMatch(header, candidate);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch ? { match: bestMatch, score: bestScore } : null;
}

// ═══════════════════════════════════════════════════════════════
// HEADER ROW DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Find the header row in a table by matching required headers
 * Scans through all rows to find which one contains the most header keywords
 *
 * @param tableData - Array of rows (each row is array of cell values)
 * @param requiredHeaders - Headers that must be present
 * @param fuzzyThreshold - Minimum similarity score for matching
 * @returns Header row index, or -1 if not found
 */
export function findHeaderRow(
  tableData: string[][],
  requiredHeaders: string[],
  fuzzyThreshold: number = 0.75
): number {
  let bestRowIndex = -1;
  let bestMatchCount = 0;

  // Scan first 10 rows (headers are usually at the top)
  const rowsToScan = Math.min(10, tableData.length);

  for (let rowIdx = 0; rowIdx < rowsToScan; rowIdx++) {
    const row = tableData[rowIdx];
    let matchCount = 0;

    // Count how many required headers are present in this row
    for (const requiredHeader of requiredHeaders) {
      for (const cell of row) {
        if (fuzzyMatch(cell, requiredHeader) >= fuzzyThreshold) {
          matchCount++;
          break; // Found match, move to next required header
        }
      }
    }

    // If this row has more matches than previous best, update
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestRowIndex = rowIdx;
    }
  }

  // Only return row if it matched at least 70% of required headers
  const matchRatio = bestMatchCount / requiredHeaders.length;
  if (matchRatio >= 0.7) {
    return bestRowIndex;
  }

  return -1;
}

/**
 * Extract header-to-column mapping from header row
 * Returns: Map of header name → column index
 */
export function extractHeaderMapping(
  headerRow: string[],
  requiredHeaders: string[],
  optionalHeaders: string[] = [],
  fuzzyThreshold: number = 0.75
): Map<string, number> {
  const mapping = new Map<string, number>();
  const allHeaders = [...requiredHeaders, ...optionalHeaders];

  for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
    const cellValue = headerRow[colIdx];

    // Try to match this cell against all known headers
    const match = findBestHeaderMatch(cellValue, allHeaders, fuzzyThreshold);

    if (match) {
      mapping.set(match.match, colIdx);
    }
  }

  return mapping;
}

// ═══════════════════════════════════════════════════════════════
// TABLE IDENTIFICATION
// ═══════════════════════════════════════════════════════════════

/**
 * Identify which NABCA table this data represents
 * Returns table pattern with confidence score, or null if no match
 */
export function identifyTable(
  tableData: string[][],
  patterns: TableIdentificationPattern[] = NABCA_MULTI_ENTITY_TEMPLATE.tablePatterns
): { pattern: TableIdentificationPattern; confidence: number; headerRowIndex: number } | null {
  if (!tableData || tableData.length === 0) {
    return null;
  }

  let bestMatch: {
    pattern: TableIdentificationPattern;
    confidence: number;
    headerRowIndex: number;
  } | null = null;

  // Try each pattern
  for (const pattern of patterns) {
    // Find header row
    const headerRowIndex = findHeaderRow(
      tableData,
      pattern.requiredHeaders,
      pattern.fuzzyThreshold
    );

    if (headerRowIndex === -1) {
      continue; // No header row found, skip this pattern
    }

    const headerRow = tableData[headerRowIndex];

    // Count matched required headers
    let requiredMatches = 0;
    for (const requiredHeader of pattern.requiredHeaders) {
      for (const cell of headerRow) {
        if (fuzzyMatch(cell, requiredHeader) >= pattern.fuzzyThreshold) {
          requiredMatches++;
          break;
        }
      }
    }

    // Calculate confidence score
    const requiredRatio = requiredMatches / pattern.requiredHeaders.length;

    // Check column count matches expected range
    const columnCount = headerRow.length;
    const columnMatch =
      columnCount >= pattern.minColumns && columnCount <= pattern.maxColumns;

    // Confidence = required header ratio (weighted 80%) + column match (weighted 20%)
    const confidence = requiredRatio * 0.8 + (columnMatch ? 0.2 : 0);

    // Only consider if confidence is above threshold
    if (confidence >= 0.7) {
      // If this is better than previous best match, update
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          pattern,
          confidence,
          headerRowIndex,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Map a data row to field names using header mapping
 * Returns: Record<fieldName, value>
 */
export function mapRowToFields(
  dataRow: string[],
  headerMapping: Map<string, number>,
  fieldSchema: any[]
): Record<string, any> {
  const record: Record<string, any> = {};

  for (const field of fieldSchema) {
    // Skip metadata fields (report_month, report_year) - will be added separately
    if (field.name === 'report_month' || field.name === 'report_year') {
      continue;
    }

    // Try to find matching column using field label
    const columnIndex = headerMapping.get(field.label);

    if (columnIndex !== undefined && columnIndex < dataRow.length) {
      const cellValue = dataRow[columnIndex];

      // Type conversion
      if (field.type === 'NUMBER') {
        // Remove commas and convert to number
        const cleaned = cellValue.replace(/,/g, '').trim();
        const num = parseFloat(cleaned);
        record[field.name] = isNaN(num) ? null : num;
      } else {
        record[field.name] = cellValue.trim() || null;
      }
    } else {
      record[field.name] = null;
    }
  }

  return record;
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXTRACTION FUNCTION
// ═══════════════════════════════════════════════════════════════

export interface TableExtractionResult {
  entityName: string;
  tableName: string;
  tableNumber: number;
  confidence: number;
  rows: Record<string, any>[];
  headerRowIndex: number;
  totalRows: number;
}

/**
 * Extract all NABCA tables from Textract output
 *
 * @param textractTables - Array of tables from Textract (format: {data: string[][]})
 * @returns Array of extraction results for each identified table
 */
export function extractNabcaTables(
  textractTables: { data: string[][] }[]
): TableExtractionResult[] {
  const results: TableExtractionResult[] = [];

  console.log(`\n🔍 Analyzing ${textractTables.length} tables from Textract...`);

  for (let i = 0; i < textractTables.length; i++) {
    const table = textractTables[i];

    // Identify which NABCA table this is
    const identification = identifyTable(table.data);

    if (!identification) {
      console.log(`⚠️  Table ${i + 1}: No match found (skipping)`);
      continue;
    }

    const { pattern, confidence, headerRowIndex } = identification;

    console.log(
      `✅ Table ${i + 1}: Identified as "${pattern.tableName}" (confidence: ${(confidence * 100).toFixed(1)}%)`
    );

    // Extract header mapping
    const headerRow = table.data[headerRowIndex];
    const headerMapping = extractHeaderMapping(
      headerRow,
      pattern.requiredHeaders,
      pattern.optionalHeaders,
      pattern.fuzzyThreshold
    );

    // Extract data rows (all rows after header)
    const dataRows: Record<string, any>[] = [];
    for (let rowIdx = headerRowIndex + 1; rowIdx < table.data.length; rowIdx++) {
      const dataRow = table.data[rowIdx];

      // Skip empty rows
      if (dataRow.every(cell => !cell || cell.trim() === '')) {
        continue;
      }

      const record = mapRowToFields(dataRow, headerMapping, pattern.fieldSchema);
      dataRows.push(record);
    }

    results.push({
      entityName: pattern.entityName,
      tableName: pattern.tableName,
      tableNumber: pattern.tableNumber,
      confidence,
      rows: dataRows,
      headerRowIndex,
      totalRows: dataRows.length,
    });

    console.log(`   Extracted ${dataRows.length} rows`);
  }

  console.log(`\n📊 Summary: Identified ${results.length} NABCA tables\n`);

  return results;
}
