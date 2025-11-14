'use client';

/**
 * Entity Type Selector Component
 *
 * Visual selector for choosing entity type (INTERIM, REFERENCE, MASTER)
 * Displays cards with descriptions, examples, and requirements for each type
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Database, FileText, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export type EntityType = 'INTERIM' | 'REFERENCE' | 'MASTER';

interface EntityTypeOption {
  type: EntityType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeColor: string;
  examples: string[];
  requirements: string[];
}

const ENTITY_TYPES: EntityTypeOption[] = [
  {
    type: 'INTERIM',
    label: 'Interim Entity',
    description: 'Raw extracted data, 1:1 with source documents. First layer of the data pipeline.',
    icon: FileText,
    color: 'border-yellow-300 bg-yellow-50 hover:bg-yellow-100',
    badgeColor: 'bg-yellow-200 text-yellow-900 hover:bg-yellow-200',
    examples: [
      'raw_ttb_monthly_report',
      'raw_nabca_quarterly_data',
      'raw_supplier_invoice',
    ],
    requirements: [
      'Matches extraction template fields',
      'Includes extraction_date timestamp',
      'Links to source artifact',
      'Minimal transformation',
    ],
  },
  {
    type: 'REFERENCE',
    label: 'Reference Entity',
    description: 'Lookup/dimension tables with deduplicated, standardized data.',
    icon: Database,
    color: 'border-blue-300 bg-blue-50 hover:bg-blue-100',
    badgeColor: 'bg-blue-200 text-blue-900 hover:bg-blue-200',
    examples: [
      'dim_product',
      'dim_supplier',
      'dim_location',
    ],
    requirements: [
      'Unique constraints on natural keys',
      'Slow-changing dimension support',
      'Standardized field names',
      'Business-friendly values',
    ],
  },
  {
    type: 'MASTER',
    label: 'Master Entity',
    description: 'Core business fact tables with foreign keys and aggregations.',
    icon: Layers,
    color: 'border-green-300 bg-green-50 hover:bg-green-100',
    badgeColor: 'bg-green-200 text-green-900 hover:bg-green-200',
    examples: [
      'fact_sales',
      'fact_inventory',
      'fact_orders',
    ],
    requirements: [
      'Foreign keys to REFERENCE entities',
      'Business validation rules',
      'Calculated/aggregated fields',
      'Optimized for analytics',
    ],
  },
];

interface EntityTypeSelectorProps {
  selectedType: EntityType | null;
  onSelectType: (type: EntityType) => void;
  disabled?: boolean;
}

export function EntityTypeSelector({
  selectedType,
  onSelectType,
  disabled = false,
}: EntityTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">
          Entity Type <span className="text-red-500">*</span>
        </h3>
        <p className="text-sm text-gray-600">
          Choose the type of entity based on its role in your data pipeline
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ENTITY_TYPES.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;

          return (
            <Card
              key={option.type}
              className={cn(
                'relative cursor-pointer transition-all border-2',
                option.color,
                isSelected && 'ring-2 ring-offset-2 ring-gray-900',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !disabled && onSelectType(option.type)}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1">
                  <Check className="w-4 h-4" />
                </div>
              )}

              <div className="p-6">
                <div className="flex flex-col items-center text-center space-y-3">
                  {/* Icon */}
                  <div className={cn('p-4 rounded-lg', option.badgeColor)}>
                    <Icon className="w-8 h-8" />
                  </div>

                  {/* Type Name & Description */}
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 mb-2">{option.type}</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{option.description}</p>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Get badge color class for entity type
 */
export function getEntityTypeBadgeColor(type: EntityType): string {
  switch (type) {
    case 'INTERIM':
      return 'bg-yellow-200 text-yellow-900 hover:bg-yellow-200';
    case 'REFERENCE':
      return 'bg-blue-200 text-blue-900 hover:bg-blue-200';
    case 'MASTER':
      return 'bg-green-200 text-green-900 hover:bg-green-200';
  }
}

/**
 * Get entity type display name
 */
export function getEntityTypeLabel(type: EntityType): string {
  switch (type) {
    case 'INTERIM':
      return 'Interim Entity';
    case 'REFERENCE':
      return 'Reference Entity';
    case 'MASTER':
      return 'Master Entity';
  }
}
