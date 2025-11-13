/**
 * Transform SQL Generator
 *
 * Generates SQL transformation statements for loading data from INTERIM
 * entities into REFERENCE (dimension) and MASTER (fact) entities.
 */

import {
  parseSourceMapping,
  inferNaturalKeyField,
  type AIFieldSuggestion,
  type JoinCondition,
  extractJoinCondition
} from './source-mapping-parser';

export interface Entity {
  id: string;
  name: string;
  entity_type: 'INTERIM' | 'REFERENCE' | 'MASTER';
  metadata?: Record<string, any>;
}

export interface EntityField {
  id: string;
  entity_id: string;
  name: string;
  data_type: string;
  is_primary_key: boolean;
  foreign_key_entity_id?: string | null;
  foreign_key_field_id?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Generate SQL for REFERENCE entities (dimensions)
 * Uses SELECT DISTINCT to deduplicate source data
 */
export function generateDimensionSQL(
  entity: Entity,
  fields: EntityField[]
): string {
  // Separate ID field (PK) from data fields
  const pkField = fields.find(f => f.is_primary_key);
  const dataFields = fields.filter(f => !f.is_primary_key && f.metadata?.source);

  if (dataFields.length === 0) {
    throw new Error(`No source fields found for dimension ${entity.name}`);
  }

  // Get the source entity (should be same for all fields in a dimension)
  const firstParsed = parseSourceMapping(dataFields[0].metadata?.source);
  if (!firstParsed) {
    throw new Error(`Invalid source mapping for ${entity.name}`);
  }

  const sourceEntity = firstParsed.sourceEntity;

  // Build SELECT clause with source field mappings
  const selectFields: string[] = [];
  const insertFields: string[] = [];

  if (pkField) {
    selectFields.push(`gen_random_uuid() as "${pkField.name}"`);
    insertFields.push(`"${pkField.name}"`);
  }

  for (const field of dataFields) {
    const parsed = parseSourceMapping(field.metadata?.source);
    if (parsed) {
      selectFields.push(`"${parsed.sourceField}" as "${field.name}"`);
      insertFields.push(`"${field.name}"`);
    }
  }

  // Build GROUP BY clause (for DISTINCT behavior with all fields)
  const groupByFields = dataFields.map(f => {
    const parsed = parseSourceMapping(f.metadata?.source);
    return `"${parsed?.sourceField}"`;
  }).join(', ');

  // Get the primary data field for WHERE clause (first non-PK field)
  const primaryField = dataFields[0];
  const primaryParsed = parseSourceMapping(primaryField.metadata?.source);

  const sql = `
INSERT INTO "${entity.name}" (${insertFields.join(', ')})
SELECT ${selectFields.join(', ')}
FROM "${sourceEntity}"
WHERE "${primaryParsed?.sourceField}" IS NOT NULL
GROUP BY ${groupByFields};
`.trim();

  return sql;
}

/**
 * Generate SQL for MASTER entities (facts)
 * Uses JOINs to look up foreign keys from dimensions
 */
export function generateFactSQL(
  entity: Entity,
  fields: EntityField[],
  allEntities: Entity[]
): string {
  // Separate fields by type
  const pkField = fields.find(f => f.is_primary_key);
  const fkFields = fields.filter(f => f.foreign_key_entity_id);
  const dataFields = fields.filter(f => !f.is_primary_key && !f.foreign_key_entity_id && f.metadata?.source);

  // Determine the base/source table (usually INTERIM)
  let baseSourceEntity: string | null = null;
  for (const field of dataFields) {
    const parsed = parseSourceMapping(field.metadata?.source);
    if (parsed && !parsed.isFK) {
      baseSourceEntity = parsed.sourceEntity;
      break;
    }
  }

  if (!baseSourceEntity) {
    // Try FK fields
    for (const field of fkFields) {
      const parsed = parseSourceMapping(field.metadata?.source);
      if (parsed) {
        baseSourceEntity = parsed.sourceEntity;
        break;
      }
    }
  }

  if (!baseSourceEntity) {
    throw new Error(`Could not determine base source entity for fact ${entity.name}`);
  }

  // Build SELECT clause
  const selectFields: string[] = [];
  const insertFields: string[] = [];

  if (pkField) {
    selectFields.push(`gen_random_uuid() as "${pkField.name}"`);
    insertFields.push(`"${pkField.name}"`);
  }

  // Add FK fields (from JOINed dimensions)
  for (const fkField of fkFields) {
    const dimEntity = allEntities.find(e => e.id === fkField.foreign_key_entity_id);
    if (dimEntity) {
      const parsed = parseSourceMapping(fkField.metadata?.source);
      if (parsed && parsed.isFK) {
        // FK comes from dimension table - use the PK field from that dimension
        const alias = getTableAlias(dimEntity.name);
        // Use the entity's PK name pattern (e.g., dim_product_id, not product_id)
        const dimPKField = `${dimEntity.name}_id`;
        selectFields.push(`${alias}."${dimPKField}" as "${fkField.name}"`);
        insertFields.push(`"${fkField.name}"`);
      }
    }
  }

  // Add data fields (from base source table)
  for (const field of dataFields) {
    const parsed = parseSourceMapping(field.metadata?.source);
    if (parsed && !parsed.isFK) {
      selectFields.push(`base."${parsed.sourceField}" as "${field.name}"`);
      insertFields.push(`"${field.name}"`);
    }
  }

  // Build JOIN clauses
  const joins: string[] = [];

  for (const fkField of fkFields) {
    const dimEntity = allEntities.find(e => e.id === fkField.foreign_key_entity_id);
    if (!dimEntity) continue;

    const alias = getTableAlias(dimEntity.name);
    const naturalKeyRaw = fkField.metadata?.join_on || inferNaturalKeyField(fkField.name);

    // Handle multiple natural keys (e.g., "brand_name, product_type")
    const naturalKeys = naturalKeyRaw.split(',').map((k: string) => k.trim());

    // Build join condition for multiple fields
    const joinConditions = naturalKeys.map((nk: string) =>
      `base."${nk}" = ${alias}."${nk}"`
    ).join(' AND ');

    joins.push(
      `LEFT JOIN "${dimEntity.name}" ${alias} ON ${joinConditions}`
    );
  }

  // Build WHERE clause - ensure base data exists
  const whereConditions: string[] = [];
  if (dataFields.length > 0) {
    const firstDataField = dataFields[0];
    const parsed = parseSourceMapping(firstDataField.metadata?.source);
    if (parsed) {
      whereConditions.push(`base."${parsed.sourceField}" IS NOT NULL`);
    }
  }

  const sql = `
INSERT INTO "${entity.name}" (${insertFields.join(', ')})
SELECT ${selectFields.join(', ')}
FROM "${baseSourceEntity}" base
${joins.join('\n')}
${whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''};
`.trim();

  return sql;
}

/**
 * Get a short table alias for SQL
 */
function getTableAlias(tableName: string): string {
  // dim_brand -> db
  // dim_product -> dp
  // fact_sales -> fs
  const parts = tableName.split('_');
  if (parts.length >= 2) {
    return parts.map(p => p[0]).join('').toLowerCase();
  }
  return tableName.substring(0, 2).toLowerCase();
}

/**
 * Main entry point - generate transformation SQL based on entity type
 */
export function generateTransformSQL(
  entity: Entity,
  fields: EntityField[],
  allEntities: Entity[] = []
): string {
  if (entity.entity_type === 'INTERIM') {
    throw new Error('INTERIM entities use extraction pipeline, not transformation');
  }

  if (entity.entity_type === 'REFERENCE') {
    return generateDimensionSQL(entity, fields);
  }

  if (entity.entity_type === 'MASTER') {
    return generateFactSQL(entity, fields, allEntities);
  }

  throw new Error(`Unknown entity type: ${entity.entity_type}`);
}

/**
 * Get source dependencies for an entity
 */
export function getSourceDependencies(fields: EntityField[]): string[] {
  const deps = new Set<string>();

  for (const field of fields) {
    const parsed = parseSourceMapping(field.metadata?.source);
    if (parsed) {
      deps.add(parsed.sourceEntity);
    }
  }

  return Array.from(deps);
}

/**
 * Validate that an entity has all required information for transformation
 */
export function validateEntityForTransformation(
  entity: Entity,
  fields: EntityField[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (entity.entity_type === 'INTERIM') {
    errors.push('INTERIM entities cannot be transformed');
    return { valid: false, errors };
  }

  const sourceFields = fields.filter(f => f.metadata?.source);
  if (sourceFields.length === 0) {
    errors.push('No source field mappings found');
  }

  const pkFields = fields.filter(f => f.is_primary_key);
  if (pkFields.length === 0) {
    errors.push('No primary key field defined');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
