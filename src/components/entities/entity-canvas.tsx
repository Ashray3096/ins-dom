'use client';

/**
 * Entity Canvas Component
 *
 * Center canvas showing entity fields with drag-to-reorder functionality
 */

import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  FileJson,
  Key as KeyIcon,
  Trash2,
  GripVertical,
  Link as LinkIcon,
  Loader2,
} from 'lucide-react';
import { getEntityTypeBadgeColor } from './entity-type-selector';
import type { EntityField } from './visual-designer';
import type { EntityType } from './entity-type-selector';

interface Entity {
  id: string;
  name: string;
  display_name: string;
  entity_type: EntityType;
}

interface EntityCanvasProps {
  entity: Entity;
  fields: EntityField[];
  selectedFieldId?: string;
  onSelectField: (field: EntityField) => void;
  onDeleteField: (fieldId: string) => void;
  onReorderFields: (reorderedFields: EntityField[]) => void;
  loading: boolean;
}

const FIELD_TYPE_ICONS = {
  TEXT: Type,
  NUMBER: Hash,
  DATE: Calendar,
  BOOLEAN: ToggleLeft,
  JSON: FileJson,
  UUID: KeyIcon,
};

export function EntityCanvas({
  entity,
  fields,
  selectedFieldId,
  onSelectField,
  onDeleteField,
  onReorderFields,
  loading,
}: EntityCanvasProps) {
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));

    if (dragIndex === dropIndex) return;

    const newFields = [...fields];
    const [draggedField] = newFields.splice(dragIndex, 1);
    newFields.splice(dropIndex, 0, draggedField);

    onReorderFields(newFields);
  };

  if (loading) {
    return (
      <>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{entity.display_name}</CardTitle>
              <Badge variant="secondary" className={`mt-2 ${getEntityTypeBadgeColor(entity.entity_type)}`}>
                {entity.entity_type}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </>
    );
  }

  if (fields.length === 0) {
    return (
      <>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{entity.display_name}</CardTitle>
              <Badge variant="secondary" className={`mt-2 ${getEntityTypeBadgeColor(entity.entity_type)}`}>
                {entity.entity_type}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Type className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              No fields yet
            </h3>
            <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
              Add fields from the palette on the left or import them from a template
            </p>
          </div>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{entity.display_name}</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className={getEntityTypeBadgeColor(entity.entity_type)}>
                {entity.entity_type}
              </Badge>
              <span className="text-xs text-gray-500">
                {fields.length} field{fields.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {fields.map((field, index) => {
            const Icon = FIELD_TYPE_ICONS[field.data_type];
            const isSelected = field.id === selectedFieldId;

            return (
              <div
                key={field.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => onSelectField(field)}
                className={`
                  group flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all
                  ${isSelected
                    ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                {/* Drag Handle */}
                <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                </div>

                {/* Field Icon */}
                <div className={`
                  p-2 rounded
                  ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}
                `}>
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                </div>

                {/* Field Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {field.display_name}
                    </span>

                    {/* Key Indicators */}
                    {field.is_primary_key && (
                      <Badge variant="secondary" className="text-xs h-4 px-1 bg-yellow-100 text-yellow-800">
                        🔑 PK
                      </Badge>
                    )}
                    {field.foreign_key_entity_id && (
                      <Badge variant="secondary" className="text-xs h-4 px-1 bg-purple-100 text-purple-800">
                        🔗 FK
                      </Badge>
                    )}
                    {field.is_unique && (
                      <Badge variant="secondary" className="text-xs h-4 px-1">
                        UQ
                      </Badge>
                    )}
                    {field.is_required && (
                      <Badge variant="secondary" className="text-xs h-4 px-1">
                        *
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-gray-500 font-mono">
                      {field.name}
                    </code>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">
                      {field.data_type}
                    </span>
                    {field.template_id && (
                      <>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" />
                          from template
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteField(field.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </>
  );
}
