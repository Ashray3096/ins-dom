import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeTemplate() {
  console.log('=== ANALYZING NABCA TEMPLATE & ENTITY ===\n');

  // Fetch template
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', '4dcf57db-6c71-4faf-a407-82d28be0e3b5')
    .single();

  if (templateError) {
    console.log('❌ Template Error:', templateError);
    return;
  }

  console.log('📋 TEMPLATE ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Template ID:', template.id);
  console.log('Template Name:', template.name);
  console.log('Extraction Method:', template.extraction_method);
  console.log('Sample Artifact ID:', template.sample_artifact_id);
  console.log('Top-level fields count:', Array.isArray(template.fields) ? template.fields.length : 'N/A');

  if (template.selectors && template.selectors.sections) {
    console.log('\n📊 SECTIONS:', template.selectors.sections.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    template.selectors.sections.forEach((section: any, idx: number) => {
      console.log(`\n${idx + 1}. ${section.name}`);
      console.log(`   📄 Pages: ${section.pageRange.start}-${section.pageRange.end} (${section.pageRange.end - section.pageRange.start + 1} pages)`);
      console.log(`   📝 Semantic Fields: ${section.fields ? section.fields.length : 0}`);

      if (section.fields && section.fields.length > 0) {
        console.log('   Field names:', section.fields.slice(0, 5).map((f: any) => f.name).join(', ') + (section.fields.length > 5 ? '...' : ''));

        // Check field structure
        const firstField = section.fields[0];
        console.log(`   Field structure: { name: "${firstField.name}", type: "${firstField.type}", label: "${firstField.label}" }`);
      }

      console.log(`   🔍 Detected Textract Fields: ${section.detectedFields ? section.detectedFields.length : 0}`);

      if (section.metadata) {
        console.log(`   ℹ️  Metadata: ${section.metadata.tables_count} tables, ${section.metadata.fields_count} key-value pairs`);
      }
    });
  } else {
    console.log('⚠️  No sections found in template!');
  }

  // Fetch entity
  console.log('\n\n🏢 ENTITY ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const { data: entity, error: entityError } = await supabase
    .from('entities')
    .select('*')
    .eq('id', 'f519ba21-6f50-408e-a56b-ee3f23dd75dd')
    .single();

  if (entityError) {
    console.log('❌ Entity Error:', entityError);
    return;
  }

  console.log('Entity ID:', entity.id);
  console.log('Entity Name:', entity.name);
  console.log('Display Name:', entity.display_name);
  console.log('Entity Type:', entity.entity_type);
  console.log('Table Name:', entity.table_name);
  console.log('Template ID:', entity.template_id);
  console.log('Template Linked:', entity.template_id === template.id ? '✅ YES' : '❌ NO');

  // Fetch entity fields
  const { data: fields, error: fieldsError } = await supabase
    .from('entity_fields')
    .select('*')
    .eq('entity_id', entity.id)
    .order('sort_order');

  if (fieldsError) {
    console.log('❌ Fields Error:', fieldsError);
    return;
  }

  console.log('\n📋 ENTITY FIELDS:', fields.length);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let sectionName: string | null = null;
  fields.forEach((field: any, idx: number) => {
    // Extract section from metadata
    if (field.metadata && field.metadata.nabca_section) {
      if (!sectionName) {
        sectionName = field.metadata.nabca_section;
        console.log(`\n🎯 All fields are from section: "${sectionName}"\n`);
      }
    }

    console.log(`${idx + 1}. ${field.name}`);
    console.log(`   Display: ${field.display_name}`);
    console.log(`   Type: ${field.data_type}`);
    console.log(`   Template Path: ${field.template_field_path || 'N/A'}`);
    console.log(`   Section: ${field.metadata?.nabca_section || 'N/A'}`);
    console.log('');
  });

  // Validation
  console.log('\n✅ VALIDATION RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const checks = [
    {
      name: 'Template has sections',
      pass: template.selectors?.sections && template.selectors.sections.length > 0,
    },
    {
      name: 'Sections have semantic fields',
      pass: template.selectors?.sections?.some((s: any) => s.fields && s.fields.length > 0),
    },
    {
      name: 'Entity linked to template',
      pass: entity.template_id === template.id,
    },
    {
      name: 'Entity has fields',
      pass: fields.length > 0,
    },
    {
      name: 'Fields have section metadata',
      pass: fields.some((f: any) => f.metadata?.nabca_section),
    },
    {
      name: 'Fields have template paths',
      pass: fields.every((f: any) => f.template_field_path),
    },
  ];

  checks.forEach(check => {
    console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
  });

  const allPassed = checks.every(c => c.pass);

  console.log('\n' + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (allPassed) {
    console.log('🎉 ALL CHECKS PASSED! Ready for pipeline generation.');
  } else {
    console.log('⚠️  SOME CHECKS FAILED. Review the issues above.');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Show next steps
  if (allPassed) {
    console.log('📝 NEXT STEPS:');
    console.log('1. Create pipeline for this entity');
    console.log('2. Generate pipeline code');
    console.log('3. Pipeline will:');
    console.log(`   - Extract pages ${template.selectors.sections.find((s: any) => s.name === sectionName)?.pageRange.start}-${template.selectors.sections.find((s: any) => s.name === sectionName)?.pageRange.end} from each PDF`);
    console.log('   - Use Textract to get table data');
    console.log('   - Map Textract columns to your semantic field names');
    console.log('   - Insert records into your entity table');
  }
}

analyzeTemplate().catch(console.error);
