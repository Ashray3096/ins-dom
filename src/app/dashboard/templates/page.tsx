'use client';

/**
 * Templates Page
 *
 * Manage extraction templates (prompts and field schemas)
 */

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { TemplateForm } from '@/components/templates/template-form';
import { TemplateList } from '@/components/templates/template-list';
import { toast } from 'sonner';
import type { Template } from '@/types/templates';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch templates');
      }

      setTemplates(result.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(undefined);
    setFormOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete template');
      }

      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete template');
    }
  };

  const handleFormSuccess = () => {
    fetchTemplates();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="mt-2 text-gray-600">
            Create and manage reusable extraction templates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTemplates} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Template List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading templates...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <TemplateList
          templates={templates}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Template Form Dialog */}
      <TemplateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editingTemplate}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
