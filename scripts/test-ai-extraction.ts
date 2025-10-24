/**
 * Test script for AI-powered data extraction
 *
 * This script validates that Claude API can extract structured data from documents.
 * Run with: npx tsx scripts/test-ai-extraction.ts
 */

import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

interface ExtractionConfig {
  filePath: string;
  prompt: string;
  expectedFields: string[];
}

async function extractWithAI(config: ExtractionConfig) {
  console.log('\n🤖 Starting AI Extraction Test');
  console.log('================================\n');

  // Initialize Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }

  const anthropic = new Anthropic({ apiKey });

  // Check if file exists
  const fullPath = path.resolve(config.filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  console.log(`📄 File: ${config.filePath}`);

  // Read file and convert to base64
  const fileBuffer = fs.readFileSync(fullPath);
  const fileSize = (fileBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`📊 File size: ${fileSize} MB`);

  const base64Content = fileBuffer.toString('base64');

  // Determine media type
  const ext = path.extname(config.filePath).toLowerCase();
  const mediaType = ext === '.pdf' ? 'application/pdf' : 'text/html';

  console.log(`🎯 Media type: ${mediaType}`);
  console.log(`\n💬 User Prompt:\n"${config.prompt}"\n`);

  // Build system prompt
  const systemPrompt = `You are a data extraction assistant. Extract structured data from documents and return ONLY valid JSON.

Expected fields: ${config.expectedFields.join(', ')}

Rules:
1. Return a JSON array of objects
2. Each object must have these exact field names: ${config.expectedFields.join(', ')}
3. Extract ALL matching records from the document
4. Be precise and accurate
5. If a field is missing or unclear, use null
6. Return ONLY the JSON array, no additional text or markdown

Example output format:
[
  {"${config.expectedFields[0]}": "value1", "${config.expectedFields[1]}": "value2"},
  {"${config.expectedFields[0]}": "value3", "${config.expectedFields[1]}": "value4"}
]`;

  console.log('⏳ Calling Claude API...\n');

  const startTime = Date.now();

  try {
    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000, // Further increased - NABCA document has many records
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Content
            }
          },
          {
            type: 'text',
            text: config.prompt
          }
        ]
      }]
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ API call completed in ${duration}s\n`);

    // Parse response
    const responseText = message.content[0].text;

    console.log('📝 Raw Response:');
    console.log('─'.repeat(80));
    // Show first 1000 chars and last 500 chars if response is long
    if (responseText.length > 2000) {
      console.log(responseText.substring(0, 1000));
      console.log('\n... [response truncated for display] ...\n');
      console.log(responseText.substring(responseText.length - 500));
    } else {
      console.log(responseText);
    }
    console.log('─'.repeat(80));
    console.log('');

    // Extract JSON from response - be more flexible with parsing
    let extractedData;
    let cleanedText = responseText;

    // Remove markdown code blocks if present
    cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

    try {
      // Try to parse the entire cleaned response as JSON first
      extractedData = JSON.parse(cleanedText.trim());
    } catch {
      // If that fails, try to extract JSON array
      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        console.error('❌ No JSON array found in response');
        console.error('First 500 chars of cleaned text:', cleanedText.substring(0, 500));
        return { success: false, error: 'No JSON found' };
      }

      try {
        extractedData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError);
        console.error('Extracted text:', jsonMatch[0].substring(0, 500));
        return { success: false, error: 'JSON parse error' };
      }
    }

    // Display results
    console.log('✨ Extraction Results:');
    console.log(`   Records extracted: ${extractedData.length}`);
    console.log('');

    if (extractedData.length > 0) {
      console.log('📋 Sample Records (first 3):');
      console.log('─'.repeat(80));
      extractedData.slice(0, 3).forEach((record: any, index: number) => {
        console.log(`\nRecord ${index + 1}:`);
        Object.entries(record).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
      console.log('─'.repeat(80));
      console.log('');
    }

    // Token usage and cost
    console.log('💰 Usage & Cost:');
    console.log(`   Input tokens:  ${message.usage.input_tokens.toLocaleString()}`);
    console.log(`   Output tokens: ${message.usage.output_tokens.toLocaleString()}`);

    const inputCost = (message.usage.input_tokens * 0.003) / 1000;
    const outputCost = (message.usage.output_tokens * 0.015) / 1000;
    const totalCost = inputCost + outputCost;

    console.log(`   Estimated cost: $${totalCost.toFixed(4)}`);
    console.log('');

    // Validation
    console.log('🔍 Validation:');
    const missingFields = validateFields(extractedData, config.expectedFields);
    if (missingFields.length === 0) {
      console.log('   ✅ All expected fields present');
    } else {
      console.log(`   ⚠️  Missing fields: ${missingFields.join(', ')}`);
    }

    const accuracy = calculateAccuracy(extractedData);
    console.log(`   📊 Estimated accuracy: ${accuracy}%`);
    console.log('');

    return {
      success: true,
      data: extractedData,
      metadata: {
        recordCount: extractedData.length,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cost: totalCost,
        duration: parseFloat(duration)
      }
    };

  } catch (error) {
    console.error('❌ Error during extraction:', error);
    return { success: false, error };
  }
}

function validateFields(data: any[], expectedFields: string[]): string[] {
  if (data.length === 0) return expectedFields;

  const sampleRecord = data[0];
  const actualFields = Object.keys(sampleRecord);

  return expectedFields.filter(field => !actualFields.includes(field));
}

function calculateAccuracy(data: any[]): number {
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

function saveAsCSV(data: any[], filename: string): void {
  if (data.length === 0) {
    console.log('   ⚠️  No data to save');
    return;
  }

  // Get headers from first record
  const headers = Object.keys(data[0]);

  // Build CSV content
  const csvLines = [
    // Header row
    headers.join(','),
    // Data rows
    ...data.map(record =>
      headers.map(header => {
        const value = record[header];
        // Handle values that contain commas or quotes
        if (value === null || value === undefined) return '';
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',')
    )
  ];

  const csvContent = csvLines.join('\n');

  // Save to file
  fs.writeFileSync(filename, csvContent, 'utf-8');

  console.log(`\n💾 CSV Export:`);
  console.log(`   ✅ Saved to: ${filename}`);
  console.log(`   📊 Total rows: ${data.length}`);
  console.log(`   📋 Columns: ${headers.join(', ')}`);
}

// Main execution
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Inspector Dom - AI Extraction Test                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Example configuration
  const config: ExtractionConfig = {
    filePath: './test-data/631_9L_0725.PDF.pdf',
    prompt: `Extract ALL data from ALL tables in this document.

For each table row, extract:
- brand_name: The brand or product name
- bottle_size: The bottle size (keep original format like "1.75L", "750ml")
- case_sales_ytd: Year-to-date case sales (number)
- case_sales_12m: Rolling 12-month case sales (number)
- category: Product category if mentioned

Extract EVERY row from EVERY table. Include all brands and all size categories.
Return as a JSON array with these exact field names.`,
    expectedFields: ['brand_name', 'bottle_size', 'case_sales_ytd', 'case_sales_12m', 'category']
  };

  try {
    const result = await extractWithAI(config);

    if (result.success) {
      console.log('🎉 Test completed successfully!');

      // Save to CSV if we have data
      if (result.data && result.data.length > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const csvFilename = `./test-data/extracted_${timestamp}.csv`;
        saveAsCSV(result.data, csvFilename);
      }

      console.log('\nNext steps:');
      console.log('1. Review the extracted data above');
      console.log('2. Check the CSV file in test-data/');
      console.log('3. If accuracy is >80%, proceed to build the API');
      console.log('4. If accuracy is low, refine the prompt and try again');
    } else {
      console.log('❌ Test failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { extractWithAI };
