/**
 * API Route: Generate NABCA Multi-Entity Template
 *
 * One-click setup that:
 * 1. Auto-creates 8 NABCA entities (if they don't exist)
 * 2. Creates ONE multi-entity template with table identification patterns
 * 3. No Textract calls needed - just sets up the configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  TABLE_1_BRAND_LEADERS,
  TABLE_2_CURRENT_MONTH_SALES,
  TABLE_3_YTD_SALES,
  TABLE_4_L12M_SALES,
  TABLE_5_BRAND_SUMMARY,
  TABLE_6_VENDOR_TOP_100,
  TABLE_7_VENDOR_TOP_20_BY_CLASS,
  TABLE_8_CONTROL_STATES,
} from '@/lib/nabca-field-schemas';
import { NABCA_MULTI_ENTITY_TEMPLATE } from '@/lib/nabca-template-config';

const ENTITY_CONFIGS = [
  { name: 'raw_nabca_table_1', displayName: 'NABCA Table 1: Brand Leaders', schema: TABLE_1_BRAND_LEADERS },
  { name: 'raw_nabca_table_2', displayName: 'NABCA Table 2: Current Month Sales', schema: TABLE_2_CURRENT_MONTH_SALES },
  { name: 'raw_nabca_table_3', displayName: 'NABCA Table 3: YTD Sales', schema: TABLE_3_YTD_SALES },
  { name: 'raw_nabca_table_4', displayName: 'NABCA Table 4: Rolling 12-Month', schema: TABLE_4_L12M_SALES },
  { name: 'raw_nabca_table_5', displayName: 'NABCA Table 5: Brand Summary', schema: TABLE_5_BRAND_SUMMARY },
  { name: 'raw_nabca_table_6', displayName: 'NABCA Table 6: Vendor Top 100', schema: TABLE_6_VENDOR_TOP_100 },
  { name: 'raw_nabca_table_7', displayName: 'NABCA Table 7: Vendor Top 20 by Class', schema: TABLE_7_VENDOR_TOP_20_BY_CLASS },
  { name: 'raw_nabca_table_8', displayName: 'NABCA Table 8: Control States', schema: TABLE_8_CONTROL_STATES },
];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user for RLS
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { template_name = 'NABCA All Tables' } = body;

    console.log('🚀 Starting NABCA multi-entity setup...');

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Create or verify 8 entities exist
    // ═══════════════════════════════════════════════════════════════

    const createdEntities: string[] = [];
    const existingEntities: string[] = [];
    const createdTables: string[] = [];

    // STEP 1A: Create entities
    for (const entityConfig of ENTITY_CONFIGS) {
      // Check if entity already exists
      const { data: existing, error: checkError } = await supabase
        .from('entities')
        .select('id, name')
        .eq('name', entityConfig.name)
        .single();

      if (existing) {
        console.log(`✓ Entity "${entityConfig.name}" already exists`);
        existingEntities.push(entityConfig.name);
        continue;
      }

      // Create entity
      const { data: entity, error: entityError} = await supabase
        .from('entities')
        .insert({
          name: entityConfig.name,
          display_name: entityConfig.displayName,
          description: `Auto-generated entity for ${entityConfig.displayName}`,
          entity_type: 'INTERIM',
          metadata: {
            fields: entityConfig.schema.map((field) => ({
              name: field.name,
              label: field.label,
              type: field.type,
              description: field.description,
              classification: field.classification,
              required: field.name === 'report_month' || field.name === 'report_year',
            })),
            source: 'NABCA Multi-Entity Template Generator',
            artifact_type: 'pdf',
          },
          status: 'DRAFT',
          created_by: user.id,
        })
        .select()
        .single();

      if (entityError) {
        console.error(`❌ Failed to create entity "${entityConfig.name}":`, entityError);
        throw new Error(`Failed to create entity "${entityConfig.name}": ${entityError.message}`);
      }

      console.log(`✅ Created entity "${entityConfig.name}"`);
      createdEntities.push(entityConfig.name);
    }

    // STEP 1B: Create database tables (separate from entity creation)
    for (const entityConfig of ENTITY_CONFIGS) {
      console.log(`📝 Creating table for ${entityConfig.name}...`);

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${entityConfig.name} (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          ${entityConfig.schema
            .map((field) => {
              let sqlType = 'TEXT';
              if (field.type === 'NUMBER') sqlType = 'NUMERIC';
              else if (field.type === 'DATE') sqlType = 'DATE';
              else if (field.type === 'BOOLEAN') sqlType = 'BOOLEAN';
              return `${field.name} ${sqlType}`;
            })
            .join(',\n          ')},
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );
      `;

      console.log(`SQL for ${entityConfig.name}:`, createTableSQL.substring(0, 200) + '...');

      const { data: tableData, error: tableError } = await supabase.rpc('execute_sql', {
        sql: createTableSQL,
      });

      if (tableError) {
        console.error(`❌ Failed to create table "${entityConfig.name}":`, tableError);
        throw new Error(`Failed to create table "${entityConfig.name}": ${tableError.message}`);
      }

      console.log(`✅ Created table "${entityConfig.name}"`);
      createdTables.push(entityConfig.name);

      // Enable RLS on the table
      const rlsSQL = `ALTER TABLE ${entityConfig.name} ENABLE ROW LEVEL SECURITY;`;
      const { error: rlsError } = await supabase.rpc('execute_sql', { sql: rlsSQL });

      if (rlsError) {
        console.warn(`⚠️  Could not enable RLS on ${entityConfig.name}:`, rlsError.message);
      }

      // Create read policy
      const readPolicySQL = `
        CREATE POLICY IF NOT EXISTS "${entityConfig.name}_read"
          ON ${entityConfig.name} FOR SELECT
          TO authenticated
          USING (true);
      `;
      const { error: readPolicyError } = await supabase.rpc('execute_sql', { sql: readPolicySQL });

      if (readPolicyError) {
        console.warn(`⚠️  Could not create read policy on ${entityConfig.name}:`, readPolicyError.message);
      }

      // Create insert policy
      const insertPolicySQL = `
        CREATE POLICY IF NOT EXISTS "${entityConfig.name}_insert"
          ON ${entityConfig.name} FOR INSERT
          TO authenticated
          WITH CHECK (true);
      `;
      const { error: insertPolicyError } = await supabase.rpc('execute_sql', { sql: insertPolicySQL });

      if (insertPolicyError) {
        console.warn(`⚠️  Could not create insert policy on ${entityConfig.name}:`, insertPolicyError.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Create multi-entity template
    // ═══════════════════════════════════════════════════════════════

    // Get entity IDs
    const { data: entities, error: entitiesError } = await supabase
      .from('entities')
      .select('id, name')
      .in('name', NABCA_MULTI_ENTITY_TEMPLATE.targetEntities);

    if (entitiesError || !entities || entities.length !== 8) {
      throw new Error('Failed to fetch all 8 entities');
    }

    // Create template
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .insert({
        name: template_name,
        description: NABCA_MULTI_ENTITY_TEMPLATE.description,
        prompt: 'Multi-entity NABCA extraction using table identification patterns',
        fields: [], // Not needed for multi-entity templates
        artifact_type: 'pdf',
        status: 'ACTIVE',
        extraction_method: 'textract', // Uses AWS Textract with rule-based table identification
        created_by: user.id,
        selectors: {
          isMultiEntity: true,
          targetEntities: NABCA_MULTI_ENTITY_TEMPLATE.targetEntities,
          tablePatterns: NABCA_MULTI_ENTITY_TEMPLATE.tablePatterns.map((pattern) => ({
            tableNumber: pattern.tableNumber,
            tableName: pattern.tableName,
            entityName: pattern.entityName,
            requiredHeaders: pattern.requiredHeaders,
            optionalHeaders: pattern.optionalHeaders,
            fuzzyThreshold: pattern.fuzzyThreshold,
            minColumns: pattern.minColumns,
            maxColumns: pattern.maxColumns,
            fieldSchema: pattern.fieldSchema, // ✅ Include fieldSchema for column mapping!
            titleKeywords: pattern.titleKeywords, // ✅ Include titleKeywords for title-based detection!
          })),
        },
      })
      .select()
      .single();

    if (templateError) {
      console.error('❌ Failed to create template:', templateError);
      throw new Error(`Failed to create template: ${templateError.message}`);
    }

    console.log(`✅ Created multi-entity template: ${template.id}`);

    // ═══════════════════════════════════════════════════════════════
    // SUCCESS RESPONSE
    // ═══════════════════════════════════════════════════════════════

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
      },
      entities: {
        created: createdEntities,
        existing: existingEntities,
        total: 8,
      },
      tables: {
        created: createdTables,
        total: 8,
      },
      summary: {
        message: `NABCA multi-entity template created successfully! ${createdEntities.length} new entities created, ${existingEntities.length} entities already existed. ${createdTables.length} database tables created.`,
        totalEntities: 8,
        totalTables: 8,
        templateType: 'multi-entity',
      },
    });
  } catch (error) {
    console.error('❌ Error generating NABCA multi-entity template:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate NABCA template',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
