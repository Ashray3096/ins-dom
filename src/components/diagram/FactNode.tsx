import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BarChart3 } from 'lucide-react';
import type { Fact } from '@/types/database';

function FactNode({ data }: NodeProps<{ fact: Fact }>) {
  const { fact } = data;

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-green-400 bg-green-50 min-w-[180px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-green-500" />

      <div className="flex items-start gap-2">
        <BarChart3 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-xs truncate">
            {fact.name}
          </div>
          <div className="text-xs text-green-600 mt-0.5">Fact Table</div>
          {fact.grain && (
            <div className="text-xs text-gray-600 mt-1 line-clamp-1">
              {fact.grain}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            {Object.keys(fact.measures).length} measures
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-green-500"
      />
    </div>
  );
}

export default memo(FactNode);
