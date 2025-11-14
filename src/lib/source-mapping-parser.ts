/**
 * Source Mapping Parser
 *
 * Parses AI-generated source field mappings like "raw_html.brand_name"
 * into structured data for SQL generation and FK creation.
 */

export interface ParsedSource {
  sourceEntity: string;      // e.g., "raw_html"
  sourceField: string;       // e.g., "brand_name"
  isFK: boolean;             // true if source is a REFERENCE/MASTER entity
  fullPath: string;          // original "raw_html.brand_name"
}

export interface AIFieldSuggestion {
  name: string;
  type: string;
  source?: string;
  join_on?: string;  // For FK fields - which natural key to join on
}

/**
 * Parse a source mapping string like "raw_html.brand_name"
 */
export function parseSourceMapping(source: string | undefined): ParsedSource | null {
  if (!source) return null;

  const parts = source.split('.');
  if (parts.length !== 2) {
    console.warn(`Invalid source mapping format: ${source}. Expected "table.field"`);
    return null;
  }

  const [sourceEntity, sourceField] = parts;

  // Determine if this is a FK reference (from REFERENCE/MASTER entity)
  // vs a direct field mapping (from INTERIM entity)
  const isFK = sourceEntity.startsWith('dim_') ||
               sourceEntity.startsWith('fact_') ||
               sourceEntity.includes('_ref');

  return {
    sourceEntity: sourceEntity.trim(),
    sourceField: sourceField.trim(),
    isFK,
    fullPath: source
  };
}

/**
 * Get unique source entities from a list of field suggestions
 */
export function getUniqueSourceEntities(fields: AIFieldSuggestion[]): string[] {
  const entities = new Set<string>();

  for (const field of fields) {
    const parsed = parseSourceMapping(field.source);
    if (parsed) {
      entities.add(parsed.sourceEntity);
    }
  }

  return Array.from(entities);
}

/**
 * Map AI data types to PostgreSQL types
 */
export function mapAITypeToDBType(aiType: string): string {
  const typeMap: Record<string, string> = {
    'TEXT': 'TEXT',
    'STRING': 'TEXT',
    'NUMBER': 'NUMBER',
    'NUMERIC': 'NUMBER',
    'INTEGER': 'NUMBER',
    'INT': 'NUMBER',
    'FLOAT': 'NUMBER',
    'DECIMAL': 'NUMBER',
    'BOOLEAN': 'BOOLEAN',
    'BOOL': 'BOOLEAN',
    'DATE': 'DATE',
    'DATETIME': 'DATE',
    'TIMESTAMP': 'DATE',
    'TIMESTAMPTZ': 'DATE',
    'TIME': 'DATE',
    'UUID': 'UUID',
    'JSON': 'JSON',
    'JSONB': 'JSON'
  };

  return typeMap[aiType.toUpperCase()] || 'TEXT';
}

/**
 * Infer the natural key field name from a FK field name
 * E.g., "brand_id" -> "brand_name"
 */
export function inferNaturalKeyField(fkFieldName: string): string {
  // Remove _id suffix and add _name
  const baseName = fkFieldName.replace(/_id$/i, '');
  return `${baseName}_name`;
}

/**
 * Determine relationship type based on entity types
 * Note: Database only supports ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY
 */
export function determineRelationshipType(
  fromEntityType: 'INTERIM' | 'REFERENCE' | 'MASTER',
  toEntityType: 'INTERIM' | 'REFERENCE' | 'MASTER'
): 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_MANY' {
  // For star schema, most relationships are ONE_TO_MANY
  // INTERIM -> REFERENCE: one source to many dimensions
  // REFERENCE -> MASTER: one dimension to many facts

  return 'ONE_TO_MANY';
}

/**
 * Extract join condition information from field suggestion
 */
export interface JoinCondition {
  fkField: string;           // The FK field in the fact table (e.g., "brand_id")
  dimEntity: string;         // The dimension entity (e.g., "dim_brand")
  dimField: string;          // The field in dimension (e.g., "brand_id")
  naturalKey: string;        // The natural key to join on (e.g., "brand_name")
}

export function extractJoinCondition(
  field: AIFieldSuggestion,
  sourceEntityName: string
): JoinCondition | null {
  const parsed = parseSourceMapping(field.source);
  if (!parsed || !parsed.isFK) return null;

  return {
    fkField: field.name,
    dimEntity: parsed.sourceEntity,
    dimField: parsed.sourceField,
    naturalKey: field.join_on || inferNaturalKeyField(field.name)
  };
}
