/**
 * Update NABCA Template with Proper Field Schema
 *
 * This script updates the existing NABCA template with semantic field names
 * based on the NABCA_pdf_details.docx specification
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Proper NABCA field schema based on the specification document
const NABCA_FIELD_SCHEMA = [
  // Core atomic fields (from Table 5 - Brand Summary)
  { name: 'brand_name', label: 'Brand Name', type: 'TEXT', description: 'Brand name' },
  { name: 'vendor', label: 'Vendor', type: 'TEXT', description: 'Vendor/supplier name' },
  { name: 'class_type', label: 'Class/Type', type: 'TEXT', description: 'Spirit class/type (e.g., Vodka, Whiskey)' },
  { name: 'bottle_size', label: 'Bottle Size', type: 'TEXT', description: 'Bottle size (SKU level)' },

  // Current Month metrics
  { name: 'cases_sold_current_month', label: 'Cases Sold (Current Month)', type: 'NUMBER', description: 'Total 9L case equivalents sold in current month' },
  { name: 'pct_change_current_month', label: '% Change (Current Month vs Prior Year)', type: 'NUMBER', description: 'Percentage change vs same month prior year' },

  // Year-to-Date metrics
  { name: 'cases_sold_ytd', label: 'Cases Sold (YTD)', type: 'NUMBER', description: 'Total 9L case equivalents sold year-to-date' },
  { name: 'pct_change_ytd', label: '% Change (YTD vs Prior Year)', type: 'NUMBER', description: 'YTD percentage change vs prior year YTD' },

  // Last 12 Months metrics
  { name: 'cases_sold_l12m', label: 'Cases Sold (L12M)', type: 'NUMBER', description: 'Total 9L case equivalents sold in last 12 months' },
  { name: 'pct_change_l12m', label: '% Change (L12M vs Prior 12M)', type: 'NUMBER', description: 'L12M percentage change vs prior 12 months' },

  // Market share and ranking
  { name: 'market_share_pct', label: 'Market Share %', type: 'NUMBER', description: 'Share of total distilled spirits market' },
  { name: 'class_share_pct', label: 'Class Share %', type: 'NUMBER', description: 'Share within spirit class' },
  { name: 'rank', label: 'Rank', type: 'NUMBER', description: 'Rank by sales volume' },
  { name: 'rank_change', label: 'Rank Change', type: 'NUMBER', description: 'Change in rank vs prior period' },

  // Vendor-specific fields (Table 6 & 7)
  { name: 'vendor_market_position', label: 'Vendor Market Position', type: 'NUMBER', description: 'Vendor rank in market' },
  { name: 'vendor_share_total', label: 'Vendor Share of Total', type: 'NUMBER', description: 'Vendor share of total market' },
  { name: 'vendor_share_class', label: 'Vendor Share of Class', type: 'NUMBER', description: 'Vendor share within class' },

  // Meta fields
  { name: 'report_month', label: 'Report Month', type: 'DATE', description: 'Reporting period month' },
  { name: 'state', label: 'State', type: 'TEXT', description: 'Control state (for Table 8)' },
  { name: 'data_source_table', label: 'Source Table', type: 'TEXT', description: 'Which NABCA table this data came from' },
];

async function updateNabcaTemplate() {
  console.log('🔄 Updating NABCA template with proper field schema...\n');

  // Update the main NABCA template
  const { data: template, error: fetchError } = await supabase
    .from('templates')
    .select('id, name')
    .eq('id', '4fe0d18f-9f2c-4946-b145-99e49dacc175')
    .single();

  if (fetchError || !template) {
    console.error('❌ NABCA template not found:', fetchError);
    process.exit(1);
  }

  console.log(`✓ Found template: "${template.name}" (ID: ${template.id})\n`);

  // Update the template with proper field schema
  const { error: updateError } = await supabase
    .from('templates')
    .update({
      fields: NABCA_FIELD_SCHEMA,
      description: 'NABCA multi-section template with standardized field schema based on NABCA specification',
      updated_at: new Date().toISOString(),
    })
    .eq('id', template.id);

  if (updateError) {
    console.error('❌ Failed to update template:', updateError);
    process.exit(1);
  }

  console.log('✅ Template updated successfully!');
  console.log(`   Added ${NABCA_FIELD_SCHEMA.length} semantic fields to the template`);
  console.log('\nField schema:');
  NABCA_FIELD_SCHEMA.forEach(f => {
    console.log(`   - ${f.name} (${f.type}): ${f.description}`);
  });

  console.log('\n✓ Users can now import these fields when creating entities');
}

updateNabcaTemplate();
