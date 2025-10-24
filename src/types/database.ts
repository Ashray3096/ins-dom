// Database types for Inspector Dom application

export type EntityType = 'interim' | 'reference' | 'master';
export type FileType = 'html' | 'pdf' | 'email';
export type RelationshipType = '1:1' | '1:N' | 'N:M';
export type DimensionType = 'time' | 'geography' | 'product' | 'customer' | 'other';
export type SCDType = 0 | 1 | 2 | 3;

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceFile {
  id: string;
  project_id: string;
  name: string;
  type: FileType;
  storage_path: string;
  size_bytes: number | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Template {
  id: string;
  source_file_id: string;
  name: string;
  selectors: Selector[];
  field_mappings: Record<string, FieldMapping>;
  created_at: string;
  updated_at: string;
}

export interface Selector {
  id: string;
  type: 'xpath' | 'css' | 'text' | 'region';
  value: string;
  label: string;
}

export interface FieldMapping {
  selector_id: string;
  field_name: string;
  data_type: string;
  transformation?: string;
}

export interface Entity {
  id: string;
  project_id: string;
  name: string;
  entity_type: EntityType;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface EntityField {
  id: string;
  entity_id: string;
  name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  default_value: string | null;
  constraints: Record<string, any>;
  created_at: string;
}

export interface Relationship {
  id: string;
  project_id: string;
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: RelationshipType;
  from_field_id: string | null;
  to_field_id: string | null;
  relationship_name: string | null;
  created_at: string;
}

export interface Dimension {
  id: string;
  project_id: string;
  entity_id: string | null;
  name: string;
  dimension_type: DimensionType | null;
  scd_type: SCDType | null;
  attributes: DimensionAttribute[];
  created_at: string;
  updated_at: string;
}

export interface DimensionAttribute {
  name: string;
  data_type: string;
  description?: string;
}

export interface Fact {
  id: string;
  project_id: string;
  entity_id: string | null;
  name: string;
  measures: Measure[];
  grain: string | null;
  created_at: string;
  updated_at: string;
}

export interface Measure {
  name: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct_count';
  data_type: string;
  description?: string;
}

export interface DiagramState {
  id: string;
  project_id: string;
  layout: DiagramLayout;
  created_at: string;
  updated_at: string;
}

export interface DiagramLayout {
  nodes: DiagramNode[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface DiagramNode {
  id: string;
  entity_id: string;
  position: {
    x: number;
    y: number;
  };
  type: 'entity' | 'dimension' | 'fact';
}

// Database response types with joins
export interface ProjectWithStats extends Project {
  source_files_count?: number;
  entities_count?: number;
}

export interface SourceFileWithTemplates extends SourceFile {
  templates?: Template[];
}

export interface EntityWithFields extends Entity {
  fields?: EntityField[];
}

export interface EntityWithRelationships extends Entity {
  fields?: EntityField[];
  outgoing_relationships?: Relationship[];
  incoming_relationships?: Relationship[];
}
