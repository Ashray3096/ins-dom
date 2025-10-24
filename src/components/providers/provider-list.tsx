'use client';

/**
 * Provider List Component
 *
 * Displays a grid of provider cards with actions
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Database } from 'lucide-react';
import { toast } from 'sonner';
import type { Provider } from '@/types/providers';

interface ProviderListProps {
  providers: Provider[];
  onEdit: (provider: Provider) => void;
  onDelete: (id: string) => void;
}

export function ProviderList({ providers, onEdit, onDelete }: ProviderListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (provider: Provider) => {
    if (!confirm(`Are you sure you want to delete "${provider.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(provider.id);
      onDelete(provider.id);
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast.error('Failed to delete provider');
    } finally {
      setDeletingId(null);
    }
  };

  const getCadenceBadgeColor = (cadence: string) => {
    switch (cadence) {
      case 'MONTHLY':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'QUARTERLY':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'ANNUAL':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'ADHOC':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'NABCA':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'TTB':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CUSTOM':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (providers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Database className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No providers yet
          </h3>
          <p className="text-gray-600 text-center max-w-md">
            Create your first provider to start organizing your data sources.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {providers.map((provider) => (
        <Card key={provider.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <CardTitle className="text-lg">{provider.name}</CardTitle>
                <CardDescription className="mt-1">
                  {provider.description || 'No description'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <span className={`px-2 py-1 text-xs rounded-md border ${getTypeBadgeColor(provider.type)}`}>
                {provider.type}
              </span>
              <span className={`px-2 py-1 text-xs rounded-md border ${getCadenceBadgeColor(provider.cadence)}`}>
                {provider.cadence}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Created:</span>
                <span>{new Date(provider.created_at).toLocaleDateString()}</span>
              </div>
              {provider.updated_at && provider.updated_at !== provider.created_at && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Updated:</span>
                  <span>{new Date(provider.updated_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onEdit(provider)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(provider)}
                disabled={deletingId === provider.id}
              >
                {deletingId === provider.id ? (
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
