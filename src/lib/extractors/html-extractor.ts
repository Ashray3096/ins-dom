/**
 * HTML Extractor
 *
 * Extracts text content and metadata from HTML files
 * Uses cheerio library
 */

import * as cheerio from 'cheerio';

export interface HTMLExtractionResult {
  success: boolean;
  text?: string;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    keywords?: string[];
    headers?: string[];
    links?: number;
    images?: number;
  };
  structuredContent?: {
    headings: Array<{ level: string; text: string }>;
    paragraphs: string[];
    lists: string[];
    tables: Array<{ headers: string[]; rows: string[][] }>;
  };
  error?: string;
}

/**
 * Extract text and metadata from HTML content
 */
export async function extractHTML(html: string): Promise<HTMLExtractionResult> {
  try {
    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script').remove();
    $('style').remove();

    // Extract metadata
    const metadata = {
      title: $('title').text() || $('meta[property="og:title"]').attr('content'),
      description:
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content'),
      author: $('meta[name="author"]').attr('content'),
      keywords: $('meta[name="keywords"]')
        .attr('content')
        ?.split(',')
        .map((k) => k.trim()),
      headers: $('h1, h2, h3, h4, h5, h6')
        .map((i, el) => $(el).text().trim())
        .get(),
      links: $('a').length,
      images: $('img').length,
    };

    // Extract structured content
    const structuredContent = {
      headings: $('h1, h2, h3, h4, h5, h6')
        .map((i, el) => ({
          level: el.tagName,
          text: $(el).text().trim(),
        }))
        .get(),

      paragraphs: $('p')
        .map((i, el) => $(el).text().trim())
        .get()
        .filter((p) => p.length > 0),

      lists: $('ul, ol')
        .map((i, el) => {
          const items = $(el)
            .find('li')
            .map((j, li) => $(li).text().trim())
            .get();
          return items.join('\n- ');
        })
        .get(),

      tables: $('table')
        .map((i, table) => {
          const headers = $(table)
            .find('thead th, thead td')
            .map((j, el) => $(el).text().trim())
            .get();

          const rows = $(table)
            .find('tbody tr')
            .map((j, row) => {
              return $(row)
                .find('td, th')
                .map((k, cell) => $(cell).text().trim())
                .get();
            })
            .get();

          return { headers, rows };
        })
        .get(),
    };

    // Extract clean text content
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    if (!text || text.length === 0) {
      return {
        success: false,
        error: 'HTML appears to be empty or contains no extractable text',
      };
    }

    return {
      success: true,
      text,
      metadata,
      structuredContent,
    };
  } catch (error) {
    console.error('HTML extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract HTML content',
    };
  }
}

/**
 * Extract text from specific selectors
 */
export async function extractHTMLBySelector(
  html: string,
  selector: string
): Promise<HTMLExtractionResult> {
  try {
    const $ = cheerio.load(html);

    const elements = $(selector);

    if (elements.length === 0) {
      return {
        success: false,
        error: `No elements found matching selector: ${selector}`,
      };
    }

    const text = elements.text().replace(/\s+/g, ' ').trim();

    return {
      success: true,
      text,
      metadata: {
        title: $('title').text(),
      },
    };
  } catch (error) {
    console.error('HTML selector extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract HTML by selector',
    };
  }
}

/**
 * Extract tables from HTML
 */
export async function extractHTMLTables(html: string): Promise<{
  success: boolean;
  tables?: Array<{ headers: string[]; rows: string[][] }>;
  error?: string;
}> {
  try {
    const $ = cheerio.load(html);

    const tables = $('table')
      .map((i, table) => {
        const headers = $(table)
          .find('thead th, thead td')
          .map((j, el) => $(el).text().trim())
          .get();

        const rows = $(table)
          .find('tbody tr')
          .map((j, row) => {
            return $(row)
              .find('td, th')
              .map((k, cell) => $(cell).text().trim())
              .get();
          })
          .get();

        return { headers, rows };
      })
      .get();

    if (tables.length === 0) {
      return {
        success: false,
        error: 'No tables found in HTML',
      };
    }

    return {
      success: true,
      tables,
    };
  } catch (error) {
    console.error('HTML table extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract tables from HTML',
    };
  }
}

/**
 * Extract links from HTML
 */
export async function extractHTMLLinks(html: string): Promise<{
  success: boolean;
  links?: Array<{ text: string; href: string; title?: string }>;
  error?: string;
}> {
  try {
    const $ = cheerio.load(html);

    const links = $('a')
      .map((i, el) => ({
        text: $(el).text().trim(),
        href: $(el).attr('href') || '',
        title: $(el).attr('title'),
      }))
      .get()
      .filter((link) => link.href.length > 0);

    return {
      success: true,
      links,
    };
  } catch (error) {
    console.error('HTML link extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract links from HTML',
    };
  }
}
