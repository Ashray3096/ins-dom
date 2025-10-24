'use client';

/**
 * Providers Page
 *
 * Manage data providers (NABCA, TTB, custom sources)
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { ProviderForm } from '@/components/providers/provider-form';
import { ProviderList } from '@/components/providers/provider-list';
import { toast } from 'sonner';
import type { Provider } from '@/types/providers';

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | undefined>();

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/providers');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch providers');
      }

      setProviders(result.data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingProvider(undefined);
    setFormOpen(true);
  };

  const handleEdit = (provider: Provider) => {
    setEditingProvider(provider);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/providers/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete provider');
      }

      toast.success('Provider deleted successfully');
      fetchProviders();
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete provider');
    }
  };

  const handleFormSuccess = () => {
    fetchProviders();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Providers</h1>
          <p className="mt-2 text-gray-600">
            Manage your data providers and sources
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchProviders} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        </div>
      </div>

      {/* Provider List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading providers...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ProviderList
          providers={providers}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Info Cards - Only show when there are no providers */}
      {!loading && providers.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">NABCA</CardTitle>
              <CardDescription>National Alcoholic Beverage Control Association</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Monthly reports on distilled spirits sales across control states
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">TTB</CardTitle>
              <CardDescription>Alcohol and Tobacco Tax and Trade Bureau</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Annual data on alcohol production, imports, and tax information
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom</CardTitle>
              <CardDescription>Your own data sources</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Add any custom data provider with your own extraction templates
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provider Form Dialog */}
      <ProviderForm
        open={formOpen}
        onOpenChange={setFormOpen}
        provider={editingProvider}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
