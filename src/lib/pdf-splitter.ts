/**
 * PDF Splitter Utility
 *
 * Splits large PDFs into smaller chunks for efficient Textract processing
 */

import { PDFDocument } from 'pdf-lib';

export interface PdfChunk {
  chunkIndex: number;
  startPage: number;
  endPage: number;
  pageCount: number;
  buffer: Buffer;
}

export interface ChunkingOptions {
  chunkSize?: number; // Pages per chunk (default: 100)
  maxChunks?: number; // Maximum number of chunks to create (optional)
}

/**
 * Get the total number of pages in a PDF
 */
export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  return pdfDoc.getPageCount();
}

/**
 * Extract a specific page range from a PDF
 */
export async function extractPdfPages(
  pdfBuffer: Buffer,
  startPage: number, // 1-indexed
  endPage: number     // 1-indexed (inclusive)
): Promise<Buffer> {
  const sourcePdf = await PDFDocument.load(pdfBuffer);
  const totalPages = sourcePdf.getPageCount();

  // Validate page range
  if (startPage < 1 || endPage > totalPages) {
    throw new Error(
      `Invalid page range: ${startPage}-${endPage}. PDF has ${totalPages} pages.`
    );
  }

  if (startPage > endPage) {
    throw new Error(
      `Start page (${startPage}) cannot be greater than end page (${endPage})`
    );
  }

  // Create new PDF with extracted pages
  const newPdf = await PDFDocument.create();

  // Copy pages (convert to 0-indexed)
  for (let i = startPage - 1; i < endPage; i++) {
    const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
    newPdf.addPage(copiedPage);
  }

  // Return as Buffer
  const pdfBytes = await newPdf.save();
  return Buffer.from(pdfBytes);
}

/**
 * Split a PDF into chunks for processing
 */
export async function splitPdfIntoChunks(
  pdfBuffer: Buffer,
  options: ChunkingOptions = {}
): Promise<PdfChunk[]> {
  const { chunkSize = 100, maxChunks } = options;

  const totalPages = await getPdfPageCount(pdfBuffer);
  console.log(`📄 PDF has ${totalPages} pages. Splitting into chunks of ${chunkSize} pages...`);

  const chunks: PdfChunk[] = [];
  let chunkIndex = 0;
  let startPage = 1;

  while (startPage <= totalPages) {
    // Check if we've reached max chunks
    if (maxChunks && chunkIndex >= maxChunks) {
      console.log(`⚠️ Reached max chunks limit (${maxChunks})`);
      break;
    }

    const endPage = Math.min(startPage + chunkSize - 1, totalPages);
    const pageCount = endPage - startPage + 1;

    console.log(`  Creating chunk ${chunkIndex + 1}: pages ${startPage}-${endPage} (${pageCount} pages)`);

    const buffer = await extractPdfPages(pdfBuffer, startPage, endPage);

    chunks.push({
      chunkIndex,
      startPage,
      endPage,
      pageCount,
      buffer,
    });

    startPage = endPage + 1;
    chunkIndex++;
  }

  console.log(`✅ Created ${chunks.length} chunks`);
  return chunks;
}

/**
 * Calculate optimal chunk size based on total pages and constraints
 */
export function calculateOptimalChunkSize(
  totalPages: number,
  options: {
    maxChunkSize?: number;     // Max pages per chunk (default: 150)
    minChunkSize?: number;     // Min pages per chunk (default: 50)
    targetChunks?: number;     // Preferred number of chunks
    maxProcessingTime?: number; // Max processing time per chunk in seconds
  } = {}
): number {
  const {
    maxChunkSize = 150,
    minChunkSize = 50,
    targetChunks = 10,
  } = options;

  // Try to create target number of chunks
  let chunkSize = Math.ceil(totalPages / targetChunks);

  // Clamp to min/max
  chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, chunkSize));

  console.log(`📊 Optimal chunk size: ${chunkSize} pages (${Math.ceil(totalPages / chunkSize)} chunks)`);
  return chunkSize;
}
