'use client';

/**
 * AI Extractor Component
 *
 * Allows users to extract structured data from artifacts using AI
 * Based on spec section 4, Flow 2: AI-Powered Extraction
 */

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Artifact } from '@/types/artifacts';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface AIExtractorProps {
  artifact: Artifact;
}

interface ExtractionResult {
  success: boolean;
  data?: Record<string, any>[];
  fields?: string[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    estimated_cost: string;
  };
  error?: string;
}

export function AIExtractor({ artifact }: AIExtractorProps) {
  const [instructions, setInstructions] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);

  const handleExtract = async () => {
    if (!instructions.trim()) {
      toast.error('Please provide extraction instructions');
      return;
    }

    if (!artifact.raw_content) {
      toast.error('Artifact content not extracted yet. Please extract content first.');
      return;
    }

    try {
      setExtracting(true);
      setResult(null);

      const response = await fetch('/api/ai-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifact_id: artifact.id,
          instructions: instructions.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI extraction failed');
      }

      setResult(data);
      toast.success('Data extracted successfully!');
    } catch (error) {
      console.error('AI extraction error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to extract data');
    } finally {
      setExtracting(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const fileUrl = artifact.metadata?.public_url;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column - Preview */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Document Preview</CardTitle>
            <p className="text-sm text-gray-500">{artifact.original_filename}</p>
          </CardHeader>
          <CardContent>
            {artifact.artifact_type === 'pdf' && fileUrl ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden bg-gray-50">
                  <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center h-96">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                      </div>
                    }
                    error={
                      <div className="flex items-center justify-center h-96">
                        <p className="text-red-600">Failed to load PDF</p>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={pageNumber}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      width={500}
                    />
                  </Document>
                </div>

                {numPages > 1 && (
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                      disabled={pageNumber <= 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {pageNumber} of {numPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                      disabled={pageNumber >= numPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            ) : artifact.artifact_type === 'html' && artifact.raw_content?.text ? (
              <div className="border rounded-lg p-4 bg-gray-50 max-h-[600px] overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: artifact.raw_content.text.substring(0, 5000) }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 border rounded-lg bg-gray-50">
                <p className="text-gray-500">Preview not available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Extraction */}
      <div className="space-y-4">
        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Extraction Instructions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                What data do you want to extract?
              </label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Example: Extract all invoice line items with columns: description, quantity, unit price, and total amount. Each row should be a separate product or service."
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                Be specific about the fields you want and their format. The AI will analyze the document
                and extract structured data based on your instructions.
              </p>
            </div>

            <Button
              onClick={handleExtract}
              disabled={extracting || !instructions.trim()}
              className="w-full"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Extracting with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Extract with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && result.success && (
          <>
            {/* Token Usage */}
            {result.usage && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Input Tokens</p>
                      <p className="font-semibold text-gray-900">
                        {result.usage.input_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Output Tokens</p>
                      <p className="font-semibold text-gray-900">
                        {result.usage.output_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Tokens</p>
                      <p className="font-semibold text-gray-900">
                        {result.usage.total_tokens.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Estimated Cost</p>
                      <p className="font-semibold text-green-700">
                        ${result.usage.estimated_cost}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Extracted Data Table */}
            <Card>
              <CardHeader>
                <CardTitle>Extracted Data ({result.data?.length || 0} rows)</CardTitle>
              </CardHeader>
              <CardContent>
                {result.data && result.data.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          {result.fields?.map((field) => (
                            <th
                              key={field}
                              className="text-left p-3 font-medium text-gray-700"
                            >
                              {field}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b hover:bg-gray-50">
                            {result.fields?.map((field) => (
                              <td key={`${rowIndex}-${field}`} className="p-3 text-gray-900">
                                {row[field] !== undefined && row[field] !== null
                                  ? String(row[field])
                                  : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No data extracted</p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Error Display */}
        {result && !result.success && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <p className="text-red-900 font-medium mb-2">Extraction Failed</p>
              <p className="text-red-700 text-sm">{result.error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
