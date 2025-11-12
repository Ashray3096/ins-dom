'use client';

/**
 * PDF Selector Component
 *
 * Renders PDF with text layer selection
 * Allows clicking on text elements to select them
 */

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { Artifact } from '@/types/artifacts';
import type { FieldSelection } from './dom-selector';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfSelectorProps {
  artifact: Artifact;
  isSelecting: boolean;
  selections: FieldSelection[];
  onElementSelected: (selection: Omit<FieldSelection, 'id' | 'fieldName' | 'fieldType' | 'required'>) => void;
}

export function PdfSelector({
  artifact,
  isSelecting,
  selections,
  onElementSelected
}: PdfSelectorProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [selectedText, setSelectedText] = useState<string>('');

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  /**
   * Handle text selection in PDF
   */
  const handleTextSelection = useCallback(() => {
    if (!isSelecting) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const text = selection.toString().trim();
    if (!text) return;

    setSelectedText(text);

    // Get the range
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    // Find the parent element
    const element = container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : container as Element;

    if (!element) return;

    // Generate a selector based on PDF position
    // For PDFs, we use a combination of page number + text content
    const cssSelector = `page[data-page-number="${pageNumber}"] .textLayer`;
    const xpath = `//*[@data-page-number="${pageNumber}"]//span[contains(text(), "${text.substring(0, 50)}")]`;

    // Create selection object
    onElementSelected({
      cssSelector,
      xpath,
      sampleValue: text,
      elementInfo: {
        tagName: 'span',
        className: 'textLayer',
        id: `page_${pageNumber}`
      }
    });

    // Clear selection
    selection.removeAllRanges();
  }, [isSelecting, pageNumber, onElementSelected]);

  /**
   * Add custom styles for PDF text layer selection
   */
  const customTextRenderer = useCallback((textItem: any) => {
    return textItem.str;
  }, []);

  const fileUrl = artifact.metadata?.public_url;

  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-96 border rounded-lg bg-gray-50">
        <p className="text-gray-500">PDF file not available</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="border rounded-lg overflow-hidden bg-gray-50" style={{ height: '70vh' }}>
        {/* PDF Document */}
        <div
          className="overflow-auto h-full"
          onMouseUp={handleTextSelection}
          style={{ userSelect: isSelecting ? 'text' : 'none' }}
        >
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            }
            error={
              <div className="flex items-center justify-center h-full">
                <p className="text-red-600">Failed to load PDF</p>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              width={700}
              customTextRenderer={customTextRenderer}
            />
          </Document>
        </div>

        {/* Page Navigation */}
        {numPages > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white border rounded-lg shadow-lg px-4 py-2 flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="text-sm font-medium">
              Page {pageNumber} of {numPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Selection Mode Indicator */}
      {isSelecting && (
        <div className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-10">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-sm font-medium">Select text with your cursor</span>
        </div>
      )}

      {/* Selection Count */}
      {selections.length > 0 && (
        <div className="absolute top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-10">
          <span className="text-sm font-medium">
            {selections.length} field{selections.length !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}

      {/* Show selected text temporarily */}
      {selectedText && (
        <div className="absolute bottom-20 left-4 right-4 bg-green-100 border-2 border-green-400 rounded-lg p-3 shadow-lg z-10">
          <p className="text-xs text-green-800 font-medium mb-1">Selected Text:</p>
          <p className="text-sm text-green-900 font-mono">
            {selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}
          </p>
        </div>
      )}

      {/* CSS for text layer selection styling */}
      <style jsx global>{`
        .react-pdf__Page__textContent {
          user-select: ${isSelecting ? 'text' : 'none'};
        }

        .react-pdf__Page__textContent span {
          cursor: ${isSelecting ? 'text' : 'default'};
        }

        .react-pdf__Page__textContent span:hover {
          background-color: ${isSelecting ? 'rgba(59, 130, 246, 0.2)' : 'transparent'};
        }

        ::selection {
          background-color: rgba(16, 185, 129, 0.4);
          color: inherit;
        }
      `}</style>
    </div>
  );
}
