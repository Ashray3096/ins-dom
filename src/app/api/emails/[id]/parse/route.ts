/**
 * Email Parsing API
 *
 * GET /api/emails/[id]/parse - Parse email artifact and return structured data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseEmailContent } from '@/lib/email-parser';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get artifact
    const { data: artifact, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !artifact) {
      return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    // Get email content
    let emailContent: string;

    if (artifact.raw_content && typeof artifact.raw_content === 'object') {
      emailContent = artifact.raw_content.content || '';
    } else if (typeof artifact.raw_content === 'string') {
      emailContent = artifact.raw_content;
    } else {
      return NextResponse.json({ error: 'No email content found' }, { status: 400 });
    }

    // Parse email (server-side only)
    const parsed = await parseEmailContent(emailContent);

    return NextResponse.json({
      success: true,
      data: parsed,
    });

  } catch (error) {
    console.error('Error parsing email:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
