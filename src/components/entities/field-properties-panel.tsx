'use client';

/**
 * Field Properties Panel Component
 *
 * Right panel for editing field properties
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { EntityField } from './visual-designer';
import type { EntityType } from './entity-type-selector';

interface FieldPropertiesPanelProps {
  field: EntityField | null;
  entityType: EntityType;
  onUpdateField: (fieldId: string, updates: Partial<EntityField>) => void;
}

export function FieldPropertiesPanel({
  field,
  entityType,
  onUpdateField,
}: FieldPropertiesPanelProps) {
  if (!field) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Field Properties</CardTitle>
          <CardDescription className="text-xs">
            Select a field to edit its properties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Settings className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-xs text-gray-500">
              No field selected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleUpdate = (updates: Partial<EntityField>) => {
    onUpdateField(field.id, updates);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Field Properties</CardTitle>
        <CardDescription className="text-xs">
          Configure field settings and constraints
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="display_name" className="text-xs">
            Display Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="display_name"
            value={field.display_name}
            onChange={(e) => handleUpdate({ display_name: e.target.value })}
            className="h-8 text-sm"
            placeholder="e.g., Brand Name"
          />
        </div>

        {/* Field Name (database column) */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs">
            Field Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={field.name}
            onChange={(e) => handleUpdate({
              name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')
            })}
            className="h-8 text-sm font-mono"
            placeholder="e.g., brand_name"
          />
          <p className="text-xs text-gray-500">
            Database column name (lowercase, underscores only)
          </p>
        </div>

        {/* Data Type */}
        <div className="space-y-2">
          <Label htmlFor="data_type" className="text-xs">
            Data Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={field.data_type}
            onValueChange={(value) => handleUpdate({ data_type: value as EntityField['data_type'] })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEXT">TEXT</SelectItem>
              <SelectItem value="NUMBER">NUMBER</SelectItem>
              <SelectItem value="DATE">DATE</SelectItem>
              <SelectItem value="BOOLEAN">BOOLEAN</SelectItem>
              <SelectItem value="JSON">JSON</SelectItem>
              <SelectItem value="UUID">UUID</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-xs">
            Description
          </Label>
          <Textarea
            id="description"
            value={field.description}
            onChange={(e) => handleUpdate({ description: e.target.value })}
            className="text-sm min-h-[60px]"
            placeholder="Describe this field..."
          />
        </div>

        {/* Constraints */}
        <div className="space-y-3 pt-2 border-t">
          <Label className="text-xs font-semibold">Constraints</Label>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_required"
              checked={field.is_required}
              onCheckedChange={(checked) => handleUpdate({ is_required: !!checked })}
            />
            <Label htmlFor="is_required" className="text-xs font-normal cursor-pointer">
              Required (NOT NULL)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_unique"
              checked={field.is_unique}
              onCheckedChange={(checked) => handleUpdate({ is_unique: !!checked })}
            />
            <Label htmlFor="is_unique" className="text-xs font-normal cursor-pointer">
              Unique (UNIQUE constraint)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_primary_key"
              checked={field.is_primary_key}
              onCheckedChange={(checked) => handleUpdate({
                is_primary_key: !!checked,
                is_required: !!checked, // PK implies NOT NULL
                is_unique: !!checked,   // PK implies UNIQUE
              })}
            />
            <Label htmlFor="is_primary_key" className="text-xs font-normal cursor-pointer">
              Primary Key 🔑
            </Label>
          </div>
        </div>

        {/* Default Value */}
        <div className="space-y-2 pt-2 border-t">
          <Label htmlFor="default_value" className="text-xs">
            Default Value
          </Label>
          <Input
            id="default_value"
            value={field.default_value || ''}
            onChange={(e) => handleUpdate({ default_value: e.target.value })}
            className="h-8 text-sm font-mono"
            placeholder="e.g., NULL, NOW(), 0"
          />
        </div>

        {/* Transformation Expression */}
        {field.template_id && (
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="transform_expression" className="text-xs">
              Transformation (Optional)
            </Label>
            <Textarea
              id="transform_expression"
              value={field.transform_expression || ''}
              onChange={(e) => handleUpdate({ transform_expression: e.target.value })}
              className="text-sm font-mono min-h-[60px]"
              placeholder="e.g., UPPER(value), TRIM(value)"
            />
            <p className="text-xs text-gray-500">
              SQL expression to transform the template value
            </p>
          </div>
        )}

        {/* Template Mapping Info */}
        {field.template_id && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-800">
              This field is mapped from a template:{' '}
              <code className="bg-blue-100 px-1 rounded">
                {field.template_field_path}
              </code>
            </AlertDescription>
          </Alert>
        )}

        {/* Foreign Key (for MASTER entities) */}
        {entityType === 'MASTER' && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs font-semibold">
              Foreign Key 🔗
            </Label>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Foreign key configuration will be available in the next update.
                For now, use the field name to indicate relationships (e.g., product_id).
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
