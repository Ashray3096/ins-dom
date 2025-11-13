'use client';

/**
 * Template Save Modal Component
 *
 * Modal dialog for entering template name and description
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface TemplateSaveModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
  defaultName?: string;
  fieldCount: number;
}

export function TemplateSaveModal({
  open,
  onClose,
  onSave,
  defaultName = '',
  fieldCount,
}: TemplateSaveModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      onClose();
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setName(defaultName);
      setDescription('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save Template</DialogTitle>
          <DialogDescription>
            Save your template with {fieldCount} field{fieldCount !== 1 ? 's' : ''} for future use
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Product Data Extraction"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">
              Description <span className="text-gray-400 text-sm">(optional)</span>
            </Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template extracts and when to use it..."
              rows={3}
              disabled={saving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
