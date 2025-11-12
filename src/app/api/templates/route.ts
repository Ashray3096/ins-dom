import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/templates
 * Get all templates for the authenticated user
 */
export async function GET() {
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

    // Fetch templates for this user
    const { data: templates, error } = await supabase
      .from('templates')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: templates || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Create a new template
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

    // Parse request body
    const body = await request.json();
    const {
      name,
      description,
      provider_id,
      prompt,
      fields,
      status,
      selectors,
      corrections,
      extraction_method,
      artifact_type,
      sample_artifact_id,
    } = body;

    // Validate required fields
    if (!name || !prompt || !fields) {
      return NextResponse.json(
        { error: 'Missing required fields: name, prompt, fields' },
        { status: 400 }
      );
    }

    // Validate fields is an array
    if (!Array.isArray(fields)) {
      return NextResponse.json(
        { error: 'fields must be an array' },
        { status: 400 }
      );
    }

    // If provider_id is provided, verify it exists and belongs to this user
    if (provider_id) {
      const { data: provider, error: providerError } = await supabase
        .from('providers')
        .select('id')
        .eq('id', provider_id)
        .eq('created_by', user.id)
        .single();

      if (providerError || !provider) {
        return NextResponse.json(
          { error: 'Provider not found or access denied' },
          { status: 404 }
        );
      }
    }

    // If sample_artifact_id is provided, verify it exists
    if (sample_artifact_id) {
      const { data: artifact, error: artifactError } = await supabase
        .from('artifacts')
        .select('id')
        .eq('id', sample_artifact_id)
        .single();

      if (artifactError || !artifact) {
        return NextResponse.json(
          { error: 'Sample artifact not found' },
          { status: 404 }
        );
      }
    }

    // Create template
    const { data: template, error } = await supabase
      .from('templates')
      .insert({
        name,
        description: description || null,
        provider_id: provider_id || null,
        prompt,
        fields,
        status: status || 'DRAFT',
        created_by: user.id,
        selectors: selectors || null,
        corrections: corrections || null,
        extraction_method: extraction_method || 'ai',
        artifact_type: artifact_type || null,
        sample_artifact_id: sample_artifact_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
