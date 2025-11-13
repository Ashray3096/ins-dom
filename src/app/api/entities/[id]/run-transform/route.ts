/**
 * Run Transformation API
 *
 * Executes SQL transformations to load data from source entities
 * into REFERENCE (dimension) and MASTER (fact) entities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { querySQL, executeSQL } from '@/lib/db';
import {
  generateTransformSQL,
  getSourceDependencies,
  validateEntityForTransformation,
  type Entity,
  type EntityField
} from '@/lib/transform-sql-generator';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch entity with fields
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .single();

    if (entityError || !entity) {
      return NextResponse.json(
        { error: 'Entity not found' },
        { status: 404 }
      );
    }

    // 2. Validate entity can be transformed
    if (entity.entity_type === 'INTERIM') {
      return NextResponse.json(
        { error: 'INTERIM entities use extraction pipeline, not transformation' },
        { status: 400 }
      );
    }

    // 3. Fetch entity fields
    const { data: fields, error: fieldsError } = await supabase
      .from('entity_fields')
      .select('*')
      .eq('entity_id', id)
      .order('sort_order');

    if (fieldsError || !fields) {
      return NextResponse.json(
        { error: 'Failed to fetch entity fields' },
        { status: 500 }
      );
    }

    // 4. Validate entity has required data for transformation
    const validation = validateEntityForTransformation(
      entity as unknown as Entity,
      fields as unknown as EntityField[]
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Entity validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // 5. Check dependencies have data
    const sourceDependencies = getSourceDependencies(fields as unknown as EntityField[]);
    const dependencyStatus: Array<{
      entity: string;
      hasData: boolean;
      rowCount: number;
    }> = [];

    for (const sourceEntity of sourceDependencies) {
      try {
        const countResult = await querySQL<{ count: string }>(
          `SELECT COUNT(*) as count FROM "${sourceEntity}"`
        );
        const count = parseInt(countResult[0].count);

        dependencyStatus.push({
          entity: sourceEntity,
          hasData: count > 0,
          rowCount: count
        });

        if (count === 0) {
          return NextResponse.json(
            {
              error: `Source table "${sourceEntity}" has no data. Load it first.`,
              dependencies: dependencyStatus
            },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          {
            error: `Source table "${sourceEntity}" does not exist or cannot be accessed.`,
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 400 }
        );
      }
    }

    // 6. Generate or retrieve transformation SQL
    // Always regenerate to ensure it's up-to-date with current fields
    // Fetch all entities for FK resolution
    const { data: allEntities } = await supabase
      .from('entities')
      .select('*');

    const transformSQL = generateTransformSQL(
      entity as unknown as Entity,
      fields as unknown as EntityField[],
      (allEntities || []) as unknown as Entity[]
    );

    // Store generated SQL in metadata for future reference
    await supabase
      .from('entities')
      .update({
        metadata: {
          ...entity.metadata,
          transformation_sql: transformSQL,
          last_sql_generated: new Date().toISOString()
        }
      })
      .eq('id', id);

    // 7. Execute transformation
    console.log(`\n========== TRANSFORMATION SQL ==========`);
    console.log(`Entity: ${entity.name} (${entity.entity_type})`);
    console.log(`Fields: ${fields.length}`);
    console.log(`SQL:\n${transformSQL}`);
    console.log(`========================================\n`);

    const startTime = Date.now();
    const result = await executeSQL(transformSQL);
    const duration = Date.now() - startTime;

    if (!result.success) {
      console.error(`Transformation failed for ${entity.name}:`, result.error);
      return NextResponse.json(
        {
          error: 'Transformation SQL execution failed',
          details: result.error,
          sql: transformSQL
        },
        { status: 500 }
      );
    }

    // Count the inserted rows
    const countResult = await querySQL<{ count: string }>(
      `SELECT COUNT(*) as count FROM "${entity.name}"`
    );
    const rowsInserted = parseInt(countResult[0].count);

    // 8. Update entity status
    await supabase
      .from('entities')
      .update({
        metadata: {
          ...entity.metadata,
          last_transform_date: new Date().toISOString(),
          last_transform_duration_ms: duration,
          last_transform_rows: rowsInserted
        }
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      entity: entity.name,
      rowsInserted: rowsInserted,
      duration_ms: duration,
      dependencies: dependencyStatus,
      sql: transformSQL
    });
  } catch (error) {
    console.error('Error running transformation:', error);
    return NextResponse.json(
      {
        error: 'Failed to run transformation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check transformation readiness
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch entity and fields
    const { data: entity } = await supabase
      .from('entities')
      .select('*')
      .eq('id', id)
      .single();

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const { data: fields } = await supabase
      .from('entity_fields')
      .select('*')
      .eq('entity_id', id);

    if (!fields) {
      return NextResponse.json({ error: 'No fields found' }, { status: 404 });
    }

    // Check dependencies
    const sourceDependencies = getSourceDependencies(fields as unknown as EntityField[]);
    const dependencyStatus = [];

    for (const sourceEntity of sourceDependencies) {
      try {
        const countResult = await querySQL<{ count: string }>(
          `SELECT COUNT(*) as count FROM "${sourceEntity}"`
        );
        const count = parseInt(countResult[0].count);

        dependencyStatus.push({
          entity: sourceEntity,
          hasData: count > 0,
          rowCount: count
        });
      } catch {
        dependencyStatus.push({
          entity: sourceEntity,
          hasData: false,
          rowCount: 0,
          error: 'Table does not exist'
        });
      }
    }

    const ready = dependencyStatus.every(d => d.hasData);

    return NextResponse.json({
      ready,
      dependencies: dependencyStatus,
      entity_type: entity.entity_type
    });
  } catch (error) {
    console.error('Error checking transformation readiness:', error);
    return NextResponse.json(
      {
        error: 'Failed to check readiness',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
