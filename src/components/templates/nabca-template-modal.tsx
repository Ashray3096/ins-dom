'use client';

/**
 * NABCA Template Generation Modal
 *
 * One-click setup for NABCA multi-entity extraction:
 * - Creates 8 entities with field schemas
 * - Creates 1 multi-entity template with table identification patterns
 * - No PDF processing, just configuration setup
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';

interface NabcaTemplateModalProps {
  artifact: Artifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (templateId: string) => void;
}

export function NabcaTemplateModal({
  artifact,
  open,
  onOpenChange,
  onSuccess,
}: NabcaTemplateModalProps) {
  const [templateName, setTemplateName] = useState('NABCA Template');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      console.log('🚀 Starting NABCA multi-entity template setup...');
      console.log('Template name:', templateName);

      const response = await fetch('/api/templates/generate-nabca-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: templateName.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate template');
      }

      console.log('✅ Template setup successful:', result);

      toast.success(
        `Template "${templateName}" created successfully!\n` +
        `${result.entities.created.length} entities created, ${result.entities.existing.length} already existed`
      );

      // Call success callback
      if (onSuccess && result.template?.id) {
        onSuccess(result.template.id);
      }

      // Close modal after short delay
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 1500);

    } catch (error) {
      console.error('❌ Error setting up NABCA template:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      toast.error(error instanceof Error ? error.message : 'Failed to generate template');
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    setTemplateName('NABCA Template');
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!generating) {
        onOpenChange(open);
        if (!open) resetForm();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-600" />
            Generate NABCA Template
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            {artifact?.original_filename}
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Enter template name"
              disabled={generating}
            />
          </div>

          {/* Loading Indicator */}
          {generating && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-3 text-sm text-gray-700">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Setting up template and entities...</span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900 mb-1">Generation Failed</h4>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          {!generating && !error && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">What this creates:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 8 NABCA entities (Brand Leaders, Current Month, YTD, etc.)</li>
                <li>• 1 multi-entity template with table identification patterns</li>
                <li>• Configured field schemas for all 8 tables</li>
                <li>• Ready to use with pipeline generation</li>
                <li>• No PDF processing - just configuration setup</li>
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !templateName.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Template
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
