'use client';

/**
 * Source File List Component
 *
 * Displays list of source files with filtering and actions
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText,
  Download,
  Trash2,
  Calendar,
  Database,
  FileType as FileTypeIcon,
  HardDrive,
  AlertCircle,
  File,
  Globe,
  Mail,
  Sheet,
  type LucideIcon
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SourceFile, SourceFileStatus, SourceFileType } from '@/types/sources';

interface SourceFileListProps {
  sourceFiles: SourceFile[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

const statusColors: Record<SourceFileStatus, string> = {
  UPLOADED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-yellow-100 text-yellow-800',
  EXTRACTED: 'bg-green-100 text-green-800',
  ERROR: 'bg-red-100 text-red-800',
};

const fileTypeIcons: Record<SourceFileType, LucideIcon> = {
  PDF: File,
  HTML: Globe,
  EMAIL: Mail,
  MSG: Mail,
  CSV: Sheet,
  EXCEL: Sheet,
};

export function SourceFileList({ sourceFiles, onDelete, onRefresh }: SourceFileListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filter source files
  const filteredFiles = sourceFiles.filter((file) => {
    if (statusFilter !== 'all' && file.status !== statusFilter) return false;
    if (typeFilter !== 'all' && file.file_type !== typeFilter) return false;
    return true;
  });

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / 1024 / 1024;
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (sourceFiles.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No source files yet</h3>
          <p className="text-gray-600 text-center mb-4">
            Upload your first file to start extracting data
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="UPLOADED">Uploaded</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="EXTRACTED">Extracted</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                File Type
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="HTML">HTML</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="MSG">MSG</SelectItem>
                  <SelectItem value="CSV">CSV</SelectItem>
                  <SelectItem value="EXCEL">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredFiles.length !== sourceFiles.length && (
            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredFiles.length} of {sourceFiles.length} files
            </div>
          )}
        </CardContent>
      </Card>

      {/* File List */}
      {filteredFiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-10 w-10 text-gray-400 mb-3" />
            <p className="text-gray-600">No files match the selected filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredFiles.map((file) => {
            const Icon = fileTypeIcons[file.file_type];

            return (
              <Card key={file.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    {/* File Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Icon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{file.filename}</h3>
                          <Badge className={statusColors[file.status]}>
                            {file.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <FileTypeIcon className="h-4 w-4" />
                          <span>{file.file_type}</span>
                        </div>

                        {file.file_size && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <HardDrive className="h-4 w-4" />
                            <span>{formatFileSize(file.file_size)}</span>
                          </div>
                        )}

                        {file.provider && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Database className="h-4 w-4" />
                            <span>{file.provider.name}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      {file.source_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(file.source_url!, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteId(file.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Source File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this source file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
