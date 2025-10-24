'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MousePointer, Save } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { SourceFile } from '@/types/database';
import { ParsedEmail, parseEmailFromText } from '@/lib/emailParser';

// Dynamically import PdfViewer to avoid SSR issues
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading PDF viewer...</p>
      </div>
    </div>
  ),
});

// Dynamically import EmailViewer
const EmailViewer = dynamic(() => import('@/components/EmailViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Loading email viewer...</p>
      </div>
    </div>
  ),
});

export default function FileViewerPage() {
  const { user } = useAuth();
  const params = useParams();
  const projectId = params.id as string;
  const fileId = params.fileId as string;
  const router = useRouter();

  const [file, setFile] = useState<SourceFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [emailData, setEmailData] = useState<ParsedEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedElements, setSelectedElements] = useState<Array<{
    xpath: string;
    text: string;
    tagName: string;
    pageNumber?: number; // For PDF selections
  }>>([]);

  useEffect(() => {
    if (user && fileId) {
      loadFile();
    }
  }, [user, fileId]);

  async function loadFile() {
    try {
      // Load file metadata
      const { data: fileData, error: fileError } = await supabase
        .from('source_files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (fileError) throw fileError;
      setFile(fileData);

      if (fileData.type === 'pdf') {
        // For PDF files, get the public URL
        const { data: urlData, error: urlError } = await supabase.storage
          .from('source-files')
          .createSignedUrl(fileData.storage_path, 3600); // 1 hour expiry

        console.log('PDF signed URL result:', { urlData, urlError, storage_path: fileData.storage_path });

        if (urlData) {
          setFileUrl(urlData.signedUrl);
          console.log('PDF URL set:', urlData.signedUrl);
        } else if (urlError) {
          console.error('Error creating signed URL:', urlError);
        }
      } else if (fileData.type === 'email') {
        // Download and parse email file
        const { data: contentData, error: contentError } = await supabase.storage
          .from('source-files')
          .download(fileData.storage_path);

        if (contentError) throw contentError;

        // Determine if it's .eml or .msg from filename
        const isEml = fileData.name.toLowerCase().endsWith('.eml');

        if (isEml) {
          // Parse .eml file (text-based)
          const content = await contentData.text();
          const parsed = await parseEmailFromText(content, 'eml');
          setEmailData(parsed);
        } else {
          // For .msg files, we'd need binary parsing
          // For now, show a message that .msg parsing requires binary data
          console.error('.msg files require binary parsing from File object');
          setEmailData({
            subject: 'Error',
            text: 'MSG file parsing is not yet supported for uploaded files. Please use EML format.',
          });
        }
      } else {
        // Download file content from storage (for HTML)
        const { data: contentData, error: contentError } = await supabase.storage
          .from('source-files')
          .download(fileData.storage_path);

        if (contentError) throw contentError;

        const content = await contentData.text();
        setFileContent(content);
      }
    } catch (error) {
      console.error('Error loading file:', error);
    } finally {
      setLoading(false);
    }
  }

  function getXPath(element: HTMLElement): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    if (element === document.body) {
      return '/html/body';
    }

    let ix = 0;
    const siblings = element.parentNode?.children;
    if (siblings) {
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === element) {
          const parentPath = element.parentElement ? getXPath(element.parentElement) : '';
          return `${parentPath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
        }
        if (sibling.tagName === element.tagName) {
          ix++;
        }
      }
    }
    return '';
  }

  function handleElementClick(e: React.MouseEvent<HTMLIFrameElement>) {
    if (!selectionMode) return;

    const iframe = e.currentTarget;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    iframeDoc.addEventListener('click', (event: MouseEvent) => {
      if (!selectionMode) return;

      event.preventDefault();
      event.stopPropagation();

      const target = event.target as HTMLElement;
      if (!target) return;

      // Get XPath
      const xpath = getXPath(target);
      const text = target.textContent?.trim() || '';
      const tagName = target.tagName.toLowerCase();

      // Highlight the element
      target.style.outline = '2px solid #3b82f6';
      target.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';

      // Add to selected elements
      setSelectedElements(prev => [
        ...prev,
        { xpath, text: text.substring(0, 100), tagName }
      ]);
    });
  }

  useEffect(() => {
    if (file?.type === 'html' && fileContent) {
      const iframe = document.getElementById('html-viewer') as HTMLIFrameElement;
      if (iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(fileContent);
          iframeDoc.close();

          // Add hover effects
          if (selectionMode) {
            const style = iframeDoc.createElement('style');
            style.textContent = `
              * {
                cursor: pointer !important;
              }
              *:hover {
                outline: 2px dashed #3b82f6 !important;
                background-color: rgba(59, 130, 246, 0.05) !important;
              }
            `;
            iframeDoc.head.appendChild(style);
          }
        }
      }
    }
  }, [file, fileContent, selectionMode]);

  function toggleSelectionMode() {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      // Clear selections
      setSelectedElements([]);
    }
  }

  function handleTextSelection() {
    if (!selectionMode || (file?.type !== 'pdf' && file?.type !== 'email')) return;

    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') {
      alert('Please select some text first');
      return;
    }

    const selectedText = selection.toString().trim();

    // For PDFs and emails, we use a simplified identifier since we don't have XPath
    // Store the text and context for matching during extraction
    const tagName = file.type === 'pdf' ? 'pdf-text' : 'email-text';

    setSelectedElements(prev => [
      ...prev,
      {
        xpath: `${tagName}-${Date.now()}`, // Unique identifier
        text: selectedText,
        tagName: tagName,
        pageNumber: undefined
      }
    ]);

    // Clear the selection after capturing
    selection.removeAllRanges();
  }

  function handleSaveTemplate() {
    // Store selected elements in session storage for template page
    sessionStorage.setItem('selectedElements', JSON.stringify(selectedElements));
    router.push(`/projects/${projectId}/files/${fileId}/template`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading file...</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">File not found</h2>
          <Link href={`/projects/${projectId}`}>
            <Button>Back to Project</Button>
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
            href={`/projects/${projectId}`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Link>
          <div className="flex items-center justify-between mt-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{file.name}</h1>
              <p className="text-sm text-gray-600 mt-1 capitalize">{file.type} File</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={selectionMode ? 'default' : 'outline'}
                onClick={toggleSelectionMode}
              >
                <MousePointer className="h-4 w-4 mr-2" />
                {selectionMode ? 'Selection Mode Active' : 'Enable Selection'}
              </Button>
              {selectionMode && (file.type === 'pdf' || file.type === 'email') && (
                <Button variant="secondary" onClick={handleTextSelection}>
                  Capture Selection
                </Button>
              )}
              {selectedElements.length > 0 && (
                <Button onClick={handleSaveTemplate}>
                  <Save className="h-4 w-4 mr-2" />
                  Create Template ({selectedElements.length})
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Viewer */}
          <div className="lg:col-span-2">
            <Card className="h-[calc(100vh-250px)]">
              <CardHeader>
                <CardTitle>Document Preview</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)]">
                {file.type === 'html' ? (
                  <iframe
                    id="html-viewer"
                    className="w-full h-full border border-gray-200 rounded"
                    sandbox="allow-same-origin"
                    onClick={handleElementClick}
                  />
                ) : file.type === 'pdf' ? (
                  fileUrl ? (
                    <PdfViewer fileUrl={fileUrl} />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-100 rounded">
                      <p className="text-gray-600">Loading PDF...</p>
                    </div>
                  )
                ) : file.type === 'email' ? (
                  emailData ? (
                    <EmailViewer emailData={emailData} />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-100 rounded">
                      <p className="text-gray-600">Loading email...</p>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-100 rounded">
                    <p className="text-gray-600">
                      Unsupported file type: {file.type}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Selected Elements Panel */}
          <div className="lg:col-span-1">
            <Card className="h-[calc(100vh-250px)]">
              <CardHeader>
                <CardTitle>Selected Elements</CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto h-[calc(100%-80px)]">
                {selectedElements.length === 0 ? (
                  <div className="text-center py-8">
                    <MousePointer className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm text-gray-600">
                      {selectionMode
                        ? file.type === 'pdf' || file.type === 'email'
                          ? `Select text in the ${file.type === 'pdf' ? 'PDF' : 'email'}, then click "Capture Selection"`
                          : 'Click on elements in the document to select them'
                        : 'Enable selection mode to start selecting elements'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedElements.map((element, index) => (
                      <div
                        key={index}
                        className="p-3 border border-gray-200 rounded-lg bg-blue-50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-mono bg-blue-100 px-2 py-1 rounded">
                            {element.tagName}
                          </span>
                          <button
                            onClick={() =>
                              setSelectedElements(prev =>
                                prev.filter((_, i) => i !== index)
                              )
                            }
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                        <p className="text-xs text-gray-700 mb-2 line-clamp-2">
                          {element.text}
                        </p>
                        <p className="text-xs text-gray-500 font-mono break-all">
                          {element.xpath}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
