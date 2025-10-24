'use client';

/**
 * Artifacts Page
 *
 * Upload and manage artifact files (PDF, HTML, Email) for AI extraction
 * Based on spec section 3: Artifacts Table
 */

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, FileText, Loader2, PlayCircle, Eye, Sparkles } from 'lucide-react';
import { FileUploader } from '@/components/sources/file-uploader';
import { AIExtractor } from '@/components/extraction/ai-extractor';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';
import type { Source } from '@/types/sources';

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingSources, setLoadingSources] = useState(true);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [viewingArtifact, setViewingArtifact] = useState<Artifact | null>(null);
  const [aiExtractingArtifact, setAiExtractingArtifact] = useState<Artifact | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    if (selectedSource) {
      fetchArtifacts();
    }
  }, [selectedSource]);

  const fetchSources = async () => {
    try {
      setLoadingSources(true);
      const response = await fetch('/api/sources');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch sources');
      }

      setSources(result.data || []);

      // Auto-select first source
      if (result.data && result.data.length > 0) {
        setSelectedSource(result.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
      toast.error('Failed to load sources');
    } finally {
      setLoadingSources(false);
    }
  };

  const fetchArtifacts = async () => {
    if (!selectedSource) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/artifacts?source_id=${selectedSource}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch artifacts');
      }

      setArtifacts(result.data || []);
    } catch (error) {
      console.error('Error fetching artifacts:', error);
      toast.error('Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (artifact: Artifact) => {
    setArtifacts(prev => [artifact, ...prev]);
    toast.success('File uploaded successfully!');
  };

  const handleUploadError = (error: string) => {
    toast.error(error);
  };

  const handleExtract = async (artifactId: string) => {
    try {
      setExtracting(artifactId);
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artifact_id: artifactId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Extraction failed');
      }

      toast.success('Content extracted successfully!');

      // Update the artifact in the list
      setArtifacts(prev => prev.map(a =>
        a.id === artifactId ? result.artifact : a
      ));
    } catch (error) {
      console.error('Error extracting artifact:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to extract content');
    } finally {
      setExtracting(null);
    }
  };

  if (loadingSources) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No sources configured
              </h3>
              <p className="text-gray-500 mb-4">
                Configure a source first before uploading artifacts
              </p>
              <Button onClick={() => window.location.href = '/dashboard/sources'}>
                Go to Sources
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSource = sources.find(s => s.id === selectedSource);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Artifacts</h1>
          <p className="text-gray-500 mt-1">
            Upload and manage source files for AI extraction
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchArtifacts}
          disabled={loading || !selectedSource}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Source Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Source</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger>
              <SelectValue placeholder="Select a source" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name} ({source.source_type})
                  {source.provider && ` - ${source.provider.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* File Uploader - Only for file_upload sources */}
      {currentSource && currentSource.source_type === 'file_upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Artifacts</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploader
              sourceId={selectedSource}
              onSuccess={handleUploadSuccess}
              onError={handleUploadError}
            />
          </CardContent>
        </Card>
      )}

      {/* Info for non-upload sources */}
      {currentSource && currentSource.source_type !== 'file_upload' && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-blue-900 font-medium mb-2">
                This is a {currentSource.source_type.replace('_', ' ')} source
              </p>
              <p className="text-sm text-blue-700 mb-4">
                Artifacts from this source are synced automatically. Go to Sources page to trigger a sync.
              </p>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/dashboard/sources'}
              >
                Go to Sources
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Artifacts List */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Artifacts ({artifacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : artifacts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No artifacts uploaded yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Upload your first file using the uploader above
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {artifact.original_filename}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="uppercase">{artifact.artifact_type}</span>
                      <span>{(artifact.file_size! / 1024).toFixed(2)} KB</span>
                      {artifact.source && (
                        <span className="text-xs text-gray-400">
                          via {artifact.source.source_type}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        artifact.extraction_status === 'completed' ? 'bg-green-100 text-green-700' :
                        artifact.extraction_status === 'failed' ? 'bg-red-100 text-red-700' :
                        artifact.extraction_status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {artifact.extraction_status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {artifact.extraction_status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExtract(artifact.id)}
                        disabled={extracting === artifact.id}
                      >
                        {extracting === artifact.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <PlayCircle className="w-4 h-4 mr-2" />
                        )}
                        Extract
                      </Button>
                    )}
                    {artifact.extraction_status === 'completed' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingArtifact(artifact)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Content
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setAiExtractingArtifact(artifact)}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          AI Extract
                        </Button>
                      </>
                    )}
                    {artifact.extraction_status === 'failed' && artifact.error_message && (
                      <span className="text-xs text-red-600 max-w-xs truncate">
                        {artifact.error_message}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Content Viewer Dialog */}
      <Dialog open={!!viewingArtifact} onOpenChange={() => setViewingArtifact(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extracted Content</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              {viewingArtifact?.original_filename}
            </p>
          </DialogHeader>

          {viewingArtifact?.raw_content && (
            <div className="space-y-4 mt-4">
              {/* Metadata Section */}
              {viewingArtifact.raw_content.metadata && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-2">Metadata</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(viewingArtifact.raw_content.metadata).map(([key, value]) => (
                      <div key={key}>
                        <span className="text-gray-500">{key}: </span>
                        <span className="text-gray-900">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Structured Content (HTML only) */}
              {viewingArtifact.raw_content.structured && (
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h3 className="font-medium text-gray-900 mb-2">Structured Content</h3>

                  {viewingArtifact.raw_content.structured.headings?.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-1">Headings</h4>
                      <ul className="text-sm space-y-1">
                        {viewingArtifact.raw_content.structured.headings.slice(0, 10).map((h: any, i: number) => (
                          <li key={i} className="text-gray-600">
                            <span className="text-gray-400">{h.level}:</span> {h.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {viewingArtifact.raw_content.structured.tables?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-1">
                        Tables Found: {viewingArtifact.raw_content.structured.tables.length}
                      </h4>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Text */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Extracted Text</h3>
                  <span className="text-sm text-gray-500">
                    {viewingArtifact.raw_content.text?.length.toLocaleString()} characters
                  </span>
                </div>
                <div className="bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {viewingArtifact.raw_content.text}
                  </pre>
                </div>
              </div>

              {/* Extraction Timestamp */}
              {viewingArtifact.raw_content.extracted_at && (
                <p className="text-xs text-gray-400 text-center">
                  Extracted at: {new Date(viewingArtifact.raw_content.extracted_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Extraction Dialog */}
      <Dialog open={!!aiExtractingArtifact} onOpenChange={() => setAiExtractingArtifact(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI-Powered Data Extraction
            </DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              Use AI to extract structured data from {aiExtractingArtifact?.original_filename}
            </p>
          </DialogHeader>

          {aiExtractingArtifact && (
            <AIExtractor artifact={aiExtractingArtifact} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
