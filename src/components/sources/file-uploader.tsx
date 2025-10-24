/**
 * File Uploader Component
 *
 * Drag-and-drop file uploader for artifact files (PDF, HTML)
 * Based on spec requirements: Support PDF and HTML files (max 10MB)
 */

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatFileSize, validateFile, UPLOAD_CONSTRAINTS } from '@/lib/storage/upload';
import type { Artifact } from '@/types/artifacts';

export interface FileUploaderProps {
  sourceId: string;
  onSuccess?: (artifact: Artifact) => void;
  onError?: (error: string) => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  artifact?: Artifact;
}

export function FileUploader({ sourceId, onSuccess, onError }: FileUploaderProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setError(null);

      // Validate and prepare files for upload
      const validatedFiles = acceptedFiles.map(file => {
        const validation = validateFile(file);
        return {
          file,
          progress: 0,
          status: validation.valid ? ('uploading' as const) : ('error' as const),
          error: validation.error,
        };
      });

      setUploadingFiles(prev => [...prev, ...validatedFiles]);

      // Upload valid files
      for (const uploadFile of validatedFiles) {
        if (uploadFile.status === 'uploading') {
          await uploadSingleFile(uploadFile.file);
        }
      }
    },
    [sourceId]
  );

  const uploadSingleFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sourceId', sourceId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update file status to success
      setUploadingFiles(prev =>
        prev.map(f =>
          f.file === file
            ? { ...f, progress: 100, status: 'success', artifact: result.artifact }
            : f
        )
      );

      // Call success callback
      if (onSuccess && result.artifact) {
        onSuccess(result.artifact);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      // Update file status to error
      setUploadingFiles(prev =>
        prev.map(f =>
          f.file === file ? { ...f, status: 'error', error: errorMessage } : f
        )
      );

      // Call error callback
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const removeFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/html': ['.html', '.htm'],
      'message/rfc822': ['.eml'],
      'application/vnd.ms-outlook': ['.msg'],
    },
    maxSize: UPLOAD_CONSTRAINTS.MAX_FILE_SIZE,
    multiple: true,
  });

  const hasActiveUploads = uploadingFiles.some(f => f.status === 'uploading');

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <Card
        {...getRootProps()}
        className={`
          relative p-8 border-2 border-dashed transition-colors cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${hasActiveUploads ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-gray-400" />
          </div>

          {isDragActive ? (
            <p className="text-lg font-medium text-blue-600">Drop files here...</p>
          ) : (
            <>
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Drag and drop files here
                </p>
                <p className="text-sm text-gray-500 mt-1">or click to browse</p>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>Supported formats: PDF, HTML, Email (.eml, .msg)</p>
                <p>Maximum file size: {formatFileSize(UPLOAD_CONSTRAINTS.MAX_FILE_SIZE)}</p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Progress List */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {hasActiveUploads ? 'Uploading...' : 'Upload Complete'}
          </h4>

          {uploadingFiles.map((uploadFile, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-start gap-3">
                {/* File Icon / Status Icon */}
                <div className="flex-shrink-0">
                  {uploadFile.status === 'uploading' && (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                  {uploadFile.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {uploadFile.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadFile.file)}
                      className="flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <p className="text-xs text-gray-500 mt-1">
                    {formatFileSize(uploadFile.file.size)}
                  </p>

                  {/* Progress Bar */}
                  {uploadFile.status === 'uploading' && (
                    <Progress value={uploadFile.progress} className="mt-2 h-1" />
                  )}

                  {/* Error Message */}
                  {uploadFile.status === 'error' && uploadFile.error && (
                    <p className="text-xs text-red-600 mt-2">{uploadFile.error}</p>
                  )}

                  {/* Success Message */}
                  {uploadFile.status === 'success' && (
                    <p className="text-xs text-green-600 mt-2">
                      Upload complete
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
