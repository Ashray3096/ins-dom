/**
 * AWS Textract Client
 *
 * Utilities for analyzing PDFs with AWS Textract to extract:
 * - Tables
 * - Key-value pairs (form fields)
 * - Text blocks with positions
 */

import {
  TextractClient,
  AnalyzeDocumentCommand,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  Block,
  FeatureType,
} from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export interface TextractConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface TableData {
  tableIndex: number;
  rows: number;
  columns: number;
  data: string[][];
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  page: number;
}

export interface KeyValuePair {
  key: string;
  value: string;
  confidence: number;
  page: number;
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface TextBlock {
  id: string;
  text: string;
  blockType: 'LINE' | 'WORD';
  page: number;
  confidence: number;
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface TextractAnalysisResult {
  tables: TableData[];
  keyValuePairs: KeyValuePair[];
  textBlocks: TextBlock[];
  rawBlocks: Block[];
  documentMetadata: {
    pages: number;
  };
}

/**
 * Create Textract client with AWS credentials
 */
export function createTextractClient(config?: TextractConfig): TextractClient {
  const region = config?.region || process.env.AWS_REGION || 'us-east-1';

  return new TextractClient({
    region,
    credentials: config?.accessKeyId && config?.secretAccessKey ? {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    } : {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Create S3 client with AWS credentials
 */
export function createS3Client(config?: TextractConfig): S3Client {
  const region = config?.region || process.env.AWS_REGION || 'us-east-1';

  return new S3Client({
    region,
    credentials: config?.accessKeyId && config?.secretAccessKey ? {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    } : {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Analyze document with Textract
 */
export async function analyzeDocument(
  client: TextractClient,
  documentBytes: Buffer
): Promise<TextractAnalysisResult> {
  console.log(`📄 Starting Textract analysis (${documentBytes.length} bytes)...`);

  // Convert Buffer to Uint8Array for AWS SDK v3
  const bytes = new Uint8Array(documentBytes);
  console.log(`✅ Converted to Uint8Array: ${bytes.length} bytes, constructor: ${bytes.constructor.name}`);

  const command = new AnalyzeDocumentCommand({
    Document: {
      Bytes: bytes,
    },
    FeatureTypes: [
      FeatureType.TABLES,
      FeatureType.FORMS,
    ],
  });

  console.log(`📤 Sending AnalyzeDocumentCommand to Textract...`);

  const response = await client.send(command);

  if (!response.Blocks) {
    throw new Error('No blocks returned from Textract');
  }

  console.log(`✅ Textract analysis complete: ${response.Blocks.length} blocks found`);

  // Parse the response
  const tables = extractTables(response.Blocks);
  const keyValuePairs = extractKeyValuePairs(response.Blocks);
  const textBlocks = extractTextBlocks(response.Blocks);

  return {
    tables,
    keyValuePairs,
    textBlocks,
    rawBlocks: response.Blocks,
    documentMetadata: {
      pages: response.DocumentMetadata?.Pages || 1,
    },
  };
}

/**
 * Extract table data from Textract blocks
 */
export function extractTables(blocks: Block[]): TableData[] {
  const tables: TableData[] = [];
  const blockMap = new Map<string, Block>();

  // Build block map
  blocks.forEach(block => {
    if (block.Id) {
      blockMap.set(block.Id, block);
    }
  });

  // Find all TABLE blocks
  const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');

  tableBlocks.forEach((tableBlock, tableIndex) => {
    const cells: Map<string, string> = new Map();
    let maxRow = 0;
    let maxCol = 0;

    // Get all CELL blocks for this table
    if (tableBlock.Relationships) {
      const cellRelationship = tableBlock.Relationships.find(
        rel => rel.Type === 'CHILD'
      );

      if (cellRelationship?.Ids) {
        cellRelationship.Ids.forEach(cellId => {
          const cellBlock = blockMap.get(cellId);
          if (cellBlock && cellBlock.BlockType === 'CELL') {
            const rowIndex = cellBlock.RowIndex || 0;
            const colIndex = cellBlock.ColumnIndex || 0;
            maxRow = Math.max(maxRow, rowIndex);
            maxCol = Math.max(maxCol, colIndex);

            // Get cell text
            const cellText = getCellText(cellBlock, blockMap);
            cells.set(`${rowIndex},${colIndex}`, cellText);
          }
        });
      }
    }

    // Build 2D array
    const data: string[][] = [];
    for (let row = 1; row <= maxRow; row++) {
      const rowData: string[] = [];
      for (let col = 1; col <= maxCol; col++) {
        rowData.push(cells.get(`${row},${col}`) || '');
      }
      data.push(rowData);
    }

    tables.push({
      tableIndex,
      rows: maxRow,
      columns: maxCol,
      data,
      boundingBox: {
        top: tableBlock.Geometry?.BoundingBox?.Top || 0,
        left: tableBlock.Geometry?.BoundingBox?.Left || 0,
        width: tableBlock.Geometry?.BoundingBox?.Width || 0,
        height: tableBlock.Geometry?.BoundingBox?.Height || 0,
      },
      page: tableBlock.Page || 1,
    });
  });

  console.log(`📊 Extracted ${tables.length} tables`);
  return tables;
}

/**
 * Get text content from a CELL block
 */
function getCellText(cellBlock: Block, blockMap: Map<string, Block>): string {
  const texts: string[] = [];

  if (cellBlock.Relationships) {
    const childRelationship = cellBlock.Relationships.find(
      rel => rel.Type === 'CHILD'
    );

    if (childRelationship?.Ids) {
      childRelationship.Ids.forEach(childId => {
        const childBlock = blockMap.get(childId);
        if (childBlock?.Text) {
          texts.push(childBlock.Text);
        }
      });
    }
  }

  return texts.join(' ').trim();
}

/**
 * Extract key-value pairs (form fields) from Textract blocks
 */
export function extractKeyValuePairs(blocks: Block[]): KeyValuePair[] {
  const pairs: KeyValuePair[] = [];
  const blockMap = new Map<string, Block>();

  // Build block map
  blocks.forEach(block => {
    if (block.Id) {
      blockMap.set(block.Id, block);
    }
  });

  // Find all KEY_VALUE_SET blocks
  const kvBlocks = blocks.filter(
    block => block.BlockType === 'KEY_VALUE_SET' && block.EntityTypes?.includes('KEY')
  );

  kvBlocks.forEach(keyBlock => {
    const key = getKeyValueText(keyBlock, blockMap);
    let value = '';

    // Find corresponding VALUE block
    if (keyBlock.Relationships) {
      const valueRelationship = keyBlock.Relationships.find(
        rel => rel.Type === 'VALUE'
      );

      if (valueRelationship?.Ids) {
        const valueBlockId = valueRelationship.Ids[0];
        const valueBlock = blockMap.get(valueBlockId);
        if (valueBlock) {
          value = getKeyValueText(valueBlock, blockMap);
        }
      }
    }

    if (key) {
      pairs.push({
        key,
        value,
        confidence: keyBlock.Confidence || 0,
        page: keyBlock.Page || 1,
        boundingBox: {
          top: keyBlock.Geometry?.BoundingBox?.Top || 0,
          left: keyBlock.Geometry?.BoundingBox?.Left || 0,
          width: keyBlock.Geometry?.BoundingBox?.Width || 0,
          height: keyBlock.Geometry?.BoundingBox?.Height || 0,
        },
      });
    }
  });

  console.log(`🔑 Extracted ${pairs.length} key-value pairs`);
  return pairs;
}

/**
 * Get text from KEY or VALUE block
 */
function getKeyValueText(kvBlock: Block, blockMap: Map<string, Block>): string {
  const texts: string[] = [];

  if (kvBlock.Relationships) {
    const childRelationship = kvBlock.Relationships.find(
      rel => rel.Type === 'CHILD'
    );

    if (childRelationship?.Ids) {
      childRelationship.Ids.forEach(childId => {
        const childBlock = blockMap.get(childId);
        if (childBlock?.Text) {
          texts.push(childBlock.Text);
        }
      });
    }
  }

  return texts.join(' ').trim();
}

/**
 * Extract text blocks (LINE and WORD) from Textract blocks
 */
export function extractTextBlocks(blocks: Block[]): TextBlock[] {
  const textBlocks: TextBlock[] = [];

  blocks.forEach(block => {
    if (
      (block.BlockType === 'LINE' || block.BlockType === 'WORD') &&
      block.Text &&
      block.Id
    ) {
      textBlocks.push({
        id: block.Id,
        text: block.Text,
        blockType: block.BlockType as 'LINE' | 'WORD',
        page: block.Page || 1,
        confidence: block.Confidence || 0,
        boundingBox: {
          top: block.Geometry?.BoundingBox?.Top || 0,
          left: block.Geometry?.BoundingBox?.Left || 0,
          width: block.Geometry?.BoundingBox?.Width || 0,
          height: block.Geometry?.BoundingBox?.Height || 0,
        },
      });
    }
  });

  console.log(`📝 Extracted ${textBlocks.length} text blocks`);
  return textBlocks;
}

/**
 * Helper to format Textract results for display/AI analysis
 */
export function formatTextractResults(result: TextractAnalysisResult): string {
  let output = `DOCUMENT ANALYSIS RESULTS\n`;
  output += `========================\n\n`;
  output += `Pages: ${result.documentMetadata.pages}\n`;
  output += `Tables: ${result.tables.length}\n`;
  output += `Key-Value Pairs: ${result.keyValuePairs.length}\n`;
  output += `Text Blocks: ${result.textBlocks.length}\n\n`;

  // Tables
  if (result.tables.length > 0) {
    output += `TABLES:\n`;
    output += `-------\n`;
    result.tables.forEach((table, idx) => {
      output += `\nTable ${idx + 1} (Page ${table.page}):\n`;
      output += `Size: ${table.rows} rows × ${table.columns} columns\n`;
      output += `Data:\n`;
      table.data.forEach((row, rowIdx) => {
        output += `  Row ${rowIdx + 1}: ${row.join(' | ')}\n`;
      });
    });
    output += `\n`;
  }

  // Key-Value Pairs
  if (result.keyValuePairs.length > 0) {
    output += `KEY-VALUE PAIRS:\n`;
    output += `----------------\n`;
    result.keyValuePairs.forEach(pair => {
      output += `  ${pair.key}: ${pair.value} (confidence: ${pair.confidence.toFixed(1)}%)\n`;
    });
    output += `\n`;
  }

  // Sample Text Blocks (first 20 lines)
  if (result.textBlocks.length > 0) {
    output += `TEXT BLOCKS (sample):\n`;
    output += `--------------------\n`;
    const lineBlocks = result.textBlocks
      .filter(b => b.blockType === 'LINE')
      .slice(0, 20);

    lineBlocks.forEach(block => {
      output += `  [Page ${block.page}] ${block.text}\n`;
    });

    if (result.textBlocks.length > 20) {
      output += `  ... and ${result.textBlocks.length - 20} more blocks\n`;
    }
  }

  return output;
}

/**
 * Analyze large document with Textract (async API for >10 pages)
 * Uploads to S3, starts async job, polls for completion
 */
export async function analyzeDocumentAsync(
  textractClient: TextractClient,
  s3Client: S3Client,
  documentBytes: Buffer,
  options: {
    s3Bucket: string;
    s3KeyPrefix?: string;
    maxPollingTime?: number; // milliseconds
  }
): Promise<TextractAnalysisResult> {
  const { s3Bucket, s3KeyPrefix = 'textract-temp/', maxPollingTime = 600000 } = options;

  console.log(`📄 Starting async Textract analysis (${documentBytes.length} bytes)...`);

  // 1. Upload PDF to S3
  const s3Key = `${s3KeyPrefix}${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;
  console.log(`📤 Uploading to S3: s3://${s3Bucket}/${s3Key}`);

  const uploadCommand = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key,
    Body: documentBytes,
    ContentType: 'application/pdf',
  });

  await s3Client.send(uploadCommand);
  console.log(`✅ Uploaded to S3`);

  // 2. Start async Textract job
  console.log(`🚀 Starting Textract async job...`);
  const startCommand = new StartDocumentAnalysisCommand({
    DocumentLocation: {
      S3Object: {
        Bucket: s3Bucket,
        Name: s3Key,
      },
    },
    FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS],
  });

  const startResponse = await textractClient.send(startCommand);
  const jobId = startResponse.JobId!;
  console.log(`✅ Job started: ${jobId}`);

  // 3. Poll for completion
  const startTime = Date.now();
  let blocks: Block[] = [];
  let pages = 0;

  while (true) {
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > maxPollingTime) {
      throw new Error(`Textract job timed out after ${maxPollingTime}ms`);
    }

    console.log(`⏳ Polling job status... (${Math.round(elapsedTime / 1000)}s elapsed)`);

    const getCommand = new GetDocumentAnalysisCommand({ JobId: jobId });
    const getResponse = await textractClient.send(getCommand);

    const status = getResponse.JobStatus;
    console.log(`   Status: ${status}`);

    if (status === 'SUCCEEDED') {
      // Collect all blocks from this response
      if (getResponse.Blocks) {
        blocks.push(...getResponse.Blocks);
      }
      pages = getResponse.DocumentMetadata?.Pages || pages;

      // Handle pagination - Textract returns results in pages
      let nextToken = getResponse.NextToken;
      while (nextToken) {
        console.log(`   Fetching next page of results...`);
        const nextCommand = new GetDocumentAnalysisCommand({ JobId: jobId, NextToken: nextToken });
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
    } else if (status === 'PARTIAL_SUCCESS') {
      console.warn(`⚠️ Job completed with partial success`);
      if (getResponse.Blocks) {
        blocks.push(...getResponse.Blocks);
      }
      pages = getResponse.DocumentMetadata?.Pages || pages;
      break;
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 4. Parse results (same as synchronous API)
  const tables = extractTables(blocks);
  const keyValuePairs = extractKeyValuePairs(blocks);
  const textBlocks = extractTextBlocks(blocks);

  return {
    tables,
    keyValuePairs,
    textBlocks,
    rawBlocks: blocks,
    documentMetadata: { pages },
  };
}

/**
 * Analyze document from existing S3 location (for S3-synced artifacts)
 * Use this when the PDF is already in S3 and you don't want to upload it again
 */
export async function processDocumentFromS3(
  textractClient: TextractClient,
  s3Bucket: string,
  s3Key: string,
  options: {
    region?: string;
    maxPollingTime?: number;
  } = {}
): Promise<TextractAnalysisResult> {
  const { maxPollingTime = 600000 } = options; // 10 minutes default

  console.log(`🚀 Starting Textract async job for s3://${s3Bucket}/${s3Key}`);

  // 1. Start async Textract job (directly from S3, no upload needed)
  const startCommand = new StartDocumentAnalysisCommand({
    DocumentLocation: {
      S3Object: {
        Bucket: s3Bucket,
        Name: s3Key,
      },
    },
    FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS],
  });

  const startResponse = await textractClient.send(startCommand);
  const jobId = startResponse.JobId!;
  console.log(`✅ Job started: ${jobId}`);

  // 2. Poll for completion
  const startTime = Date.now();
  let blocks: Block[] = [];
  let pages = 0;

  while (true) {
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > maxPollingTime) {
      throw new Error(`Textract job timed out after ${maxPollingTime}ms`);
    }

    console.log(`⏳ Polling job status... (${Math.round(elapsedTime / 1000)}s elapsed)`);

    const getCommand = new GetDocumentAnalysisCommand({ JobId: jobId });
    const getResponse = await textractClient.send(getCommand);

    const status = getResponse.JobStatus;
    console.log(`   Status: ${status}`);

    if (status === 'SUCCEEDED') {
      // Collect all blocks from this response
      if (getResponse.Blocks) {
        blocks.push(...getResponse.Blocks);
      }
      pages = getResponse.DocumentMetadata?.Pages || pages;

      // Handle pagination - Textract returns results in pages
      let nextToken = getResponse.NextToken;
      while (nextToken) {
        console.log(`   Fetching next page of results...`);
        const nextCommand = new GetDocumentAnalysisCommand({ JobId: jobId, NextToken: nextToken });
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
    } else if (status === 'PARTIAL_SUCCESS') {
      console.warn(`⚠️ Job completed with partial success`);
      if (getResponse.Blocks) {
        blocks.push(...getResponse.Blocks);
      }
      pages = getResponse.DocumentMetadata?.Pages || pages;
      break;
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // 3. Parse results
  const tables = extractTables(blocks);
  const keyValuePairs = extractKeyValuePairs(blocks);
  const textBlocks = extractTextBlocks(blocks);

  return {
    tables,
    keyValuePairs,
    textBlocks,
    rawBlocks: blocks,
    documentMetadata: { pages },
  };
}
