'use client';

/**
 * S3 Browser Modal
 *
 * Browse S3 bucket contents, navigate folders, preview files
 * Shows file count and allows sync to artifacts
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Folder, File, Loader2, RefreshCw, ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { Source } from '@/types/sources';

interface S3BrowserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Source | null;
  onSyncComplete: () => void;
}

interface S3Item {
  name: string;
  fullPath: string;
  size?: number;
  lastModified?: string;
  type: 'folder' | 'file';
}

export function S3BrowserModal({
  open,
  onOpenChange,
  source,
  onSyncComplete,
}: S3BrowserModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [folders, setFolders] = useState<S3Item[]>([]);
  const [files, setFiles] = useState<S3Item[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (open && source) {
      fetchBucketContents('');
    }
  }, [open, source]);

  const fetchBucketContents = async (prefix: string) => {
    if (!source) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        prefix,
        limit: '100',
      });

      const response = await fetch(`/api/sources/${source.id}/browse?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to browse bucket');
      }

      setCurrentPrefix(prefix);
      setFolders(result.folders || []);
      setFiles(result.files || []);
      setTotalFiles(result.totalFiles || 0);
      setHasMore(result.hasMore || false);
    } catch (error) {
      console.error('Error browsing bucket:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to browse bucket');
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderPath: string) => {
    fetchBucketContents(folderPath);
  };

  const navigateBack = () => {
    const parts = currentPrefix.split('/').filter(Boolean);
    parts.pop();
    const newPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
    fetchBucketContents(newPrefix);
  };

  const handleSync = async (dryRun: boolean = false) => {
    if (!source) return;

    try {
      setSyncing(true);

      const response = await fetch(`/api/sources/${source.id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync');
      }

      if (dryRun) {
        toast.info(
          `Preview: ${result.newFilesToSync} new files to sync, ${result.filesAlreadySynced} already synced`
        );
      } else {
        toast.success(
          `Synced ${result.filesProcessed} files! ${result.filesSkipped} already existed.`
        );
        onSyncComplete();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!source || source.source_type !== 's3_bucket') {
    return null;
  }

  const config = source.configuration as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Browse S3 Bucket</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-xs">
              <div>Bucket: <span className="font-mono">{config.bucket}</span></div>
              {config.prefix && (
                <div>Prefix: <span className="font-mono">{config.prefix}</span></div>
              )}
              {config.pattern && (
                <div>Pattern: <span className="font-mono">{config.pattern}</span></div>
              )}
              {config.test_mode && (
                <div className="text-orange-600">
                  🧪 Test mode: {config.test_limit} files max
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Navigation */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={navigateBack}
              disabled={!currentPrefix || loading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex-1 text-xs font-mono bg-gray-100 px-3 py-2 rounded">
              {currentPrefix || '/'}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchBucketContents(currentPrefix)}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Contents */}
          <div className="flex-1 border rounded-lg overflow-y-auto bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="divide-y">
                {/* Folders */}
                {folders.map((folder) => (
                  <div
                    key={folder.fullPath}
                    className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-100 cursor-pointer"
                    onClick={() => navigateToFolder(folder.fullPath)}
                  >
                    <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{folder.name}</div>
                    </div>
                  </div>
                ))}

                {/* Files */}
                {files.map((file) => (
                  <div
                    key={file.fullPath}
                    className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-100"
                  >
                    <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{file.name}</div>
                      <div className="text-xs text-gray-500">
                        {file.size !== undefined && formatFileSize(file.size)}
                        {file.lastModified && (
                          <> • {new Date(file.lastModified).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {folders.length === 0 && files.length === 0 && (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    No items found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
            <div className="flex justify-between">
              <span>{files.length} file(s) shown</span>
              {hasMore && <span className="text-blue-600">More files available...</span>}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center space-x-2">
          <div className="flex-1 text-xs text-gray-500">
            Files will be synced to Artifacts with status "completed"
          </div>
          <Button
            variant="outline"
            onClick={() => handleSync(true)}
            disabled={syncing || loading}
          >
            Preview Sync
          </Button>
          <Button
            onClick={() => handleSync(false)}
            disabled={syncing || loading || files.length === 0}
          >
            {syncing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Download className="w-4 h-4 mr-2" />
            Sync to Artifacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
