'use client';

/**
 * Entity Form Component
 *
 * Form for creating and editing entities with type-specific fields and validation
 * Supports three entity types: INTERIM, REFERENCE, MASTER
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Info } from 'lucide-react';
import { EntityTypeSelector, EntityType, getEntityTypeBadgeColor } from './entity-type-selector';
import { createClient } from '@/lib/supabase/client';

interface EntityFormData {
  name: string;
  display_name: string;
  description: string;
  entity_type: EntityType | null;
  template_id: string | null; // For INTERIM entities
  metadata: Record<string, any>;
}

interface EntityFormProps {
  onSubmit: (data: EntityFormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<EntityFormData>;
  isSubmitting?: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
}

export function EntityForm({
  onSubmit,
  onCancel,
  initialData,
  isSubmitting = false,
}: EntityFormProps) {
  // Form state
  const [formData, setFormData] = useState<EntityFormData>({
    name: initialData?.name || '',
    display_name: initialData?.display_name || '',
    description: initialData?.description || '',
    entity_type: initialData?.entity_type || null,
    template_id: initialData?.template_id || null,
    metadata: initialData?.metadata || {},
  });

  // Templates for INTERIM entities
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load templates when entity type is INTERIM
  useEffect(() => {
    if (formData.entity_type === 'INTERIM') {
      loadTemplates();
    }
  }, [formData.entity_type]);

  // Auto-generate name from display_name
  useEffect(() => {
    if (formData.display_name && !initialData?.name) {
      const generatedName = formData.display_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setFormData((prev) => ({ ...prev, name: generatedName }));
    }
  }, [formData.display_name, initialData?.name]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, description')
        .eq('status', 'ACTIVE')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.entity_type) {
      newErrors.entity_type = 'Entity type is required';
    }
    if (!formData.display_name.trim()) {
      newErrors.display_name = 'Display name is required';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Entity name is required';
    } else if (!/^[a-z0-9_]+$/.test(formData.name)) {
      newErrors.name = 'Entity name must contain only lowercase letters, numbers, and underscores';
    }

    // Type-specific validation
    if (formData.entity_type === 'INTERIM') {
      if (!formData.template_id) {
        newErrors.template_id = 'Template is required for INTERIM entities';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  const handleFieldChange = (field: keyof EntityFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Entity Type Selector */}
      <EntityTypeSelector
        selectedType={formData.entity_type}
        onSelectType={(type) => handleFieldChange('entity_type', type)}
        disabled={isSubmitting}
      />
      {errors.entity_type && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.entity_type}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      {formData.entity_type && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            <Badge variant="secondary" className={getEntityTypeBadgeColor(formData.entity_type)}>
              {formData.entity_type}
            </Badge>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display_name">
              Display Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="display_name"
              value={formData.display_name}
              onChange={(e) => handleFieldChange('display_name', e.target.value)}
              placeholder="e.g., TTB Monthly Report"
              disabled={isSubmitting}
              className={errors.display_name ? 'border-red-500' : ''}
            />
            {errors.display_name && (
              <p className="text-sm text-red-600">{errors.display_name}</p>
            )}
            <p className="text-xs text-gray-500">
              Human-readable name for this entity
            </p>
          </div>

          {/* Entity Name (Database Table Name) */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Entity Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="e.g., ttb_monthly_report"
              disabled={isSubmitting}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name}</p>
            )}
            <p className="text-xs text-gray-500">
              Database table name (lowercase, underscores only). Auto-generated from display name.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Describe the purpose of this entity..."
              rows={3}
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500">
              Optional description of what this entity represents
            </p>
          </div>
        </Card>
      )}

      {/* Type-Specific Configuration */}
      {formData.entity_type === 'INTERIM' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">INTERIM Configuration</h3>
          </div>

          <Alert>
            <AlertDescription>
              INTERIM entities store raw extracted data from templates. Select the template
              that this entity will be populated from.
            </AlertDescription>
          </Alert>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template_id">
              Source Template <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.template_id || ''}
              onValueChange={(value) => handleFieldChange('template_id', value)}
              disabled={isSubmitting || loadingTemplates}
            >
              <SelectTrigger className={errors.template_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-gray-500 text-center">
                    No templates available. Create a template first.
                  </div>
                ) : (
                  templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-xs text-gray-500">{template.description}</div>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.template_id && (
              <p className="text-sm text-red-600">{errors.template_id}</p>
            )}
            <p className="text-xs text-gray-500">
              The extraction template that will populate this entity
            </p>
          </div>
        </Card>
      )}

      {formData.entity_type === 'REFERENCE' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">REFERENCE Configuration</h3>
          </div>

          <Alert>
            <AlertDescription>
              REFERENCE entities are dimension tables with unique constraints. Configure
              natural keys and slow-changing dimension behavior in the next step.
            </AlertDescription>
          </Alert>
        </Card>
      )}

      {formData.entity_type === 'MASTER' && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">MASTER Configuration</h3>
          </div>

          <Alert>
            <AlertDescription>
              MASTER entities are fact tables with foreign keys to REFERENCE entities. Define
              relationships, business rules, and aggregations in the next step.
            </AlertDescription>
          </Alert>
        </Card>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !formData.entity_type}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Entity...
            </>
          ) : (
            'Create Entity'
          )}
        </Button>
      </div>
    </form>
  );
}
