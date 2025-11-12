'use client';

/**
 * Template Field Importer Component
 *
 * Allows users to import fields from extraction templates
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import type { EntityField } from './visual-designer';
import type { EntityType } from './entity-type-selector';

interface Template {
  id: string;
  name: string;
  description: string | null;
  fields: Record<string, any>;
}

interface TemplateField {
  name: string;
  type?: string;
  description?: string;
}

interface TemplateFieldImporterProps {
  entityType: EntityType;
  linkedTemplateId: string | null;
  onImportFields: (fields: Omit<EntityField, 'id' | 'sort_order'>[]) => void;
}

export function TemplateFieldImporter({
  entityType,
  linkedTemplateId,
  onImportFields,
}: TemplateFieldImporterProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(linkedTemplateId || '');
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [selectedFieldNames, setSelectedFieldNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (linkedTemplateId) {
      setSelectedTemplateId(linkedTemplateId);
      loadTemplateFields(linkedTemplateId);
    }
  }, [linkedTemplateId]);

  const loadTemplates = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, description, fields')
        .eq('status', 'ACTIVE')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadTemplateFields = async (templateId: string, sectionName?: string) => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error} = await supabase
        .from('templates')
        .select('fields, selectors')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      console.log('Template fields data:', data?.fields);
      console.log('Template selectors data:', data?.selectors);

      // Parse template fields from JSONB
      const fields: TemplateField[] = [];

      // Check if this is a multi-section NABCA template
      const isMultiSectionTemplate = data?.selectors?.sections &&
                                    Array.isArray(data.selectors.sections) &&
                                    data.selectors.sections.length > 0 &&
                                    data.selectors.sections[0].fields &&
                                    Array.isArray(data.selectors.sections[0].fields);

      if (isMultiSectionTemplate) {
        console.log('Multi-section NABCA template detected:', data.selectors.sections.length, 'sections');

        // Extract section names for the selector
        const sectionNames = data.selectors.sections.map((s: any) => s.name);
        setSections(sectionNames);

        // If a specific section is selected, load only that section's fields
        if (sectionName) {
          const section = data.selectors.sections.find((s: any) => s.name === sectionName);
          if (section && section.fields) {
            console.log(`Loading fields for section: ${sectionName} (${section.fields.length} fields)`);
            section.fields.forEach((field: any) => {
              if (typeof field === 'object' && field.name) {
                fields.push({
                  name: field.name,
                  type: field.type || field.data_type || 'TEXT',
                  description: field.description || field.label || '',
                });
              }
            });
          }
        } else {
          // No section selected yet - don't load any fields
          console.log('No section selected. Please select a table/section to import fields.');
        }
      }
      // Priority 1: Use top-level fields array if it exists and is non-empty
      // This contains the curated semantic field schema (for non-NABCA templates)
      else if (data?.fields && Array.isArray(data.fields) && data.fields.length > 0) {
        console.log('Using top-level fields array:', data.fields.length, 'fields');

        // These are already properly structured semantic fields
        data.fields.forEach((field: any) => {
          if (typeof field === 'object' && field.name) {
            fields.push({
              name: field.name,
              type: field.type || field.data_type || 'TEXT',
              description: field.description || field.label || '',
            });
          }
        });
        setSections([]); // No sections for regular templates
      }
      // Priority 3: Original fields structure (for other template types)
      else if (data?.fields) {
        // Handle array format (most common from visual builder and AI extract)
        if (Array.isArray(data.fields)) {
          data.fields.forEach((field: any) => {
            // Handle string array: ["field1", "field2", ...]
            if (typeof field === 'string') {
              fields.push({
                name: field,
                type: 'TEXT', // Default type for string-only fields
                description: '',
              });
            }
            // Handle object array: [{ name, type, description }, ...]
            else if (typeof field === 'object' && field.name) {
              fields.push({
                name: field.name,
                type: field.type || field.data_type || 'TEXT',
                description: field.description || '',
              });
            }
          });
        }
        // Handle object format
        else if (typeof data.fields === 'object') {
          // Check if it's nested under "fields" key
          const fieldsData = 'fields' in data.fields ? data.fields.fields : data.fields;

          if (Array.isArray(fieldsData)) {
            // Nested array: { fields: [...] }
            fieldsData.forEach((field: any) => {
              if (field.name) {
                fields.push({
                  name: field.name,
                  type: field.type || field.data_type || 'TEXT',
                  description: field.description || '',
                });
              }
            });
          } else if (typeof fieldsData === 'object') {
            // Object format: { field_name: { type, description }, ... }
            Object.entries(fieldsData).forEach(([name, value]: [string, any]) => {
              if (typeof value === 'object') {
                fields.push({
                  name,
                  type: value?.type || value?.data_type || 'TEXT',
                  description: value?.description || '',
                });
              }
            });
          }
        }
      }

      console.log('Parsed fields:', fields);
      setTemplateFields(fields);
      // Auto-select all fields by default
      setSelectedFieldNames(new Set(fields.map(f => f.name)));
    } catch (error) {
      console.error('Error loading template fields:', error);
      setTemplateFields([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setSelectedSection(''); // Reset section when template changes
    setTemplateFields([]); // Clear fields
    setSelectedFieldNames(new Set()); // Clear selections
    loadTemplateFields(templateId);
  };

  const handleSectionChange = (sectionName: string) => {
    setSelectedSection(sectionName);
    loadTemplateFields(selectedTemplateId, sectionName);
  };

  const handleToggleField = (fieldName: string) => {
    const newSelected = new Set(selectedFieldNames);
    if (newSelected.has(fieldName)) {
      newSelected.delete(fieldName);
    } else {
      newSelected.add(fieldName);
    }
    setSelectedFieldNames(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedFieldNames(new Set(templateFields.map(f => f.name)));
  };

  const handleDeselectAll = () => {
    setSelectedFieldNames(new Set());
  };

  const handleImport = () => {
    const fieldsToImport: Omit<EntityField, 'id' | 'sort_order'>[] = templateFields
      .filter(tf => selectedFieldNames.has(tf.name))
      .map(tf => {
        // Sanitize field name for database column
        const sanitizedName = tf.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores

        // Build template field path based on whether this is a section-based import
        const templateFieldPath = selectedSection
          ? `selectors.sections.${selectedSection}.fields.${tf.name}`
          : `fields.${tf.name}`;

        return {
          name: sanitizedName,
          display_name: tf.name,
          description: tf.description || '',
          data_type: mapTypeToDataType(tf.type),
          is_required: false,
          is_unique: false,
          is_primary_key: false,
          template_id: selectedTemplateId,
          template_field_path: templateFieldPath,
          mapping_type: 'DIRECT',
          // Store section metadata for NABCA templates (used by pipeline generation)
          metadata: selectedSection ? { nabca_section: selectedSection } : undefined,
        };
      });

    console.log('Fields to import:', fieldsToImport);
    console.log('Section:', selectedSection || 'none');
    onImportFields(fieldsToImport);
    setSelectedFieldNames(new Set());
  };

  const mapTypeToDataType = (type?: string): EntityField['data_type'] => {
    if (!type) return 'TEXT';
    const t = type.toLowerCase();
    if (t.includes('number') || t.includes('int') || t.includes('float') || t.includes('decimal')) {
      return 'NUMBER';
    }
    if (t.includes('date') || t.includes('time')) {
      return 'DATE';
    }
    if (t.includes('bool')) {
      return 'BOOLEAN';
    }
    if (t.includes('json') || t.includes('object') || t.includes('array')) {
      return 'JSON';
    }
    if (t.includes('uuid') || t.includes('guid')) {
      return 'UUID';
    }
    return 'TEXT';
  };

  if (entityType !== 'INTERIM' && !linkedTemplateId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Import from Template</CardTitle>
          <CardDescription className="text-xs">
            Select a template to import fields
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Template import is most useful for INTERIM entities. For REFERENCE and MASTER entities,
              consider manually designing fields.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Import from Template
        </CardTitle>
        <CardDescription className="text-xs">
          Bulk import fields from extraction templates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Template Selector */}
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Select Template
          </label>
          <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section Selector (for multi-section NABCA templates) */}
        {sections.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">
              Select Table/Section
            </label>
            <Select value={selectedSection} onValueChange={handleSectionChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a table..." />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section} value={section}>
                    {section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedSection && (
              <p className="text-xs text-gray-500 mt-1">
                Select which NABCA table to import fields from
              </p>
            )}
          </div>
        )}

        {/* Field List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : templateFields.length > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">
                {selectedFieldNames.size} of {templateFields.length} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-6 text-xs"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                  className="h-6 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>

            <ScrollArea className="h-64 border rounded-md">
              <div className="p-3 space-y-2">
                {templateFields.map((field) => (
                  <div
                    key={field.name}
                    className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    onClick={() => handleToggleField(field.name)}
                  >
                    <Checkbox
                      checked={selectedFieldNames.has(field.name)}
                      onCheckedChange={() => handleToggleField(field.name)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate">
                          {field.name}
                        </span>
                        {field.type && (
                          <Badge variant="secondary" className="text-xs h-4 px-1">
                            {mapTypeToDataType(field.type)}
                          </Badge>
                        )}
                      </div>
                      {field.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {field.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Button
              onClick={handleImport}
              disabled={selectedFieldNames.size === 0}
              className="w-full"
              size="sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Import {selectedFieldNames.size} Field{selectedFieldNames.size !== 1 ? 's' : ''}
            </Button>
          </>
        ) : selectedTemplateId ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              No fields found in this template.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
