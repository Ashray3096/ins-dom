'use client';

/**
 * PDF Visual Selector Component
 *
 * Allows users to select text regions in PDFs to build extraction templates
 * Features:
 * - Renders PDF with pdf.js
 * - Click/drag to select text regions
 * - Captures page number and bounding box coordinates
 * - Field mapping panel
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { X, Check, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { Artifact } from '@/types/artifacts';

export interface PDFFieldMapping {
  id: string;
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  pageNumber: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textContent: string;
  textPattern?: string; // For regex matching
}

interface PDFVisualSelectorProps {
  artifact: Artifact;
  onSave: (fieldMappings: PDFFieldMapping[]) => void;
  onCancel: () => void;
}

export function PDFVisualSelector({
  artifact,
  onSave,
  onCancel,
}: PDFVisualSelectorProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.5);
  const [fieldMappings, setFieldMappings] = useState<PDFFieldMapping[]>([]);
  const [currentFieldName, setCurrentFieldName] = useState('');
  const [currentFieldType, setCurrentFieldType] = useState<'string' | 'number' | 'date' | 'boolean'>('string');
  const [currentFieldRequired, setCurrentFieldRequired] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [workerReady, setWorkerReady] = useState(false);

  const pageRef = useRef<HTMLDivElement>(null);

  // Set up PDF.js worker (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use jsdelivr CDN which is more reliable for workers
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`;
      console.log('PDF.js worker configured:', pdfjs.GlobalWorkerOptions.workerSrc);
      setWorkerReady(true);
    }
  }, []);

  // Memoize file prop to prevent unnecessary reloads
  const pdfFile = useMemo(() => ({
    url: `/api/artifacts/${artifact.id}/download`,
    httpHeaders: {},
    withCredentials: false,
  }), [artifact.id]);

  // Memoize options to prevent unnecessary reloads
  const pdfOptions = useMemo(() => ({
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/standard_fonts/',
  }), []);

  // Update refs when state changes
  const currentFieldNameRef = useRef(currentFieldName);
  const currentFieldTypeRef = useRef(currentFieldType);
  const currentFieldRequiredRef = useRef(currentFieldRequired);

  useEffect(() => {
    currentFieldNameRef.current = currentFieldName;
  }, [currentFieldName]);

  useEffect(() => {
    currentFieldTypeRef.current = currentFieldType;
  }, [currentFieldType]);

  useEffect(() => {
    currentFieldRequiredRef.current = currentFieldRequired;
  }, [currentFieldRequired]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    console.log(`📄 PDF loaded: ${numPages} pages`);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentFieldName.trim()) {
      toast.error('Please enter a field name first');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionRect({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionStart) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const width = currentX - selectionStart.x;
    const height = currentY - selectionStart.y;

    setSelectionRect({
      x: width < 0 ? currentX : selectionStart.x,
      y: height < 0 ? currentY : selectionStart.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionRect || !selectionStart) return;

    // Only process if selection has meaningful size
    if (selectionRect.width < 10 || selectionRect.height < 10) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionRect(null);
      return;
    }

    // Try to extract text from the selected region
    const textContent = await extractTextFromRegion(
      currentPage,
      selectionRect.x,
      selectionRect.y,
      selectionRect.width,
      selectionRect.height
    );

    handleRegionSelected(textContent, selectionRect);

    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionRect(null);
  };

  const extractTextFromRegion = async (
    page: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<string> => {
    // Try to get text from the text layer
    const textLayer = document.querySelector('.react-pdf__Page__textContent');

    if (!textLayer) {
      return 'Selected region';
    }

    // Get all text spans in the selection area
    const textSpans = textLayer.querySelectorAll('span');
    let selectedText = '';

    textSpans.forEach((span) => {
      const spanRect = span.getBoundingClientRect();
      const pageRect = pageRef.current?.getBoundingClientRect();

      if (pageRect) {
        const spanX = spanRect.left - pageRect.left;
        const spanY = spanRect.top - pageRect.top;

        // Check if span overlaps with selection
        if (
          spanX >= x && spanX <= x + width &&
          spanY >= y && spanY <= y + height
        ) {
          selectedText += span.textContent + ' ';
        }
      }
    });

    return selectedText.trim() || 'Selected region';
  };

  const handleRegionSelected = (textContent: string, rect: { x: number; y: number; width: number; height: number }) => {
    const fieldName = currentFieldNameRef.current.trim();
    const fieldType = currentFieldTypeRef.current;
    const fieldRequired = currentFieldRequiredRef.current;

    if (!fieldName) {
      toast.error('Please enter a field name first');
      return;
    }

    setFieldMappings((prevMappings) => {
      if (prevMappings.some(f => f.name === fieldName)) {
        toast.error('Field name already exists');
        return prevMappings;
      }

      // Normalize coordinates to percentage-based for scale independence
      const pageElement = pageRef.current;
      if (!pageElement) return prevMappings;

      const pageRect = pageElement.getBoundingClientRect();
      const normalizedBox = {
        x: (rect.x / pageRect.width) * 100,
        y: (rect.y / pageRect.height) * 100,
        width: (rect.width / pageRect.width) * 100,
        height: (rect.height / pageRect.height) * 100,
      };

      const mapping: PDFFieldMapping = {
        id: Date.now().toString(),
        name: fieldName,
        type: fieldType,
        required: fieldRequired,
        pageNumber: currentPage,
        boundingBox: normalizedBox,
        textContent: textContent,
        textPattern: textContent ? `${textContent.substring(0, 20)}.*` : undefined,
      };

      console.log(`✅ Added PDF field mapping:`, mapping);
      toast.success(`Field "${mapping.name}" mapped on page ${currentPage}! (Total: ${prevMappings.length + 1})`);

      return [...prevMappings, mapping];
    });

    setCurrentFieldName('');
  };

  const removeFieldMapping = (id: string) => {
    setFieldMappings((prevMappings) => {
      const filtered = prevMappings.filter(f => f.id !== id);
      console.log(`🗑️ Removing PDF field mapping. Remaining: ${filtered.length}`);
      return filtered;
    });

    toast.info('Field mapping removed');
  };

  const handleSave = () => {
    if (fieldMappings.length === 0) {
      toast.error('Please map at least one field');
      return;
    }

    onSave(fieldMappings);
  };

  // Don't render until worker is ready
  if (!workerReady) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-gray-500">Initializing PDF viewer...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between bg-gray-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">PDF Template Builder</h2>
          <p className="text-sm text-gray-600">
            Click and drag to select text regions on the PDF
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={fieldMappings.length === 0}>
            <Check className="w-4 h-4 mr-2" />
            Save Template ({fieldMappings.length} fields)
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF Viewer */}
        <div className="flex-1 border-r overflow-auto">
          <div className="h-full flex flex-col">
            {/* PDF Controls */}
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                >
                  Next
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm">{Math.round(scale * 100)}%</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScale(s => Math.min(3, s + 0.25))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* PDF Document */}
            <div className="flex-1 overflow-auto bg-gray-100 p-4 flex justify-center">
              <div
                ref={pageRef}
                className="relative bg-white shadow-lg"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ cursor: currentFieldName ? 'crosshair' : 'default' }}
              >
                <Document
                  file={pdfFile}
                  options={pdfOptions}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={(error) => {
                    console.error('PDF Load Error:', error);
                    console.error('PDF URL:', pdfFile.url);
                    console.error('Worker src:', pdfjs.GlobalWorkerOptions.workerSrc);
                    toast.error(`Failed to load PDF: ${error.message || 'Unknown error'}`);
                  }}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <div className="text-gray-500">Loading PDF...</div>
                    </div>
                  }
                >
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={false}
                  />
                </Document>

                {/* Selection Rectangle */}
                {isSelecting && selectionRect && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-30 pointer-events-none"
                    style={{
                      left: selectionRect.x,
                      top: selectionRect.y,
                      width: selectionRect.width,
                      height: selectionRect.height,
                    }}
                  />
                )}

                {/* Show existing field mappings on current page */}
                {fieldMappings
                  .filter(m => m.pageNumber === currentPage)
                  .map((mapping) => {
                    const pageElement = pageRef.current;
                    if (!pageElement) return null;

                    const pageRect = pageElement.getBoundingClientRect();
                    const box = {
                      x: (mapping.boundingBox.x / 100) * pageRect.width,
                      y: (mapping.boundingBox.y / 100) * pageRect.height,
                      width: (mapping.boundingBox.width / 100) * pageRect.width,
                      height: (mapping.boundingBox.height / 100) * pageRect.height,
                    };

                    return (
                      <div
                        key={mapping.id}
                        className="absolute border-2 border-green-500 bg-green-100 bg-opacity-20 pointer-events-none"
                        style={{
                          left: box.x,
                          top: box.y,
                          width: box.width,
                          height: box.height,
                        }}
                      >
                        <div className="absolute -top-6 left-0 bg-green-500 text-white text-xs px-2 py-1 rounded">
                          {mapping.name}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Field Mapping Panel */}
        <div className="w-96 overflow-y-auto bg-gray-50 p-4 space-y-4">
          {/* Instructions */}
          {fieldMappings.length === 0 && (
            <Card className="p-4 bg-blue-50 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">📝 How to use:</h3>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li><strong>Enter a field name</strong> below</li>
                <li><strong>Click and drag</strong> on the PDF to select a text region</li>
                <li><strong>Repeat</strong> for all fields</li>
                <li><strong>Navigate pages</strong> if needed</li>
                <li><strong>Click "Save Template"</strong> when done</li>
              </ol>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="font-medium text-gray-900 mb-4">Add New Field</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="field-name">Field Name *</Label>
                <Input
                  id="field-name"
                  value={currentFieldName}
                  onChange={(e) => setCurrentFieldName(e.target.value)}
                  placeholder="e.g., product_name"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter a name, then drag on the PDF to select the region
                </p>
              </div>

              <div>
                <Label htmlFor="field-type">Field Type</Label>
                <Select
                  value={currentFieldType}
                  onValueChange={(v: any) => setCurrentFieldType(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="field-required"
                  checked={currentFieldRequired}
                  onChange={(e) => setCurrentFieldRequired(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="field-required" className="cursor-pointer">
                  Required field
                </Label>
              </div>

              {currentFieldName && (
                <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                  ✓ Ready! Drag on the PDF to select the region for "{currentFieldName}"
                </p>
              )}
            </div>
          </Card>

          {/* Mapped Fields */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Mapped Fields ({fieldMappings.length})</h3>
            <div className="space-y-2">
              {fieldMappings.map((mapping) => (
                <Card key={mapping.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{mapping.name}</div>
                      <div className="text-sm text-gray-600">
                        {mapping.type}
                        {mapping.required && <span className="text-red-500"> *</span>}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Page {mapping.pageNumber}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Sample: {mapping.textContent.substring(0, 50)}
                        {mapping.textContent.length > 50 && '...'}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFieldMapping(mapping.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </Card>
              ))}

              {fieldMappings.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No fields mapped yet.
                  <br />
                  Enter a field name and drag on the PDF to start.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
