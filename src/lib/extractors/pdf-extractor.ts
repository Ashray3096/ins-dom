/**
 * PDF Extractor
 *
 * Extracts text content and metadata from PDF files
 * Uses pdf2json library (pure JavaScript, no native dependencies)
 */

export interface PDFExtractionResult {
  success: boolean;
  text?: string;
  metadata?: {
    pages: number;
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  error?: string;
}

/**
 * Extract text and metadata from a PDF buffer
 */
export async function extractPDF(buffer: Buffer): Promise<PDFExtractionResult> {
  try {
    const PDFParser = require('pdf2json');
    const pdfParser = new PDFParser();

    return new Promise((resolve) => {
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('PDF parsing error:', errData);
        resolve({
          success: false,
          error: errData.parserError || 'Failed to parse PDF',
        });
      });

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          // Extract text from all pages
          let text = '';
          if (pdfData.Pages) {
            pdfData.Pages.forEach((page: any) => {
              if (page.Texts) {
                page.Texts.forEach((textItem: any) => {
                  if (textItem.R) {
                    textItem.R.forEach((run: any) => {
                      if (run.T) {
                        try {
                          text += decodeURIComponent(run.T) + ' ';
                        } catch (e) {
                          // If decoding fails, use the raw text
                          text += run.T + ' ';
                        }
                      }
                    });
                  }
                });
                text += '\n';
              }
            });
          }

          // Extract metadata
          const metadata = {
            pages: pdfData.Pages?.length || 0,
            title: pdfData.Meta?.Title || undefined,
            author: pdfData.Meta?.Author || undefined,
            subject: pdfData.Meta?.Subject || undefined,
            creator: pdfData.Meta?.Creator || undefined,
            producer: pdfData.Meta?.Producer || undefined,
            creationDate: pdfData.Meta?.CreationDate || undefined,
            modificationDate: pdfData.Meta?.ModDate || undefined,
          };

          // Basic validation
          if (!text || text.trim().length === 0) {
            resolve({
              success: false,
              error: 'PDF appears to be empty or contains no extractable text',
            });
            return;
          }

          resolve({
            success: true,
            text: text.trim(),
            metadata,
          });
        } catch (error) {
          console.error('PDF data processing error:', error);
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process PDF data',
          });
        }
      });

      // Parse the PDF buffer
      pdfParser.parseBuffer(buffer);
    });
  } catch (error) {
    console.error('PDF extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract PDF content',
    };
  }
}

/**
 * Extract text from specific pages of a PDF
 */
export async function extractPDFPages(
  buffer: Buffer,
  startPage: number,
  endPage?: number
): Promise<PDFExtractionResult> {
  try {
    const result = await extractPDF(buffer);

    if (!result.success || !result.text) {
      return result;
    }

    // Split by pages (simple approach - each \n represents a page break)
    const pages = result.text.split('\n').filter(p => p.trim().length > 0);
    const end = endPage || startPage;
    const selectedPages = pages.slice(startPage - 1, end);
    const text = selectedPages.join('\n');

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: 'No text found in specified pages',
      };
    }

    return {
      success: true,
      text,
      metadata: {
        pages: selectedPages.length,
      },
    };
  } catch (error) {
    console.error('PDF page extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract PDF pages',
    };
  }
}

/**
 * Check if PDF is extractable (not a scanned image PDF)
 */
export async function isPDFExtractable(buffer: Buffer): Promise<boolean> {
  try {
    const result = await extractPDF(buffer);
    return result.success && !!result.text && result.text.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get PDF metadata only (no text extraction)
 */
export async function getPDFMetadata(buffer: Buffer): Promise<{
  success: boolean;
  metadata?: PDFExtractionResult['metadata'];
  error?: string;
}> {
  try {
    const result = await extractPDF(buffer);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      metadata: result.metadata,
    };
  } catch (error) {
    console.error('PDF metadata extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract PDF metadata',
    };
  }
}
