/**
 * Pipeline Test Run API Route
 *
 * POST /api/pipelines/[id]/test-run - Run pipeline on sample data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


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
    const { limit = 10 } = body; // Default to 10 files

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

    // Get entity fields for mapping
    const { data: entityFields } = await supabase
      .from('entity_fields')
      .select('*')
      .eq('entity_id', entity.id)
      .order('sort_order');

    // Get template if linked (with selectors)
    let template = null;
    let templateSelectors = null;
    if (pipeline.template_id) {
      const { data: templateData } = await supabase
        .from('templates')
        .select('*')
        .eq('id', pipeline.template_id)
        .single();
      template = templateData;
      templateSelectors = templateData?.selectors;
    }

    // Get sample artifacts to process
    const sourceIds = config.source_ids || [];
    let artifacts = [];

    // Try to find artifacts with different criteria in order of preference
    if (sourceIds.length > 0) {
      // First try: artifacts from specified sources that are completed
      const { data: completedArtifacts } = await supabase
        .from('artifacts')
        .select('*')
        .in('source_id', sourceIds)
        .eq('extraction_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      artifacts = completedArtifacts || [];

      // Second try: any artifacts from specified sources (regardless of status)
      if (artifacts.length === 0) {
        const { data: allSourceArtifacts } = await supabase
          .from('artifacts')
          .select('*')
          .in('source_id', sourceIds)
          .order('created_at', { ascending: false })
          .limit(limit);

        artifacts = allSourceArtifacts || [];
      }
    }

    // Third try: any completed artifacts for this user
    if (artifacts.length === 0) {
      const { data: userCompletedArtifacts } = await supabase
        .from('artifacts')
        .select('*')
        .eq('extraction_status', 'completed')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      artifacts = userCompletedArtifacts || [];
    }

    // Fourth try: ANY artifacts for this user (regardless of status)
    if (artifacts.length === 0) {
      const { data: allUserArtifacts } = await supabase
        .from('artifacts')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      artifacts = allUserArtifacts || [];
    }

    if (artifacts.length === 0) {
      return NextResponse.json({
        error: 'No artifacts found to process',
        message: 'Upload some files first in the Artifacts section',
      }, { status: 404 });
    }

    console.log(`Found ${artifacts.length} artifacts to test with`);
    console.log('First artifact structure:', {
      id: artifacts[0]?.id,
      filename: artifacts[0]?.original_filename,
      raw_content_type: typeof artifacts[0]?.raw_content,
      raw_content_sample: artifacts[0]?.raw_content,
      metadata_type: typeof artifacts[0]?.metadata,
      metadata_sample: artifacts[0]?.metadata,
    });

    // Simulate pipeline execution
    const results = {
      pipeline_id: id,
      pipeline_name: pipeline.name,
      entity_name: entity.name,
      entity_type: entity.entity_type,
      template_name: template?.name || 'No template',
      execution_summary: {
        total_files: artifacts.length,
        processed: 0,
        template_successes: 0,
        ai_fallbacks: 0,
        failed: 0,
        rows_loaded: 0,
      },
      processed_files: [] as any[],
      sample_data: [] as any[],
    };

    // Process each artifact
    for (const artifact of artifacts) {
      try {
        let rawContent = artifact.raw_content || {};

        // If raw_content is a string, try to parse it
        if (typeof rawContent === 'string') {
          try {
            rawContent = JSON.parse(rawContent);
          } catch (e) {
            rawContent = { content: rawContent };
          }
        }

        // Extract data intelligently based on what we have
        let extractedData: any = {};

        // Priority 1: Check if AI extraction has already been done (fields property)
        if (rawContent.fields && typeof rawContent.fields === 'object') {
          extractedData = rawContent.fields;
          console.log(`Artifact ${artifact.id}: Using AI extracted fields`);
        }
        // Priority 2: Template extraction from HTML text
        else if (rawContent.text && entityFields && entityFields.length > 0) {
          console.log(`Artifact ${artifact.id}: Extracting from HTML text using template selectors`);
          const text = rawContent.text;

          // Extract each field using template selectors or fallback patterns
          for (const field of entityFields) {
            let value = null;

            // Generate possible selector field names (handle name variations)
            const selectorFieldNames = [field.name];
            if (field.name.endsWith('_number')) {
              selectorFieldNames.push(field.name.replace('_number', ''));
            }
            if (field.name.endsWith('_id')) {
              selectorFieldNames.push(field.name.replace('_id', ''));
            }

            // Try template selector first if available
            let fieldSelector = null;
            if (templateSelectors?.fields) {
              for (const selName of selectorFieldNames) {
                if (templateSelectors.fields[selName]) {
                  fieldSelector = templateSelectors.fields[selName];
                  break;
                }
              }
            }

            if (fieldSelector) {
              // Try primary pattern
              if (fieldSelector.pattern?.primary) {
                try {
                  const pattern = new RegExp(fieldSelector.pattern.primary, 'im');
                  const match = text.match(pattern);
                  if (match && match[1]) {
                    value = match[1].trim();
                  }
                } catch (e) {
                  console.error(`Invalid regex pattern for ${field.name}:`, e);
                }
              }

              // Try fallback pattern if primary failed
              if (!value && fieldSelector.pattern?.fallback) {
                try {
                  const pattern = new RegExp(fieldSelector.pattern.fallback, 'im');
                  const match = text.match(pattern);
                  if (match && match[1]) {
                    value = match[1].trim();
                  }
                } catch (e) {
                  console.error(`Invalid fallback regex pattern for ${field.name}:`, e);
                }
              }
            }

            // Fallback to basic patterns if no template or template extraction failed
            if (!value) {
              const basicPatterns: Record<string, RegExp> = {
                'ttbid': /TTB\s+ID\s*(\d+)/i,
                'ttb_id': /TTB\s+ID\s*(\d+)/i,
                'ct': /\bCT\s*(\d+)/i,
                'ct_number': /\bCT\s*(\d+)/i,
                'or': /\bOR\s*(\d+)/i,
                'or_number': /\bOR\s*(\d+)/i,
                'status': /THE\s+STATUS\s+IS\s+([A-Z]+)/i,
                'product_type': /TYPE\s+OF\s+PRODUCT[^A-Z]*(WINE|DISTILLED SPIRITS|MALT BEVERAGE)/i,
                'application_type': /APPLICATION\s+TYPE[:\s]+([^\n]+)/i,
                'applicant_name': /NAME\s+AND\s+ADDRESS\s+OF\s+APPLICANT[^A-Z]*([A-Z][A-Za-z\s,]+)/i,
                'source_of_product': /SOURCE\s+OF\s+PRODUCT[:\s]+([^\n]+)/i,
                'plant_registry_number': /PLANT\s+REGISTRY[:\s]*(\d+)/i,
                'class_type_description': /CLASS\/TYPE\s+DESCRIPTION[:\s]+([^\n]+)/i,
              };

              const fieldNameLower = field.name.toLowerCase();
              if (basicPatterns[fieldNameLower]) {
                const match = text.match(basicPatterns[fieldNameLower]);
                if (match && match[1]) {
                  value = match[1].trim();
                }
              }
            }

            if (value) {
              extractedData[field.name] = value;
            }
          }
        }
        // Priority 3: Use metadata if nothing else
        else if (artifact.metadata?.extracted_data) {
          extractedData = artifact.metadata.extracted_data;
        }

        console.log(`Processing artifact ${artifact.id}:`, {
          filename: artifact.original_filename,
          extractedFields: Object.keys(extractedData),
          sampleData: extractedData,
        });

        if (!extractedData || Object.keys(extractedData).length === 0) {
          results.execution_summary.failed++;
          results.processed_files.push({
            artifact_id: artifact.id,
            filename: artifact.original_filename,
            status: 'FAILED',
            error: 'No data could be extracted',
            extraction_status: artifact.extraction_status,
          });
          continue;
        }

        // Use extracted data directly (already mapped to entity field names)
        const mappedRow: any = { ...extractedData };

        // Add metadata fields (matching SQL schema for INTERIM entities)
        mappedRow.extraction_date = new Date().toISOString();
        mappedRow.source_artifact_id = artifact.id;
        if (template) {
          mappedRow.template_id = template.id;
        }

        results.execution_summary.processed++;
        results.execution_summary.template_successes++;
        results.execution_summary.rows_loaded++;

        results.processed_files.push({
          artifact_id: artifact.id,
          filename: artifact.original_filename,
          status: 'SUCCESS',
          extraction_method: template ? 'template' : 'ai',
          row_data: mappedRow,
        });

        // Keep first 5 for sample preview
        if (results.sample_data.length < 5) {
          results.sample_data.push(mappedRow);
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

    // Calculate cost estimate (rough)
    const aiCalls = results.execution_summary.ai_fallbacks;
    const estimatedCost = aiCalls * 0.06; // ~$0.06 per AI call

    results.execution_summary = {
      ...results.execution_summary,
      estimated_cost: estimatedCost,
      success_rate: (results.execution_summary.processed / results.execution_summary.total_files * 100).toFixed(1) + '%',
    };

    return NextResponse.json(results);

  } catch (error) {
    console.error('Error running pipeline test:', error);
    return NextResponse.json(
      { error: 'Failed to run pipeline test', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
