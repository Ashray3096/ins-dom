'use client';

/**
 * Source File Upload Component
 *
 * Handles file uploads with drag-and-drop support
 */

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { SourceFileType } from '@/types/sources';

interface SourceFileUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Provider {
  id: string;
  name: string;
  type: string;
}

export function SourceFileUpload({ open, onOpenChange, onSuccess }: SourceFileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<SourceFileType>('PDF');
  const [providerId, setProviderId] = useState<string>('none');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Load providers when dialog opens
  const handleOpenChange = useCallback(async (isOpen: boolean) => {
    onOpenChange(isOpen);

    if (isOpen && providers.length === 0) {
      try {
        setLoadingProviders(true);
        const response = await fetch('/api/providers');
        const result = await response.json();

        if (response.ok) {
          setProviders(result.data || []);
        }
      } catch (error) {
        console.error('Error loading providers:', error);
      } finally {
        setLoadingProviders(false);
      }
    }

    // Reset form when closing
    if (!isOpen) {
      setFile(null);
      setFileType('PDF');
      setProviderId('none');
    }
  }, [onOpenChange, providers.length]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const uploadedFile = acceptedFiles[0];
      setFile(uploadedFile);

      // Auto-detect file type
      const extension = uploadedFile.name.split('.').pop()?.toUpperCase();
      if (extension === 'PDF') setFileType('PDF');
      else if (extension === 'HTML' || extension === 'HTM') setFileType('HTML');
      else if (extension === 'MSG') setFileType('MSG');
      else if (extension === 'EML') setFileType('EMAIL');
      else if (extension === 'CSV') setFileType('CSV');
      else if (extension === 'XLS' || extension === 'XLSX') setFileType('EXCEL');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'text/html': ['.html', '.htm'],
      'application/vnd.ms-outlook': ['.msg'],
      'message/rfc822': ['.eml'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
  });

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    try {
      setUploading(true);

      // If no provider selected, create or get "Manual Uploads" provider
      let actualProviderId = providerId;
      if (providerId === 'none') {
        // Check if "Manual Uploads" provider exists
        const providerResponse = await fetch('/api/providers?type=CUSTOM');
        const providerResult = await providerResponse.json();

        let manualProvider = providerResult.data?.find((p: any) =>
          p.name === 'Manual Uploads' && p.type === 'CUSTOM'
        );

        // Create "Manual Uploads" provider if it doesn't exist
        if (!manualProvider) {
          const createProviderResponse = await fetch('/api/providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Manual Uploads',
              type: 'CUSTOM',
              description: 'Default provider for manually uploaded files',
              cadence: 'ADHOC',
            }),
          });

          const createResult = await createProviderResponse.json();
          if (!createProviderResponse.ok) {
            throw new Error(createResult.error || 'Failed to create default provider');
          }
          manualProvider = createResult.data;
        }

        actualProviderId = manualProvider.id;
      }

      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from('source-files')
        .upload(fileName, file);

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('source-files')
        .getPublicUrl(fileName);

      // Create source file record
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: actualProviderId,
          filename: file.name,
          file_type: fileType,
          file_size: file.size,
          storage_path: fileName,
          source_url: publicUrl,
          metadata: {
            original_name: file.name,
            mime_type: file.type,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create source file record');
      }

      toast.success('File uploaded successfully!');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Source File</DialogTitle>
          <DialogDescription>
            Upload a document for data extraction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Drop Zone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
            `}
          >
            <input {...getInputProps()} />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  {isDragActive ? 'Drop file here' : 'Drag & drop a file here'}
                </p>
                <p className="text-sm text-gray-500">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">
                  Supports PDF, HTML, MSG, EML, CSV, Excel
                </p>
              </div>
            )}
          </div>

          {/* File Type */}
          <div>
            <Label htmlFor="file-type">File Type</Label>
            <Select value={fileType} onValueChange={(value) => setFileType(value as SourceFileType)}>
              <SelectTrigger id="file-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="HTML">HTML</SelectItem>
                <SelectItem value="EMAIL">Email (EML)</SelectItem>
                <SelectItem value="MSG">Outlook Message (MSG)</SelectItem>
                <SelectItem value="CSV">CSV</SelectItem>
                <SelectItem value="EXCEL">Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Provider */}
          <div>
            <Label htmlFor="provider">Provider</Label>
            <Select value={providerId} onValueChange={setProviderId} disabled={loadingProviders}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Manual Upload (no specific provider)</SelectItem>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} ({provider.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Files without a specific provider will be assigned to "Manual Uploads"
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
