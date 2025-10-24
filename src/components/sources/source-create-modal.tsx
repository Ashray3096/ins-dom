'use client';

/**
 * Source Creation Modal
 *
 * Modal form for creating new source configurations
 * Supports: URL, S3 (with test mode), API, File Upload
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SourceType, SourceCreateData } from '@/types/sources';

interface SourceCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Array<{ id: string; name: string; type: string }>;
  onSuccess: () => void;
}

export function SourceCreateModal({
  open,
  onOpenChange,
  providers,
  onSuccess,
}: SourceCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('file_upload');

  // URL configuration
  const [url, setUrl] = useState('');

  // S3 configuration
  const [bucket, setBucket] = useState('');
  const [prefix, setPrefix] = useState('');
  const [pattern, setPattern] = useState('*.pdf');
  const [testMode, setTestMode] = useState(false);
  const [testLimit, setTestLimit] = useState(10);
  const [region, setRegion] = useState('');

  // API configuration
  const [endpoint, setEndpoint] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'api_key'>('none');
  const [authToken, setAuthToken] = useState('');

  const resetForm = () => {
    setProviderId('');
    setName('');
    setSourceType('file_upload');
    setUrl('');
    setBucket('');
    setPrefix('');
    setPattern('*.pdf');
    setTestMode(false);
    setTestLimit(10);
    setRegion('');
    setEndpoint('');
    setMethod('GET');
    setAuthType('none');
    setAuthToken('');
  };

  const buildConfiguration = () => {
    switch (sourceType) {
      case 'url':
        return { url };

      case 's3_bucket':
        return {
          bucket,
          prefix,
          pattern,
          test_mode: testMode,
          test_limit: testMode ? testLimit : undefined,
          region: region || undefined,
        };

      case 'api':
        return {
          endpoint,
          method,
          auth_type: authType,
          auth_token: authType !== 'none' ? authToken : undefined,
        };

      case 'file_upload':
        return { upload_type: 'manual' };

      default:
        return {};
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!providerId) {
      toast.error('Please select a provider');
      return;
    }

    if (!name) {
      toast.error('Please enter a source name');
      return;
    }

    // Validate based on source type
    if (sourceType === 'url' && !url) {
      toast.error('Please enter a URL');
      return;
    }

    if (sourceType === 's3_bucket' && !bucket) {
      toast.error('Please enter a bucket name');
      return;
    }

    if (sourceType === 'api' && !endpoint) {
      toast.error('Please enter an API endpoint');
      return;
    }

    try {
      setLoading(true);

      const data: SourceCreateData = {
        provider_id: providerId,
        name,
        source_type: sourceType,
        configuration: buildConfiguration(),
        is_active: true,
      };

      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create source');
      }

      toast.success('Source created successfully!');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating source:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create source');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Source</DialogTitle>
          <DialogDescription>
            Configure where and how data will be collected
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label htmlFor="provider">Provider *</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} ({provider.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Source Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NABCA PDFs - Test Mode"
            />
          </div>

          {/* Source Type */}
          <div className="space-y-2">
            <Label htmlFor="sourceType">Source Type *</Label>
            <Select
              value={sourceType}
              onValueChange={(value) => setSourceType(value as SourceType)}
            >
              <SelectTrigger id="sourceType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="file_upload">File Upload (Manual)</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="s3_bucket">S3 Bucket</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Configuration based on source type */}
          {sourceType === 'url' && (
            <div className="space-y-2">
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/data.pdf"
              />
            </div>
          )}

          {sourceType === 's3_bucket' && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium text-sm">S3 Configuration</h4>

              <div className="space-y-2">
                <Label htmlFor="bucket">Bucket Name *</Label>
                <Input
                  id="bucket"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  placeholder="my-data-bucket"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prefix">Prefix (Optional)</Label>
                <Input
                  id="prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="data/nabca/"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pattern">File Pattern</Label>
                <Input
                  id="pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="*.pdf"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Region (Optional)</Label>
                <Input
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="us-east-1"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="testMode"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="testMode" className="font-normal">
                  Enable Test Mode (process limited files first)
                </Label>
              </div>

              {testMode && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="testLimit">Test Limit (number of files)</Label>
                  <Input
                    id="testLimit"
                    type="number"
                    min="1"
                    max="100"
                    value={testLimit}
                    onChange={(e) => setTestLimit(parseInt(e.target.value) || 10)}
                  />
                  <p className="text-xs text-orange-600">
                    🧪 Will process only {testLimit} files for testing
                  </p>
                </div>
              )}
            </div>
          )}

          {sourceType === 'api' && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium text-sm">API Configuration</h4>

              <div className="space-y-2">
                <Label htmlFor="endpoint">Endpoint *</Label>
                <Input
                  id="endpoint"
                  type="url"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://api.example.com/data"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">Method</Label>
                <Select
                  value={method}
                  onValueChange={(value) => setMethod(value as 'GET' | 'POST')}
                >
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="authType">Authentication</Label>
                <Select
                  value={authType}
                  onValueChange={(value) =>
                    setAuthType(value as 'none' | 'bearer' | 'api_key')
                  }
                >
                  <SelectTrigger id="authType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {authType !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="authToken">
                    {authType === 'bearer' ? 'Bearer Token' : 'API Key'} *
                  </Label>
                  <Input
                    id="authToken"
                    type="password"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="Enter token or key"
                  />
                </div>
              )}
            </div>
          )}

          {sourceType === 'file_upload' && (
            <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
              <p className="text-sm text-blue-900">
                📁 This source allows manual file uploads through the Artifacts page.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Source
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
