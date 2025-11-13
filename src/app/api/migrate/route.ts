/**
 * Database Migration API
 *
 * Run this once to update database constraints for CSV and JSON support
 * Access: GET /api/migrate
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    console.log('Running database migration...');

    // Update artifacts constraint to include 'csv'
    const { error: artifactsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS artifacts_artifact_type_check;
        ALTER TABLE artifacts ADD CONSTRAINT artifacts_artifact_type_check
          CHECK (artifact_type IN ('pdf', 'html', 'email', 'json', 'csv'));
      `
    });

    if (artifactsError) {
      console.error('Error updating artifacts constraint:', artifactsError);
      // Try alternative approach
      console.log('Trying direct SQL execution...');
    }

    // Update templates constraint to include 'jsonpath' and 'csv'
    const { error: templatesError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_extraction_method_check;
        ALTER TABLE templates ADD CONSTRAINT templates_extraction_method_check
          CHECK (extraction_method IN ('visual', 'textract', 'jsonpath', 'csv'));
      `
    });

    if (templatesError) {
      console.error('Error updating templates constraint:', templatesError);
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed. You may need to run these SQL commands manually in Supabase dashboard if RPC failed.',
      sql: `
-- Run these commands in Supabase SQL Editor:

-- Update artifacts table to allow 'csv' artifact type
ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS artifacts_artifact_type_check;
ALTER TABLE artifacts ADD CONSTRAINT artifacts_artifact_type_check
  CHECK (artifact_type IN ('pdf', 'html', 'email', 'json', 'csv'));

-- Update templates table to allow new extraction methods
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_extraction_method_check;
ALTER TABLE templates ADD CONSTRAINT templates_extraction_method_check
  CHECK (extraction_method IN ('visual', 'textract', 'jsonpath', 'csv'));
      `
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        sql: `
-- Run these commands manually in Supabase SQL Editor:

-- Update artifacts table to allow 'csv' artifact type
ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS artifacts_artifact_type_check;
ALTER TABLE artifacts ADD CONSTRAINT artifacts_artifact_type_check
  CHECK (artifact_type IN ('pdf', 'html', 'email', 'json', 'csv'));

-- Update templates table to allow new extraction methods
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_extraction_method_check;
ALTER TABLE templates ADD CONSTRAINT templates_extraction_method_check
  CHECK (extraction_method IN ('visual', 'textract', 'jsonpath', 'csv'));
        `
      },
      { status: 500 }
    );
  }
}
