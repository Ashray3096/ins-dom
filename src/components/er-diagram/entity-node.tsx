'use client';

/**
 * Entity Node Component
 *
 * Custom node for React Flow representing an entity in the ER diagram
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Badge } from '@/components/ui/badge';
import { FileText, Database, Layers } from 'lucide-react';

interface EntityNodeData {
  entity: {
    id: string;
    name: string;
    display_name: string;
    entity_type: 'INTERIM' | 'REFERENCE' | 'MASTER';
    description: string | null;
  };
  fields: Array<{
    id: string;
    name: string;
    display_name: string;
    data_type: string;
    is_primary_key: boolean;
    is_required: boolean;
    is_unique: boolean;
  }>;
}

const ENTITY_TYPE_STYLES = {
  INTERIM: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    headerBg: 'bg-yellow-200',
    icon: FileText,
    iconColor: 'text-yellow-700',
  },
  REFERENCE: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    headerBg: 'bg-blue-200',
    icon: Database,
    iconColor: 'text-blue-700',
  },
  MASTER: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    headerBg: 'bg-green-200',
    icon: Layers,
    iconColor: 'text-green-700',
  },
};

export const EntityNode = memo(({ data }: NodeProps<EntityNodeData>) => {
  const { entity, fields } = data;
  const style = ENTITY_TYPE_STYLES[entity.entity_type];
  const Icon = style.icon;

  return (
    <div className={`rounded-lg border-2 ${style.border} ${style.bg} shadow-lg min-w-[250px]`}>
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500 hover:!bg-blue-600 !border-2 !border-white"
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500 hover:!bg-blue-600 !border-2 !border-white"
        isConnectable={true}
      />

      {/* Entity Header */}
      <div className={`${style.headerBg} px-4 py-3 rounded-t-md border-b-2 ${style.border}`}>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${style.iconColor}`} />
          <h3 className="font-semibold text-gray-900 text-sm">
            {entity.display_name}
          </h3>
        </div>
        <code className="text-xs text-gray-700 font-mono">
          {entity.name}
        </code>
      </div>

      {/* Entity Fields */}
      <div className="p-2">
        {fields.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-2">
            No fields defined
          </div>
        ) : (
          <div className="space-y-1">
            {fields.slice(0, 8).map((field) => (
              <div
                key={field.id}
                className="flex items-center gap-2 text-xs px-2 py-1 hover:bg-white/60 rounded"
              >
                {field.is_primary_key && (
                  <span className="text-yellow-600">🔑</span>
                )}
                <span className="font-mono text-gray-700 flex-1 truncate">
                  {field.name}
                </span>
                <span className="text-gray-500 text-[10px]">
                  {field.data_type}
                </span>
              </div>
            ))}
            {fields.length > 8 && (
              <div className="text-xs text-gray-500 text-center pt-1">
                +{fields.length - 8} more fields
              </div>
            )}
          </div>
        )}
      </div>

      {/* Entity Type Badge */}
      <div className="px-3 pb-2">
        <Badge
          variant="secondary"
          className={`text-xs ${
            entity.entity_type === 'INTERIM' ? 'bg-yellow-200 text-yellow-900' :
            entity.entity_type === 'REFERENCE' ? 'bg-blue-200 text-blue-900' :
            'bg-green-200 text-green-900'
          }`}
        >
          {entity.entity_type}
        </Badge>
      </div>
    </div>
  );
});

EntityNode.displayName = 'EntityNode';
