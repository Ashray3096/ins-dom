'use client';

/**
 * Save Template Dialog Component
 *
 * Proper UI dialog for saving extraction templates
 * Replaces browser prompt() with professional form
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save, X } from 'lucide-react';

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string) => void;
  correctionStats?: {
    correctedFields: number;
    correctedRows: number;
  };
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  onSave,
  correctionStats,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      // Reset form
      setName('');
      setDescription('');
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Create a reusable template from this extraction. The template will include AI-generated rules
            and your corrections for improved accuracy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="template-name"
              placeholder="e.g., TTB Form 5100.31 Extractor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Template Description */}
          <div className="space-y-2">
            <Label htmlFor="template-description">
              Description <span className="text-gray-400 text-sm">(optional)</span>
            </Label>
            <Textarea
              id="template-description"
              placeholder="What does this template extract? When should it be used?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={3}
            />
          </div>

          {/* Correction Stats */}
          {correctionStats && correctionStats.correctedFields > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                <strong>Corrections included:</strong> {correctionStats.correctedFields} field
                {correctionStats.correctedFields !== 1 ? 's' : ''} across{' '}
                {correctionStats.correctedRows} row
                {correctionStats.correctedRows !== 1 ? 's' : ''} will be saved to improve
                extraction accuracy.
              </p>
            </div>
          )}

          {/* Info about what gets saved */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-gray-700">
              <strong>What gets saved:</strong>
            </p>
            <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc list-inside">
              <li>AI extraction instructions</li>
              <li>Field schema and types</li>
              <li>XPath/CSS selectors (for fast extraction)</li>
              <li>Regex patterns (for flexible extraction)</li>
              <li>Your corrections (for learning)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
