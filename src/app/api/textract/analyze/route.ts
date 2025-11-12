/**
 * Textract Analyze API
 *
 * POST /api/textract/analyze
 * Analyzes a PDF artifact using AWS Textract to extract:
 * - Tables
 * - Key-value pairs (form fields)
 * - Text blocks with positions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createTextractClient,
  createS3Client,
  analyzeDocument,
  analyzeDocumentAsync,
  formatTextractResults,
} from '@/lib/textract-client';
import { getFileStorageService } from '@/lib/file-storage-service';

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
    const { artifact_id } = body;

    if (!artifact_id) {
      return NextResponse.json(
        { error: 'artifact_id is required' },
        { status: 400 }
      );
    }

    console.log(`📄 Starting Textract analysis for artifact: ${artifact_id}`);

    // Get artifact from database
    const { data: artifact, error: artifactError } = await supabase
      .from('artifacts')
      .select('*, sources(*)')
      .eq('id', artifact_id)
      .eq('created_by', user.id)
      .single();

    if (artifactError || !artifact) {
      console.error('Artifact not found:', artifactError);
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Check if artifact contains HTML (not supported by Textract)
    if (artifact.raw_content?.html || artifact.filename?.endsWith('.html')) {
      return NextResponse.json(
        {
          error: 'HTML artifacts cannot be analyzed with Textract',
          details: 'Textract only supports PDF and image files. This artifact contains HTML content. Please use the Visual Template Builder for HTML artifacts instead.'
        },
        { status: 400 }
      );
    }

    // Check artifact type
    if (artifact.artifact_type !== 'pdf') {
      return NextResponse.json(
        { error: 'Only PDF artifacts can be analyzed with Textract' },
        { status: 400 }
      );
    }

    // Get PDF file using FileStorageService (handles S3, Supabase Storage, and raw_content)
    console.log('📥 Retrieving PDF file...');
    const fileService = getFileStorageService();

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await fileService.getFile(artifact as any);
      console.log(`✅ Retrieved PDF: ${pdfBuffer.length} bytes`);
    } catch (error) {
      console.error('❌ Could not retrieve PDF file:', error);
      return NextResponse.json(
        {
          error: 'PDF file not found',
          details: error instanceof Error ? error.message : 'Could not retrieve PDF from any storage location'
        },
        { status: 400 }
      );
    }

    // Log first bytes for debugging
    const firstBytes = pdfBuffer.slice(0, 10);
    console.log('🔍 First 10 bytes:', firstBytes.toString('hex'), '|', firstBytes.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));

    // Validate that we have actual PDF content (check PDF magic bytes)
    const pdfMagicBytes = pdfBuffer.slice(0, 5).toString('ascii');
    if (!pdfMagicBytes.startsWith('%PDF')) {
      console.error('❌ Invalid PDF format. First 20 bytes:', pdfBuffer.slice(0, 20).toString('ascii'));
      return NextResponse.json(
        {
          error: 'Invalid PDF format',
          details: `The file does not appear to be a valid PDF (starts with: "${pdfMagicBytes}"). Textract only supports PDF and image files.`
        },
        { status: 400 }
      );
    }

    console.log(`✅ PDF validated: ${pdfBuffer.length} bytes`);

    // Create Textract client
    const textractClient = createTextractClient();

    // Determine whether to use synchronous or asynchronous API
    // Sync API: Max 10 pages, 5MB
    // Async API: Max 3000 pages, 500MB, requires S3
    const syncMaxSize = 5 * 1024 * 1024; // 5MB
    const useAsyncApi = pdfBuffer.length > syncMaxSize;

    let analysisResult;

    if (useAsyncApi) {
      // Use async API for larger files
      console.log(`📊 PDF size (${(pdfBuffer.length / 1024 / 1024).toFixed(2)}MB) requires async API`);

      // Check for S3 bucket configuration
      const s3Bucket = process.env.TEXTRACT_S3_BUCKET || process.env.AWS_S3_BUCKET;
      if (!s3Bucket) {
        return NextResponse.json(
          {
            error: 'S3 bucket not configured',
            details: 'This PDF requires async processing, but no S3 bucket is configured. Please set TEXTRACT_S3_BUCKET or AWS_S3_BUCKET in your environment variables.'
          },
          { status: 500 }
        );
      }

      const s3Client = createS3Client();

      console.log('🔍 Starting async Textract analysis...');
      analysisResult = await analyzeDocumentAsync(
        textractClient,
        s3Client,
        pdfBuffer,
        {
          s3Bucket,
          s3KeyPrefix: 'textract-temp/',
          maxPollingTime: 600000 // 10 minutes
        }
      );
    } else {
      // Use synchronous API for smaller files (likely <10 pages)
      console.log('🔍 Analyzing document with Textract (synchronous API)...');

      try {
        analysisResult = await analyzeDocument(textractClient, pdfBuffer);
      } catch (error: any) {
        // If we get an error about too many pages, fall back to async API
        if (error?.__type === 'UnsupportedDocumentException' ||
            error?.message?.includes('pages') ||
            error?.message?.includes('11 pages')) {

          console.log('⚠️ Synchronous API failed (likely >10 pages), falling back to async API...');

          // Check for S3 bucket configuration
          const s3Bucket = process.env.TEXTRACT_S3_BUCKET || process.env.AWS_S3_BUCKET;
          if (!s3Bucket) {
            return NextResponse.json(
              {
                error: 'PDF has too many pages for synchronous processing',
                details: 'This PDF appears to have more than 10 pages and requires async processing, but no S3 bucket is configured. Please set TEXTRACT_S3_BUCKET or AWS_S3_BUCKET in your environment variables.'
              },
              { status: 500 }
            );
          }

          const s3Client = createS3Client();

          analysisResult = await analyzeDocumentAsync(
            textractClient,
            s3Client,
            pdfBuffer,
            {
              s3Bucket,
              s3KeyPrefix: 'textract-temp/',
              maxPollingTime: 600000 // 10 minutes
            }
          );
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }

    console.log('✅ Textract analysis complete!');
    console.log(`   - Tables: ${analysisResult.tables.length}`);
    console.log(`   - Key-Value Pairs: ${analysisResult.keyValuePairs.length}`);
    console.log(`   - Text Blocks: ${analysisResult.textBlocks.length}`);

    // Format results for easier reading
    const formattedResults = formatTextractResults(analysisResult);

    // Store analysis results in artifact metadata (optional)
    const { error: updateError } = await supabase
      .from('artifacts')
      .update({
        metadata: {
          ...artifact.metadata,
          textract_analysis: {
            analyzed_at: new Date().toISOString(),
            tables_count: analysisResult.tables.length,
            key_value_pairs_count: analysisResult.keyValuePairs.length,
            text_blocks_count: analysisResult.textBlocks.length,
            pages: analysisResult.documentMetadata.pages,
          },
        },
      })
      .eq('id', artifact_id);

    if (updateError) {
      console.warn('Failed to update artifact metadata:', updateError);
    }

    return NextResponse.json({
      success: true,
      artifact_id,
      analysis: analysisResult,
      formatted: formattedResults,
    });
  } catch (error) {
    console.error('❌ Error analyzing PDF with Textract:', error);

    // Handle specific Textract errors
    if (error && typeof error === 'object' && '__type' in error) {
      const errorType = (error as any).__type;

      if (errorType === 'UnsupportedDocumentException') {
        return NextResponse.json(
          {
            error: 'PDF not supported by Textract',
            details: 'This PDF cannot be processed by AWS Textract. Common reasons:\n' +
              '• The PDF contains only scanned images (no text layer)\n' +
              '• The PDF uses unsupported features or encoding\n' +
              '• The PDF structure is incompatible\n\n' +
              'Suggestions:\n' +
              '• Try a different PDF with selectable text\n' +
              '• Use the "Build Visual Template" option for HTML artifacts instead\n' +
              '• Convert the PDF to have a text layer using OCR software first',
            errorType: 'UnsupportedDocumentException'
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to analyze PDF',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
