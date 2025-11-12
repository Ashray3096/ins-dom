/**
 * NABCA Multi-Entity Template Configuration
 *
 * This template describes HOW to identify the 8 different NABCA tables
 * from Textract output based on their header patterns.
 *
 * Used at runtime: PDF → Textract → Identify tables using this config → Route to DB
 */

import {
  TABLE_1_BRAND_LEADERS,
  TABLE_2_CURRENT_MONTH_SALES,
  TABLE_3_YTD_SALES,
  TABLE_4_L12M_SALES,
  TABLE_5_BRAND_SUMMARY,
  TABLE_6_VENDOR_TOP_100,
  TABLE_7_VENDOR_TOP_20_BY_CLASS,
  TABLE_8_CONTROL_STATES,
  type NabcaField,
} from './nabca-field-schemas';

export interface TableIdentificationPattern {
  tableNumber: number;
  tableName: string;
  entityName: string;
  requiredHeaders: string[]; // Headers that MUST be present to identify this table
  optionalHeaders: string[]; // Additional headers that may be present
  fuzzyThreshold: number; // Minimum similarity score (0-1) for header matching
  minColumns: number; // Minimum number of columns expected
  maxColumns: number; // Maximum number of columns expected
  fieldSchema: NabcaField[]; // Field definitions from nabca-field-schemas.ts
  sequenceGroup?: string; // For tables with identical headers, use sequential order (e.g., "category_performance")
  titleKeywords?: string[]; // Keywords to search for in page title to disambiguate tables
}

export interface NabcaMultiEntityTemplate {
  name: string;
  description: string;
  artifactType: 'pdf';
  isMultiEntity: true;
  targetEntities: string[];
  tablePatterns: TableIdentificationPattern[];
}

/**
 * NABCA 8-Table Template Configuration
 * Identifies all 8 NABCA tables from a single Textract call
 */
export const NABCA_MULTI_ENTITY_TEMPLATE: NabcaMultiEntityTemplate = {
  name: 'NABCA All Tables',
  description: 'Extracts all 8 NABCA tables from monthly PDF reports using single Textract call',
  artifactType: 'pdf',
  isMultiEntity: true,
  targetEntities: [
    'raw_nabca_table_1',
    'raw_nabca_table_2',
    'raw_nabca_table_3',
    'raw_nabca_table_4',
    'raw_nabca_table_5',
    'raw_nabca_table_6',
    'raw_nabca_table_7',
    'raw_nabca_table_8',
  ],
  tablePatterns: [
    // ═══════════════════════════════════════════════════════════════
    // TABLE 1: Brand Leaders (Current Month) - Pages 3-4
    // ═══════════════════════════════════════════════════════════════
    {
      tableNumber: 1,
      tableName: 'Brand Leaders',
      entityName: 'raw_nabca_table_1',
      requiredHeaders: ['BRAND', 'Type', 'Rank', 'Case Sales'],
      optionalHeaders: ['% Total', '+ or Last Year', 'Case Sales Last Twelve Months'],
      fuzzyThreshold: 0.75,
      minColumns: 8,
      maxColumns: 12,
      fieldSchema: TABLE_1_BRAND_LEADERS,
    },

    // ═══════════════════════════════════════════════════════════════
    // TABLE 2: Category Performance (Current Month) - Pages 5-6
    // ═══════════════════════════════════════════════════════════════
    {
      tableNumber: 2,
      tableName: 'Current Month Sales',
      entityName: 'raw_nabca_table_2',
      requiredHeaders: ['CLASS', 'Dist. Spirits', 'Cases'],
      optionalHeaders: ['1.75 L', '1.0 L', '750 ml', '375 ml', '200 ml', '100 ml', '50 ml'],
      fuzzyThreshold: 0.75,
      minColumns: 10,
      maxColumns: 15,
      fieldSchema: TABLE_2_CURRENT_MONTH_SALES,
      sequenceGroup: 'category_performance', // Sequential order: 1st match
      titleKeywords: ['CURRENT MONTH', 'TOTAL CASE SALES'],
    },

    // ═══════════════════════════════════════════════════════════════
    // TABLE 3: Category Performance (YTD) - Pages 7-8
    // ═══════════════════════════════════════════════════════════════
    {
      tableNumber: 3,
      tableName: 'YTD Sales',
      entityName: 'raw_nabca_table_3',
      requiredHeaders: ['CLASS', 'Dist. Spirits', 'Cases'],
      optionalHeaders: ['1.75 L', '1.0 L', '750 ml', '375 ml', '200 ml', '100 ml', '50 ml'],
      fuzzyThreshold: 0.75,
      minColumns: 10,
      maxColumns: 15,
      fieldSchema: TABLE_3_YTD_SALES,
      sequenceGroup: 'category_performance', // Sequential order: 2nd match
      titleKeywords: ['YEAR TO DATE', 'TOTAL CASE SALES'],
    },

    // ═══════════════════════════════════════════════════════════════
    // TABLE 4: Category Performance (L12M) - Pages 9-10
    // ═══════════════════════════════════════════════════════════════
    {
      tableNumber: 4,
      tableName: 'Rolling 12-Month Sales',
      entityName: 'raw_nabca_table_4',
      requiredHeaders: ['CLASS', 'Dist. Spirits', 'Cases'],
      optionalHeaders: ['1.75 L', '1.0 L', '750 ml', '375 ml', '200 ml', '100 ml', '50 ml'],
      fuzzyThreshold: 0.75,
      minColumns: 10,
      maxColumns: 15,
      fieldSchema: TABLE_4_L12M_SALES,
      sequenceGroup: 'category_performance', // Sequential order: 3rd match
      titleKeywords: ['ROLLING 12 MONTH', 'CASE SALES'],
    },

    // ═══════════════════════════════════════════════════════════════
    // TABLE 5: Brand Summary - Pages 11-346 (CORE FACT TABLE)
    // ═══════════════════════════════════════════════════════════════
    {
      tableNumber: 5,
      tableName: 'Brand Summary',
      entityName: 'raw_nabca_table_5',
      requiredHeaders: ['Class & Type', 'Brand', 'Vendor', 'Case Sales'],
      optionalHeaders: ['L12M', 'YTD', '% of Type', 'Current Month'],
      fuzzyThreshold: 0.75,
      minColumns: 12,
      maxColumns: 20,
      fieldSchema: TABLE_5_BRAND_SUMMARY,
    },

    // ═══════════════════════════════════════════════════════════════
    // TABLE 6: Vendor Sales Performance - Top 100 - Pages 365-366
    // ═══════════════════════════════════════════════════════════════
    {
      tableNumber: 6,
      tableName: 'Vendor Top 100',
      entityName: 'raw_nabca_table_6',
      requiredHeaders: ['Vendor', 'Rank', 'Share of Market', 'Last 12 Months This Year'],
      optionalHeaders: ['Last 12 Months Prior Year', 'This Year to Date', 'Current Month'],
      fuzzyThreshold: 0.75,
      minColumns: 10,
      maxColumns: 15,
      fieldSchema: TABLE_6_VENDOR_TOP_100,
      titleKeywords: ['TOP 100', 'VENDORS'],
    },

    // ═══════════════════════════════════════════════════════════════
    // TABLE 7: Vendor Sales Performance - Top 20 by Class - Pages 367-373
    // ═══════════════════════════════════════════════════════════════
    {
      tableNumber: 7,
      tableName: 'Vendor Top 20 by Class',
      entityName: 'raw_nabca_table_7',
      requiredHeaders: ['Class / Vendor', 'Rank', 'Share of Market', 'Last 12 Months This Year'],
      optionalHeaders: ['Last 12 Months Prior Year', 'This Year to Date', 'Current Month'],
      fuzzyThreshold: 0.75,
      minColumns: 10,
      maxColumns: 15,
      fieldSchema: TABLE_7_VENDOR_TOP_20_BY_CLASS,
      titleKeywords: ['TOP 20', 'VENDORS', 'BY CLASS'],
    },

    // ═══════════════════════════════════════════════════════════════
    // TABLE 8: All Control States - Vendor/Brand Sales by Class - Pages 375-754
    // ═══════════════════════════════════════════════════════════════
    {
      tableNumber: 8,
      tableName: 'Control States',
      entityName: 'raw_nabca_table_8',
      requiredHeaders: ['Vendor / Brand', 'Class', 'Last 12 Months This Year', 'This Year to Date'],
      optionalHeaders: ['Last 12 Months Prior Year', '% Change', 'Current Month This Year', 'Current Month Last Year'],
      fuzzyThreshold: 0.75,
      minColumns: 10,
      maxColumns: 15,
      fieldSchema: TABLE_8_CONTROL_STATES,
    },
  ],
};

/**
 * Get table pattern by entity name
 */
export function getTablePatternByEntity(entityName: string): TableIdentificationPattern | null {
  return NABCA_MULTI_ENTITY_TEMPLATE.tablePatterns.find(
    (pattern) => pattern.entityName === entityName
  ) || null;
}

/**
 * Get table pattern by table number
 */
export function getTablePatternByNumber(tableNumber: number): TableIdentificationPattern | null {
  return NABCA_MULTI_ENTITY_TEMPLATE.tablePatterns.find(
    (pattern) => pattern.tableNumber === tableNumber
  ) || null;
}
