'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { SourceFile, Selector, FieldMapping } from '@/types/database';

interface FieldConfig {
  id: string;
  selectorId: string;
  fieldName: string;
  dataType: string;
  xpath: string;
  tagName: string;
  sampleText: string;
}

export default function TemplateCreationPage() {
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const fileId = params.fileId as string;
  const router = useRouter();

  const [file, setFile] = useState<SourceFile | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && fileId) {
      loadFile();
      loadSelectionsFromUrl();
    }
  }, [user, fileId]);

  async function loadFile() {
    try {
      const { data, error } = await supabase
        .from('source_files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (error) throw error;
      setFile(data);
      setTemplateName(`${data.name} - Template`);
    } catch (error) {
      console.error('Error loading file:', error);
    } finally {
      setLoading(false);
    }
  }

  function loadSelectionsFromUrl() {
    // Load selected elements from session storage
    const stored = sessionStorage.getItem('selectedElements');
    if (stored) {
      try {
        const selectedElements = JSON.parse(stored);
        const loadedFields: FieldConfig[] = selectedElements.map((element: any, index: number) => ({
          id: `field-${Date.now()}-${index}`,
          selectorId: `sel-${Date.now()}-${index}`,
          fieldName: '', // User will fill this in
          dataType: 'text',
          xpath: element.xpath,
          tagName: element.tagName,
          sampleText: element.text,
        }));
        setFields(loadedFields);
        // Clear session storage after loading
        sessionStorage.removeItem('selectedElements');
      } catch (error) {
        console.error('Error loading selections:', error);
      }
    }
  }

  function addField() {
    const newField: FieldConfig = {
      id: Date.now().toString(),
      selectorId: `sel-${Date.now()}`,
      fieldName: '',
      dataType: 'text',
      xpath: '',
      tagName: 'div',
      sampleText: '',
    };
    setFields([...fields, newField]);
  }

  function updateField(id: string, updates: Partial<FieldConfig>) {
    setFields(fields.map(field =>
      field.id === id ? { ...field, ...updates } : field
    ));
  }

  function removeField(id: string) {
    setFields(fields.filter(field => field.id !== id));
  }

  async function handleSaveTemplate() {
    setError('');
    setSaving(true);

    if (!templateName.trim()) {
      setError('Please enter a template name');
      setSaving(false);
      return;
    }

    if (fields.length === 0) {
      setError('Please add at least one field');
      setSaving(false);
      return;
    }

    // Validate all fields have names
    const invalidFields = fields.filter(f => !f.fieldName.trim());
    if (invalidFields.length > 0) {
      setError('All fields must have a name');
      setSaving(false);
      return;
    }

    try {
      // Prepare selectors
      const selectors: Selector[] = fields.map(field => ({
        id: field.selectorId,
        type: 'xpath',
        value: field.xpath,
        label: field.fieldName,
      }));

      // Prepare field mappings
      const fieldMappings: Record<string, FieldMapping> = {};
      fields.forEach(field => {
        fieldMappings[field.fieldName] = {
          selector_id: field.selectorId,
          field_name: field.fieldName,
          data_type: field.dataType,
        };
      });

      // Save template
      const { error: insertError } = await supabase
        .from('templates')
        .insert([
          {
            source_file_id: fileId,
            name: templateName,
            selectors,
            field_mappings: fieldMappings,
          },
        ]);

      if (insertError) throw insertError;

      // Redirect back to file viewer
      router.push(`/projects/${projectId}/files/${fileId}`);
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">File not found</h2>
          <Link href={`/projects/${projectId}`}>
            <Button>Back to Project</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href={`/projects/${projectId}/files/${fileId}`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to File Viewer
          </Link>
          <div className="flex items-center justify-between mt-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Extraction Template</h1>
              <p className="text-sm text-gray-600 mt-1">
                Define fields and data types for extracting data from {file.name}
              </p>
            </div>
            <Button onClick={handleSaveTemplate} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Template Name */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Template Information</CardTitle>
            <CardDescription>Give your template a descriptive name</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Product Details Extraction"
              />
            </div>
          </CardContent>
        </Card>

        {/* Field Mappings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Field Mappings</CardTitle>
                <CardDescription>
                  Map HTML elements to named fields with data types
                </CardDescription>
              </div>
              <Button onClick={addField} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-600 mb-4">No fields added yet</p>
                <Button onClick={addField}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Field
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="p-4 border border-gray-200 rounded-lg bg-white"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Field {index + 1}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeField(field.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Field Name */}
                      <div className="space-y-2">
                        <Label>Field Name *</Label>
                        <Input
                          value={field.fieldName}
                          onChange={(e) =>
                            updateField(field.id, { fieldName: e.target.value })
                          }
                          placeholder="e.g., productTitle, price, description"
                        />
                      </div>

                      {/* Data Type */}
                      <div className="space-y-2">
                        <Label>Data Type</Label>
                        <select
                          value={field.dataType}
                          onChange={(e) =>
                            updateField(field.id, { dataType: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="email">Email</option>
                          <option value="url">URL</option>
                          <option value="boolean">Boolean</option>
                        </select>
                      </div>

                      {/* XPath */}
                      <div className="space-y-2 md:col-span-2">
                        <Label>XPath Selector *</Label>
                        <Input
                          value={field.xpath}
                          onChange={(e) =>
                            updateField(field.id, { xpath: e.target.value })
                          }
                          placeholder="/html/body/div[1]/span[1]"
                          className="font-mono text-sm"
                        />
                      </div>

                      {/* Sample Text */}
                      <div className="space-y-2 md:col-span-2">
                        <Label>Sample Value</Label>
                        <Input
                          value={field.sampleText}
                          onChange={(e) =>
                            updateField(field.id, { sampleText: e.target.value })
                          }
                          placeholder="Preview of extracted value"
                          className="bg-gray-50"
                        />
                      </div>

                      {/* Tag Name */}
                      <div className="space-y-2">
                        <Label>HTML Tag</Label>
                        <Input
                          value={field.tagName}
                          onChange={(e) =>
                            updateField(field.id, { tagName: e.target.value })
                          }
                          placeholder="div, span, p, etc."
                          className="bg-gray-50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <Button onClick={handleSaveTemplate} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving Template...' : 'Save Template'}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}/files/${fileId}`)}
          >
            Cancel
          </Button>
        </div>
      </main>
    </div>
  );
}
