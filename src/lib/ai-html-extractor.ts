/**
 * AI-Based HTML Field Extractor
 *
 * Uses Claude to extract field values from HTML documents
 * Fully generic - works with any template and any HTML format
 */

import Anthropic from '@anthropic-ai/sdk';

interface ExtractorConfig {
  html: string;
  fieldNames: string[];
  selectors: any; // Template selectors for context
}

/**
 * Extract field values from HTML using AI
 *
 * @param config - HTML content, field names, and template selectors
 * @returns Record of field names to extracted values
 */
export async function extractFieldsWithAI(config: ExtractorConfig): Promise<Record<string, string | null>> {
  const { html, fieldNames, selectors } = config;

  // Build field descriptions from template metadata
  const fieldDescriptions = fieldNames.map(fieldName => {
    const field = selectors?.fields?.[fieldName];
    const sampleValue = field?.structural?.sampleValue || '';
    const checkboxConfig = field?.checkboxConfig;

    let description = `- ${fieldName}`;

    if (checkboxConfig?.isCheckboxGroup) {
      const options = checkboxConfig.allOptions?.join(', ') || '';
      description += `: Checkbox or radio field. Options: [${options}]. Extract ONLY the checked option.`;
    } else {
      description += `: Text field`;
    }

    if (sampleValue) {
      description += ` (example from template: "${sampleValue}")`;
    }

    return description;
  }).join('\n');

  // Build prompt
  const prompt = `Extract the following fields from this HTML document:

${fieldDescriptions}

Important instructions:
- For checkbox/radio fields, extract ONLY the checked option (not all options)
- Return exact field names as specified above
- If a field is not found or empty, use null
- Extract clean text values (no extra HTML markup)

HTML Document:
${html.substring(0, 20000)}

Return ONLY a JSON object with the field values. No explanation needed.

Format:
{
  "field_name": "extracted value",
  ...
}`;

  try {
    // Initialize Anthropic client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Extract JSON from response
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const text = content.text;

    // Parse JSON (handle markdown code blocks if present)
    let jsonText = text;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      jsonText = jsonMatch[1] || jsonMatch[0];
    }

    const result = JSON.parse(jsonText);

    console.log('AI extraction successful:', {
      fieldsRequested: fieldNames.length,
      fieldsExtracted: Object.keys(result).length,
      fieldsWithValues: Object.values(result).filter(v => v !== null).length
    });

    return result;

  } catch (error) {
    console.error('AI extraction error:', error);
    throw new Error(`AI extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
