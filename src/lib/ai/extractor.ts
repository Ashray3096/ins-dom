/**
 * AI Extraction Functions
 *
 * Main extraction logic using Claude API with error handling and retry
 * Based on spec section 7: AI Extraction Implementation Guide
 */

import { getAnthropicClient, DEFAULT_MODEL, DEFAULT_MAX_TOKENS, calculateCost } from './client';
import { buildSystemPrompt, buildUserPrompt, type FieldSchema } from './prompt-builder';

export interface ExtractionOptions {
  artifactType: 'pdf' | 'html' | 'text';
  content: string | Buffer; // Base64 for PDF, text for HTML/text
  userPrompt: string;
  fields: FieldSchema[];
  examples?: Array<Record<string, any>>;
  rules?: string[];
  maxRetries?: number;
  retryDelay?: number; // milliseconds
}

export interface ExtractionResult {
  success: boolean;
  data: Array<Record<string, any>>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  metadata: {
    model: string;
    duration: number; // milliseconds
    retries: number;
  };
  error?: string;
  rawResponse?: string;
}

/**
 * Extract structured data from artifact using AI
 */
export async function extractWithAI(
  options: ExtractionOptions
): Promise<ExtractionResult> {
  const {
    artifactType,
    content,
    userPrompt,
    fields,
    examples,
    rules,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  const startTime = Date.now();
  let retries = 0;
  let lastError: Error | null = null;

  // Build prompts
  const systemPrompt = buildSystemPrompt({ fields });
  const enhancedUserPrompt = buildUserPrompt({ userPrompt, examples, rules, fields });

  while (retries < maxRetries) {
    try {
      const client = getAnthropicClient();

      // Prepare content based on artifact type
      const messageContent = prepareMessageContent(artifactType, content, enhancedUserPrompt);

      // Call Claude API
      const message = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: messageContent,
          },
        ],
      });

      // Parse response
      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      const extractedData = parseJSONFromResponse(responseText);

      // Calculate cost and duration
      const duration = Date.now() - startTime;
      const estimatedCost = calculateCost(
        message.usage.input_tokens,
        message.usage.output_tokens
      );

      return {
        success: true,
        data: extractedData,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          totalTokens: message.usage.input_tokens + message.usage.output_tokens,
          estimatedCost,
        },
        metadata: {
          model: DEFAULT_MODEL,
          duration,
          retries,
        },
        rawResponse: responseText,
      };

    } catch (error) {
      lastError = error as Error;
      retries++;

      console.error(`Extraction attempt ${retries} failed:`, error);

      // If we have retries left, wait and try again
      if (retries < maxRetries) {
        await sleep(retryDelay * retries); // Exponential backoff
        continue;
      }

      // All retries exhausted
      break;
    }
  }

  // Return error result
  return {
    success: false,
    data: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    metadata: {
      model: DEFAULT_MODEL,
      duration: Date.now() - startTime,
      retries,
    },
    error: lastError?.message || 'Unknown error occurred',
  };
}

/**
 * Prepare message content based on artifact type
 */
function prepareMessageContent(
  artifactType: 'pdf' | 'html' | 'text',
  content: string | Buffer,
  userPrompt: string
): Array<any> {
  if (artifactType === 'pdf') {
    // Content should be base64 string for PDF
    const base64Content = Buffer.isBuffer(content)
      ? content.toString('base64')
      : content;

    return [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Content,
        },
      },
      {
        type: 'text',
        text: userPrompt,
      },
    ];
  } else {
    // For HTML and text, send as text
    const textContent = Buffer.isBuffer(content)
      ? content.toString('utf-8')
      : content;

    return [
      {
        type: 'text',
        text: `${userPrompt}\n\nContent:\n${textContent}`,
      },
    ];
  }
}

/**
 * Parse JSON array from Claude's response
 */
function parseJSONFromResponse(responseText: string): Array<Record<string, any>> {
  try {
    // Try to find JSON array in response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Ensure it's an array
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    // If no array found or invalid format, return empty array
    console.warn('No valid JSON array found in response:', responseText.substring(0, 200));
    return [];

  } catch (error) {
    console.error('Error parsing JSON from response:', error);
    return [];
  }
}

/**
 * Validate extracted data against schema
 */
export function validateExtractedData(
  data: Array<Record<string, any>>,
  fields: FieldSchema[]
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data) || data.length === 0) {
    errors.push('No data extracted or data is not an array');
    return { valid: false, errors, warnings };
  }

  // Check each record
  data.forEach((record, index) => {
    // Check required fields
    fields.forEach(field => {
      if (field.required && (record[field.name] === undefined || record[field.name] === null)) {
        errors.push(`Record ${index}: Missing required field "${field.name}"`);
      }

      // Type validation
      if (record[field.name] !== undefined && record[field.name] !== null) {
        const value = record[field.name];
        const actualType = typeof value;

        if (field.type === 'number' && actualType !== 'number') {
          warnings.push(`Record ${index}: Field "${field.name}" should be number, got ${actualType}`);
        }
        if (field.type === 'string' && actualType !== 'string') {
          warnings.push(`Record ${index}: Field "${field.name}" should be string, got ${actualType}`);
        }
        if (field.type === 'boolean' && actualType !== 'boolean') {
          warnings.push(`Record ${index}: Field "${field.name}" should be boolean, got ${actualType}`);
        }
      }
    });

    // Check for unexpected fields
    const expectedFieldNames = fields.map(f => f.name);
    const actualFieldNames = Object.keys(record);
    const unexpectedFields = actualFieldNames.filter(name => !expectedFieldNames.includes(name));

    if (unexpectedFields.length > 0) {
      warnings.push(`Record ${index}: Unexpected fields: ${unexpectedFields.join(', ')}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate data quality score based on completeness
 */
export function calculateAccuracy(data: Array<Record<string, any>>): number {
  if (data.length === 0) return 0;

  let totalFields = 0;
  let nonNullFields = 0;

  data.forEach(record => {
    Object.values(record).forEach(value => {
      totalFields++;
      if (value !== null && value !== undefined && value !== '') {
        nonNullFields++;
      }
    });
  });

  return Math.round((nonNullFields / totalFields) * 100);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract with caching support
 */
export async function extractWithCaching(
  options: ExtractionOptions,
  cacheKey: string,
  getCache: (key: string) => Promise<ExtractionResult | null>,
  setCache: (key: string, result: ExtractionResult) => Promise<void>
): Promise<ExtractionResult> {
  // Check cache first
  const cached = await getCache(cacheKey);

  if (cached) {
    console.log('Using cached extraction - $0.00');
    return {
      ...cached,
      metadata: {
        ...cached.metadata,
        cached: true,
      },
    } as any;
  }

  // No cache, perform extraction
  const result = await extractWithAI(options);

  // Cache successful results
  if (result.success) {
    await setCache(cacheKey, result);
  }

  return result;
}

/**
 * Batch extraction for multiple artifacts
 */
export async function extractBatch(
  artifacts: Array<{ id: string; options: ExtractionOptions }>,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, ExtractionResult>> {
  const results = new Map<string, ExtractionResult>();
  let completed = 0;

  for (const artifact of artifacts) {
    const result = await extractWithAI(artifact.options);
    results.set(artifact.id, result);

    completed++;
    if (onProgress) {
      onProgress(completed, artifacts.length);
    }
  }

  return results;
}
