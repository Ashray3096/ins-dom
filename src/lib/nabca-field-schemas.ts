/**
 * NABCA Field Schemas for All 8 Tables
 *
 * Based on nabca_fields.pdf specification
 * Each table has its own specific field schema with proper semantic names
 */

export interface NabcaField {
  name: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN';
  description: string;
  classification: 'Master Data' | 'Reference Data' | 'Dimensional Data' | 'Fact Data';
}

/**
 * Table 1: Brand Leaders (pg 3-4)
 * Top spirit brands ranked by sales volume
 */
export const TABLE_1_BRAND_LEADERS: NabcaField[] = [
  { name: 'report_month', label: 'Report Month', type: 'TEXT', description: 'Month of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'report_year', label: 'Report Year', type: 'TEXT', description: 'Year of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'brand', label: 'Brand', type: 'TEXT', description: 'The name of the spirit brand', classification: 'Master Data' },
  { name: 'type', label: 'Type', type: 'TEXT', description: 'Spirit type/category (same as class)', classification: 'Reference Data' },
  { name: 'ytd_rank', label: 'Year to Date Case Sales Rank', type: 'NUMBER', description: 'Rank of the brand based on case sales for YTD period', classification: 'Dimensional Data' },
  { name: 'ytd_pct_total', label: 'Year to Date % Total', type: 'NUMBER', description: 'Brand share (%) of total case sales YTD', classification: 'Dimensional Data' },
  { name: 'ytd_case_sales', label: 'Year to Date Case Sales', type: 'NUMBER', description: 'Total number of 9-liter cases sold YTD', classification: 'Fact Data' },
  { name: 'ytd_vs_last_year', label: 'YTD +/- Last Year', type: 'NUMBER', description: 'Difference in case sales vs same YTD period prior year', classification: 'Fact Data' },
  { name: 'current_month_case_sales', label: 'Current Month Case Sales', type: 'NUMBER', description: 'Total 9L cases sold in current month', classification: 'Fact Data' },
  { name: 'current_month_vs_last_year', label: 'Current Month +/- Last Year', type: 'NUMBER', description: 'Difference vs same month last year', classification: 'Fact Data' },
  { name: 'l12m_case_sales', label: 'Last Twelve Months Case Sales', type: 'NUMBER', description: 'Rolling 12-month total of 9L case sales', classification: 'Fact Data' },
];

/**
 * Table 2: Current Month Sales (pg 5-6)
 * Breakdown of case sales by spirit class for current month
 */
export const TABLE_2_CURRENT_MONTH_SALES: NabcaField[] = [
  { name: 'report_month', label: 'Report Month', type: 'TEXT', description: 'Month of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'report_year', label: 'Report Year', type: 'TEXT', description: 'Year of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'class', label: 'Class', type: 'TEXT', description: 'The spirit class/category', classification: 'Reference Data' },
  { name: 'pct_total_dist_spirits', label: '% Total Dist. Spirits', type: 'NUMBER', description: 'Percentage of this class out of all distilled spirits sales', classification: 'Dimensional Data' },
  { name: 'pct_of_class', label: '% of Class', type: 'NUMBER', description: 'Share of this class relative to its parent grouping', classification: 'Dimensional Data' },
  { name: 'total_cases', label: 'Total Cases', type: 'NUMBER', description: 'Total 9L cases sold for this class (all bottle sizes)', classification: 'Fact Data' },
  { name: 'bottle_1_75l', label: '1.75 L', type: 'NUMBER', description: 'Cases sold in 1.75L bottles', classification: 'Fact Data' },
  { name: 'bottle_1_0l', label: '1.0 L', type: 'NUMBER', description: 'Cases sold in 1.0L bottles', classification: 'Fact Data' },
  { name: 'bottle_750ml', label: '750 ml', type: 'NUMBER', description: 'Cases sold in 750ml bottles', classification: 'Fact Data' },
  { name: 'bottle_750ml_traveler', label: '750 ml Traveler', type: 'NUMBER', description: 'Cases sold in 750ml traveler bottles', classification: 'Fact Data' },
  { name: 'bottle_375ml', label: '375 ml', type: 'NUMBER', description: 'Cases sold in 375ml bottles', classification: 'Fact Data' },
  { name: 'bottle_200ml', label: '200 ml', type: 'NUMBER', description: 'Cases sold in 200ml bottles', classification: 'Fact Data' },
  { name: 'bottle_100ml', label: '100 ml', type: 'NUMBER', description: 'Cases sold in 100ml bottles', classification: 'Fact Data' },
  { name: 'bottle_50ml', label: '50 ml', type: 'NUMBER', description: 'Cases sold in 50ml bottles', classification: 'Fact Data' },
];

/**
 * Table 3: Year to Date Sales (pg 7-8)
 * Breakdown of case sales by spirit class for year to date
 */
export const TABLE_3_YTD_SALES: NabcaField[] = [
  { name: 'report_month', label: 'Report Month', type: 'TEXT', description: 'Month of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'report_year', label: 'Report Year', type: 'TEXT', description: 'Year of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'class', label: 'Class', type: 'TEXT', description: 'Spirit class/category', classification: 'Reference Data' },
  { name: 'pct_total_dist_spirits', label: '% Total Dist. Spirits', type: 'NUMBER', description: 'Class share (%) of all distilled spirits for YTD', classification: 'Dimensional Data' },
  { name: 'pct_of_class', label: '% of Class', type: 'NUMBER', description: 'Share within the parent grouping', classification: 'Dimensional Data' },
  { name: 'total_cases', label: 'Total Cases', type: 'NUMBER', description: 'Total 9L cases for the class (all bottle sizes)', classification: 'Fact Data' },
  { name: 'bottle_1_75l', label: '1.75 L', type: 'NUMBER', description: '9L cases sold in 1.75L', classification: 'Fact Data' },
  { name: 'bottle_1_0l', label: '1.0 L', type: 'NUMBER', description: '9L cases sold in 1.0L', classification: 'Fact Data' },
  { name: 'bottle_750ml', label: '750 ml', type: 'NUMBER', description: '9L cases sold in 750ml', classification: 'Fact Data' },
  { name: 'bottle_750ml_traveler', label: '750 ml Traveler', type: 'NUMBER', description: '9L cases sold in 750ml traveler', classification: 'Fact Data' },
  { name: 'bottle_375ml', label: '375 ml', type: 'NUMBER', description: '9L cases sold in 375ml', classification: 'Fact Data' },
  { name: 'bottle_200ml', label: '200 ml', type: 'NUMBER', description: '9L cases sold in 200ml', classification: 'Fact Data' },
  { name: 'bottle_100ml', label: '100 ml', type: 'NUMBER', description: '9L cases sold in 100ml', classification: 'Fact Data' },
  { name: 'bottle_50ml', label: '50 ml', type: 'NUMBER', description: '9L cases sold in 50ml', classification: 'Fact Data' },
];

/**
 * Table 4: Rolling 12-Month Sales (pg 9-10)
 * Breakdown of case sales by spirit class for last 12 months
 */
export const TABLE_4_L12M_SALES: NabcaField[] = [
  { name: 'report_month', label: 'Report Month', type: 'TEXT', description: 'Month of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'report_year', label: 'Report Year', type: 'TEXT', description: 'Year of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'class', label: 'Class', type: 'TEXT', description: 'Spirit class/category', classification: 'Reference Data' },
  { name: 'pct_total_dist_spirits', label: '% Total Dist. Spirits', type: 'NUMBER', description: 'Class share (%) of all distilled spirits for L12M', classification: 'Dimensional Data' },
  { name: 'pct_of_class', label: '% of Class', type: 'NUMBER', description: 'Share within the parent grouping', classification: 'Dimensional Data' },
  { name: 'total_cases', label: 'Total Cases', type: 'NUMBER', description: 'Total 9L cases for the class (all bottle sizes)', classification: 'Fact Data' },
  { name: 'bottle_1_75l', label: '1.75 L', type: 'NUMBER', description: '9L cases sold in 1.75L', classification: 'Fact Data' },
  { name: 'bottle_1_0l', label: '1.0 L', type: 'NUMBER', description: '9L cases sold in 1.0L', classification: 'Fact Data' },
  { name: 'bottle_750ml', label: '750 ml', type: 'NUMBER', description: '9L cases sold in 750ml', classification: 'Fact Data' },
  { name: 'bottle_750ml_traveler', label: '750 ml Traveler', type: 'NUMBER', description: '9L cases sold in 750ml traveler', classification: 'Fact Data' },
  { name: 'bottle_375ml', label: '375 ml', type: 'NUMBER', description: '9L cases sold in 375ml', classification: 'Fact Data' },
  { name: 'bottle_200ml', label: '200 ml', type: 'NUMBER', description: '9L cases sold in 200ml', classification: 'Fact Data' },
  { name: 'bottle_100ml', label: '100 ml', type: 'NUMBER', description: '9L cases sold in 100ml', classification: 'Fact Data' },
  { name: 'bottle_50ml', label: '50 ml', type: 'NUMBER', description: '9L cases sold in 50ml', classification: 'Fact Data' },
];

/**
 * Table 5: Brand Summary (pg 11-346) - THE CORE FACT TABLE
 * Granular brand sales performance broken down by Class, Brand, and Vendor
 */
export const TABLE_5_BRAND_SUMMARY: NabcaField[] = [
  { name: 'report_month', label: 'Report Month', type: 'TEXT', description: 'Month of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'report_year', label: 'Report Year', type: 'TEXT', description: 'Year of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'class_brand', label: 'Class & Brand', type: 'TEXT', description: 'Combined class/type and brand name (merged cell in PDF)', classification: 'Master Data' },
  { name: 'vendor', label: 'Vendor', type: 'TEXT', description: 'The supplier or producer associated with the brand', classification: 'Master Data' },
  { name: 'case_sales_l12m', label: 'Case Sales Last Twelve Months', type: 'NUMBER', description: 'Total cases sold in last rolling 12 months', classification: 'Fact Data' },
  { name: 'case_sales_last_ytd', label: 'Case Sales Last Year to Date', type: 'NUMBER', description: 'Total cases sold in same YTD period last year', classification: 'Fact Data' },
  { name: 'ytd_pct_of_type', label: 'This Year to Date % of Type', type: 'NUMBER', description: 'Brand % share of its spirit type', classification: 'Dimensional Data' },
  { name: 'ytd_case_sales', label: 'This Year to Date Case Sales', type: 'NUMBER', description: 'Current YTD total case sales', classification: 'Fact Data' },
  { name: 'current_month_case_sales', label: 'Case Sales Current Month', type: 'NUMBER', description: 'Total case sales in current month', classification: 'Fact Data' },
  { name: 'current_month_1_75l', label: 'Current Month 1.75 L', type: 'NUMBER', description: 'Current month sales in 1.75L bottles', classification: 'Fact Data' },
  { name: 'current_month_1_0l', label: 'Current Month 1.0 L', type: 'NUMBER', description: 'Current month sales in 1.0L bottles', classification: 'Fact Data' },
  { name: 'current_month_750ml', label: 'Current Month 750 ml', type: 'NUMBER', description: 'Current month sales in 750ml bottles', classification: 'Fact Data' },
  { name: 'current_month_750ml_traveler', label: 'Current Month 750 ml Traveler', type: 'NUMBER', description: 'Current month sales in 750ml traveler bottles', classification: 'Fact Data' },
  { name: 'current_month_375ml', label: 'Current Month 375 ml', type: 'NUMBER', description: 'Current month sales in 375ml bottles', classification: 'Fact Data' },
  { name: 'current_month_200ml', label: 'Current Month 200 ml', type: 'NUMBER', description: 'Current month sales in 200ml bottles', classification: 'Fact Data' },
  { name: 'current_month_100ml', label: 'Current Month 100 ml', type: 'NUMBER', description: 'Current month sales in 100ml bottles', classification: 'Fact Data' },
  { name: 'current_month_50ml', label: 'Current Month 50 ml', type: 'NUMBER', description: 'Current month sales in 50ml bottles', classification: 'Fact Data' },
];

/**
 * Table 6: Vendor Sales Performance - Top 100 (pg 365-366)
 * Vendor-level sales performance for top 100 vendors
 */
export const TABLE_6_VENDOR_TOP_100: NabcaField[] = [
  { name: 'report_month', label: 'Report Month', type: 'TEXT', description: 'Month of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'report_year', label: 'Report Year', type: 'TEXT', description: 'Year of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'vendor', label: 'Vendor', type: 'TEXT', description: 'The supplier or producer', classification: 'Master Data' },
  { name: 'rank', label: 'Rank', type: 'NUMBER', description: 'Position of vendor based on sales performance', classification: 'Dimensional Data' },
  { name: 'share_of_market', label: 'Share of Market', type: 'NUMBER', description: 'Vendor percentage share of overall spirits market', classification: 'Dimensional Data' },
  { name: 'l12m_this_year', label: 'Last 12 Months This Year', type: 'NUMBER', description: 'Total case sales for last 12 months', classification: 'Fact Data' },
  { name: 'l12m_prior_year', label: 'Last 12 Months Prior Year', type: 'NUMBER', description: 'Total case sales for same 12-month period in previous year', classification: 'Fact Data' },
  { name: 'l12m_change', label: '+/- (Last 12 Months)', type: 'NUMBER', description: 'Difference in sales between this year and last year L12M', classification: 'Fact Data' },
  { name: 'ytd_this_year', label: 'This Year to Date', type: 'NUMBER', description: 'Total case sales YTD for current year', classification: 'Fact Data' },
  { name: 'ytd_last_year', label: 'Last Year to Date', type: 'NUMBER', description: 'Total case sales YTD for prior year', classification: 'Fact Data' },
  { name: 'ytd_change', label: '+/- (YTD)', type: 'NUMBER', description: 'Difference in sales between this YTD and last YTD', classification: 'Fact Data' },
  { name: 'current_month_this_year', label: 'Current Month This Year', type: 'NUMBER', description: 'Total case sales for current month', classification: 'Fact Data' },
  { name: 'current_month_last_year', label: 'Current Month Last Year', type: 'NUMBER', description: 'Total case sales for same month last year', classification: 'Fact Data' },
  { name: 'current_month_change', label: '+/- (Current Month)', type: 'NUMBER', description: 'Difference in sales between this month and same month last year', classification: 'Fact Data' },
];

/**
 * Table 7: Vendor Sales Performance - Top 20 by Class (pg 367-373)
 * Combined view of sales performance by Class and Vendor (top 20 per class)
 */
export const TABLE_7_VENDOR_TOP_20_BY_CLASS: NabcaField[] = [
  { name: 'report_month', label: 'Report Month', type: 'TEXT', description: 'Month of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'report_year', label: 'Report Year', type: 'TEXT', description: 'Year of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'class_vendor', label: 'Class / Vendor', type: 'TEXT', description: 'Combined class and vendor name (merged cell in PDF)', classification: 'Master Data' },
  { name: 'rank', label: 'Rank', type: 'NUMBER', description: 'Position of vendor within the class based on sales', classification: 'Dimensional Data' },
  { name: 'share_of_market', label: 'Share of Market', type: 'NUMBER', description: 'Percentage share of the class total sales for vendor', classification: 'Dimensional Data' },
  { name: 'l12m_this_year', label: 'Last 12 Months This Year', type: 'NUMBER', description: 'Case sales for last 12 months (current year)', classification: 'Fact Data' },
  { name: 'l12m_prior_year', label: 'Last 12 Months Prior Year', type: 'NUMBER', description: 'Case sales for same 12-month period in prior year', classification: 'Fact Data' },
  { name: 'l12m_change', label: '+/- (Last 12 Months)', type: 'NUMBER', description: 'Difference in sales between this year and last year L12M', classification: 'Fact Data' },
  { name: 'ytd_this_year', label: 'This Year to Date', type: 'NUMBER', description: 'Case sales YTD for current year', classification: 'Fact Data' },
  { name: 'ytd_last_year', label: 'Last Year to Date', type: 'NUMBER', description: 'Case sales YTD for prior year', classification: 'Fact Data' },
  { name: 'ytd_change', label: '+/- (YTD)', type: 'NUMBER', description: 'Difference in sales between this YTD and last YTD', classification: 'Fact Data' },
  { name: 'current_month_this_year', label: 'Current Month This Year', type: 'NUMBER', description: 'Case sales for current month', classification: 'Fact Data' },
  { name: 'current_month_last_year', label: 'Current Month Last Year', type: 'NUMBER', description: 'Case sales for same month in prior year', classification: 'Fact Data' },
  { name: 'current_month_change', label: '+/- (Current Month)', type: 'NUMBER', description: 'Difference in sales between this month and same month last year', classification: 'Fact Data' },
];

/**
 * Table 8: All Control States - Vendor / Brand Sales by Class (pg 375-754)
 * Brand-level view within each vendor, showing performance across classes
 */
export const TABLE_8_CONTROL_STATES: NabcaField[] = [
  { name: 'report_month', label: 'Report Month', type: 'TEXT', description: 'Month of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'report_year', label: 'Report Year', type: 'TEXT', description: 'Year of the report (extracted from filename)', classification: 'Dimensional Data' },
  { name: 'vendor_brand', label: 'Vendor / Brand', type: 'TEXT', description: 'Combined vendor and brand name (merged cell in PDF)', classification: 'Master Data' },
  { name: 'class', label: 'Class', type: 'TEXT', description: 'Spirit class/category associated with the brand', classification: 'Reference Data' },
  { name: 'l12m_this_year', label: 'Last 12 Months This Year', type: 'NUMBER', description: 'Case sales for last 12 months (current year)', classification: 'Fact Data' },
  { name: 'l12m_prior_year', label: 'Last 12 Months Prior Year', type: 'NUMBER', description: 'Case sales for same 12-month period in prior year', classification: 'Fact Data' },
  { name: 'l12m_pct_change', label: '% Change (Last 12 Months)', type: 'NUMBER', description: 'Percentage change in sales between this year and last year L12M', classification: 'Dimensional Data' },
  { name: 'ytd_this_year', label: 'This Year to Date', type: 'NUMBER', description: 'Case sales YTD for current year', classification: 'Fact Data' },
  { name: 'ytd_last_year', label: 'Last Year to Date', type: 'NUMBER', description: 'Case sales YTD for prior year', classification: 'Fact Data' },
  { name: 'ytd_pct_change', label: '% Change (YTD)', type: 'NUMBER', description: 'Percentage change in sales between this YTD and last YTD', classification: 'Dimensional Data' },
  { name: 'current_month_this_year', label: 'Current Month This Year', type: 'NUMBER', description: 'Case sales for current month', classification: 'Fact Data' },
  { name: 'current_month_last_year', label: 'Current Month Last Year', type: 'NUMBER', description: 'Case sales for same month in prior year', classification: 'Fact Data' },
  { name: 'current_month_pct_change', label: '% Change (Current Month)', type: 'NUMBER', description: 'Percentage change in sales between this month and same month last year', classification: 'Dimensional Data' },
];

/**
 * Map of table names to field schemas
 */
export const NABCA_TABLE_SCHEMAS: Record<string, NabcaField[]> = {
  'Brand Leaders': TABLE_1_BRAND_LEADERS,
  'Current Month Sales': TABLE_2_CURRENT_MONTH_SALES,
  'YTD Sales': TABLE_3_YTD_SALES,
  'Rolling 12-Month': TABLE_4_L12M_SALES,
  'Brand Summary': TABLE_5_BRAND_SUMMARY,
  'Vendor Top 100': TABLE_6_VENDOR_TOP_100,
  'Vendor Top 20 by Class': TABLE_7_VENDOR_TOP_20_BY_CLASS,
  'Control States': TABLE_8_CONTROL_STATES,
};

/**
 * Get field schema for a specific NABCA table
 */
export function getNabcaTableSchema(tableName: string): NabcaField[] | null {
  return NABCA_TABLE_SCHEMAS[tableName] || null;
}

/**
 * Get all NABCA table names
 */
export function getNabcaTableNames(): string[] {
  return Object.keys(NABCA_TABLE_SCHEMAS);
}
