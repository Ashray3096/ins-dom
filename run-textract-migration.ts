import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔄 Running migration to add textract extraction method...');
  console.log('   Supabase URL:', supabaseUrl);

  try {
    // Try to update the constraint directly using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_extraction_method_check;
        ALTER TABLE templates ADD CONSTRAINT templates_extraction_method_check
          CHECK (extraction_method IN ('ai', 'visual', 'hybrid', 'textract'));
      `
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      console.error('   Note: This may fail if exec_sql RPC function does not exist.');
      console.error('   You may need to run the migration manually in the Supabase SQL editor.');
      process.exit(1);
    } else {
      console.log('✅ Migration completed successfully');
      console.log('   The templates table now accepts extraction_method = "textract"');
    }
  } catch (err) {
    console.error('❌ Error running migration:', err);
    process.exit(1);
  }
}

runMigration();
