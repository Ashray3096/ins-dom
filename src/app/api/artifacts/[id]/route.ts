import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * DELETE /api/artifacts/[id]
 * Delete an artifact and its associated file from storage
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Get the artifact to find the file path
    const { data: artifact, error: fetchError } = await supabase
      .from('artifacts')
      .select('file_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching artifact:', fetchError);
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Delete the file from storage if it exists
    if (artifact.file_path) {
      const { error: storageError } = await supabase.storage
        .from('artifacts')
        .remove([artifact.file_path]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with DB deletion even if storage fails
      }
    }

    // Delete the artifact record from database
    const { error: deleteError } = await supabase
      .from('artifacts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting artifact from database:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete artifact' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Artifact deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/artifacts/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
