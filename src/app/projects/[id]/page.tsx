'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, FileText, FileCode, Mail, Trash2, FileBox } from 'lucide-react';
import Link from 'next/link';
import type { Project, SourceFile, Template } from '@/types/database';

export default function ProjectDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (user && projectId) {
      loadProject();
      loadFiles();
      loadTemplates();
    }
  }, [user, projectId]);

  async function loadProject() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles() {
    try {
      const { data, error } = await supabase
        .from('source_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }

  async function loadTemplates() {
    try {
      // Get all templates for files in this project
      const { data, error } = await supabase
        .from('templates')
        .select(`
          *,
          source_files!inner(project_id)
        `)
        .eq('source_files.project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setUploadError('');

    try {
      for (const file of Array.from(selectedFiles)) {
        // Determine file type
        let fileType: 'html' | 'pdf' | 'email' = 'html';
        if (file.name.endsWith('.pdf')) {
          fileType = 'pdf';
        } else if (file.name.endsWith('.eml') || file.name.endsWith('.msg')) {
          fileType = 'email';
        }

        // Upload to Supabase Storage
        const filePath = `${user!.id}/${projectId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('source-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create database record
        const { error: dbError } = await supabase
          .from('source_files')
          .insert([
            {
              project_id: projectId,
              name: file.name,
              type: fileType,
              storage_path: filePath,
              size_bytes: file.size,
              metadata: {
                content_type: file.type,
              },
            },
          ]);

        if (dbError) throw dbError;
      }

      // Reload files
      await loadFiles();
    } catch (error) {
      console.error('Error uploading files:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFile(fileId: string, storagePath: string) {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('source-files')
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('source_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;

      // Reload files
      await loadFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  }

  function getFileIcon(type: string) {
    switch (type) {
      case 'html':
        return <FileCode className="h-8 w-8 text-orange-500" />;
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'email':
        return <Mail className="h-8 w-8 text-blue-500" />;
      default:
        return <FileText className="h-8 w-8 text-gray-500" />;
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Project not found</h2>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between mt-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="text-sm text-gray-600 mt-1">{project.description}</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => router.push(`/projects/${projectId}/diagram`)}
              >
                View ER Diagram
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/entities`)}
              >
                Manage Entities
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/dimensions`)}
              >
                Dimensions
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/projects/${projectId}/facts`)}
              >
                Facts
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload Source Files</CardTitle>
            <CardDescription>
              Upload HTML, PDF, or email files to extract data from
            </CardDescription>
          </CardHeader>
          <CardContent>
            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {uploadError}
              </div>
            )}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-sm text-gray-600 mb-4">
                Drag and drop files here, or click to browse
              </p>
              <input
                type="file"
                id="file-upload"
                multiple
                accept=".html,.htm,.pdf,.eml,.msg"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <label htmlFor="file-upload">
                <Button disabled={uploading} asChild>
                  <span className="cursor-pointer">
                    {uploading ? 'Uploading...' : 'Choose Files'}
                  </span>
                </Button>
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Supported formats: HTML, PDF, EML, MSG
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Files List */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Source Files ({files.length})
          </h2>
        </div>

        {files.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No files uploaded yet
              </h3>
              <p className="text-gray-600 text-center">
                Upload your first source file to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {files.map((file) => (
              <Card
                key={file.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/projects/${projectId}/files/${file.id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getFileIcon(file.type)}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {file.name}
                        </h3>
                        <p className="text-sm text-gray-500 capitalize">{file.type}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatFileSize(file.size_bytes)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id, file.storage_path);
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Templates Section */}
        <div className="mt-12 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Extraction Templates ({templates.length})
          </h2>
        </div>

        {templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileBox className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No templates created yet
              </h3>
              <p className="text-gray-600 text-center">
                Upload a file and create extraction templates to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>
                    {Object.keys(template.field_mappings).length} fields defined
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-semibold text-gray-700">Fields:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.keys(template.field_mappings).slice(0, 5).map((fieldName) => (
                          <span
                            key={fieldName}
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800"
                          >
                            {fieldName}
                          </span>
                        ))}
                        {Object.keys(template.field_mappings).length > 5 && (
                          <span className="text-xs text-gray-500">
                            +{Object.keys(template.field_mappings).length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Created {new Date(template.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
