'use client';

/**
 * Sources Management Page
 *
 * Per spec section 3: Sources define WHERE data comes from
 * Configure URL, S3, API, and File Upload sources
 */

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, RefreshCw, Settings, Trash2, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SourceCreateModal } from '@/components/sources/source-create-modal';
import type { Source } from '@/types/sources';

interface Provider {
  id: string;
  name: string;
  type: string;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    fetchSources();
  }, [selectedProvider]);

  const fetchProviders = async () => {
    try {
      setLoadingProviders(true);
      const response = await fetch('/api/providers');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch providers');
      }

      setProviders(result.data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast.error('Failed to load providers');
    } finally {
      setLoadingProviders(false);
    }
  };

  const fetchSources = async () => {
    try {
      setLoading(true);
      const url =
        selectedProvider === 'all'
          ? '/api/sources'
          : `/api/sources?provider_id=${selectedProvider}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch sources');
      }

      setSources(result.data || []);
    } catch (error) {
      console.error('Error fetching sources:', error);
      toast.error('Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  const getSourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      url: 'URL',
      s3_bucket: 'S3 Bucket',
      api: 'API',
      file_upload: 'File Upload',
    };
    return labels[type] || type;
  };

  const getSourceTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      url: 'bg-blue-100 text-blue-700',
      s3_bucket: 'bg-purple-100 text-purple-700',
      api: 'bg-green-100 text-green-700',
      file_upload: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const renderConfiguration = (source: Source) => {
    const config = source.configuration as any;

    switch (source.source_type) {
      case 'url':
        return <span className="text-sm text-gray-600">{config.url}</span>;

      case 's3_bucket':
        return (
          <div className="text-sm text-gray-600">
            <div>
              Bucket: <code className="bg-gray-100 px-1 rounded">{config.bucket}</code>
            </div>
            {config.prefix && <div>Prefix: {config.prefix}</div>}
            {config.test_mode && (
              <div className="text-orange-600 font-medium mt-1">
                🧪 Test Mode: {config.test_limit || 10} files
              </div>
            )}
          </div>
        );

      case 'api':
        return (
          <div className="text-sm text-gray-600">
            <div>{config.endpoint}</div>
            {config.method && <div>Method: {config.method}</div>}
          </div>
        );

      case 'file_upload':
        return (
          <span className="text-sm text-gray-600">Manual upload ({config.upload_type})</span>
        );

      default:
        return null;
    }
  };

  if (loadingProviders) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No providers found
              </h3>
              <p className="text-gray-500 mb-4">
                Create a provider first before configuring sources
              </p>
              <Button onClick={() => (window.location.href = '/dashboard/providers')}>
                Go to Providers
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sources</h1>
          <p className="text-gray-500 mt-1">
            Configure where data comes from (URL, S3, API, File Upload)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSources} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Source
          </Button>
        </div>
      </div>

      {/* Provider Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger>
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {providers.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name} ({provider.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Sources List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Sources ({sources.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No sources configured yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Create your first source to start collecting data
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900">{source.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getSourceTypeBadge(
                          source.source_type
                        )}`}
                      >
                        {getSourceTypeLabel(source.source_type)}
                      </span>
                      {!source.is_active && (
                        <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                          Inactive
                        </span>
                      )}
                    </div>

                    {source.provider && (
                      <div className="text-sm text-gray-500 mb-2">
                        Provider: {source.provider.name}
                      </div>
                    )}

                    {renderConfiguration(source)}

                    {source.last_sync_at && (
                      <div className="text-xs text-gray-400 mt-2">
                        Last synced:{' '}
                        {new Date(source.last_sync_at).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info('Sync functionality coming next!')}
                    >
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info('Edit functionality coming next!')}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info('Delete functionality coming next!')}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="text-blue-600 mt-0.5">ℹ️</div>
            <div className="text-sm text-blue-900">
              <strong>What are Sources?</strong>
              <p className="mt-1 text-blue-800">
                Sources define WHERE and HOW data is collected. Configure S3 buckets
                (with test mode), URLs, APIs, or manual file uploads. Each source
                belongs to a provider and can have multiple artifacts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Source Modal */}
      <SourceCreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        providers={providers}
        onSuccess={fetchSources}
      />
    </div>
  );
}
