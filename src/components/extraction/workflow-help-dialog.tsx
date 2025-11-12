'use client';

/**
 * Workflow Help Dialog
 *
 * Explains when to use Visual Builder vs AI Extract and how the cascade extraction works
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MousePointer2, Sparkles, Layers, FileText, FileCode } from 'lucide-react';

interface WorkflowHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowHelpDialog({ open, onOpenChange }: WorkflowHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extraction Workflow Guide</DialogTitle>
          <DialogDescription>
            Choose the right extraction method for your documents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overview */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Layers className="w-5 h-5" />
              How Inspector Dom Works
            </h3>
            <p className="text-sm text-blue-800">
              Inspector Dom uses a <strong>3-layer cascade extraction</strong> system that tries fast,
              cheap rules first, then falls back to AI only when needed:
            </p>
            <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside ml-2">
              <li><strong>Layer 1: Structural Rules</strong> (XPath/CSS selectors) - Instant, $0.00</li>
              <li><strong>Layer 2: Pattern Rules</strong> (Regex patterns) - Fast, $0.00</li>
              <li><strong>Layer 3: AI Fallback</strong> (Claude API) - Slow, ~$0.05</li>
            </ol>
            <p className="text-sm text-blue-800 mt-2">
              This approach achieves <strong>95-99% cost reduction</strong> on similar documents!
            </p>
          </Card>

          {/* HTML Workflow */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-orange-600" />
              For HTML Documents
            </h3>
            <div className="space-y-3">
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded">
                    <MousePointer2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">Option 1: Build Visual Template (Recommended)</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Click elements in the rendered HTML to capture precise XPath and CSS selectors.
                    </p>
                    <div className="mt-2 text-sm">
                      <strong className="text-green-600">✓ Best for:</strong>
                      <ul className="text-gray-600 ml-4 mt-1 space-y-1">
                        <li>• Documents with consistent HTML structure</li>
                        <li>• When you need the most precise selectors</li>
                        <li>• Maximum extraction speed (instant)</li>
                      </ul>
                    </div>
                    <div className="mt-2 text-sm">
                      <strong className="text-gray-600">How it works:</strong>
                      <ol className="text-gray-600 ml-4 mt-1 space-y-1 list-decimal">
                        <li>Enter field name</li>
                        <li>Enable selection mode</li>
                        <li>Click the element in the document</li>
                        <li>Repeat for all fields</li>
                        <li>Save template</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 p-2 rounded">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">Option 2: Extract Data with AI</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      AI analyzes the document and generates both structural (XPath/CSS) and pattern (regex) rules.
                    </p>
                    <div className="mt-2 text-sm">
                      <strong className="text-green-600">✓ Best for:</strong>
                      <ul className="text-gray-600 ml-4 mt-1 space-y-1">
                        <li>• Quick one-off extractions</li>
                        <li>• When document structure may vary</li>
                        <li>• Generating both structural AND pattern rules</li>
                      </ul>
                    </div>
                    <div className="mt-2 text-sm">
                      <strong className="text-amber-600">⚠️ Note:</strong>
                      <span className="text-gray-600 ml-1">
                        AI-generated XPath may be less precise than visual selection, but includes regex fallback patterns.
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-green-50 border-green-200">
                <h4 className="font-medium text-green-900">💡 Best Practice: Combine Both!</h4>
                <ol className="text-sm text-green-800 mt-2 space-y-1 list-decimal list-inside ml-2">
                  <li>Use <strong>Visual Builder</strong> to capture precise XPath/CSS selectors</li>
                  <li>Use <strong>AI Extract</strong> to generate regex pattern fallbacks</li>
                  <li>Save template with both structural + pattern rules</li>
                  <li>Future documents try: XPath → CSS → Regex → AI (only if all fail)</li>
                </ol>
              </Card>
            </div>
          </div>

          {/* PDF Workflow */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" />
              For PDF Documents
            </h3>
            <div className="space-y-3">
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 p-2 rounded">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">Extract Data with AI</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      AI analyzes PDF text/tables and generates extraction rules (table coordinates + regex patterns).
                    </p>
                    <div className="mt-2 text-sm">
                      <strong className="text-green-600">✓ Generates:</strong>
                      <ul className="text-gray-600 ml-4 mt-1 space-y-1">
                        <li>• Table detection rules (page, table index, column mappings)</li>
                        <li>• Regex patterns for form fields</li>
                        <li>• Coordinate-based extraction rules</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-amber-50 border-amber-200">
                <h4 className="font-medium text-amber-900">📋 Coming Soon: PDF Visual Selection</h4>
                <p className="text-sm text-amber-800 mt-1">
                  Visual text selection for PDFs is planned for a future update. For now, use AI extraction
                  which generates table rules and regex patterns automatically.
                </p>
              </Card>
            </div>
          </div>

          {/* Template Application */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Using Templates on New Documents</h3>
            <Card className="p-4 bg-gray-50">
              <p className="text-sm text-gray-600">
                Once you've created a template, apply it to similar documents:
              </p>
              <ol className="text-sm text-gray-600 mt-2 space-y-1 list-decimal list-inside ml-2">
                <li>Upload a new document (same format/structure)</li>
                <li>Click "Apply Template" on the document</li>
                <li>System tries extraction layers in order:
                  <ul className="ml-6 mt-1 space-y-1">
                    <li>→ Layer 1: XPath/CSS (instant, free)</li>
                    <li>→ Layer 2: Regex patterns (fast, free)</li>
                    <li>→ Layer 3: AI (only if both fail)</li>
                  </ul>
                </li>
                <li>Review and correct extracted data</li>
                <li>Corrections improve the template over time</li>
              </ol>
            </Card>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
