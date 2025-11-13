'use client';

/**
 * Visual Entity Designer
 *
 * A visual interface for designing entity schemas with:
 * - Drag-drop field creation from palette
 * - Import fields from templates
 * - Field properties configuration
 * - SQL preview generation
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Eye, EyeOff, Database, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { FieldPalette } from './field-palette';
import { TemplateFieldImporter } from './template-field-importer';
import { EntityCanvas } from './entity-canvas';
import { FieldPropertiesPanel } from './field-properties-panel';
import { SqlPreview } from './sql-preview';
import type { EntityType } from './entity-type-selector';

export interface EntityField {
  id: string; // Temporary ID for UI (uuid for new, db id for existing)
  name: string;
  display_name: string;
  description: string;
  data_type: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'JSON' | 'UUID';
  is_required: boolean;
  is_unique: boolean;
  is_primary_key: boolean;
  foreign_key_entity_id?: string;
  foreign_key_field_id?: string;
  default_value?: string;
  validation_rules?: Record<string, any>;
  sort_order: number;
  metadata?: Record<string, any>; // Stores field-specific metadata
}

interface Entity {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  entity_type: EntityType;
  status: string;
  template_id: string | null;
  table_status?: string;
  table_created_at?: string | null;
  graphql_operations?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

interface VisualDesignerProps {
  entityId: string;
}

export function VisualDesigner({ entityId }: VisualDesignerProps) {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [fields, setFields] = useState<EntityField[]>([]);
  const [selectedField, setSelectedField] = useState<EntityField | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [creatingTable, setCreatingTable] = useState(false);

  useEffect(() => {
    loadEntity();
    loadFields();
  }, [entityId]);

  const loadEntity = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('id', entityId)
        .single();

      if (error) throw error;
      setEntity(data);
    } catch (error) {
      console.error('Error loading entity:', error);
      toast.error('Failed to load entity');
    }
  };

  const loadFields = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('entity_fields')
        .select('*')
        .eq('entity_id', entityId)
        .order('sort_order');

      if (error) throw error;

      // Convert to EntityField format
      const entityFields: EntityField[] = (data || []).map(f => ({
        id: f.id,
        name: f.name,
        display_name: f.display_name,
        description: f.description || '',
        data_type: f.data_type,
        is_required: f.is_required,
        is_unique: f.is_unique,
        is_primary_key: f.is_primary_key,
        foreign_key_entity_id: f.foreign_key_entity_id,
        foreign_key_field_id: f.foreign_key_field_id,
        default_value: f.default_value,
        validation_rules: f.validation_rules,
        transform_expression: f.transform_expression,
        sort_order: f.sort_order,
      }));

      setFields(entityFields);
    } catch (error) {
      console.error('Error loading fields:', error);
      toast.error('Failed to load fields');
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = (field: Omit<EntityField, 'id' | 'sort_order'>) => {
    const newField: EntityField = {
      ...field,
      id: `temp-${Date.now()}-${Math.random()}`,
      sort_order: fields.length,
    };
    setFields([...fields, newField]);
    setSelectedField(newField);
  };

  const handleUpdateField = (fieldId: string, updates: Partial<EntityField>) => {
    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, ...updates } : f
    ));
    if (selectedField?.id === fieldId) {
      setSelectedField({ ...selectedField, ...updates });
    }
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  };

  const handleReorderFields = (reorderedFields: EntityField[]) => {
    setFields(reorderedFields.map((f, idx) => ({ ...f, sort_order: idx })));
  };

  const handleImportTemplateFields = (templateFields: Omit<EntityField, 'id' | 'sort_order'>[]) => {
    const newFields = templateFields.map((field, idx) => ({
      ...field,
      id: `temp-${Date.now()}-${idx}`,
      sort_order: fields.length + idx,
    }));
    setFields([...fields, ...newFields]);
    toast.success(`Imported ${newFields.length} fields from template`);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Delete all existing fields for this entity
      const { error: deleteError } = await supabase
        .from('entity_fields')
        .delete()
        .eq('entity_id', entityId);

      if (deleteError) throw deleteError;

      // Insert all fields (both new and existing)
      const fieldsToInsert = fields.map(f => ({
        entity_id: entityId,
        name: f.name,
        display_name: f.display_name,
        description: f.description || null,
        data_type: f.data_type,
        is_required: f.is_required,
        is_unique: f.is_unique,
        is_primary_key: f.is_primary_key,
        foreign_key_entity_id: f.foreign_key_entity_id || null,
        foreign_key_field_id: f.foreign_key_field_id || null,
        default_value: f.default_value || null,
        validation_rules: f.validation_rules || null,
        sort_order: f.sort_order,
        metadata: f.metadata || null,
      }));

      console.log('Fields to insert:', fieldsToInsert);

      const { error: insertError } = await supabase
        .from('entity_fields')
        .insert(fieldsToInsert);

      if (insertError) {
        console.error('Insert error details:', insertError);
        throw insertError;
      }

      toast.success('Entity fields saved successfully!');
      loadFields(); // Reload to get proper IDs
    } catch (error) {
      console.error('Error saving fields:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save fields');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTable = async () => {
    if (!entity) return;

    // Confirmation dialog
    const confirmed = confirm(
      `Create table '${entity.name}' in the database?\n\n` +
      `This will create a physical table with ${fields.length} columns. ` +
      `Make sure you've saved your field definitions first.`
    );

    if (!confirmed) return;

    try {
      setCreatingTable(true);

      const response = await fetch(`/api/entities/${entityId}/create-table`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Failed to create table');
      }

      toast.success(`Table '${entity.name}' created successfully!`);

      // Reload entity to get updated table_status
      loadEntity();
    } catch (error) {
      console.error('Error creating table:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create table');
    } finally {
      setCreatingTable(false);
    }
  };

  if (!entity) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const borderColor =
    entity.entity_type === 'INTERIM' ? 'border-yellow-300' :
    entity.entity_type === 'REFERENCE' ? 'border-blue-300' :
    'border-green-300';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">{entity.display_name}</h2>
            {entity.table_status === 'created' && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                <CheckCircle className="w-3 h-3 mr-1" />
                Table Created
              </Badge>
            )}
            {entity.table_status === 'failed' && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                <AlertCircle className="w-3 h-3 mr-1" />
                Creation Failed
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Design the structure of your entity by adding fields
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSqlPreview(!showSqlPreview)}
          >
            {showSqlPreview ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide SQL
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Show SQL
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={saving || fields.length === 0}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Fields
              </>
            )}
          </Button>
          <Button
            onClick={handleCreateTable}
            disabled={creatingTable || fields.length === 0 || entity.table_status === 'created'}
            className="bg-green-600 hover:bg-green-700"
          >
            {creatingTable ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : entity.table_status === 'created' ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Table Created
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Create Table
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Designer Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Panel: Field Sources */}
        <div className="col-span-3 space-y-4">
          <FieldPalette onAddField={handleAddField} />
          <TemplateFieldImporter
            entityType={entity.entity_type}
            linkedTemplateId={entity.template_id}
            onImportFields={handleImportTemplateFields}
          />
        </div>

        {/* Center: Entity Canvas */}
        <div className="col-span-6">
          <Card className={`border-2 ${borderColor}`}>
            <EntityCanvas
              entity={entity}
              fields={fields}
              selectedFieldId={selectedField?.id}
              onSelectField={(field) => setSelectedField(field)}
              onDeleteField={handleDeleteField}
              onReorderFields={handleReorderFields}
              loading={loading}
            />
          </Card>
        </div>

        {/* Right Panel: Field Properties */}
        <div className="col-span-3">
          <FieldPropertiesPanel
            field={selectedField}
            entityType={entity.entity_type}
            onUpdateField={handleUpdateField}
          />
        </div>
      </div>

      {/* SQL Preview */}
      {showSqlPreview && (
        <SqlPreview
          entity={entity}
          fields={fields}
        />
      )}
    </div>
  );
}
