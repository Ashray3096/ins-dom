'use client';

/**
 * SQL Preview Component
 *
 * Generates and displays CREATE TABLE SQL for the entity
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { EntityField } from './visual-designer';
import type { EntityType } from './entity-type-selector';

interface Entity {
  id: string;
  name: string;
  display_name: string;
  entity_type: EntityType;
}

interface SqlPreviewProps {
  entity: Entity;
  fields: EntityField[];
}

export function SqlPreview({ entity, fields }: SqlPreviewProps) {
  const [copied, setCopied] = useState(false);

  const generateSql = (): string => {
    if (fields.length === 0) {
      return '-- Add fields to generate SQL';
    }

    const lines: string[] = [];

    // Table header with comment
    lines.push(`-- ${entity.display_name} (${entity.entity_type} Entity)`);
    lines.push(`CREATE TABLE ${entity.name} (`);

    // Fields
    const fieldDefinitions = fields.map((field, index) => {
      let def = `  ${field.name} ${mapDataTypeToSql(field.data_type)}`;

      // Constraints
      if (field.is_primary_key) {
        def += ' PRIMARY KEY';
      } else {
        if (field.is_required) {
          def += ' NOT NULL';
        }
        if (field.is_unique) {
          def += ' UNIQUE';
        }
      }

      // Default value
      if (field.default_value) {
        def += ` DEFAULT ${field.default_value}`;
      }

      return def;
    });

    lines.push(fieldDefinitions.join(',\n'));

    // Add metadata fields for INTERIM entities
    if (entity.entity_type === 'INTERIM') {
      lines.push(',');
      lines.push('');
      lines.push('  -- Metadata fields');
      lines.push('  extraction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),');
      lines.push('  source_artifact_id UUID,');
      lines.push('  template_id UUID,');
      lines.push('  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),');
      lines.push('  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    } else {
      lines.push(',');
      lines.push('');
      lines.push('  -- Audit fields');
      lines.push('  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),');
      lines.push('  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),');
      lines.push('  created_by UUID NOT NULL');
    }

    lines.push(');');

    // Indexes
    const uniqueFields = fields.filter(f => f.is_unique && !f.is_primary_key);
    const requiredFields = fields.filter(f => f.is_required && !f.is_primary_key && !f.is_unique);

    if (uniqueFields.length > 0 || requiredFields.length > 0) {
      lines.push('');
      lines.push('-- Indexes');
    }

    uniqueFields.forEach(field => {
      lines.push(`CREATE UNIQUE INDEX idx_${entity.name}_${field.name} ON ${entity.name}(${field.name});`);
    });

    requiredFields.forEach(field => {
      lines.push(`CREATE INDEX idx_${entity.name}_${field.name} ON ${entity.name}(${field.name});`);
    });

    // Comments
    lines.push('');
    lines.push('-- Field comments');
    fields.forEach(field => {
      if (field.description) {
        lines.push(`COMMENT ON COLUMN ${entity.name}.${field.name} IS '${field.description.replace(/'/g, "''")}';`);
      }
    });

    return lines.join('\n');
  };

  const mapDataTypeToSql = (dataType: EntityField['data_type']): string => {
    switch (dataType) {
      case 'TEXT':
        return 'TEXT';
      case 'NUMBER':
        return 'NUMERIC';
      case 'DATE':
        return 'TIMESTAMPTZ';
      case 'BOOLEAN':
        return 'BOOLEAN';
      case 'JSON':
        return 'JSONB';
      case 'UUID':
        return 'UUID';
      default:
        return 'TEXT';
    }
  };

  const handleCopy = async () => {
    const sql = generateSql();
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    toast.success('SQL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const sql = generateSql();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">SQL Preview</CardTitle>
            <CardDescription className="text-xs">
              Auto-generated CREATE TABLE statement
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={fields.length === 0}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="mr-2 h-3 w-3" />
                Copy SQL
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono">
          {sql}
        </pre>
      </CardContent>
    </Card>
  );
}
