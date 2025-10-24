import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Database, Key } from 'lucide-react';
import type { Entity } from '@/types/database';

function EntityNode({ data }: NodeProps<{ entity: Entity }>) {
  const { entity } = data;

  function getEntityTypeColor(type: string) {
    switch (type) {
      case 'interim':
        return 'border-yellow-400 bg-yellow-50';
      case 'reference':
        return 'border-blue-400 bg-blue-50';
      case 'master':
        return 'border-green-400 bg-green-50';
      default:
        return 'border-gray-400 bg-gray-50';
    }
  }

  function getEntityTypeBadgeColor(type: string) {
    switch (type) {
      case 'interim':
        return 'bg-yellow-100 text-yellow-800';
      case 'reference':
        return 'bg-blue-100 text-blue-800';
      case 'master':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg border-2 ${getEntityTypeColor(
        entity.entity_type
      )} min-w-[200px]`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="flex items-start gap-2 mb-2">
        <Database className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 text-sm truncate">
            {entity.name}
          </div>
          <span
            className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getEntityTypeBadgeColor(
              entity.entity_type
            )}`}
          >
            {entity.entity_type.toUpperCase()}
          </span>
        </div>
      </div>

      {entity.description && (
        <p className="text-xs text-gray-600 mt-2 line-clamp-2">
          {entity.description}
        </p>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

export default memo(EntityNode);
