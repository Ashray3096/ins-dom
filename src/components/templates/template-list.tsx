'use client';

/**
 * Template List Component
 *
 * Displays a grid of template cards with actions
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Wand2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { Template } from '@/types/templates';

interface TemplateListProps {
  templates: Template[];
  onEdit: (template: Template) => void;
  onDelete: (id: string) => void;
}

export function TemplateList({ templates, onEdit, onDelete }: TemplateListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (template: Template) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(template.id);
      onDelete(template.id);
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'DRAFT':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'ARCHIVED':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Wand2 className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No templates yet
          </h3>
          <p className="text-gray-600 text-center max-w-md">
            Create your first extraction template to define how AI should extract data from your documents.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {templates.map((template) => (
        <Card key={template.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <CardDescription className="mt-1">
                  {template.description || 'No description'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <span className={`px-2 py-1 text-xs rounded-md border ${getStatusBadgeColor(template.status)}`}>
                {template.status}
              </span>
              <span className="px-2 py-1 text-xs rounded-md border bg-blue-50 text-blue-700 border-blue-200">
                v{template.version}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                <span>{template.fields?.length || 0} fields</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Created:</span>
                <span>{new Date(template.created_at).toLocaleDateString()}</span>
              </div>
              {template.updated_at && template.updated_at !== template.created_at && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Updated:</span>
                  <span>{new Date(template.updated_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {template.prompt && (
              <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Prompt preview:</p>
                <p className="text-xs font-mono text-gray-700 line-clamp-3">
                  {template.prompt}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onEdit(template)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(template)}
                disabled={deletingId === template.id}
              >
                {deletingId === template.id ? (
                  '...'
                ) : (
                  <Trash2 className="h-4 w-4 text-red-600" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
