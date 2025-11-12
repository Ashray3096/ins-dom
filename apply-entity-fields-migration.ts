import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('📦 Applying entity_fields table migration...\n');

  // Read the SQL file
  const sql = fs.readFileSync('add-entity-fields-template-columns.sql', 'utf-8');

  // Split by semicolon and filter out comments and empty lines
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing:`);
    console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        console.error('   ❌ Error:', error.message);
        // Continue with other statements even if one fails
      } else {
        console.log('   ✅ Success');
      }
    } catch (err) {
      console.error('   ❌ Exception:', err);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Verifying columns were added...\n');

  // Verify the columns exist
  const { data: columns, error: columnsError } = await supabase
    .from('entity_fields')
    .select('*')
    .limit(1);

  if (columnsError) {
    console.error('❌ Error querying entity_fields:', columnsError);
    return;
  }

  if (columns && columns.length > 0) {
    const firstRow = columns[0];
    const newColumns = ['template_id', 'template_field_path', 'mapping_type', 'metadata'];

    console.log('Column check:');
    newColumns.forEach(col => {
      const exists = col in firstRow;
      console.log(`  ${exists ? '✅' : '❌'} ${col}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });
  }

  console.log('\n✅ Migration complete!\n');
  console.log('📝 NEXT STEPS:');
  console.log('1. Delete or abandon the current entity (f519ba21-6f50-408e-a56b-ee3f23dd75dd)');
  console.log('2. Create a new entity using template: 4dcf57db-6c71-4faf-a407-82d28be0e3b5');
  console.log('3. Select "Brand Leaders" section when importing fields');
  console.log('4. Verify entity_fields rows have metadata with nabca_section');
  console.log('5. Proceed to pipeline execution');
}

applyMigration().catch(console.error);
