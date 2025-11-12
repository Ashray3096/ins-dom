'use client';

/**
 * Universal Template Wizard - Redesigned 3-Step Flow
 * Step 1: Welcome + Strategy Selection
 * Step 2: Visual Selection (launch appropriate selector)
 * Step 3: Field Mapping (map selections to field library)
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, Table, MousePointer, GitBranch, Hash, ScanText, Brain, AlertCircle, Search } from 'lucide-react';
import { VisualDOMSelector, type FieldMapping } from '../template-builder/visual-dom-selector';
import { PDFVisualSelector, type PDFFieldMapping } from '../template-builder/pdf-visual-selector';
import type { Artifact } from '@/types/artifacts';

type ExtractionStrategy =
  | 'table_detection'
  | 'dom_selection'
  | 'json_path'
  | 'key_value'
  | 'ocr_text'
  | 'ai_extraction';

interface StrategyOption {
  id: ExtractionStrategy;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  supportedTypes: string[];
}

interface StrategyConfig {
  table_detection?: {
    tableIndex?: number;
    skipRows?: number;
    headerRow?: number;
  };
  dom_selection?: {
    selector: string;
    selectorType: 'css' | 'xpath';
  };
  json_path?: {
    rootPath: string;
  };
  key_value?: {
    keyPattern?: string;
    valuePattern?: string;
  };
  ocr_text?: {
    ocrEngine: 'textract' | 'tesseract';
    language?: string;
  };
  ai_extraction?: {
    prompt: string;
    model?: string;
  };
}

interface UniversalWizardProps {
  artifact: Artifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 'strategy' | 'visual' | 'mapping';

// Combined selection type from visual selectors
interface VisualSelection {
  // DOM selection fields
  xpath?: string;
  cssSelector?: string;
  sampleValue?: string;
  elementInfo?: {
    tagName: string;
    className: string;
    id: string;
  };
  isArray?: boolean;
  regexPattern?: string;
  // PDF selection fields
  pageNumber?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textContent?: string;
  textPattern?: string;
}

const EXTRACTION_STRATEGIES: StrategyOption[] = [
  {
    id: 'table_detection',
    name: 'Table Detection',
    description: 'Automatically detect and extract tables from PDFs or HTML documents',
    icon: Table,
    supportedTypes: ['pdf', 'html'],
  },
  {
    id: 'dom_selection',
    name: 'DOM Selection',
    description: 'Select specific HTML elements using CSS selectors or XPath',
    icon: MousePointer,
    supportedTypes: ['html'],
  },
  {
    id: 'json_path',
    name: 'JSON Path',
    description: 'Extract data from JSON files using JSONPath expressions',
    icon: GitBranch,
    supportedTypes: ['json'],
  },
  {
    id: 'key_value',
    name: 'Key-Value Extraction',
    description: 'Extract key-value pairs from documents (invoices, forms, receipts)',
    icon: Hash,
    supportedTypes: ['pdf', 'html', 'image'],
  },
  {
    id: 'ocr_text',
    name: 'OCR Text',
    description: 'Extract text from images or scanned PDFs using OCR',
    icon: ScanText,
    supportedTypes: ['pdf', 'image'],
  },
  {
    id: 'ai_extraction',
    name: 'AI Extraction',
    description: 'Use AI to intelligently extract data from any document type',
    icon: Brain,
    supportedTypes: ['pdf', 'html', 'json', 'image', 'text'],
  },
];

export function UniversalWizard({ artifact, open, onOpenChange }: UniversalWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('strategy');
  const [selectedStrategy, setSelectedStrategy] = useState<ExtractionStrategy | null>(null);
  const [showVisualSelector, setShowVisualSelector] = useState(false);
  const [visualSelections, setVisualSelections] = useState<VisualSelection[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');

  if (!artifact) return null;

  const steps: { id: WizardStep; label: string }[] = [
    { id: 'strategy', label: 'Select Strategy' },
    { id: 'visual', label: 'Visual Selection' },
    { id: 'mapping', label: 'Field Mapping' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // Filter strategies based on artifact type
  const availableStrategies = EXTRACTION_STRATEGIES.filter((strategy) =>
    strategy.supportedTypes.includes(artifact.artifact_type.toLowerCase())
  );

  // Handle visual selector save
  const handleVisualSelectionComplete = (selections: (FieldMapping | PDFFieldMapping)[]) => {
    // Convert to unified format
    const unified = selections.map((sel): VisualSelection => {
      if ('xpath' in sel) {
        // DOM selection
        return {
          xpath: sel.xpath,
          cssSelector: sel.cssSelector,
          sampleValue: sel.sampleValue,
          elementInfo: sel.elementInfo,
          isArray: sel.isArray,
          regexPattern: sel.regexPattern,
        };
      } else {
        // PDF selection
        return {
          pageNumber: sel.pageNumber,
          boundingBox: sel.boundingBox,
          textContent: sel.textContent,
          textPattern: sel.textPattern,
        };
      }
    });
    setVisualSelections(unified);
    setShowVisualSelector(false);
    setCurrentStep('mapping');
  };

  return (
    <>
      {/* Main Wizard Dialog - only show when visual selector is NOT open */}
      {!showVisualSelector && (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Create Universal Template</DialogTitle>
              <p className="text-sm text-gray-500">
                {artifact.original_filename} • {artifact.artifact_type.toUpperCase()}
              </p>
            </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between py-4 border-b">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStepIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.completed ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className="text-xs mt-1 text-gray-600">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 ${
                    index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-6">
          {/* Step 1: Strategy Selection (with welcome message) */}
          {currentStep === 'strategy' && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <h2 className="text-2xl font-bold mb-2">Create Universal Template</h2>
                <p className="text-gray-600 mb-4">
                  Extract data from <strong>{artifact.original_filename}</strong> using visual selection
                </p>
                <Badge className="bg-blue-100 text-blue-700">
                  {artifact.artifact_type.toUpperCase()}
                </Badge>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-2">Select Extraction Strategy</h3>
                <p className="text-gray-600 mb-6">
                  Choose how you want to extract data from this file
                </p>
              </div>

              {availableStrategies.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    No extraction strategies available for {artifact.artifact_type} files
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableStrategies.map((strategy) => {
                    const Icon = strategy.icon;
                    const isSelected = selectedStrategy === strategy.id;

                    return (
                      <button
                        key={strategy.id}
                        onClick={() => setSelectedStrategy(strategy.id)}
                        className={`relative p-6 border-2 rounded-lg text-left transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {/* Radio indicator */}
                        <div
                          className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>

                        {/* Icon */}
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                            isSelected ? 'bg-blue-100' : 'bg-gray-100'
                          }`}
                        >
                          <Icon
                            className={`w-6 h-6 ${
                              isSelected ? 'text-blue-600' : 'text-gray-600'
                            }`}
                          />
                        </div>

                        {/* Content */}
                        <h4
                          className={`font-medium mb-2 ${
                            isSelected ? 'text-blue-900' : 'text-gray-900'
                          }`}
                        >
                          {strategy.name}
                        </h4>
                        <p
                          className={`text-sm ${
                            isSelected ? 'text-blue-700' : 'text-gray-600'
                          }`}
                        >
                          {strategy.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedStrategy && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Selected:</strong>{' '}
                    {
                      availableStrategies.find((s) => s.id === selectedStrategy)
                        ?.name
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Visual Selection */}
          {currentStep === 'visual' && selectedStrategy && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Visual Selection</h3>
                <p className="text-gray-600 mb-6">
                  Using <strong>{availableStrategies.find((s) => s.id === selectedStrategy)?.name}</strong> -
                  {selectedStrategy === 'ai_extraction'
                    ? ' describe what to extract'
                    : ' visually select fields from your document'}
                </p>
              </div>

              {/* AI Extraction - Just Prompt */}
              {selectedStrategy === 'ai_extraction' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="aiPrompt">Extraction Prompt</Label>
                    <Textarea
                      id="aiPrompt"
                      rows={8}
                      placeholder="Extract the following information from the document:&#10;- Vendor name&#10;- Invoice date&#10;- Total amount"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Describe what data you want to extract
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      AI extraction uses Claude for intelligent data extraction. This is flexible but may be slower than pattern-based strategies.
                    </p>
                  </div>
                </div>
              )}

              {/* Visual Selectors for other strategies */}
              {selectedStrategy !== 'ai_extraction' && !showVisualSelector && (
                <div className="text-center py-8">
                  <Button
                    size="lg"
                    onClick={() => setShowVisualSelector(true)}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <MousePointer className="w-5 h-5 mr-2" />
                    Open Visual Selector
                  </Button>
                  <p className="text-sm text-gray-500 mt-4">
                    Click to visually select fields from your document
                  </p>
                </div>
              )}

              {visualSelections.length > 0 && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-medium mb-2">
                    <Check className="w-4 h-4 inline mr-1" />
                    {visualSelections.length} field{visualSelections.length > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xs text-green-700">
                    Click Next to map these selections to the field library
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Field Mapping */}
          {currentStep === 'mapping' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Map to Field Library</h3>
                <p className="text-gray-600 mb-6">
                  Map your {visualSelections.length} selection{visualSelections.length > 1 ? 's' : ''} to reusable fields
                </p>
              </div>

              <div className="text-center py-12 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="font-medium mb-2">Field Mapping UI - Coming Soon</p>
                <p className="text-sm">
                  This will show a split view: selections on the left, field library search on the right
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep === 'strategy') {
                onOpenChange(false);
              } else {
                const prevIndex = Math.max(0, currentStepIndex - 1);
                setCurrentStep(steps[prevIndex].id);
              }
            }}
          >
            {currentStep === 'strategy' ? 'Cancel' : 'Back'}
          </Button>

          <div className="text-sm text-gray-500">
            Step {currentStepIndex + 1} of {steps.length}
          </div>

          <Button
            onClick={() => {
              if (currentStep === 'strategy' && selectedStrategy) {
                setCurrentStep('visual');
              } else if (currentStep === 'visual') {
                if (selectedStrategy === 'ai_extraction' && aiPrompt.trim()) {
                  // AI extraction only needs prompt
                  setCurrentStep('mapping');
                } else if (visualSelections.length > 0) {
                  // Has visual selections
                  setCurrentStep('mapping');
                }
              } else if (currentStep === 'mapping') {
                // Final step - create template
                onOpenChange(false);
              }
            }}
            disabled={
              (currentStep === 'strategy' && !selectedStrategy) ||
              (currentStep === 'visual' &&
                selectedStrategy === 'ai_extraction' &&
                !aiPrompt.trim()) ||
              (currentStep === 'visual' &&
                selectedStrategy !== 'ai_extraction' &&
                visualSelections.length === 0)
            }
          >
            {currentStep === 'mapping' ? 'Create Template' : 'Next'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
      )}

      {/* Visual Selector Components - rendered directly, no Dialog wrapper needed */}
      {/* They are already full-screen with fixed positioning */}
      {showVisualSelector && selectedStrategy === 'dom_selection' && (
        <VisualDOMSelector
          artifact={artifact}
          onSave={handleVisualSelectionComplete}
          onCancel={() => setShowVisualSelector(false)}
        />
      )}

      {showVisualSelector &&
        (selectedStrategy === 'table_detection' ||
          selectedStrategy === 'ocr_text' ||
          selectedStrategy === 'key_value') && (
          <PDFVisualSelector
            artifact={artifact}
            onSave={handleVisualSelectionComplete}
            onCancel={() => setShowVisualSelector(false)}
          />
        )}
    </>
  );
}
