/**
 * NABCA Section Extraction API
 *
 * POST /api/artifacts/[id]/extract-nabca-section
 * Extracts a specific NABCA section from a PDF artifact using Textract
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFileStorageService } from '@/lib/file-storage-service';
import { extractPdfPages } from '@/lib/pdf-splitter';
import {
  createTextractClient,
  createS3Client,
  analyzeDocumentAsync,
} from '@/lib/textract-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const artifactId = (await params).id;

    // Get request body
    const body = await request.json();
    const { section_name, page_start, page_end, template_id } = body;

    if (!section_name || !page_start || !page_end) {
      return NextResponse.json(
        { error: 'Missing required fields: section_name, page_start, page_end' },
        { status: 400 }
      );
    }

    console.log(`📋 Extracting NABCA section: ${section_name} (pages ${page_start}-${page_end}) from artifact ${artifactId}`);

    // Get artifact
    const { data: artifact, error: artifactError } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', artifactId)
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
        { error: 'Only PDF artifacts are supported' },
        { status: 400 }
      );
    }

    // Get PDF file
    console.log('📥 Retrieving PDF file...');
    const fileService = getFileStorageService();
    const pdfBuffer = await fileService.getFile(artifact as any);
    console.log(`✅ Retrieved PDF: ${pdfBuffer.length} bytes`);

    // Extract specific page range
    console.log(`📄 Extracting pages ${page_start}-${page_end}...`);
    const sectionPdf = await extractPdfPages(pdfBuffer, page_start, page_end);
    console.log(`✅ Extracted ${sectionPdf.length} bytes`);

    // Analyze with Textract
    console.log('🔍 Analyzing with AWS Textract...');
    const textractClient = createTextractClient();
    const s3Client = createS3Client();

    const textractResult = await analyzeDocumentAsync(
      textractClient,
      s3Client,
      sectionPdf,
      {
        s3Bucket: process.env.TEXTRACT_S3_BUCKET || process.env.AWS_S3_BUCKET!,
        s3KeyPrefix: `textract-temp/nabca-extraction/${artifactId}/`,
        maxPollingTime: 600000, // 10 minutes
      }
    );

    console.log(`✅ Textract complete: ${textractResult.tables.length} tables detected`);

    // Return extraction results
    return NextResponse.json({
      success: true,
      artifact_id: artifactId,
      section_name,
      page_range: { start: page_start, end: page_end },
      tables: textractResult.tables,
      keyValuePairs: textractResult.keyValuePairs,
      metadata: {
        tables_count: textractResult.tables.length,
        fields_count: textractResult.keyValuePairs.length,
      },
    });
  } catch (error) {
    console.error('❌ Error extracting NABCA section:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract NABCA section',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
