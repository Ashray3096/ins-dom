'use client';

/**
 * DOM Selector Component
 *
 * Visual template builder through DOM selection
 * This is Inspector Dom's signature feature!
 *
 * Features:
 * - Click HTML elements to select them
 * - Click PDF text to select it
 * - Generate CSS selectors and XPath automatically
 * - Map selections to field names
 * - Save as reusable template
 */

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Save,
  Trash2,
  MousePointer2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';
import { HtmlSelector } from './html-selector';
import { PdfSelector } from './pdf-selector';

export interface FieldSelection {
  id: string;
  fieldName: string;
  fieldType: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  cssSelector?: string;
  xpath?: string;
  sampleValue: string;
  elementInfo?: {
    tagName: string;
    className: string;
    id: string;
  };
}

interface DomSelectorProps {
  artifact: Artifact;
  onSaveTemplate?: (selections: FieldSelection[]) => void;
}

export function DomSelector({ artifact, onSaveTemplate }: DomSelectorProps) {
  const [selections, setSelections] = useState<FieldSelection[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  /**
   * Handle element selection from HTML/PDF
   */
  const handleElementSelected = useCallback((selection: Omit<FieldSelection, 'id' | 'fieldName' | 'fieldType' | 'required'>) => {
    const newSelection: FieldSelection = {
      id: `field_${Date.now()}`,
      fieldName: '', // User will fill this in
      fieldType: 'string',
      required: true,
      ...selection
    };

    setSelections(prev => [...prev, newSelection]);
    toast.success('Element selected! Name your field in the panel.');
  }, []);

  /**
   * Update field configuration
   */
  const updateField = useCallback((id: string, updates: Partial<FieldSelection>) => {
    setSelections(prev => prev.map(field =>
      field.id === id ? { ...field, ...updates } : field
    ));
  }, []);

  /**
   * Remove a field selection
   */
  const removeField = useCallback((id: string) => {
    setSelections(prev => prev.filter(field => field.id !== id));
    toast.info('Field removed');
  }, []);

  /**
   * Validate selections before saving
   */
  const validateSelections = useCallback((): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (selections.length === 0) {
      errors.push('No fields selected. Please select at least one field.');
    }

    const unnamedFields = selections.filter(s => !s.fieldName.trim());
    if (unnamedFields.length > 0) {
      errors.push(`${unnamedFields.length} field(s) need names.`);
    }

    const duplicateNames = selections
      .map(s => s.fieldName)
      .filter((name, index, self) => name && self.indexOf(name) !== index);

    if (duplicateNames.length > 0) {
      errors.push(`Duplicate field names: ${duplicateNames.join(', ')}`);
    }

    const missingSelectorFields = selections.filter(s => !s.cssSelector && !s.xpath);
    if (missingSelectorFields.length > 0) {
      errors.push(`${missingSelectorFields.length} field(s) missing selectors.`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }, [selections]);

  /**
   * Save template with selections
   */
  const handleSave = useCallback(() => {
    const validation = validateSelections();

    if (!validation.valid) {
      toast.error('Cannot save template', {
        description: validation.errors.join(' ')
      });
      return;
    }

    if (onSaveTemplate) {
      onSaveTemplate(selections);
    }

    toast.success('Template saved!', {
      description: `${selections.length} fields configured`
    });
  }, [selections, validateSelections, onSaveTemplate]);

  /**
   * Toggle selection mode
   */
  const toggleSelecting = useCallback(() => {
    setIsSelecting(prev => !prev);
    toast.info(isSelecting ? 'Selection mode disabled' : 'Selection mode enabled - click elements to select');
  }, [isSelecting]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-screen">
      {/* Left Panel - Document Viewer (2/3 width) */}
      <div className="lg:col-span-2 space-y-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Document Preview - Click to Select</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {artifact.original_filename}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={isSelecting ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleSelecting}
                  className="gap-2"
                >
                  <MousePointer2 className="w-4 h-4" />
                  {isSelecting ? 'Selecting...' : 'Select Elements'}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="gap-2"
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Show
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          {showPreview && (
            <CardContent>
              {artifact.artifact_type === 'html' ? (
                <HtmlSelector
                  artifact={artifact}
                  isSelecting={isSelecting}
                  selections={selections}
                  onElementSelected={handleElementSelected}
                />
              ) : artifact.artifact_type === 'pdf' ? (
                <PdfSelector
                  artifact={artifact}
                  isSelecting={isSelecting}
                  selections={selections}
                  onElementSelected={handleElementSelected}
                />
              ) : (
                <div className="flex items-center justify-center h-96 border rounded-lg bg-gray-50">
                  <p className="text-gray-500">
                    Visual selection not supported for this file type
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Right Panel - Field Configuration (1/3 width) */}
      <div className="space-y-4 overflow-y-auto">
        {/* Statistics */}
        <Card className={selections.length > 0 ? 'bg-blue-50 border-blue-200' : ''}>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Fields Selected</span>
                <span className="text-2xl font-bold text-gray-900">
                  {selections.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Named Fields</span>
                <span className="text-lg font-semibold text-gray-900">
                  {selections.filter(s => s.fieldName.trim()).length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Required Fields</span>
                <span className="text-lg font-semibold text-gray-900">
                  {selections.filter(s => s.required).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Field List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Field Mapping</span>
              {selections.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Template
                </Button>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Configure each selected field
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {selections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MousePointer2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">No fields selected yet</p>
                <p className="text-sm mt-1">
                  Click "Select Elements" and then click on data in the document
                </p>
              </div>
            ) : (
              selections.map((field, index) => (
                <Card key={field.id} className="border-2">
                  <CardContent className="pt-4 space-y-3">
                    {/* Field Number */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500">
                        FIELD {index + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeField(field.id)}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Field Name */}
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Field Name *
                      </label>
                      <Input
                        placeholder="e.g., product_name"
                        value={field.fieldName}
                        onChange={(e) => updateField(field.id, { fieldName: e.target.value })}
                        className={!field.fieldName.trim() ? 'border-red-300' : ''}
                      />
                    </div>

                    {/* Field Type */}
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Data Type
                      </label>
                      <select
                        value={field.fieldType}
                        onChange={(e) => updateField(field.id, {
                          fieldType: e.target.value as FieldSelection['fieldType']
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="string">Text (string)</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>

                    {/* Required Toggle */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`required_${field.id}`}
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <label
                        htmlFor={`required_${field.id}`}
                        className="text-sm text-gray-700"
                      >
                        Required field
                      </label>
                    </div>

                    {/* Sample Value */}
                    <div className="pt-2 border-t">
                      <label className="text-xs font-medium text-gray-500 block mb-1">
                        Sample Value
                      </label>
                      <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border">
                        {field.sampleValue || '-'}
                      </p>
                    </div>

                    {/* Selector Info */}
                    <div className="pt-2 border-t">
                      <label className="text-xs font-medium text-gray-500 block mb-1">
                        CSS Selector
                      </label>
                      <p className="text-xs text-gray-700 font-mono bg-gray-50 p-2 rounded border break-all">
                        {field.cssSelector || 'Not generated'}
                      </p>
                    </div>

                    {field.xpath && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">
                          XPath
                        </label>
                        <p className="text-xs text-gray-700 font-mono bg-gray-50 p-2 rounded border break-all">
                          {field.xpath}
                        </p>
                      </div>
                    )}

                    {/* Validation Status */}
                    <div className="flex items-center gap-2 pt-2">
                      {field.fieldName.trim() && field.cssSelector ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-xs text-green-700">Ready to save</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                          <span className="text-xs text-yellow-700">
                            {!field.fieldName.trim() ? 'Needs name' : 'Missing selector'}
                          </span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Save Button at Bottom */}
        {selections.length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <Button
                onClick={handleSave}
                className="w-full gap-2"
                size="lg"
              >
                <Save className="w-5 h-5" />
                Save Template with {selections.length} Fields
              </Button>

              <p className="text-xs text-gray-600 mt-3 text-center">
                This template can be reused on similar documents
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
