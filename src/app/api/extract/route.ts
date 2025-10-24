/**
 * Extraction API Route
 *
 * POST /api/extract - Extract content from artifacts
 *
 * Extracts raw text content from uploaded artifact files (PDF, HTML)
 * and stores it in the raw_content field for AI processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractPDF } from '@/lib/extractors/pdf-extractor';
import { extractHTML } from '@/lib/extractors/html-extractor';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for extraction

/**
 * POST /api/extract
 *
 * Body: { artifact_id: string }
 * or: { artifact_ids: string[] } for batch extraction
 */
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

    const body = await request.json();
    const { artifact_id, artifact_ids } = body;

    // Handle batch extraction
    if (artifact_ids && Array.isArray(artifact_ids)) {
      const results = await Promise.all(
        artifact_ids.map((id) => extractArtifact(supabase, id, user.id))
      );

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      return NextResponse.json({
        success: true,
        results,
        summary: {
          total: results.length,
          successful,
          failed,
        },
      });
    }

    // Handle single extraction
    if (!artifact_id) {
      return NextResponse.json(
        { error: 'artifact_id or artifact_ids required' },
        { status: 400 }
      );
    }

    const result = await extractArtifact(supabase, artifact_id, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      artifact: result.artifact,
      extraction: {
        text_length: result.text_length,
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract content from a single artifact
 */
async function extractArtifact(supabase: any, artifactId: string, userId: string) {
  try {
    // Get artifact from database
    const { data: artifact, error: fetchError } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', artifactId)
      .eq('created_by', userId)
      .single();

    if (fetchError || !artifact) {
      return {
        success: false,
        error: 'Artifact not found or access denied',
        artifact_id: artifactId,
      };
    }

    // Check if already extracted
    if (artifact.raw_content && artifact.extraction_status === 'completed') {
      return {
        success: true,
        artifact,
        text_length: JSON.stringify(artifact.raw_content).length,
        metadata: artifact.metadata,
        message: 'Already extracted',
      };
    }

    // Update status to processing
    await supabase
      .from('artifacts')
      .update({ extraction_status: 'processing' })
      .eq('id', artifactId);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('artifacts')
      .download(artifact.file_path);

    if (downloadError || !fileData) {
      await supabase
        .from('artifacts')
        .update({
          extraction_status: 'failed',
          error_message: `Failed to download file: ${downloadError?.message}`,
        })
        .eq('id', artifactId);

      return {
        success: false,
        error: 'Failed to download artifact file',
        artifact_id: artifactId,
      };
    }

    // Convert to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Extract content based on type
    let extractionResult;
    let rawContent;

    switch (artifact.artifact_type) {
      case 'pdf':
        extractionResult = await extractPDF(buffer);
        if (extractionResult.success) {
          rawContent = {
            text: extractionResult.text,
            metadata: extractionResult.metadata,
            extracted_at: new Date().toISOString(),
          };
        }
        break;

      case 'html':
        const htmlContent = buffer.toString('utf-8');
        extractionResult = await extractHTML(htmlContent);
        if (extractionResult.success) {
          rawContent = {
            text: extractionResult.text,
            metadata: extractionResult.metadata,
            structured: extractionResult.structuredContent,
            extracted_at: new Date().toISOString(),
          };
        }
        break;

      case 'email':
        // For now, treat as text
        extractionResult = {
          success: true,
          text: buffer.toString('utf-8'),
        };
        rawContent = {
          text: extractionResult.text,
          extracted_at: new Date().toISOString(),
        };
        break;

      default:
        await supabase
          .from('artifacts')
          .update({
            extraction_status: 'failed',
            error_message: `Unsupported artifact type: ${artifact.artifact_type}`,
          })
          .eq('id', artifactId);

        return {
          success: false,
          error: `Unsupported artifact type: ${artifact.artifact_type}`,
          artifact_id: artifactId,
        };
    }

    // Check if extraction succeeded
    if (!extractionResult.success) {
      await supabase
        .from('artifacts')
        .update({
          extraction_status: 'failed',
          error_message: extractionResult.error || 'Extraction failed',
        })
        .eq('id', artifactId);

      return {
        success: false,
        error: extractionResult.error || 'Extraction failed',
        artifact_id: artifactId,
      };
    }

    // Update artifact with extracted content
    const { data: updatedArtifact, error: updateError } = await supabase
      .from('artifacts')
      .update({
        raw_content: rawContent,
        extraction_status: 'completed',
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artifactId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update artifact:', updateError);
      return {
        success: false,
        error: 'Failed to update artifact with extracted content',
        artifact_id: artifactId,
      };
    }

    return {
      success: true,
      artifact: updatedArtifact,
      text_length: rawContent.text?.length || 0,
      metadata: rawContent.metadata,
    };
  } catch (error) {
    console.error('Extract artifact error:', error);

    // Try to update status to failed
    try {
      await supabase
        .from('artifacts')
        .update({
          extraction_status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', artifactId);
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      artifact_id: artifactId,
    };
  }
}
