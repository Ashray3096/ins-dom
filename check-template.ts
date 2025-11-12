import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/"/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTemplate() {
  console.log('Fetching most recent template...');

  const { data: templates, error } = await supabase
    .from('templates')
    .select('*')
    .eq('extraction_method', 'textract')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('❌ Error fetching template:', error);
    return;
  }

  if (!templates || templates.length === 0) {
    console.log('❌ No textract templates found');
    return;
  }

  const template = templates[0];
  console.log('\n✅ Found Template:');
  console.log('ID:', template.id);
  console.log('Name:', template.name);
  console.log('Description:', template.description);
  console.log('Extraction Method:', template.extraction_method);
  console.log('Fields:', template.fields);
  console.log('\n📋 Selectors (Extraction Rules):');
  console.log(JSON.stringify(template.selectors, null, 2));
}

checkTemplate();
