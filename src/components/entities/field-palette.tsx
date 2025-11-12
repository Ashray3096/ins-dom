'use client';

/**
 * Field Palette Component
 *
 * Displays basic field types that can be added to an entity
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  FileJson,
  Key,
  Plus,
} from 'lucide-react';
import type { EntityField } from './visual-designer';

interface FieldType {
  type: EntityField['data_type'];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  defaultName: string;
}

const FIELD_TYPES: FieldType[] = [
  {
    type: 'TEXT',
    label: 'Text',
    icon: Type,
    description: 'String, varchar, text',
    defaultName: 'text_field',
  },
  {
    type: 'NUMBER',
    label: 'Number',
    icon: Hash,
    description: 'Integer, decimal, float',
    defaultName: 'number_field',
  },
  {
    type: 'DATE',
    label: 'Date',
    icon: Calendar,
    description: 'Date, datetime, timestamp',
    defaultName: 'date_field',
  },
  {
    type: 'BOOLEAN',
    label: 'Boolean',
    icon: ToggleLeft,
    description: 'True/false, yes/no',
    defaultName: 'boolean_field',
  },
  {
    type: 'JSON',
    label: 'JSON',
    icon: FileJson,
    description: 'JSON object or array',
    defaultName: 'json_field',
  },
  {
    type: 'UUID',
    label: 'UUID',
    icon: Key,
    description: 'Unique identifier',
    defaultName: 'uuid_field',
  },
];

interface FieldPaletteProps {
  onAddField: (field: Omit<EntityField, 'id' | 'sort_order'>) => void;
}

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  const handleAddFieldType = (fieldType: FieldType) => {
    const field: Omit<EntityField, 'id' | 'sort_order'> = {
      name: fieldType.defaultName,
      display_name: fieldType.label + ' Field',
      description: '',
      data_type: fieldType.type,
      is_required: false,
      is_unique: false,
      is_primary_key: false,
    };
    onAddField(field);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Field Types</CardTitle>
        <CardDescription className="text-xs">
          Click to add a field to your entity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {FIELD_TYPES.map((fieldType) => {
          const Icon = fieldType.icon;
          return (
            <Button
              key={fieldType.type}
              variant="outline"
              className="w-full justify-start h-auto py-3 px-3"
              onClick={() => handleAddFieldType(fieldType)}
            >
              <div className="flex items-start gap-3 w-full">
                <div className="bg-gray-100 p-2 rounded">
                  <Icon className="w-4 h-4 text-gray-700" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">{fieldType.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {fieldType.description}
                  </div>
                </div>
                <Plus className="w-4 h-4 text-gray-400" />
              </div>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
