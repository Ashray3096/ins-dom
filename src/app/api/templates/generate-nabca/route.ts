/**
 * NABCA Template Generation API
 *
 * POST /api/templates/generate-nabca
 * Generates a multi-section template for NABCA PDFs with 8 different table types
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFileStorageService } from '@/lib/file-storage-service';
import { extractPdfPages, getPdfPageCount } from '@/lib/pdf-splitter';
import {
  createTextractClient,
  createS3Client,
  processDocumentFromS3,
  analyzeDocumentAsync,
  formatTextractResults,
} from '@/lib/textract-client';
import { NABCA_TABLE_SCHEMAS } from '@/lib/nabca-field-schemas';

interface PageRange {
  start: number;
  end: number;
}

interface NabcaSection {
  name: string;
  pageRange: PageRange;
  enabled: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const {
      artifact_id,
      template_name,
      sections,
    } = body as {
      artifact_id: string;
      template_name: string;
      sections: NabcaSection[];
    };

    if (!artifact_id || !template_name || !sections) {
      return NextResponse.json(
        { error: 'Missing required fields: artifact_id, template_name, sections' },
        { status: 400 }
      );
    }

    console.log(`🏁 Starting NABCA template generation for artifact: ${artifact_id}`);
    console.log(`   Template name: ${template_name}`);
    console.log(`   Sections: ${sections.filter(s => s.enabled).length} enabled`);

    // Get artifact from database
    const { data: artifact, error: artifactError } = await supabase
      .from('artifacts')
      .select('*, sources(*)')
      .eq('id', artifact_id)
      .eq('created_by', user.id)
      .single();

    if (artifactError || !artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Verify it's a PDF
    if (artifact.artifact_type !== 'pdf') {
      return NextResponse.json(
        { error: 'Only PDF artifacts are supported for NABCA template generation' },
        { status: 400 }
      );
    }

    // Get PDF file
    console.log('📥 Retrieving PDF file...');
    const fileService = getFileStorageService();
    const pdfBuffer = await fileService.getFile(artifact as any);
    console.log(`✅ Retrieved PDF: ${pdfBuffer.length} bytes`);

    // Get page count
    const totalPages = await getPdfPageCount(pdfBuffer);
    console.log(`📄 PDF has ${totalPages} pages`);

    // Validate page ranges
    for (const section of sections.filter(s => s.enabled)) {
      if (section.pageRange.start < 1 || section.pageRange.end > totalPages) {
        return NextResponse.json(
          {
            error: `Invalid page range for ${section.name}: ${section.pageRange.start}-${section.pageRange.end}. PDF has ${totalPages} pages.`
          },
          { status: 400 }
        );
      }
    }

    // Create Textract client
    const textractClient = createTextractClient();

    // Check if we can use direct S3 processing (for S3-synced artifacts)
    const isS3Artifact = !!(artifact.metadata?.s3_bucket && artifact.metadata?.s3_key);
    const s3Bucket = process.env.TEXTRACT_S3_BUCKET || process.env.AWS_S3_BUCKET || artifact.metadata?.s3_bucket;

    console.log(`🔧 Processing mode: ${isS3Artifact ? 'Direct S3' : 'Upload to S3'}`);

    // Process each enabled section
    const processedSections: any[] = [];
    const enabledSections = sections.filter(s => s.enabled);

    for (let i = 0; i < enabledSections.length; i++) {
      const section = enabledSections[i];
      console.log(`\n📋 Processing section ${i + 1}/${enabledSections.length}: ${section.name}`);
      console.log(`   Pages: ${section.pageRange.start}-${section.pageRange.end}`);

      try {
        // Extract page range
        const sectionPdf = await extractPdfPages(
          pdfBuffer,
          section.pageRange.start,
          section.pageRange.end
        );
        console.log(`   Extracted ${sectionPdf.length} bytes`);

        // Analyze with Textract
        let analysisResult;

        if (isS3Artifact && section.pageRange.start === 1 && section.pageRange.end === totalPages) {
          // If processing entire PDF and it's already in S3, use it directly
          console.log(`   Using direct S3 processing...`);
          analysisResult = await processDocumentFromS3(
            textractClient,
            artifact.metadata.s3_bucket,
            artifact.metadata.s3_key,
            { maxPollingTime: 1200000 } // 20 minutes
          );
        } else {
          // Extract section and upload to S3 for processing
          console.log(`   Uploading section to S3 for analysis...`);
          const s3Client = createS3Client();

          analysisResult = await analyzeDocumentAsync(
            textractClient,
            s3Client,
            sectionPdf,
            {
              s3Bucket: s3Bucket!,
              s3KeyPrefix: `textract-nabca-temp/${artifact_id}/`,
              maxPollingTime: 1200000 // 20 minutes
            }
          );
        }

        console.log(`   ✅ Textract complete: ${analysisResult.tables.length} tables, ${analysisResult.keyValuePairs.length} fields`);

        // Format results
        const formatted = formatTextractResults(analysisResult);

        // Store section data
        processedSections.push({
          name: section.name,
          pageRange: section.pageRange,
          tables: analysisResult.tables,
          keyValuePairs: analysisResult.keyValuePairs,
          textBlocks: analysisResult.textBlocks,
          formatted,
          metadata: {
            pages: section.pageRange.end - section.pageRange.start + 1,
            tables_count: analysisResult.tables.length,
            fields_count: analysisResult.keyValuePairs.length,
          }
        });
      } catch (error) {
        console.error(`   ❌ Failed to process section ${section.name}:`, error);
        return NextResponse.json(
          {
            error: `Failed to process section: ${section.name}`,
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    console.log(`\n✅ All sections processed successfully`);

    // Generate extraction rules for each section with table-specific field schemas
    const templateSections = processedSections.map(section => {
      // Get the proper field schema for this section from our NABCA specifications
      const tableSchema = NABCA_TABLE_SCHEMAS[section.name] || [];

      // Add nabca_section metadata to each field so pipeline generator knows this is NABCA
      const fieldsWithMetadata = tableSchema.map(field => ({
        ...field,
        metadata: {
          nabca_section: section.name, // e.g., "Brand Leaders"
          page_range: `${section.pageRange.start}-${section.pageRange.end}`,
        }
      }));

      // Extract Textract-detected field names from tables and key-value pairs
      // These will be used for column mapping at runtime
      const detectedFields: any[] = [];

      // Add fields from tables (use first row as headers if available)
      section.tables.forEach((table: any, tableIdx: number) => {
        if (table.data.length > 0) {
          const headers = table.data[0]; // Assume first row is headers
          headers.forEach((header: string, colIdx: number) => {
            if (header && header.trim()) {
              detectedFields.push({
                name: header.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                label: header,
                type: 'string',
                source: {
                  type: 'table',
                  tableIndex: tableIdx,
                  columnIndex: colIdx,
                }
              });
            }
          });
        }
      });

      // Add fields from key-value pairs
      section.keyValuePairs.forEach((kv: any) => {
        if (kv.key && kv.key.trim()) {
          detectedFields.push({
            name: kv.key.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            label: kv.key,
            type: 'string',
            source: {
              type: 'form_field',
              key: kv.key,
            }
          });
        }
      });

      return {
        name: section.name,
        pageRange: section.pageRange,
        fields: fieldsWithMetadata, // Use proper semantic field schema with nabca_section metadata
        detectedFields, // Store Textract-detected fields for column mapping
        metadata: section.metadata,
      };
    });

    // Create template in database
    const { data: template, error: templateError } = await supabase
      .from('templates')
      .insert({
        name: template_name,
        description: `NABCA multi-section template with table-specific field schemas for all 8 NABCA tables`,
        provider_id: artifact.provider_id,
        extraction_method: 'textract',
        sample_artifact_id: artifact_id,
        fields: [], // Fields are stored per-section in selectors.sections[].fields
        selectors: {
          sections: templateSections,
        },
        prompt: 'Extract data from NABCA PDF sections using AWS Textract. Each section has its own semantic field schema.',
        created_by: user.id,
      })
      .select()
      .single();

    if (templateError) {
      console.error('Failed to create template:', templateError);
      return NextResponse.json(
        { error: 'Failed to create template', details: templateError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Template created: ${template.id}`);

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        sections: templateSections.map(s => ({
          name: s.name,
          pageRange: s.pageRange,
          fieldCount: s.fields.length,
        })),
      },
      summary: {
        totalSections: processedSections.length,
        totalFields: templateSections.reduce((sum, s) => sum + s.fields.length, 0),
        totalTables: processedSections.reduce((sum, s) => sum + s.metadata.tables_count, 0),
      },
    });
  } catch (error) {
    console.error('❌ Error generating NABCA template:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate NABCA template',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
