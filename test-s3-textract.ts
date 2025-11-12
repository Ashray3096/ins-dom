/**
 * Test S3-based Textract Async API
 *
 * This script:
 * 1. Lists files in s3://nabca-data/raw-pdfs/
 * 2. Picks one file
 * 3. Processes with Textract async API
 * 4. Analyzes results
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import {
  TextractClient,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  FeatureType,
  Block
} from '@aws-sdk/client-textract';
import { extractTables, extractKeyValuePairs, extractTextBlocks } from './src/lib/textract-client';

// Initialize clients
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const textractClient = new TextractClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function listS3Files(bucket: string, prefix: string) {
  console.log(`📂 Listing files in s3://${bucket}/${prefix}`);

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: 10,
  });

  const response = await s3Client.send(command);
  return response.Contents || [];
}

async function processWithTextract(bucket: string, key: string) {
  console.log(`\n🚀 Starting Textract async job for s3://${bucket}/${key}`);

  // Start async job
  const startCommand = new StartDocumentAnalysisCommand({
    DocumentLocation: {
      S3Object: {
        Bucket: bucket,
        Name: key,
      },
    },
    FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS],
  });

  const startResponse = await textractClient.send(startCommand);
  const jobId = startResponse.JobId!;
  console.log(`✅ Job started: ${jobId}`);

  // Poll for completion
  let status = 'IN_PROGRESS';
  let blocks: Block[] = [];
  let pages = 0;
  const startTime = Date.now();

  while (status === 'IN_PROGRESS') {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds

    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏳ Polling job status... (${elapsedTime}s elapsed)`);

    const getCommand = new GetDocumentAnalysisCommand({ JobId: jobId });
    const getResponse = await textractClient.send(getCommand);

    status = getResponse.JobStatus!;
    console.log(`   Status: ${status}`);

    if (status === 'SUCCEEDED') {
      // Collect all blocks
      if (getResponse.Blocks) {
        blocks.push(...getResponse.Blocks);
      }
      pages = getResponse.DocumentMetadata?.Pages || 0;

      // Handle pagination
      let nextToken = getResponse.NextToken;
      while (nextToken) {
        console.log(`   Fetching next page of results...`);
        const nextCommand = new GetDocumentAnalysisCommand({
          JobId: jobId,
          NextToken: nextToken
        });
        const nextResponse = await textractClient.send(nextCommand);

        if (nextResponse.Blocks) {
          blocks.push(...nextResponse.Blocks);
        }
        nextToken = nextResponse.NextToken;
      }

      console.log(`✅ Job completed! Found ${blocks.length} blocks across ${pages} pages`);
      break;
    } else if (status === 'FAILED') {
      throw new Error(`Textract job failed: ${getResponse.StatusMessage}`);
    }

    // Safety timeout after 20 minutes
    if (elapsedTime > 1200) {
      throw new Error('Job timed out after 20 minutes');
    }
  }

  return { blocks, pages };
}

async function analyzeResults(blocks: Block[], pages: number) {
  console.log(`\n📊 Analyzing Textract Results:`);
  console.log(`   Total Blocks: ${blocks.length}`);
  console.log(`   Total Pages: ${pages}`);

  // Extract structured data
  const tables = extractTables(blocks);
  const keyValuePairs = extractKeyValuePairs(blocks);
  const textBlocks = extractTextBlocks(blocks);

  console.log(`\n✅ Extraction Summary:`);
  console.log(`   Tables: ${tables.length}`);
  console.log(`   Key-Value Pairs: ${keyValuePairs.length}`);
  console.log(`   Text Blocks: ${textBlocks.length}`);

  // Show sample of first table
  if (tables.length > 0) {
    console.log(`\n📋 Sample: First Table (Table 0)`);
    const firstTable = tables[0];
    console.log(`   Size: ${firstTable.rows} rows × ${firstTable.columns} columns`);
    console.log(`   Page: ${firstTable.page}`);
    console.log(`   Data (first 5 rows):`);
    firstTable.data.slice(0, 5).forEach((row, idx) => {
      console.log(`     Row ${idx}: [${row.slice(0, 5).join(' | ')}${row.length > 5 ? ' | ...' : ''}]`);
    });
  }

  // Show sample of key-value pairs
  if (keyValuePairs.length > 0) {
    console.log(`\n🔑 Sample: First 10 Key-Value Pairs`);
    keyValuePairs.slice(0, 10).forEach((pair, idx) => {
      console.log(`   ${idx}. "${pair.key}" = "${pair.value}" (confidence: ${pair.confidence.toFixed(1)}%)`);
    });
  }

  // Show text sample
  if (textBlocks.length > 0) {
    const lineBlocks = textBlocks.filter(b => b.blockType === 'LINE').slice(0, 20);
    console.log(`\n📝 Sample: First 20 Text Lines`);
    lineBlocks.forEach((block, idx) => {
      console.log(`   ${idx}. [Page ${block.page}] ${block.text}`);
    });
  }

  return { tables, keyValuePairs, textBlocks };
}

async function main() {
  try {
    console.log('🧪 Testing S3-based Textract Async API\n');

    // Step 1: List files
    const files = await listS3Files('nabca-data', 'raw-pdfs/');

    if (files.length === 0) {
      console.log('❌ No files found in bucket');
      return;
    }

    console.log(`\n📁 Found ${files.length} files:`);
    files.forEach((file, idx) => {
      const sizeKB = Math.round((file.Size || 0) / 1024);
      console.log(`   ${idx + 1}. ${file.Key} (${sizeKB} KB)`);
    });

    // Step 2: Pick the first PDF
    const selectedFile = files[0];
    console.log(`\n✨ Selected: ${selectedFile.Key}`);

    // Step 3: Process with Textract
    const { blocks, pages } = await processWithTextract('nabca-data', selectedFile.Key!);

    // Step 4: Analyze results
    const results = await analyzeResults(blocks, pages);

    console.log(`\n✅ Test Complete!`);
    console.log(`\nConclusion:`);
    console.log(`  - S3-based async API works: ✅`);
    console.log(`  - Tables extracted: ${results.tables.length}`);
    console.log(`  - Data quality: ${results.tables.length > 0 ? '✅ Good' : '⚠️ Check manually'}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
