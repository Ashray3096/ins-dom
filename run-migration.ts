import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running migration to add textract extraction method...');

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_extraction_method_check;
      ALTER TABLE templates ADD CONSTRAINT templates_extraction_method_check
        CHECK (extraction_method IN ('ai', 'visual', 'hybrid', 'textract'));
    `
  });

  if (error) {
    console.error('❌ Migration failed:', error);
  } else {
    console.log('✅ Migration completed successfully');
  }
}

runMigration();
