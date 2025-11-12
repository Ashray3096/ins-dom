-- =====================================================
-- Migration 011: Seed Field Library with NABCA Fields
-- Purpose: Populate field_library with commonly used fields
-- =====================================================

-- =====================================================
-- 1. Common Date Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations)
VALUES
  ('report_month', 'Report Month', 'TEXT', 'date', 'Month of the report (e.g., October, Nov)', 'PUBLIC', ARRAY['date', 'report', 'time'], ARRAY['trim']),
  ('report_year', 'Report Year', 'TEXT', 'date', 'Year of the report (e.g., 2024)', 'PUBLIC', ARRAY['date', 'report', 'time'], ARRAY['trim']),
  ('report_date', 'Report Date', 'DATE', 'date', 'Full date of the report', 'PUBLIC', ARRAY['date', 'report', 'time'], ARRAY[]::TEXT[])
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 2. Vendor/Company Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations, validation_rules)
VALUES
  ('vendor_name', 'Vendor Name', 'TEXT', 'vendor', 'Company/vendor supplying products', 'INTERNAL', ARRAY['supplier', 'vendor', 'company'], ARRAY['trim', 'uppercase'], '{"max_length": 255}'::JSONB),
  ('vendor_id', 'Vendor ID', 'TEXT', 'vendor', 'Unique vendor identifier', 'INTERNAL', ARRAY['vendor', 'id', 'identifier'], ARRAY['trim'], '{"pattern": "^[A-Z0-9-]+$"}'::JSONB),
  ('vendor_rank', 'Vendor Rank', 'NUMBER', 'vendor', 'Ranking position among vendors', 'PUBLIC', ARRAY['vendor', 'rank', 'position'], ARRAY['parse_number'], '{"min": 1}'::JSONB),
  ('vendor_code', 'Vendor Code', 'TEXT', 'vendor', 'Internal vendor code', 'INTERNAL', ARRAY['vendor', 'code'], ARRAY['trim', 'uppercase'], '{"max_length": 50}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 3. Brand/Product Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations, validation_rules)
VALUES
  ('brand_name', 'Brand Name', 'TEXT', 'product', 'Name of the brand', 'PUBLIC', ARRAY['brand', 'product', 'name'], ARRAY['trim'], '{"max_length": 255}'::JSONB),
  ('brand_type', 'Brand Type', 'TEXT', 'product', 'Type/category of brand (e.g., Vodka, Whiskey)', 'PUBLIC', ARRAY['brand', 'product', 'type', 'category'], ARRAY['trim'], '{"max_length": 100}'::JSONB),
  ('brand_rank', 'Brand Rank', 'NUMBER', 'product', 'Ranking position of brand', 'PUBLIC', ARRAY['brand', 'rank', 'position'], ARRAY['parse_number'], '{"min": 1}'::JSONB),
  ('product_class', 'Product Class', 'TEXT', 'product', 'Product classification', 'PUBLIC', ARRAY['product', 'class', 'category'], ARRAY['trim'], '{"max_length": 100}'::JSONB),
  ('product_type', 'Product Type', 'TEXT', 'product', 'Type of product', 'PUBLIC', ARRAY['product', 'type'], ARRAY['trim'], '{"max_length": 100}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 4. Sales Metrics Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations, validation_rules)
VALUES
  ('sales_l12m', 'Sales (L12M)', 'NUMBER', 'sales', 'Sales for last 12 months', 'INTERNAL', ARRAY['sales', 'revenue', 'l12m', 'annual'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('sales_ytd', 'Sales (YTD)', 'NUMBER', 'sales', 'Year-to-date sales', 'INTERNAL', ARRAY['sales', 'revenue', 'ytd'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('sales_current_month', 'Sales (Current Month)', 'NUMBER', 'sales', 'Sales for current month', 'INTERNAL', ARRAY['sales', 'revenue', 'monthly'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('sales_prior_year', 'Sales (Prior Year)', 'NUMBER', 'sales', 'Sales from prior year same period', 'INTERNAL', ARRAY['sales', 'revenue', 'comparison'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('case_sales', 'Case Sales', 'NUMBER', 'sales', 'Number of cases sold', 'INTERNAL', ARRAY['sales', 'volume', 'cases'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('case_sales_l12m', 'Case Sales (L12M)', 'NUMBER', 'sales', 'Case sales for last 12 months', 'INTERNAL', ARRAY['sales', 'volume', 'cases', 'l12m'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 5. Market Share & Percentage Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations, validation_rules)
VALUES
  ('market_share', 'Market Share', 'NUMBER', 'sales', 'Percentage of market share', 'INTERNAL', ARRAY['market', 'share', 'percentage'], ARRAY['remove_percent', 'parse_number'], '{"min": 0, "max": 100}'::JSONB),
  ('percent_total', 'Percent of Total', 'NUMBER', 'sales', 'Percentage of total sales', 'INTERNAL', ARRAY['percentage', 'total'], ARRAY['remove_percent', 'parse_number'], '{"min": 0, "max": 100}'::JSONB),
  ('percent_change', 'Percent Change', 'NUMBER', 'sales', 'Percentage change vs prior period', 'INTERNAL', ARRAY['percentage', 'change', 'growth'], ARRAY['remove_percent', 'parse_number'], '{}'::JSONB),
  ('percent_of_type', 'Percent of Type', 'NUMBER', 'sales', 'Percentage within product type', 'INTERNAL', ARRAY['percentage', 'type'], ARRAY['remove_percent', 'parse_number'], '{"min": 0, "max": 100}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 6. Volume & Size Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations, validation_rules)
VALUES
  ('volume_175l', 'Volume 1.75L', 'NUMBER', 'volume', 'Sales volume for 1.75L bottles', 'INTERNAL', ARRAY['volume', 'size', 'bottles'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('volume_1l', 'Volume 1.0L', 'NUMBER', 'volume', 'Sales volume for 1.0L bottles', 'INTERNAL', ARRAY['volume', 'size', 'bottles'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('volume_750ml', 'Volume 750ml', 'NUMBER', 'volume', 'Sales volume for 750ml bottles', 'INTERNAL', ARRAY['volume', 'size', 'bottles'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('volume_375ml', 'Volume 375ml', 'NUMBER', 'volume', 'Sales volume for 375ml bottles', 'INTERNAL', ARRAY['volume', 'size', 'bottles'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('volume_200ml', 'Volume 200ml', 'NUMBER', 'volume', 'Sales volume for 200ml bottles', 'INTERNAL', ARRAY['volume', 'size', 'bottles'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('volume_100ml', 'Volume 100ml', 'NUMBER', 'volume', 'Sales volume for 100ml bottles', 'INTERNAL', ARRAY['volume', 'size', 'bottles'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('volume_50ml', 'Volume 50ml', 'NUMBER', 'volume', 'Sales volume for 50ml bottles', 'INTERNAL', ARRAY['volume', 'size', 'bottles'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 7. Classification & Category Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations, validation_rules)
VALUES
  ('class', 'Class', 'TEXT', 'classification', 'Product class/category', 'PUBLIC', ARRAY['class', 'category'], ARRAY['trim'], '{"max_length": 100}'::JSONB),
  ('class_vendor', 'Class / Vendor', 'TEXT', 'classification', 'Combined class and vendor field', 'INTERNAL', ARRAY['class', 'vendor', 'combined'], ARRAY['trim'], '{"max_length": 255}'::JSONB),
  ('distilled_spirits', 'Distilled Spirits', 'TEXT', 'classification', 'Distilled spirits category', 'PUBLIC', ARRAY['spirits', 'category'], ARRAY['trim'], '{"max_length": 100}'::JSONB),
  ('state_name', 'State Name', 'TEXT', 'location', 'US state name', 'PUBLIC', ARRAY['state', 'location', 'geography'], ARRAY['trim', 'uppercase'], '{"max_length": 50}'::JSONB),
  ('state_code', 'State Code', 'TEXT', 'location', 'US state code (e.g., CA, NY)', 'PUBLIC', ARRAY['state', 'location', 'code'], ARRAY['trim', 'uppercase'], '{"max_length": 2, "pattern": "^[A-Z]{2}$"}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 8. Comparison & Delta Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations, validation_rules)
VALUES
  ('plus_or_minus_last_year', '+ or - Last Year', 'NUMBER', 'comparison', 'Change vs last year', 'INTERNAL', ARRAY['comparison', 'delta', 'change'], ARRAY['remove_commas', 'parse_number'], '{}'::JSONB),
  ('vs_prior_year', 'vs Prior Year', 'NUMBER', 'comparison', 'Comparison to prior year', 'INTERNAL', ARRAY['comparison', 'prior', 'year'], ARRAY['remove_commas', 'parse_number'], '{}'::JSONB),
  ('year_over_year_change', 'Year-over-Year Change', 'NUMBER', 'comparison', 'YoY change amount', 'INTERNAL', ARRAY['comparison', 'yoy', 'change'], ARRAY['remove_commas', 'parse_number'], '{}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 9. Financial Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations, validation_rules)
VALUES
  ('revenue', 'Revenue', 'NUMBER', 'financial', 'Total revenue', 'CONFIDENTIAL', ARRAY['revenue', 'financial', 'money'], ARRAY['remove_commas', 'remove_dollar_sign', 'parse_number'], '{"min": 0}'::JSONB),
  ('cost', 'Cost', 'NUMBER', 'financial', 'Cost amount', 'CONFIDENTIAL', ARRAY['cost', 'financial', 'money'], ARRAY['remove_commas', 'remove_dollar_sign', 'parse_number'], '{"min": 0}'::JSONB),
  ('profit', 'Profit', 'NUMBER', 'financial', 'Profit amount', 'CONFIDENTIAL', ARRAY['profit', 'financial', 'money'], ARRAY['remove_commas', 'remove_dollar_sign', 'parse_number'], '{}'::JSONB),
  ('price', 'Price', 'NUMBER', 'financial', 'Unit price', 'INTERNAL', ARRAY['price', 'financial', 'money'], ARRAY['remove_commas', 'remove_dollar_sign', 'parse_number'], '{"min": 0}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 10. Generic Common Fields
-- =====================================================
INSERT INTO field_library (name, label, field_type, category, description, classification, tags, transformations, validation_rules)
VALUES
  ('rank', 'Rank', 'NUMBER', 'generic', 'Ranking position', 'PUBLIC', ARRAY['rank', 'position'], ARRAY['parse_number'], '{"min": 1}'::JSONB),
  ('name', 'Name', 'TEXT', 'generic', 'Generic name field', 'PUBLIC', ARRAY['name'], ARRAY['trim'], '{"max_length": 255}'::JSONB),
  ('description', 'Description', 'TEXT', 'generic', 'Description or notes', 'PUBLIC', ARRAY['description', 'notes'], ARRAY['trim'], '{"max_length": 1000}'::JSONB),
  ('code', 'Code', 'TEXT', 'generic', 'Generic code field', 'PUBLIC', ARRAY['code', 'identifier'], ARRAY['trim', 'uppercase'], '{"max_length": 50}'::JSONB),
  ('quantity', 'Quantity', 'NUMBER', 'generic', 'Quantity amount', 'PUBLIC', ARRAY['quantity', 'amount'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB),
  ('total', 'Total', 'NUMBER', 'generic', 'Total amount', 'PUBLIC', ARRAY['total', 'sum'], ARRAY['remove_commas', 'parse_number'], '{"min": 0}'::JSONB)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- Success message
-- =====================================================
DO $$
DECLARE
  field_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO field_count FROM field_library;
  RAISE NOTICE 'Migration 011 completed: % fields seeded in field_library', field_count;
END $$;
