/**
 * Pipeline Execution API Route
 *
 * POST /api/pipelines/[id]/execute - Create table and load data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Helper function to extract data from text using regex
 */
function extractFromText(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Generate SQL data type from entity field type
 */
function getSqlType(fieldType: string): string {
  const typeMap: Record<string, string> = {
    'text': 'TEXT',
    'string': 'TEXT',
    'number': 'NUMERIC',
    'integer': 'INTEGER',
    'bigint': 'BIGINT',
    'boolean': 'BOOLEAN',
    'date': 'DATE',
    'timestamp': 'TIMESTAMPTZ',
    'uuid': 'UUID',
    'json': 'JSONB',
  };

  return typeMap[fieldType.toLowerCase()] || 'TEXT';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { limit = 100, createTable = false } = body; // Skip table creation by default

    console.log(`\n=== PIPELINE EXECUTION START ===`);
    console.log(`Pipeline ID: ${id}`);
    console.log(`Create table: ${createTable}`);
    console.log(`Limit: ${limit}`);

    // Get pipeline configuration
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (pipelineError || !pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const config = pipeline.config as any;

    // Get entity details
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', config.target_entity_id)
      .single();

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Get entity fields
    const { data: entityFields } = await supabase
      .from('entity_fields')
      .select('*')
      .eq('entity_id', entity.id)
      .order('sort_order');

    if (!entityFields || entityFields.length === 0) {
      return NextResponse.json({
        error: 'No entity fields defined',
        message: 'Please define fields for this entity first'
      }, { status: 400 });
    }

    console.log(`Target entity:`, {
      id: entity.id,
      name: entity.name,
      table_name: entity.table_name,
      display_name: entity.display_name,
    });
    console.log(`Entity fields:`, entityFields.map(f => f.name));

    // FIX: If table_name is undefined, use entity.name or default to raw_ttb
    const tableName = entity.table_name || entity.name || 'raw_ttb';
    console.log(`Using table name: ${tableName}`);

    // Note: Table must exist before running this. Create manually in Supabase Dashboard.
    console.log(`\nStep 1: Skipping table creation (table should already exist)`);
    const tableCreated = false;

    // Step 2: Get artifacts to process
    console.log(`\nStep 2: Finding artifacts to process...`);
    console.log(`User ID: ${user.id}`);
    console.log(`Config source_ids:`, config.source_ids);

    // Always get all user artifacts - ignore source selection
    const { data: artifacts, error: artifactsError } = await supabase
      .from('artifacts')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (artifactsError) {
      console.error('Artifacts query error:', artifactsError);
    }

    console.log(`Found ${artifacts?.length || 0} artifacts`);

    if (artifacts.length === 0) {
      return NextResponse.json({
        error: 'No artifacts found',
        message: 'Upload some files first',
      }, { status: 404 });
    }

    // Step 3: Extract and load data
    console.log(`\nStep 3: Extracting and loading data...`);

    const results = {
      pipeline_id: id,
      pipeline_name: pipeline.name,
      entity_name: entity.name,
      table_name: tableName,
      table_created: tableCreated,
      execution_summary: {
        total_files: artifacts.length,
        processed: 0,
        loaded: 0,
        failed: 0,
      },
      processed_files: [] as any[],
      loaded_rows: [] as any[],
    };

    for (const artifact of artifacts) {
      try {
        let rawContent = artifact.raw_content || {};

        if (typeof rawContent === 'string') {
          try {
            rawContent = JSON.parse(rawContent);
          } catch (e) {
            rawContent = { content: rawContent };
          }
        }

        // Extract data
        let extractedData: any = {};

        if (rawContent.fields && typeof rawContent.fields === 'object') {
          extractedData = rawContent.fields;
        } else if (rawContent.text || rawContent.structured) {
          const text = rawContent.text || '';

          extractedData = {
            ttbid: extractFromText(text, /TTB\s+ID\s*(\d+)/i),
            ct: extractFromText(text, /\bCT\s*(\d+)/i),
            or: extractFromText(text, /\bOR\s*(\d+)/i),
            serial_number: extractFromText(text, /SERIAL\s+NUMBER[^0-9]*(\d+)/i),
            brand_name: extractFromText(text, /BRAND\s+NAME[^A-Z]*([A-Z][A-Z\s]+)/i),
            fanciful_name: extractFromText(text, /FANCIFUL\s+NAME[^A-Z]*([A-Z][A-Z\s]+)/i),
            product_type: extractFromText(text, /TYPE\s+OF\s+PRODUCT[^A-Z]*(WINE|DISTILLED SPIRITS|MALT BEVERAGE)/i),
            formula: extractFromText(text, /FORMULA[^0-9]*(\d+)/i),
            applicant: extractFromText(text, /NAME\s+AND\s+ADDRESS\s+OF\s+APPLICANT[^A-Z]*([A-Z][A-Za-z\s]+)/i),
            date_issued: extractFromText(text, /DATE\s+ISSUED[^0-9]*(\d{2}\/\d{2}\/\d{4})/i),
            status: extractFromText(text, /THE\s+STATUS\s+IS\s+([A-Z]+)/i),
            class_type: extractFromText(text, /CLASS\/TYPE\s+DESCRIPTION[^A-Z]*([A-Z][A-Z\s]+WINE)/i),
          };

          Object.keys(extractedData).forEach(key => {
            if (!extractedData[key]) delete extractedData[key];
          });
        } else if (artifact.metadata?.extracted_data) {
          extractedData = artifact.metadata.extracted_data;
        }

        if (!extractedData || Object.keys(extractedData).length === 0) {
          results.execution_summary.failed++;
          results.processed_files.push({
            artifact_id: artifact.id,
            filename: artifact.original_filename,
            status: 'FAILED',
            error: 'No data could be extracted',
          });
          continue;
        }

        // Map to entity columns
        const mappedRow: any = {
          extraction_date: artifact.created_at,
          source_artifact_id: artifact.id,
          source_filename: artifact.original_filename,
        };

        for (const field of entityFields) {
          let value = null;

          // Try multiple mapping strategies
          if (field.template_field_path) {
            const pathParts = field.template_field_path.split('.');
            value = extractedData;
            for (const part of pathParts) {
              if (value && typeof value === 'object' && part in value) {
                value = value[part];
              } else {
                value = null;
                break;
              }
            }
          }

          if (!value) {
            const fieldNameLower = field.name.toLowerCase();
            const fieldDisplayLower = field.display_name?.toLowerCase();

            for (const [key, val] of Object.entries(extractedData)) {
              const keyLower = key.toLowerCase();
              if (keyLower === fieldNameLower || keyLower === fieldDisplayLower) {
                value = val;
                break;
              }
            }
          }

          if (!value) {
            const aliases: Record<string, string[]> = {
              'ttbid': ['ttb_id', 'ttbid', 'ttb id'],
              'ct': ['certificate_type', 'ct'],
              'or': ['origin', 'or', 'origin_code'],
              'productsource': ['product_source', 'source', 'applicant'],
              'producttype': ['product_type', 'type_of_product', 'product'],
            };

            const fieldNameLower = field.name.toLowerCase();
            if (aliases[fieldNameLower]) {
              for (const alias of aliases[fieldNameLower]) {
                for (const [key, val] of Object.entries(extractedData)) {
                  if (key.toLowerCase() === alias) {
                    value = val;
                    break;
                  }
                }
                if (value) break;
              }
            }
          }

          mappedRow[field.name] = value;
        }

        // Insert into table
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(mappedRow);

        if (insertError) {
          console.error(`Failed to insert artifact ${artifact.id}:`, insertError);
          results.execution_summary.failed++;
          results.processed_files.push({
            artifact_id: artifact.id,
            filename: artifact.original_filename,
            status: 'FAILED',
            error: insertError.message,
          });
        } else {
          results.execution_summary.processed++;
          results.execution_summary.loaded++;
          results.processed_files.push({
            artifact_id: artifact.id,
            filename: artifact.original_filename,
            status: 'LOADED',
          });

          // Keep first 5 for preview
          if (results.loaded_rows.length < 5) {
            results.loaded_rows.push(mappedRow);
          }
        }

      } catch (error: any) {
        results.execution_summary.failed++;
        results.processed_files.push({
          artifact_id: artifact.id,
          filename: artifact.original_filename,
          status: 'FAILED',
          error: error.message,
        });
      }
    }

    // Mark pipeline as active
    await supabase
      .from('pipelines')
      .update({ is_active: true })
      .eq('id', id);

    console.log(`\n=== EXECUTION COMPLETE ===`);
    console.log(`Processed: ${results.execution_summary.processed}`);
    console.log(`Loaded: ${results.execution_summary.loaded}`);
    console.log(`Failed: ${results.execution_summary.failed}`);

    return NextResponse.json(results);

  } catch (error) {
    console.error('Error executing pipeline:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute pipeline',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
