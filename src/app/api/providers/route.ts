/**
 * Providers API Routes
 *
 * GET /api/providers - List all providers
 * POST /api/providers - Create a new provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Provider, ProviderType, ProviderCadence } from '@/types/providers';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Debug logging
    console.log('[API /api/providers GET] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message,
    });

    if (authError || !user) {
      console.error('[API /api/providers GET] Unauthorized:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as ProviderType | null;
    const status = searchParams.get('status');

    let query = supabase
      .from('providers')
      .select('*')
      .eq('created_by', user.id)
      .order('name', { ascending: true });

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching providers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in GET /api/providers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Debug logging
    console.log('[API /api/providers POST] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      authError: authError?.message,
    });

    if (authError || !user) {
      console.error('[API /api/providers POST] Unauthorized:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, description, cadence } = body;

    // Validation
    if (!name || !type || !cadence) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, cadence' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes: ProviderType[] = ['NABCA', 'TTB', 'CUSTOM'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate cadence
    const validCadences: ProviderCadence[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'ADHOC'];
    if (!validCadences.includes(cadence)) {
      return NextResponse.json(
        { error: `Invalid cadence. Must be one of: ${validCadences.join(', ')}` },
        { status: 400 }
      );
    }

    // Insert provider
    const { data, error } = await supabase
      .from('providers')
      .insert({
        name,
        type,
        description,
        cadence,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating provider:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/providers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
