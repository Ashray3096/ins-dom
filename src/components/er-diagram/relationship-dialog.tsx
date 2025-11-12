'use client';

/**
 * Relationship Dialog Component
 *
 * Dialog for creating relationships between entities in the ER diagram
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Connection } from 'reactflow';

interface Entity {
  id: string;
  name: string;
  display_name: string;
  entity_type: 'INTERIM' | 'REFERENCE' | 'MASTER';
}

interface EntityField {
  id: string;
  name: string;
  display_name: string;
  data_type: string;
}

interface RelationshipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: Connection | null;
  entities: Entity[];
  onSave: (relationshipType: string, fromFieldId: string | null, description: string) => void;
  saving: boolean;
}

const RELATIONSHIP_TYPES = [
  {
    value: 'ONE_TO_ONE',
    label: 'One to One',
    description: 'Each record in the source relates to exactly one record in the target',
  },
  {
    value: 'ONE_TO_MANY',
    label: 'One to Many',
    description: 'Each record in the source can relate to multiple records in the target',
  },
  {
    value: 'MANY_TO_MANY',
    label: 'Many to Many',
    description: 'Multiple records in the source can relate to multiple records in the target',
  },
];

export function RelationshipDialog({
  open,
  onOpenChange,
  connection,
  entities,
  onSave,
  saving,
}: RelationshipDialogProps) {
  const [relationshipType, setRelationshipType] = useState('ONE_TO_MANY');
  const [fromFieldId, setFromFieldId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [sourceFields, setSourceFields] = useState<EntityField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  const sourceEntity = entities.find(e => e.id === connection?.source);
  const targetEntity = entities.find(e => e.id === connection?.target);

  useEffect(() => {
    if (open && connection?.source) {
      loadSourceFields(connection.source);
    } else {
      // Reset state when dialog closes
      setRelationshipType('ONE_TO_MANY');
      setFromFieldId(null);
      setDescription('');
      setSourceFields([]);
    }
  }, [open, connection?.source]);

  const loadSourceFields = async (entityId: string) => {
    try {
      setLoadingFields(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('entity_fields')
        .select('id, name, display_name, data_type')
        .eq('entity_id', entityId)
        .order('sort_order');

      if (error) throw error;
      setSourceFields(data || []);
    } catch (error) {
      console.error('Error loading source fields:', error);
    } finally {
      setLoadingFields(false);
    }
  };

  const handleSave = () => {
    onSave(relationshipType, fromFieldId, description);
  };

  if (!connection || !sourceEntity || !targetEntity) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Relationship</DialogTitle>
          <DialogDescription>
            Define the relationship between these entities
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entity Connection Preview */}
          <div className="flex items-center justify-center gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <Badge
                variant="secondary"
                className={
                  sourceEntity.entity_type === 'INTERIM'
                    ? 'bg-yellow-200 text-yellow-900'
                    : sourceEntity.entity_type === 'REFERENCE'
                    ? 'bg-blue-200 text-blue-900'
                    : 'bg-green-200 text-green-900'
                }
              >
                {sourceEntity.entity_type}
              </Badge>
              <p className="font-semibold text-sm mt-1">
                {sourceEntity.display_name}
              </p>
              <code className="text-xs text-gray-600">{sourceEntity.name}</code>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
            <div className="text-center">
              <Badge
                variant="secondary"
                className={
                  targetEntity.entity_type === 'INTERIM'
                    ? 'bg-yellow-200 text-yellow-900'
                    : targetEntity.entity_type === 'REFERENCE'
                    ? 'bg-blue-200 text-blue-900'
                    : 'bg-green-200 text-green-900'
                }
              >
                {targetEntity.entity_type}
              </Badge>
              <p className="font-semibold text-sm mt-1">
                {targetEntity.display_name}
              </p>
              <code className="text-xs text-gray-600">{targetEntity.name}</code>
            </div>
          </div>

          {/* Relationship Type */}
          <div className="space-y-2">
            <Label htmlFor="relationship-type">Relationship Type</Label>
            <Select value={relationshipType} onValueChange={setRelationshipType}>
              <SelectTrigger id="relationship-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{type.label}</span>
                      <span className="text-xs text-gray-500">
                        {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source Field (Foreign Key) */}
          <div className="space-y-2">
            <Label htmlFor="source-field">
              Foreign Key Field (Optional)
            </Label>
            {loadingFields ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : (
              <Select
                value={fromFieldId || 'none'}
                onValueChange={(value) =>
                  setFromFieldId(value === 'none' ? null : value)
                }
              >
                <SelectTrigger id="source-field">
                  <SelectValue placeholder="Select a field..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-gray-500">No specific field</span>
                  </SelectItem>
                  {sourceFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{field.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {field.data_type}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-gray-500">
              Select which field in {sourceEntity.display_name} references{' '}
              {targetEntity.display_name}
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the relationship..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Relationship'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
