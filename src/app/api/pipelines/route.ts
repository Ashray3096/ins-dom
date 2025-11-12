/**
 * Pipelines API Route
 *
 * GET /api/pipelines - List all pipelines
 * POST /api/pipelines - Create new pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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

    // Get pipelines with related data
    const { data: pipelines, error } = await supabase
      .from('pipelines')
      .select(`
        *,
        provider:providers(id, name, type),
        template:templates(id, name, description)
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(pipelines || []);
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pipelines' },
      { status: 500 }
    );
  }
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
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Pipeline creation request body:', body);

    const { name, description, provider_id, template_id, schedule, config, is_multi_entity, target_entities } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Pipeline name is required' },
        { status: 400 }
      );
    }

    // Build pipeline data based on whether it's multi-entity or single-entity
    const pipelineData: any = {
      name,
      description: description || null,
      provider_id: provider_id || null,
      template_id: template_id || null,
      schedule: schedule || null,
      config: config || {},
      is_active: false, // Starts inactive until deployed
      created_by: user.id,
    };

    // Handle multi-entity vs single-entity
    if (is_multi_entity && target_entities && target_entities.length > 0) {
      // Multi-entity pipeline
      pipelineData.is_multi_entity = true;
      pipelineData.target_entities = target_entities;
      pipelineData.entity_id = null;
      console.log('Creating multi-entity pipeline with entities:', target_entities);
    } else if (config?.target_entity_id) {
      // Single-entity pipeline (legacy/default)
      pipelineData.is_multi_entity = false;
      pipelineData.entity_id = config.target_entity_id;
      pipelineData.target_entities = [];
      console.log('Creating single-entity pipeline with entity:', config.target_entity_id);
    } else {
      return NextResponse.json(
        { error: 'Either target_entity_id or target_entities is required' },
        { status: 400 }
      );
    }

    console.log('Creating pipeline with data:', pipelineData);

    // Create pipeline
    const { data: pipeline, error } = await supabase
      .from('pipelines')
      .insert(pipelineData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating pipeline:', error);
      return NextResponse.json(
        {
          error: 'Failed to create pipeline',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    console.log('Pipeline created successfully:', pipeline.id);
    return NextResponse.json(pipeline, { status: 201 });
  } catch (error) {
    console.error('Error creating pipeline:', error);
    return NextResponse.json(
      {
        error: 'Failed to create pipeline',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
