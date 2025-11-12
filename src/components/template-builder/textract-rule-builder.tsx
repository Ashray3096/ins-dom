'use client';

/**
 * Textract Rule Builder Component
 *
 * Full-screen interface for building PDF extraction templates using AWS Textract + AI
 * Features:
 * - Analyze PDF with Textract to get tables, forms, text
 * - Generate extraction rules with AI
 * - Edit and refine rules
 * - Save as reusable template
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  X,
  Check,
  Loader2,
  Sparkles,
  Table,
  FileKey,
  AlignLeft,
  Trash2,
  Edit2,
  Save,
  Zap,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';
import type { TextractAnalysisResult } from '@/lib/textract-client';
import type { ExtractionRule, GeneratedRules } from '@/app/api/textract/generate-rules/route';

export interface PDFFieldMapping {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  required: boolean;
  extractionRule: ExtractionRule;
  sampleValue: string;
  description?: string;
}

interface TextractRuleBuilderProps {
  artifact: Artifact;
  onSave: (fieldMappings: PDFFieldMapping[]) => void;
  onCancel: () => void;
}

export function TextractRuleBuilder({
  artifact,
  onSave,
  onCancel,
}: TextractRuleBuilderProps) {
  const [step, setStep] = useState<'analyze' | 'generate' | 'edit'>('analyze');
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [textractData, setTextractData] = useState<TextractAnalysisResult | null>(null);
  const [generatedRules, setGeneratedRules] = useState<GeneratedRules | null>(null);
  const [fieldMappings, setFieldMappings] = useState<PDFFieldMapping[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [userPrompt, setUserPrompt] = useState('');

  // Timer for showing elapsed time during analysis
  useEffect(() => {
    if (!analyzing || !analysisStartTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - analysisStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [analyzing, analysisStartTime]);

  /**
   * Step 1: Analyze PDF with Textract
   */
  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      setAnalysisStartTime(Date.now());
      console.log('🔍 Analyzing PDF with Textract...');

      const response = await fetch('/api/textract/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact_id: artifact.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Show detailed error message if available
        if (result.details) {
          toast.error(result.error || 'Failed to analyze PDF', {
            description: result.details,
            duration: 10000, // Show for 10 seconds
          });
        } else {
          toast.error(result.error || 'Failed to analyze PDF');
        }
        return;
      }

      console.log('✅ Textract analysis complete:', result.analysis);
      setTextractData(result.analysis);
      setStep('generate');

      toast.success('PDF analyzed successfully!', {
        description: `Found ${result.analysis.tables.length} tables and ${result.analysis.keyValuePairs.length} form fields`,
      });
    } catch (error) {
      console.error('Error analyzing PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze PDF');
    } finally {
      setAnalyzing(false);
      setAnalysisStartTime(null);
    }
  };

  /**
   * Step 2: Generate extraction rules with AI
   */
  const handleGenerateRules = async () => {
    if (!textractData) {
      toast.error('No Textract data available');
      return;
    }

    try {
      setGenerating(true);
      console.log('🤖 Generating extraction rules with AI...');

      const response = await fetch('/api/textract/generate-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textract_data: textractData,
          user_prompt: userPrompt || undefined
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate rules');
      }

      console.log('✅ Rules generated:', result.rules);
      setGeneratedRules(result.rules);

      // Convert to field mappings
      const mappings: PDFFieldMapping[] = Object.entries(result.rules.fields).map(
        ([fieldName, rule]) => ({
          id: `field_${Date.now()}_${Math.random()}`,
          name: fieldName,
          type: rule.dataType as any,
          required: rule.required,
          extractionRule: rule,
          sampleValue: rule.sampleValue,
          description: rule.description,
        })
      );

      setFieldMappings(mappings);
      setStep('edit');

      toast.success('Extraction rules generated!', {
        description: `AI suggested ${mappings.length} fields to extract`,
      });
    } catch (error) {
      console.error('Error generating rules:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate rules');
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Step 3: Save template
   */
  const handleSave = () => {
    if (fieldMappings.length === 0) {
      toast.error('Please add at least one field');
      return;
    }

    onSave(fieldMappings);
  };

  /**
   * Edit field mapping
   */
  const updateFieldMapping = (id: string, updates: Partial<PDFFieldMapping>) => {
    setFieldMappings(prev =>
      prev.map(field => (field.id === id ? { ...field, ...updates } : field))
    );
  };

  /**
   * Remove field mapping
   */
  const removeFieldMapping = (id: string) => {
    setFieldMappings(prev => prev.filter(field => field.id !== id));
    toast.info('Field removed');
  };

  /**
   * Get extraction type label
   */
  const getExtractionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      table: 'Table',
      keyValue: 'Form Field',
      position: 'Position',
      pattern: 'Pattern',
    };
    return labels[type] || type;
  };

  /**
   * Get extraction type icon
   */
  const getExtractionTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      table: Table,
      keyValue: FileKey,
      position: AlignLeft,
      pattern: Zap,
    };
    const Icon = icons[type] || AlignLeft;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between bg-gray-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Smart PDF Template Builder
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {artifact.original_filename} - Powered by AWS Textract + AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          {step === 'edit' && (
            <Button onClick={handleSave} disabled={fieldMappings.length === 0}>
              <Check className="w-4 h-4 mr-2" />
              Save Template ({fieldMappings.length} fields)
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Textract Results */}
        <div className="w-1/2 border-r overflow-y-auto p-6 space-y-6">
          {/* Step 1: Analyze */}
          {step === 'analyze' && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Analyze PDF Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  AWS Textract will analyze your PDF to extract:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-2">
                  <li>Tables with data</li>
                  <li>Form fields (key-value pairs)</li>
                  <li>Text blocks with positions</li>
                </ul>

                <div className="pt-4">
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing PDF...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Analyze with Textract
                      </>
                    )}
                  </Button>
                </div>

                {analyzing && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-900 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">Processing...</span>
                    </div>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>Elapsed time: {elapsedTime}s</p>
                      {elapsedTime > 30 && (
                        <p className="text-xs">
                          Large PDFs with multiple pages may take several minutes to analyze.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 text-center pt-2">
                  Cost: ~$0.07 per page {artifact.metadata?.pages ? `(~$${(artifact.metadata.pages * 0.07).toFixed(2)})` : ''}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Generate Rules */}
          {step === 'generate' && textractData && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Textract Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Table className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-900">
                        {textractData.tables.length}
                      </div>
                      <div className="text-sm text-blue-700">Tables</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <FileKey className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-900">
                        {textractData.keyValuePairs.length}
                      </div>
                      <div className="text-sm text-green-700">Form Fields</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <AlignLeft className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-purple-900">
                        {textractData.textBlocks.filter(b => b.blockType === 'LINE').length}
                      </div>
                      <div className="text-sm text-purple-700">Text Lines</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tables Preview */}
              {textractData.tables.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Table className="w-5 h-5" />
                      Tables Detected
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {textractData.tables.map((table, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="text-sm font-medium text-gray-900 mb-2">
                          Table {idx + 1} - {table.rows} rows × {table.columns} columns (Page {table.page})
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <tbody>
                              {table.data.slice(0, 5).map((row, rowIdx) => (
                                <tr key={rowIdx} className="border-b">
                                  {row.map((cell, cellIdx) => (
                                    <td
                                      key={cellIdx}
                                      className="px-2 py-1 border-r"
                                    >
                                      {cell || '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {table.data.length > 5 && (
                            <div className="text-xs text-gray-400 mt-2">
                              ... and {table.data.length - 5} more rows
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Key-Value Pairs Preview */}
              {textractData.keyValuePairs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileKey className="w-5 h-5" />
                      Form Fields Detected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {textractData.keyValuePairs.slice(0, 20).map((pair, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between p-2 bg-gray-50 rounded text-sm"
                        >
                          <span className="font-medium text-gray-700">{pair.key}:</span>
                          <span className="text-gray-900">{pair.value || '(empty)'}</span>
                        </div>
                      ))}
                      {textractData.keyValuePairs.length > 20 && (
                        <div className="text-xs text-gray-400 text-center">
                          ... and {textractData.keyValuePairs.length - 20} more pairs
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Generate Rules Button */}
              <Card className="bg-purple-50 border-purple-200">
                <CardHeader>
                  <CardTitle>Step 2: Generate Extraction Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-purple-900">
                    AI will analyze the Textract results and suggest extraction rules for the important fields.
                  </p>

                  <div>
                    <Label className="text-purple-900 font-medium mb-2 block">
                      What do you want to extract? (Optional)
                    </Label>
                    <textarea
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      placeholder="Example: Extract invoice number, date, line items with product name, quantity, and price. Also extract total amount and vendor information."
                      className="w-full px-3 py-2 border border-purple-300 rounded-md text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      disabled={generating}
                    />
                    <p className="text-xs text-purple-700 mt-1">
                      Specify which fields are important to you. Leave blank for AI to suggest all fields automatically.
                    </p>
                  </div>

                  <Button
                    onClick={handleGenerateRules}
                    disabled={generating}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Rules with AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Rules with AI
                      </>
                    )}
                  </Button>

                  <div className="text-xs text-purple-700 text-center">
                    Cost: ~$0.003 per request
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Edit - Show Summary */}
          {step === 'edit' && generatedRules && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  Rules Generated Successfully
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Fields identified:</span>
                    <span className="font-semibold text-gray-900">
                      {fieldMappings.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Tables analyzed:</span>
                    <span className="font-semibold text-gray-900">
                      {generatedRules.metadata.tablesAnalyzed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Form fields analyzed:</span>
                    <span className="font-semibold text-gray-900">
                      {generatedRules.metadata.keyValuePairsAnalyzed}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-white rounded border border-green-200">
                  <p className="text-sm text-green-900">
                    Review and edit the suggested fields on the right. You can modify field names, types, and extraction rules.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel - Field Mappings */}
        <div className="w-1/2 overflow-y-auto p-6">
          {step === 'edit' && fieldMappings.length > 0 ? (
            <div className="space-y-4">
              <div className="sticky top-0 bg-white pb-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Extraction Fields ({fieldMappings.length})
                </h3>
                <p className="text-sm text-gray-600">
                  Review and edit the AI-suggested fields
                </p>
              </div>

              {fieldMappings.map((field) => (
                <Card key={field.id} className="border-2">
                  <CardContent className="pt-4 space-y-3">
                    {/* Field Name */}
                    <div>
                      <Label className="text-xs">Field Name</Label>
                      <Input
                        value={field.name}
                        onChange={(e) =>
                          updateFieldMapping(field.id, { name: e.target.value })
                        }
                        className="mt-1"
                      />
                    </div>

                    {/* Field Type */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Data Type</Label>
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateFieldMapping(field.id, {
                              type: e.target.value as any,
                            })
                          }
                          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="boolean">Boolean</option>
                          <option value="array">Array</option>
                        </select>
                      </div>

                      <div className="flex items-end">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              updateFieldMapping(field.id, {
                                required: e.target.checked,
                              })
                            }
                            className="rounded"
                          />
                          <span className="text-sm">Required</span>
                        </label>
                      </div>
                    </div>

                    {/* Extraction Strategy */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {getExtractionTypeIcon(field.extractionRule.extractionType)}
                        <span className="text-sm font-medium text-gray-700">
                          {getExtractionTypeLabel(field.extractionRule.extractionType)}
                        </span>
                      </div>

                      {/* Show location details */}
                      <div className="text-xs text-gray-600">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(field.extractionRule.location, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Sample Value */}
                    <div>
                      <Label className="text-xs text-gray-500">Sample Value</Label>
                      <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200 text-sm text-gray-900 font-mono whitespace-pre-wrap">
                        {typeof field.sampleValue === 'object'
                          ? JSON.stringify(field.sampleValue, null, 2)
                          : field.sampleValue}
                      </div>
                    </div>

                    {/* Description */}
                    {field.description && (
                      <div className="text-xs text-gray-500 italic">
                        {field.description}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFieldMapping(field.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">No fields yet</p>
                <p className="text-sm mt-1">
                  {step === 'analyze' && 'Analyze the PDF to get started'}
                  {step === 'generate' && 'Generate rules to see suggested fields'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
