/**
 * Entity Table Creation API
 *
 * POST /api/entities/[id]/create-table - Create physical table in database from entity definition
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEntityTableSQL } from '@/lib/pipeline-generator';
import { executeSQL } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get entity definition
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Check if table already created
    if (entity.table_status === 'created') {
      return NextResponse.json({
        error: 'Table already exists',
        message: `Table '${entity.name}' was created at ${entity.table_created_at}`,
      }, { status: 400 });
    }

    // Get entity fields
    const { data: fields, error: fieldsError } = await supabase
      .from('entity_fields')
      .select('*')
      .eq('entity_id', id)
      .order('sort_order');

    if (fieldsError) {
      return NextResponse.json({ error: 'Failed to fetch entity fields' }, { status: 500 });
    }

    if (!fields || fields.length === 0) {
      return NextResponse.json({
        error: 'No fields defined',
        message: 'Add at least one field to the entity before creating the table',
      }, { status: 400 });
    }

    // Update status to creating
    await supabase
      .from('entities')
      .update({ table_status: 'creating' })
      .eq('id', id);

    try {
      // Generate CREATE TABLE SQL
      const createTableSQL = generateEntityTableSQL(entity, fields);

      console.log(`\n========== CREATE TABLE SQL ==========`);
      console.log(`Entity: ${entity.name}`);
      console.log(`Type: ${entity.entity_type}`);
      console.log(`Fields: ${fields.length}`);
      console.log('SQL:');
      console.log(createTableSQL);
      console.log(`======================================\n`);

      // Execute SQL using direct PostgreSQL connection
      const result = await executeSQL(createTableSQL);

      if (!result.success) {
        console.error('SQL execution error:', result.error);

        // Update status to failed
        await supabase
          .from('entities')
          .update({
            table_status: 'failed',
            metadata: {
              ...entity.metadata,
              last_error: result.error,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', id);

        throw new Error(result.error);
      }

      // Generate GraphQL operations for this entity table
      const graphqlOperations = generateGraphQLOperations(entity.name, fields);

      // Update entity with success status
      const { error: updateError } = await supabase
        .from('entities')
        .update({
          table_status: 'created',
          table_created_at: new Date().toISOString(),
          graphql_operations: graphqlOperations,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating entity status:', updateError);
      }

      return NextResponse.json({
        success: true,
        message: `Table '${entity.name}' created successfully`,
        tableName: entity.name,
        fieldCount: fields.length,
        sql: createTableSQL,
        graphqlOperations,
      });

    } catch (error) {
      // Update status to failed
      await supabase
        .from('entities')
        .update({
          table_status: 'failed',
          metadata: {
            ...entity.metadata,
            last_error: error instanceof Error ? error.message : 'Unknown error',
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', id);

      throw error;
    }

  } catch (error) {
    console.error('Error creating table:', error);
    return NextResponse.json(
      {
        error: 'Failed to create table',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate GraphQL mutation operations for entity table
 */
function generateGraphQLOperations(tableName: string, fields: any[]) {
  const fieldNames = fields.map(f => f.name).join('\n    ');

  return {
    insert: `mutation Insert${pascalCase(tableName)}($objects: [${tableName}_insert_input!]!) {
  insert_${tableName}(objects: $objects) {
    affected_rows
    returning {
      id
      ${fieldNames}
    }
  }
}`,
    upsert: `mutation Upsert${pascalCase(tableName)}($objects: [${tableName}_insert_input!]!) {
  insert_${tableName}(
    objects: $objects,
    on_conflict: {
      constraint: ${tableName}_pkey,
      update_columns: [${fields.filter(f => !f.is_primary_key).map(f => f.name).join(', ')}]
    }
  ) {
    affected_rows
  }
}`,
    query: `query Get${pascalCase(tableName)}($limit: Int = 100, $offset: Int = 0) {
  ${tableName}(limit: $limit, offset: $offset, order_by: {created_at: desc}) {
    id
    ${fieldNames}
  }
}`
  };
}

function pascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
