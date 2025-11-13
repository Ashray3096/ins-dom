/**
 * Entity API - DELETE endpoint
 *
 * Deletes an entity and optionally drops its physical table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { executeSQL } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch the entity to get its name and table status
    const { data: entity, error: fetchError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      );
    }

    // 2. Drop the physical table if it exists
    if (entity.table_status === 'created') {
      try {
        const dropSQL = `DROP TABLE IF EXISTS "${entity.name}" CASCADE;`;
        const result = await executeSQL(dropSQL);

        if (!result.success) {
          console.warn(`Failed to drop table ${entity.name}:`, result.error);
          // Continue with deletion even if drop fails
        }
      } catch (error) {
        console.warn(`Error dropping table ${entity.name}:`, error);
        // Continue with deletion even if drop fails
      }
    }

    // 3. Delete the entity (CASCADE will delete related fields and relationships)
    const { error: deleteError } = await supabase
      .from('entities')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: `Entity ${entity.name} deleted successfully`,
      table_dropped: entity.table_status === 'created'
    });

  } catch (error) {
    console.error('Error deleting entity:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete entity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
