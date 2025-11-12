import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('🔍 Checking entity_fields table columns...\n');

  // Fetch one row to see what columns exist
  const { data, error } = await supabase
    .from('entity_fields')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error querying entity_fields:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No data in entity_fields table');
    return;
  }

  const row = data[0];
  const requiredColumns = ['template_id', 'template_field_path', 'mapping_type', 'metadata'];

  console.log('📋 COLUMN STATUS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let allPresent = true;
  requiredColumns.forEach(col => {
    const exists = col in row;
    allPresent = allPresent && exists;
    console.log(`${exists ? '✅' : '❌'} ${col.padEnd(25)} ${exists ? 'EXISTS' : 'MISSING'}`);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (allPresent) {
    console.log('🎉 ALL REQUIRED COLUMNS ARE PRESENT!\n');
    console.log('📝 Next steps:');
    console.log('1. Delete/abandon current entity: f519ba21-6f50-408e-a56b-ee3f23dd75dd');
    console.log('2. Create new entity with template: 4dcf57db-6c71-4faf-a407-82d28be0e3b5');
    console.log('3. Select "Brand Leaders" section when importing fields');
    console.log('4. Verify metadata column has nabca_section populated');
    console.log('5. Ready for pipeline execution!\n');
  } else {
    console.log('⚠️  MIGRATION STILL NEEDED\n');
    console.log('Please run the SQL migration:');
    console.log('1. Open Supabase SQL Editor');
    console.log('2. Copy contents of: add-entity-fields-template-columns.sql');
    console.log('3. Execute the SQL');
    console.log('4. Run this script again to verify\n');
  }

  // Show all available columns
  console.log('All columns in entity_fields:');
  Object.keys(row).forEach(col => {
    console.log(`  - ${col}`);
  });
}

checkColumns().catch(console.error);
