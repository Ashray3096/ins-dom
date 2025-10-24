import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Box } from 'lucide-react';
import type { Dimension } from '@/types/database';

function DimensionNode({ data }: NodeProps<{ dimension: Dimension }>) {
  const { dimension } = data;

  function getDimensionTypeColor(type: string) {
    switch (type) {
      case 'time':
        return 'border-purple-400 bg-purple-50';
      case 'geography':
        return 'border-green-400 bg-green-50';
      case 'product':
        return 'border-blue-400 bg-blue-50';
      case 'customer':
        return 'border-orange-400 bg-orange-50';
      default:
        return 'border-gray-400 bg-gray-50';
    }
  }

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg border-2 ${getDimensionTypeColor(
        dimension.dimension_type
      )} min-w-[180px]`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-purple-500" />

      <div className="flex items-start gap-2">
        <Box className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-xs truncate">
            {dimension.name}
          </div>
          <div className="text-xs text-purple-600 mt-0.5">
            {dimension.dimension_type}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            SCD Type {dimension.scd_type}
          </div>
          <div className="text-xs text-gray-500">
            {(dimension.attributes as string[]).length} attributes
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-purple-500"
      />
    </div>
  );
}

export default memo(DimensionNode);
