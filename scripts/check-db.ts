import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('Checking existing database tables...\n');

  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');

  if (error) {
    console.error('Error fetching tables:', error);
    return;
  }

  console.log('Existing tables in public schema:');
  data?.forEach((table: any) => {
    console.log(`  - ${table.table_name}`);
  });
}

checkDatabase();
