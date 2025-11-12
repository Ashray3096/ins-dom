/**
 * Dagster Pipeline Code Generator
 *
 * Generates production-ready Dagster Python code from entity models.
 * This is Inspector Dom's key differentiator - automatic pipeline generation.
 *
 * Features:
 * - Asset generation for extraction (using templates)
 * - Asset generation for transformation (Interim → Reference)
 * - Asset generation for load (Reference → Master)
 * - Automatic dependency resolution based on relationships
 * - Error handling and retry logic
 * - Data quality checks
 * - Comprehensive logging
 */

import { createClient } from '@/lib/supabase/server';

// Types for entity model
export interface Entity {
  id: string;
  name: string;
  table_name: string | null;
  entity_type: 'INTERIM' | 'REFERENCE' | 'MASTER';
  display_name: string | null;
  description: string | null;
}

export interface EntityField {
  id: string;
  entity_id: string;
  name: string;
  display_name: string | null;
  data_type: string;
  is_required: boolean;
  template_field_path: string | null;
  template_id: string | null;
  mapping_type: string | null;
  metadata: Record<string, any> | null;
}

export interface Relationship {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: '1:1' | '1:N' | 'N:M';
  from_field?: string;
  to_field?: string;
}

export interface Template {
  id: string;
  name: string;
  config: any;
  extraction_prompt?: string;
  selectors?: any;
}

export interface PipelineConfig {
  pipeline_id: string;
  target_entity_id: string;
  source_ids: string[];
  template_id?: string;
  extraction_strategy: 'template' | 'ai' | 'hybrid';
}

interface GeneratedPipeline {
  python_code: string;
  config: {
    extraction_assets: string[];
    transformation_assets: string[];
    load_assets: string[];
    dependencies: Record<string, string[]>;
    entity_model: any;
  };
}

/**
 * Main code generation function
 */
export async function generateDagsterPipeline(
  pipelineConfig: PipelineConfig
): Promise<GeneratedPipeline> {
  const supabase = await createClient();

  // 1. Fetch entity and its fields
  const { data: entity } = await supabase
    .from('entities')
    .select('*')
    .eq('id', pipelineConfig.target_entity_id)
    .single();

  if (!entity) {
    throw new Error('Entity not found');
  }

  const { data: entityFields } = await supabase
    .from('entity_fields')
    .select('*')
    .eq('entity_id', entity.id)
    .order('sort_order');

  // 2. Fetch related entities and relationships
  const { data: relationships } = await supabase
    .from('entity_relationships')
    .select('*')
    .or(`from_entity_id.eq.${entity.id},to_entity_id.eq.${entity.id}`);

  // 3. Fetch template if specified
  let template = null;
  if (pipelineConfig.template_id) {
    const { data: templateData } = await supabase
      .from('templates')
      .select('*')
      .eq('id', pipelineConfig.template_id)
      .single();
    template = templateData;
  }

  // 4. Generate Python code
  const pythonCode = generatePythonCode(
    entity as Entity,
    entityFields as EntityField[] || [],
    relationships as Relationship[] || [],
    template,
    pipelineConfig
  );

  // 5. Build config metadata
  const config = {
    extraction_assets: [`extract_${entity.table_name || entity.name}`],
    transformation_assets: entity.entity_type === 'INTERIM'
      ? []
      : [`transform_${entity.table_name || entity.name}`],
    load_assets: [`load_${entity.table_name || entity.name}`],
    dependencies: buildDependencyGraph(entity, relationships || []),
    entity_model: {
      entity,
      fields: entityFields,
      relationships,
    },
  };

  return {
    python_code: pythonCode,
    config,
  };
}

/**
 * Detect if this entity is using NABCA section-based extraction
 */
function isNabcaEntity(fields: EntityField[]): string | null {
  // Check if any field has nabca_section in metadata
  for (const field of fields) {
    if (field.metadata && field.metadata.nabca_section) {
      return field.metadata.nabca_section; // Return the section name
    }
  }
  return null;
}

/**
 * Get NABCA section config from template
 */
interface NabcaSectionInfo {
  sectionName: string;
  pageStart: number;
  pageEnd: number;
  templateId: string;
}

function getNabcaSectionInfo(fields: EntityField[], template: Template | null): NabcaSectionInfo | null {
  const sectionName = isNabcaEntity(fields);
  if (!sectionName || !template) return null;

  // Extract template info from first field
  const firstField = fields[0];
  if (!firstField.template_id) return null;

  // Find section in template selectors
  const sections = template.selectors?.sections;
  if (!sections || !Array.isArray(sections)) return null;

  const section = sections.find((s: any) => s.name === sectionName);
  if (!section || !section.pageRange) return null;

  return {
    sectionName,
    pageStart: section.pageRange.start,
    pageEnd: section.pageRange.end,
    templateId: firstField.template_id,
  };
}

/**
 * Generate complete Dagster Python module
 */
function generatePythonCode(
  entity: Entity,
  fields: EntityField[],
  relationships: Relationship[],
  template: Template | null,
  config: PipelineConfig
): string {
  const moduleName = entity.table_name || entity.name;
  const assetPrefix = moduleName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  // Check if this is a NABCA entity (needs special imports)
  const nabcaInfo = getNabcaSectionInfo(fields, template);
  const nabcaImports = nabcaInfo ? `
import os
import boto3
import io
from difflib import SequenceMatcher
from PyPDF2 import PdfReader, PdfWriter
from supabase import create_client
` : '';

  return `"""
Auto-generated Dagster pipeline for ${entity.display_name || entity.name}
Generated by Inspector Dom
Entity Type: ${entity.entity_type}
"""

from dagster import (
    asset,
    AssetExecutionContext,
    MaterializeResult,
    MetadataValue,
    RetryPolicy,
)
from typing import Dict, Any, List, Optional
import logging
import traceback
import re
from datetime import datetime
${nabcaImports}
# Configure logging
logger = logging.getLogger(__name__)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def parse_report_date_from_filename(filename: str) -> tuple:
    """
    Parse month and year from NABCA filename format.
    Expected format: XXX_XXX_MMYY.PDF (e.g., 631_9L_0125.PDF = January 2025)

    Returns:
        tuple: (month_name, year) or (None, None) if parsing fails
    """
    try:
        # Extract 4-digit pattern that looks like MMYY
        match = re.search(r'_(\\d{4})\\.', filename)
        if match:
            mmyy = match.group(1)
            month_num = int(mmyy[:2])
            year_suffix = int(mmyy[2:])

            # Convert to full year (20YY format)
            full_year = f"20{year_suffix:02d}"

            # Convert month number to name
            month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']

            if 1 <= month_num <= 12:
                month_name = month_names[month_num - 1]
                return (month_name, full_year)

        # Fallback: Try to find any 4-digit pattern
        match = re.search(r'(\\d{4})', filename)
        if match:
            mmyy = match.group(1)
            month_num = int(mmyy[:2])
            year_suffix = int(mmyy[2:])

            if 1 <= month_num <= 12:
                full_year = f"20{year_suffix:02d}"
                month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December']
                month_name = month_names[month_num - 1]
                return (month_name, full_year)

        return (None, None)
    except Exception as e:
        logger.warning(f"Failed to parse date from filename '{filename}': {e}")
        return (None, None)

# ============================================================================
# EXTRACTION ASSETS
# ============================================================================

${generateExtractionAsset(entity, fields, template, config)}

# ============================================================================
# TRANSFORMATION ASSETS
# ============================================================================

${generateTransformationAssets(entity, fields, relationships)}

# ============================================================================
# LOAD ASSETS
# ============================================================================

${generateLoadAsset(entity, fields, template)}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

${generateUtilityFunctions()}
`;
}

/**
 * Generate NABCA-specific extraction asset using Textract
 */
function generateNabcaExtractionAsset(
  entity: Entity,
  fields: EntityField[],
  nabcaInfo: NabcaSectionInfo,
  config: PipelineConfig
): string {
  const assetName = `extract_${entity.table_name || entity.name}`;
  const tableName = entity.table_name || entity.name;

  // Build field mapping dictionary for Python
  // For NABCA pipelines, exclude report_month and report_year from table mapping
  // (they're populated from filename, not from PDF table)
  const fieldsForTableMapping = fields.filter(f =>
    f.name !== 'report_month' && f.name !== 'report_year'
  );

  const fieldMappings = fieldsForTableMapping.map(f => ({
    name: f.name,
    displayName: f.display_name || f.name,
    dataType: f.data_type,
  }));

  return `@asset(
    name="${assetName}",
    description="Extract ${nabcaInfo.sectionName} data from NABCA PDFs using AWS Textract",
    compute_kind="extraction:textract",
    retry_policy=RetryPolicy(max_retries=3),
)
def ${assetName}(context: AssetExecutionContext) -> Dict[str, Any]:
    """
    Extract ${entity.display_name || entity.name} data from NABCA PDF artifacts.

    NABCA Section: ${nabcaInfo.sectionName}
    Page Range: ${nabcaInfo.pageStart}-${nabcaInfo.pageEnd}
    Extraction Method: AWS Textract (Table Detection)
    Entity Type: ${entity.entity_type}
    """
    try:
        context.log.info(f"Starting NABCA extraction for ${entity.name}")
        context.log.info(f"Section: ${nabcaInfo.sectionName}, Pages: ${nabcaInfo.pageStart}-${nabcaInfo.pageEnd}")

        # Initialize clients (imports are at module level)
        supabase = create_client(
            os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # AWS clients
        textract_client = boto3.client('textract', region_name=os.getenv("AWS_REGION", "us-east-1"))
        s3_client = boto3.client('s3', region_name=os.getenv("AWS_REGION", "us-east-1"))

        # Fetch PDF artifacts
        source_ids = ${JSON.stringify(config.source_ids)}

        query = supabase.table("artifacts").select("*").eq("artifact_type", "pdf")
        if source_ids:
            query = query.in_("source_id", source_ids)

        artifacts_response = query.execute()
        artifacts = artifacts_response.data

        context.log.info(f"Found {len(artifacts)} PDF artifacts to process")

        # Field mapping (semantic field names)
        semantic_fields = ${JSON.stringify(fieldMappings)}

        # Extract data from each PDF
        extracted_records = []
        failed_count = 0

        for artifact in artifacts:
            try:
                context.log.info(f"Processing artifact: {artifact['id']}")

                # Get PDF file from S3 or Supabase
                pdf_data = get_artifact_pdf(supabase, s3_client, artifact, context)
                if not pdf_data:
                    context.log.error(f"Failed to retrieve PDF for artifact {artifact['id']}")
                    failed_count += 1
                    continue

                # Extract specific page range (${nabcaInfo.pageStart}-${nabcaInfo.pageEnd})
                context.log.info(f"Extracting pages ${nabcaInfo.pageStart}-${nabcaInfo.pageEnd}...")
                section_pdf_bytes = extract_pdf_page_range(
                    pdf_data,
                    ${nabcaInfo.pageStart},
                    ${nabcaInfo.pageEnd},
                    context
                )

                # Upload section to S3 for Textract processing
                s3_bucket = os.getenv("TEXTRACT_S3_BUCKET") or os.getenv("AWS_S3_BUCKET")
                s3_key = f"textract-temp/nabca-extraction/{artifact['id']}/section.pdf"

                context.log.info(f"Uploading to S3: s3://{s3_bucket}/{s3_key}")
                s3_client.put_object(
                    Bucket=s3_bucket,
                    Key=s3_key,
                    Body=section_pdf_bytes
                )

                # Start Textract analysis
                context.log.info("Starting Textract async analysis...")
                textract_response = textract_client.start_document_analysis(
                    DocumentLocation={'S3Object': {'Bucket': s3_bucket, 'Name': s3_key}},
                    FeatureTypes=['TABLES', 'FORMS']
                )

                job_id = textract_response['JobId']
                context.log.info(f"Textract job started: {job_id}")

                # Poll for completion
                import time
                max_wait = 600  # 10 minutes
                wait_interval = 5
                elapsed = 0

                while elapsed < max_wait:
                    time.sleep(wait_interval)
                    elapsed += wait_interval

                    status_response = textract_client.get_document_analysis(JobId=job_id)
                    status = status_response['JobStatus']

                    if status == 'SUCCEEDED':
                        context.log.info(f"Textract job completed after {elapsed}s")
                        break
                    elif status == 'FAILED':
                        raise Exception(f"Textract job failed: {status_response.get('StatusMessage')}")

                    context.log.debug(f"Textract job status: {status} (waited {elapsed}s)")

                if status != 'SUCCEEDED':
                    raise Exception(f"Textract job timed out after {max_wait}s")

                # Get all pages of results - MUST collect ALL blocks first!
                # Table blocks reference cell/word blocks that might be on different pages
                context.log.info("Retrieving all Textract blocks...")
                all_blocks = status_response.get('Blocks', [])
                next_token = status_response.get('NextToken')

                while next_token:
                    response = textract_client.get_document_analysis(JobId=job_id, NextToken=next_token)
                    all_blocks.extend(response.get('Blocks', []))
                    next_token = response.get('NextToken')

                context.log.info(f"Retrieved {len(all_blocks)} blocks from Textract")

                # Parse tables from ALL blocks at once
                tables = parse_textract_tables(all_blocks)
                extraction_result = {'tables': tables, 'keyValuePairs': []}

                context.log.info(f"Textract complete: {len(extraction_result['tables'])} tables detected")

                # Extract table data and map to semantic fields
                records = extract_nabca_table_data(
                    extraction_result,
                    semantic_fields,
                    context
                )

                # Parse report month and year from filename
                filename = artifact.get("original_filename", "")
                report_month, report_year = parse_report_date_from_filename(filename)

                if report_month and report_year:
                    context.log.info(f"📅 Parsed date from '{filename}': {report_month} {report_year}")
                else:
                    context.log.warning(f"⚠️  Could not parse date from filename: {filename}")

                # Add artifact metadata to each record
                for record in records:
                    record["_artifact_id"] = artifact["id"]
                    record["_source_id"] = artifact.get("source_id")
                    record["_extracted_at"] = datetime.utcnow().isoformat()

                    # Add parsed report month and year
                    record["report_month"] = report_month
                    record["report_year"] = report_year

                extracted_records.extend(records)
                context.log.info(f"Extracted {len(records)} records from artifact {artifact['id']}")

            except Exception as e:
                context.log.error(f"Failed to process artifact {artifact['id']}: {str(e)}")
                context.log.error(traceback.format_exc())
                failed_count += 1
                continue

        success_rate = (len(extracted_records) / (len(extracted_records) + failed_count) * 100) if (len(extracted_records) + failed_count) > 0 else 0

        context.log.info(
            f"NABCA extraction complete: {len(extracted_records)} records from {len(artifacts)} artifacts, "
            f"{failed_count} failed ({success_rate:.1f}% success rate)"
        )

        # Quality check
        if success_rate < 80:
            context.log.warning(
                f"⚠️ Low extraction success rate: {success_rate:.1f}%. "
                f"Check Textract results or PDF quality."
            )

        return {
            "records": extracted_records,
            "metadata": {
                "total_artifacts": len(artifacts),
                "extracted_records": len(extracted_records),
                "failed_artifacts": failed_count,
                "success_rate": success_rate,
                "nabca_section": "${nabcaInfo.sectionName}",
                "page_range": "${nabcaInfo.pageStart}-${nabcaInfo.pageEnd}",
            }
        }

    except Exception as e:
        context.log.error(f"NABCA extraction failed: {str(e)}")
        context.log.error(traceback.format_exc())
        raise


def get_artifact_pdf(supabase, s3_client, artifact: Dict[str, Any], context) -> bytes:
    """Retrieve PDF file data from S3 or Supabase storage."""
    try:
        # Check if artifact has S3 metadata
        if artifact.get("metadata", {}).get("s3_bucket") and artifact.get("metadata", {}).get("s3_key"):
            context.log.info(f"Downloading from S3: s3://{artifact['metadata']['s3_bucket']}/{artifact['metadata']['s3_key']}")
            response = s3_client.get_object(
                Bucket=artifact["metadata"]["s3_bucket"],
                Key=artifact["metadata"]["s3_key"]
            )
            return response['Body'].read()
        else:
            # Download from Supabase storage
            file_path = artifact.get("file_path")
            if not file_path:
                raise Exception("No file_path found in artifact")

            context.log.info(f"Downloading from Supabase storage: {file_path}")
            response = supabase.storage.from_("artifacts").download(file_path)
            return response

    except Exception as e:
        context.log.error(f"Failed to retrieve PDF: {str(e)}")
        return None


def extract_pdf_page_range(pdf_data: bytes, start_page: int, end_page: int, context) -> bytes:
    """Extract specific page range from PDF (1-indexed)."""
    try:
        # Read PDF
        pdf_reader = PdfReader(io.BytesIO(pdf_data))
        total_pages = len(pdf_reader.pages)

        context.log.info(f"PDF has {total_pages} pages, extracting pages {start_page}-{end_page}")

        # Validate page range
        if start_page < 1 or end_page > total_pages:
            raise Exception(f"Invalid page range {start_page}-{end_page} for PDF with {total_pages} pages")

        # Create new PDF with selected pages
        pdf_writer = PdfWriter()
        for page_num in range(start_page - 1, end_page):  # Convert to 0-indexed
            pdf_writer.add_page(pdf_reader.pages[page_num])

        # Write to bytes
        output_buffer = io.BytesIO()
        pdf_writer.write(output_buffer)
        output_buffer.seek(0)

        return output_buffer.read()

    except Exception as e:
        context.log.error(f"Failed to extract PDF pages: {str(e)}")
        raise


def parse_textract_tables(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Parse Textract blocks into table structure with O(1) lookups. Includes page numbers for sequential matching."""
    tables = []

    # PERFORMANCE: Build block ID lookup map once (O(n) instead of O(n²))
    block_map = {b['Id']: b for b in blocks if 'Id' in b}

    # Find all TABLE blocks
    table_blocks = [b for b in blocks if b.get('BlockType') == 'TABLE']

    for table_block in table_blocks:
        # Extract page number from table block
        page_number = table_block.get('Page', 0)

        # Find all CELL blocks for this table
        cell_blocks = []
        if 'Relationships' in table_block:
            for rel in table_block['Relationships']:
                if rel['Type'] == 'CHILD':
                    for cell_id in rel['Ids']:
                        cell_block = block_map.get(cell_id)  # O(1) lookup
                        if cell_block and cell_block.get('BlockType') == 'CELL':
                            cell_blocks.append(cell_block)

        # Build table grid
        if not cell_blocks:
            continue

        max_row = max(c.get('RowIndex', 0) for c in cell_blocks)
        max_col = max(c.get('ColumnIndex', 0) for c in cell_blocks)

        # Initialize grid
        grid = [['' for _ in range(max_col)] for _ in range(max_row)]

        # Fill grid
        for cell in cell_blocks:
            row = cell.get('RowIndex', 1) - 1  # Convert to 0-indexed
            col = cell.get('ColumnIndex', 1) - 1

            # Get cell text
            cell_text = ''
            if 'Relationships' in cell:
                for rel in cell['Relationships']:
                    if rel['Type'] == 'CHILD':
                        for word_id in rel['Ids']:
                            word_block = block_map.get(word_id)  # O(1) lookup
                            if word_block and word_block.get('BlockType') == 'WORD':
                                cell_text += word_block.get('Text', '') + ' '

            grid[row][col] = cell_text.strip()

        tables.append({'data': grid, 'page': page_number})

    return tables


def extract_nabca_table_data(
    textract_result: Dict[str, Any],
    semantic_fields: List[Dict[str, str]],
    context: AssetExecutionContext
) -> List[Dict[str, Any]]:
    """
    Extract table data from Textract results and map to semantic field names.

    Uses fuzzy matching to map Textract column headers to semantic field names.
    Handles multi-table NABCA PDFs that span multiple pages.
    """
    from difflib import SequenceMatcher

    tables = textract_result.get("tables", [])
    if not tables:
        context.log.warning("No tables found in Textract results")
        return []

    context.log.info(f"Processing {len(tables)} tables...")

    # Merge all tables (NABCA PDFs often span multiple pages/tables)
    all_table_data = []
    for idx, table in enumerate(tables):
        table_data_raw = table.get("data", [])
        context.log.info(f"  Table {idx + 1}: {len(table_data_raw)} rows")

        # For first table, include everything
        if idx == 0:
            all_table_data.extend(table_data_raw)
        else:
            # For subsequent tables, skip header rows and merge data
            # Detect header by finding row with most non-empty cells
            header_idx = 0
            max_non_empty = 0
            for row_idx, row in enumerate(table_data_raw[:5]):
                non_empty = sum(1 for cell in row if cell and cell.strip())
                if non_empty > max_non_empty:
                    max_non_empty = non_empty
                    header_idx = row_idx

            # Skip header and metadata rows, only take data
            data_start_idx = header_idx + 1
            context.log.info(f"    Skipping {data_start_idx} header rows, merging {len(table_data_raw) - data_start_idx} data rows")
            all_table_data.extend(table_data_raw[data_start_idx:])

    table_data = all_table_data
    context.log.info(f"Merged table data: {len(table_data)} total rows")

    if len(table_data) < 2:
        context.log.warning("Table has no data rows")
        return []

    # Show first 10 rows of raw data for debugging
    context.log.info(f"📊 RAW TABLE DATA ({len(table_data)} rows total):")
    for idx, row in enumerate(table_data[:10]):
        context.log.info(f"  Row {idx}: {row[:3]}... (showing first 3 cells)")

    # Find the real header row - EXACT LOGIC FROM WORKING TEST SCRIPT
    header_row_idx = 0
    max_non_empty = 0

    for idx, row in enumerate(table_data[:5]):
        non_empty_count = sum(1 for cell in row if cell and cell.strip() and cell.strip() != "'")
        if non_empty_count > max_non_empty:
            max_non_empty = non_empty_count
            header_row_idx = idx
        context.log.info(f"  Row {idx}: {non_empty_count} non-empty cells")

    context.log.info(f"✅ Detected header row at index {header_row_idx} (has {max_non_empty} non-empty cells)")

    headers = table_data[header_row_idx]
    data_rows = table_data[header_row_idx + 1:]

    context.log.info(f"📋 Headers: {headers}")
    context.log.info(f"📈 Data rows: {len(data_rows)}")

    context.log.info(f"Table has {len(headers)} columns and {len(data_rows)} data rows")
    context.log.info(f"📋 Textract Headers: {headers}")
    context.log.info(f"🎯 Semantic Fields: {[f['name'] + ' (' + f['displayName'] + ')' for f in semantic_fields]}")

    # Build column mapping: Textract column index -> semantic field name
    column_mapping = {}

    # Check if headers are empty OR if we have duplicate headers (like multiple "Case Sales")
    headers_empty = all(not h or not h.strip() for h in headers)
    has_duplicates = len(headers) != len(set(h.strip().lower() for h in headers if h and h.strip()))

    if headers_empty or has_duplicates:
        if headers_empty:
            context.log.warning("⚠️  All headers are empty! Using positional mapping for NABCA table.")
        else:
            context.log.warning(f"⚠️  Duplicate headers detected! Using positional mapping.")
            context.log.info(f"    Headers: {headers}")

        # Use positional mapping for NABCA Brand Leaders table
        # Standard NABCA Brand Leaders columns are in this order
        if len(semantic_fields) == len(headers):
            for idx, field in enumerate(semantic_fields):
                column_mapping[idx] = field["name"]
                context.log.info(f"✅ Positional mapping: column {idx} -> '{field['name']}' ({field['displayName']})")
        else:
            context.log.error(f"Column count mismatch: {len(headers)} table columns vs {len(semantic_fields)} entity fields")
    else:
        # Use fuzzy matching when headers exist
        for col_idx, header in enumerate(headers):
            if not header or not header.strip():
                continue

            # Find best matching semantic field
            best_match = None
            best_score = 0.0

            for field in semantic_fields:
                # Compare header with both field name and display name
                score1 = similarity(header.lower(), field["name"].lower())
                score2 = similarity(header.lower(), field["displayName"].lower())
                score = max(score1, score2)

                if score > best_score:
                    best_score = score
                    best_match = field["name"]

            # Only map if similarity is above threshold
            if best_match and best_score > 0.5:
                column_mapping[col_idx] = best_match
                context.log.info(f"✅ Mapped column {col_idx} '{header}' -> '{best_match}' (score: {best_score:.2f})")
            else:
                context.log.info(f"⚠️  No good match for column '{header}' (best: '{best_match}' with score {best_score:.2f})")

    context.log.info(f"📊 Column Mapping Complete: {len(column_mapping)} of {len(headers)} columns mapped")
    context.log.info(f"Mapping: {column_mapping}")

    # Extract records
    records = []
    skipped_header_count = 0
    for row in data_rows:
        # Skip rows that look like headers or summary rows
        if is_header_or_summary_row(row):
            skipped_header_count += 1
            context.log.debug(f"Skipping header/summary row: {row[:3]}...")
            continue

        record = {}
        for col_idx, value in enumerate(row):
            if col_idx in column_mapping:
                field_name = column_mapping[col_idx]
                record[field_name] = value.strip() if isinstance(value, str) else value

        # Only include records that have at least some mapped fields
        if len(record) >= len(semantic_fields) * 0.5:  # At least 50% of fields mapped
            records.append(record)
        else:
            context.log.warning(f"Skipping row with too few mapped fields: {record}")

    if skipped_header_count > 0:
        context.log.info(f"🚫 Skipped {skipped_header_count} header/summary rows")

    context.log.info(f"Extracted {len(records)} valid records")

    return records


def is_header_or_summary_row(row: List) -> bool:
    """
    Check if a row looks like a header or summary row that should be skipped.
    Returns True if the row contains common header/summary indicators.
    """
    # Keywords that indicate header or summary rows
    header_keywords = [
        'YEAR', 'LAST YEAR', 'THIS YEAR', 'PREVIOUS YEAR',
        'DECREASE', 'INCREASE', 'CHANGE', 'TOTAL', 'TOTALS',
        'CLASS', 'TYPE', 'CATEGORY', 'BRAND', 'RANK',
        'MONTH', 'MONTHS', 'YTD', 'ROLLING',
        'CASE SALES', 'SALES', 'VOLUME'
    ]

    # Check first few cells of the row
    for i, cell in enumerate(row[:3]):  # Check first 3 cells
        if not cell or not isinstance(cell, str):
            continue

        cell_upper = cell.strip().upper()

        # Skip if cell exactly matches a header keyword
        if cell_upper in header_keywords:
            return True

        # Skip if cell contains multiple header keywords (likely a composite header)
        keyword_count = sum(1 for keyword in header_keywords if keyword in cell_upper)
        if keyword_count >= 2:
            return True

    return False


def similarity(a: str, b: str) -> float:
    """Calculate similarity ratio between two strings."""
    return SequenceMatcher(None, a, b).ratio()
`;
}

/**
 * Generate multi-entity NABCA extraction asset (1 PDF → 8 tables)
 */
function generateMultiEntityExtractionAsset(
  entity: Entity,
  fields: EntityField[],
  template: Template,
  config: PipelineConfig
): string {
  const assetName = `extract_nabca_all_tables`;
  const tablePatterns = template.selectors?.tablePatterns || [];
  const targetEntities = template.selectors?.targetEntities || [];

  return `@asset(
    name="${assetName}",
    description="Extract all 8 NABCA tables from PDFs using AWS Textract with table identification",
    compute_kind="extraction:textract:multi-entity",
    retry_policy=RetryPolicy(max_retries=3),
)
def ${assetName}(context: AssetExecutionContext) -> Dict[str, Any]:
    """
    Multi-entity NABCA extraction: ONE Textract call → 8 database tables.

    Uses table identification patterns to route data to correct entities.
    Cost-efficient: 1 Textract call instead of 8 separate calls.
    """
    try:
        context.log.info("🚀 Starting NABCA multi-entity extraction...")

        # Initialize clients
        import os
        import boto3
        from supabase import create_client

        supabase = create_client(
            os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        textract_client = boto3.client('textract', region_name=os.getenv("AWS_REGION", "us-east-1"))
        s3_client = boto3.client('s3', region_name=os.getenv("AWS_REGION", "us-east-1"))

        # Fetch PDF artifacts
        source_ids = ${JSON.stringify(config.source_ids)}
        query = supabase.table("artifacts").select("*").eq("artifact_type", "pdf")
        if source_ids:
            query = query.in_("source_id", source_ids)

        artifacts_response = query.execute()
        artifacts = artifacts_response.data

        context.log.info(f"📄 Found {len(artifacts)} PDF artifacts to process")

        # Table identification patterns (from template)
        table_patterns = ${JSON.stringify(tablePatterns, null, 8)}

        # Target entities (8 NABCA tables)
        target_entities = ${JSON.stringify(targetEntities)}

        context.log.info(f"🎯 Target entities: {len(target_entities)} tables")
        context.log.info(f"📋 Table patterns configured: {len(table_patterns)}")

        # Process each PDF
        all_entity_records = {entity_name: [] for entity_name in target_entities}
        failed_artifacts = 0

        for artifact in artifacts:
            try:
                context.log.info(f"\\n{'='*60}")
                context.log.info(f"📄 Processing artifact: {artifact['id']}")
                context.log.info(f"   Filename: {artifact.get('original_filename', 'unknown')}")

                # Parse report month/year from filename (format: 631_9L_1224.PDF)
                filename = artifact.get("original_filename", "")
                report_month, report_year = parse_report_date_from_filename(filename)

                if report_month and report_year:
                    context.log.info(f"📅 Parsed date: {report_month} {report_year}")
                else:
                    context.log.warning(f"⚠️  Could not parse date from: {filename}")

                # Check if artifact is already in S3
                artifact_metadata = artifact.get("metadata", {})
                if artifact_metadata.get("s3_bucket") and artifact_metadata.get("s3_key"):
                    # Artifact already in S3 - use existing location
                    s3_bucket = artifact_metadata["s3_bucket"]
                    s3_key = artifact_metadata["s3_key"]
                    context.log.info(f"✅ Using existing S3 location: s3://{s3_bucket}/{s3_key}")
                else:
                    # Artifact in Supabase storage - need to download and upload to S3
                    context.log.info("📥 Downloading from Supabase storage...")
                    pdf_data = get_artifact_pdf(supabase, s3_client, artifact, context)
                    if not pdf_data:
                        context.log.error(f"❌ Failed to retrieve PDF for {artifact['id']}")
                        failed_artifacts += 1
                        continue

                    # Upload to S3 for Textract
                    s3_bucket = os.getenv("TEXTRACT_S3_BUCKET") or os.getenv("AWS_S3_BUCKET")
                    s3_key = f"textract-temp/nabca-multi/{artifact['id']}/full.pdf"

                    context.log.info(f"☁️  Uploading to S3: s3://{s3_bucket}/{s3_key}")
                    s3_client.put_object(Bucket=s3_bucket, Key=s3_key, Body=pdf_data)

                # Start async Textract analysis (entire PDF)
                context.log.info("🔍 Starting Textract async analysis...")
                textract_response = textract_client.start_document_analysis(
                    DocumentLocation={'S3Object': {'Bucket': s3_bucket, 'Name': s3_key}},
                    FeatureTypes=['TABLES']
                )

                job_id = textract_response['JobId']
                context.log.info(f"⏳ Textract job ID: {job_id}")

                # Poll for completion (with extended timeout for large PDFs)
                import time
                max_wait = 7200  # 2 hours for large PDFs (718 pages)
                wait_interval = 10
                elapsed = 0

                while elapsed < max_wait:
                    time.sleep(wait_interval)
                    elapsed += wait_interval

                    status_response = textract_client.get_document_analysis(JobId=job_id)
                    status = status_response['JobStatus']

                    if status == 'SUCCEEDED':
                        context.log.info(f"✅ Textract completed after {elapsed}s ({elapsed/60:.1f} min)")
                        break
                    elif status == 'FAILED':
                        raise Exception(f"Textract job failed: {status_response.get('StatusMessage')}")

                    if elapsed % 60 == 0:
                        context.log.info(f"⏳ Textract still running... ({elapsed}s / {elapsed/60:.1f} min)")

                if status != 'SUCCEEDED':
                    raise Exception(f"Textract job timed out after {max_wait}s")

                # Collect ALL blocks from all pages
                context.log.info("📦 Retrieving Textract blocks...")
                all_blocks = status_response.get('Blocks', [])
                next_token = status_response.get('NextToken')
                page_count = 1

                while next_token:
                    response = textract_client.get_document_analysis(JobId=job_id, NextToken=next_token)
                    all_blocks.extend(response.get('Blocks', []))
                    next_token = response.get('NextToken')
                    page_count += 1
                    if page_count % 10 == 0:
                        context.log.info(f"   Retrieved {page_count} pages of blocks...")

                context.log.info(f"✅ Retrieved {len(all_blocks)} total blocks from {page_count} result pages")

                # Parse tables
                tables = parse_textract_tables(all_blocks)
                context.log.info(f"📊 Detected {len(tables)} tables in PDF")

                # Track assigned entities for sequential matching (tables with identical headers)
                assigned_entities = set()

                # Identify and extract data from each table
                for table_idx, table in enumerate(tables):
                    table_data = table.get('data', [])
                    page_number = table.get('page', 0)

                    if len(table_data) < 2:
                        context.log.debug(f"Skipping table {table_idx + 1} (too small: {len(table_data)} rows)")
                        continue

                    # Identify which NABCA table this is (with title-based and page-based matching)
                    identified_pattern = identify_nabca_table(table_data, table_patterns, assigned_entities, page_number, all_blocks, context)

                    if not identified_pattern:
                        context.log.debug(f"Table {table_idx + 1} (page {page_number}): Could not identify (skipping)")
                        continue

                    entity_name = identified_pattern['entityName']
                    table_name = identified_pattern['tableName']

                    # Track assigned entity for sequential matching
                    assigned_entities.add(entity_name)
                    confidence = identified_pattern.get('confidence', 0)

                    context.log.info(f"✅ Table {table_idx + 1} (page {page_number}): Identified as '{table_name}' → {entity_name} (confidence: {confidence:.2f})")

                    # Extract data using pattern
                    records = extract_table_data_multi_entity(
                        table_data,
                        identified_pattern,
                        report_month,
                        report_year,
                        artifact,
                        context
                    )

                    all_entity_records[entity_name].extend(records)
                    context.log.info(f"   → Extracted {len(records)} records for {entity_name}")

                context.log.info(f"✅ Completed artifact {artifact['id']}")

            except Exception as e:
                context.log.error(f"❌ Failed to process artifact {artifact['id']}: {str(e)}")
                context.log.error(traceback.format_exc())
                failed_artifacts += 1
                continue

        # Load data into all 8 tables
        context.log.info(f"\\n{'='*60}")
        context.log.info("💾 Loading data into database tables...")

        load_summary = {}

        for entity_name, records in all_entity_records.items():
            if not records:
                context.log.info(f"  {entity_name}: No records to load")
                load_summary[entity_name] = {"loaded": 0, "failed": 0}
                continue

            context.log.info(f"  {entity_name}: Loading {len(records)} records...")

            # Batch insert
            loaded, failed = batch_insert_records(supabase, entity_name, records, context)
            load_summary[entity_name] = {"loaded": loaded, "failed": failed}

            context.log.info(f"    ✅ {loaded} loaded, ❌ {failed} failed")

        # Final summary
        total_loaded = sum(s["loaded"] for s in load_summary.values())
        total_failed = sum(s["failed"] for s in load_summary.values())

        context.log.info(f"\\n{'='*60}")
        context.log.info(f"🎉 NABCA Multi-Entity Extraction Complete!")
        context.log.info(f"   Artifacts processed: {len(artifacts)} ({failed_artifacts} failed)")
        context.log.info(f"   Total records loaded: {total_loaded}")
        context.log.info(f"   Total records failed: {total_failed}")
        context.log.info(f"   Entities populated: {len([k for k, v in load_summary.items() if v['loaded'] > 0])}/8")

        return {
            "success": True,
            "artifacts_processed": len(artifacts),
            "artifacts_failed": failed_artifacts,
            "total_records_loaded": total_loaded,
            "total_records_failed": total_failed,
            "load_summary": load_summary,
        }

    except Exception as e:
        context.log.error(f"❌ NABCA multi-entity extraction failed: {str(e)}")
        context.log.error(traceback.format_exc())
        raise


def get_artifact_pdf(supabase, s3_client, artifact: Dict[str, Any], context) -> bytes:
    """Retrieve PDF file data from S3 or Supabase storage."""
    try:
        # Check if artifact has S3 metadata
        if artifact.get("metadata", {}).get("s3_bucket") and artifact.get("metadata", {}).get("s3_key"):
            context.log.info(f"Downloading from S3: s3://{artifact['metadata']['s3_bucket']}/{artifact['metadata']['s3_key']}")
            response = s3_client.get_object(
                Bucket=artifact["metadata"]["s3_bucket"],
                Key=artifact["metadata"]["s3_key"]
            )
            return response['Body'].read()
        else:
            # Download from Supabase storage
            file_path = artifact.get("file_path")
            if not file_path:
                raise Exception("No file_path found in artifact")

            context.log.info(f"Downloading from Supabase storage: {file_path}")
            response = supabase.storage.from_("artifacts").download(file_path)
            return response

    except Exception as e:
        context.log.error(f"Failed to retrieve PDF: {str(e)}")
        return None


def parse_textract_tables(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Parse Textract blocks into table structure with O(1) lookups. Includes page numbers for sequential matching."""
    tables = []

    # PERFORMANCE: Build block ID lookup map once (O(n) instead of O(n²))
    block_map = {b['Id']: b for b in blocks if 'Id' in b}

    # Find all TABLE blocks
    table_blocks = [b for b in blocks if b.get('BlockType') == 'TABLE']

    for table_block in table_blocks:
        # Extract page number from table block
        page_number = table_block.get('Page', 0)

        # Find all CELL blocks for this table
        cell_blocks = []
        if 'Relationships' in table_block:
            for rel in table_block['Relationships']:
                if rel['Type'] == 'CHILD':
                    for cell_id in rel['Ids']:
                        cell_block = block_map.get(cell_id)  # O(1) lookup
                        if cell_block and cell_block.get('BlockType') == 'CELL':
                            cell_blocks.append(cell_block)

        # Build table grid
        if not cell_blocks:
            continue

        max_row = max(c.get('RowIndex', 0) for c in cell_blocks)
        max_col = max(c.get('ColumnIndex', 0) for c in cell_blocks)

        # Initialize grid
        grid = [['' for _ in range(max_col)] for _ in range(max_row)]

        # Fill grid
        for cell in cell_blocks:
            row = cell.get('RowIndex', 1) - 1  # Convert to 0-indexed
            col = cell.get('ColumnIndex', 1) - 1

            # Get cell text
            cell_text = ''
            if 'Relationships' in cell:
                for rel in cell['Relationships']:
                    if rel['Type'] == 'CHILD':
                        for word_id in rel['Ids']:
                            word_block = block_map.get(word_id)  # O(1) lookup
                            if word_block and word_block.get('BlockType') == 'WORD':
                                cell_text += word_block.get('Text', '') + ' '

            grid[row][col] = cell_text.strip()

        tables.append({'data': grid, 'page': page_number})

    return tables


def identify_nabca_table(table_data: List[List[str]], patterns: List[Dict], assigned_entities: set, page_number: int, all_blocks: List[Dict], context) -> Optional[Dict]:
    """
    Identify which NABCA table this is based on header matching and title keywords.
    Uses title-based disambiguation for patterns with identical headers (Tables 2-4, 6-7).
    Port of TypeScript identifyTable() function.

    Title-based sequential matching:
    - Table 2: "CURRENT MONTH" + "TOTAL CASE SALES"
    - Table 3: "YEAR TO DATE" + "TOTAL CASE SALES"
    - Table 4: "ROLLING 12 MONTH" + "CASE SALES"
    - Table 6: "TOP 100" + "VENDORS"
    - Table 7: "TOP 20" + "VENDORS" + "BY CLASS"
    """
    from difflib import SequenceMatcher

    # Extract LINE blocks for this page (for title matching)
    page_lines = []
    for block in all_blocks:
        if block.get('BlockType') == 'LINE' and block.get('Page') == page_number:
            line_text = block.get('Text', '').upper()
            page_lines.append(line_text)

    page_text = ' '.join(page_lines)
    context.log.debug(f"Page {page_number} text preview: {page_text[:200]}...")

    best_match = None
    best_score = 0.0

    for pattern in patterns:
        # Find header row (position-agnostic)
        header_row_idx = find_header_row(
            table_data,
            pattern['requiredHeaders'],
            pattern.get('fuzzyThreshold', 0.75)
        )

        if header_row_idx == -1:
            continue

        # Calculate base confidence score from header matching
        headers = table_data[header_row_idx]
        required_headers = pattern['requiredHeaders']

        matched_count = 0
        for required_header in required_headers:
            for header in headers:
                if not header:
                    continue

                similarity = SequenceMatcher(None, header.lower(), required_header.lower()).ratio()
                if similarity >= pattern.get('fuzzyThreshold', 0.75):
                    matched_count += 1
                    break

        score = matched_count / len(required_headers) if required_headers else 0

        # TITLE-BASED DISAMBIGUATION: Check if title keywords match
        title_keywords = pattern.get('titleKeywords', [])
        title_match_boost = 0.0

        if title_keywords:
            # Check if ALL title keywords are present in page text
            keywords_matched = sum(1 for keyword in title_keywords if keyword.upper() in page_text)
            if keywords_matched == len(title_keywords):
                # All keywords matched - strong boost to confidence
                title_match_boost = 0.3
                context.log.debug(f"   ✅ Title match for {pattern.get('entityName')}: all {len(title_keywords)} keywords found")
            elif keywords_matched > 0:
                # Partial match - smaller boost
                title_match_boost = 0.1 * (keywords_matched / len(title_keywords))
                context.log.debug(f"   ⚠️  Partial title match for {pattern.get('entityName')}: {keywords_matched}/{len(title_keywords)} keywords")

        # Apply title match boost
        final_score = score + title_match_boost

        if final_score > best_score:
            best_score = final_score
            best_match = {
                **pattern,
                'confidence': final_score,
                'headerRowIndex': header_row_idx,
                'titleMatchBoost': title_match_boost,
            }

    # Only return if confidence is above threshold
    if best_match and best_match['confidence'] >= 0.6:
        return best_match

    return None


def find_header_row(table_data: List[List[str]], required_headers: List[str], fuzzy_threshold: float) -> int:
    """
    Find the row that contains the headers (position-agnostic).
    Port of TypeScript findHeaderRow() function.
    """
    from difflib import SequenceMatcher

    for row_idx, row in enumerate(table_data[:10]):  # Check first 10 rows only
        matched_count = 0

        for required_header in required_headers:
            for cell in row:
                if not cell:
                    continue

                similarity = SequenceMatcher(None, cell.lower(), required_header.lower()).ratio()
                if similarity >= fuzzy_threshold:
                    matched_count += 1
                    break

        # If we matched most required headers, this is the header row
        if matched_count >= len(required_headers) * 0.7:  # 70% threshold
            return row_idx

    return -1  # Not found


def clean_cell_value(value: Any, field_name: str, field_type: str, context) -> Any:
    """
    Clean cell values to handle Textract OCR quality issues.

    Common issues:
    - Space-separated values: "1 1", "49 49" -> Extract first number
    - Text in numeric fields: "VISA", "NON" -> Return None
    - Malformed decimals: ".00 .00", ":00" -> Return None
    """
    import re

    if value is None or (isinstance(value, str) and not value.strip()):
        return None

    value_str = str(value).strip()

    # For NUMBER type fields, apply numeric cleaning
    if field_type == 'NUMBER':
        # Check if value contains spaces (likely merged cells)
        if ' ' in value_str:
            # Extract first valid number
            parts = value_str.split()
            for part in parts:
                # Try to extract numeric value
                match = re.match(r'^-?\\d+\\.?\\d*$', part.replace(',', ''))
                if match:
                    cleaned = part.replace(',', '')
                    context.log.warning(f"⚠️  Cleaned space-separated value '{value_str}' -> '{cleaned}' for field '{field_name}'")
                    return cleaned

            # No valid number found
            context.log.warning(f"⚠️  Rejecting invalid numeric value '{value_str}' for field '{field_name}'")
            return None

        # Check if value is purely alphabetic (text in numeric field)
        if re.match(r'^[A-Za-z]+$', value_str):
            context.log.warning(f"⚠️  Rejecting text value '{value_str}' in numeric field '{field_name}'")
            return None

        # Handle malformed decimals starting with . or :
        if value_str.startswith('.') or value_str.startswith(':'):
            # Try to fix common patterns
            if re.match(r'^\\.[0-9]+$', value_str):  # .00, .25, etc.
                fixed_value = '0' + value_str
                context.log.warning(f"⚠️  Fixed malformed decimal '{value_str}' -> '{fixed_value}' for field '{field_name}'")
                return fixed_value
            else:
                # Can't fix - reject
                context.log.warning(f"⚠️  Rejecting malformed numeric value '{value_str}' for field '{field_name}'")
                return None

        # Valid numeric value - clean commas
        return value_str.replace(',', '')

    # For TEXT fields, return as-is
    return value_str


def extract_table_data_multi_entity(
    table_data: List[List[str]],
    pattern: Dict,
    report_month: Optional[str],
    report_year: Optional[str],
    artifact: Dict,
    context
) -> List[Dict[str, Any]]:
    """
    Extract data from table using identified pattern.
    """
    # Find header row dynamically using required headers
    required_headers = pattern.get('requiredHeaders', [])
    fuzzy_threshold = pattern.get('fuzzyThreshold', 0.75)

    header_row_idx = find_header_row(table_data, required_headers, fuzzy_threshold)
    if header_row_idx == -1:
        context.log.warning(f"Could not find header row for {pattern.get('tableName')}")
        return []

    headers = table_data[header_row_idx]
    data_rows = table_data[header_row_idx + 1:]

    context.log.debug(f"   Found header row at index {header_row_idx}: {headers[:5]}...")  # Log first 5 headers

    # Get field schema for POSITIONAL MAPPING (no fuzzy matching)
    field_schema = pattern.get('fieldSchema', [])

    # Count non-metadata fields (fields that actually appear in the table)
    data_fields = [f for f in field_schema if f['name'] not in ['report_month', 'report_year']]
    metadata_fields = [f for f in field_schema if f['name'] in ['report_month', 'report_year']]

    context.log.debug(f"   Using positional mapping: {len(data_fields)} data fields + {len(metadata_fields)} metadata fields = {len(field_schema)} total")

    # Extract records using POSITIONAL MAPPING (no fuzzy matching needed)
    records = []
    for row in data_rows:
        # Skip empty rows
        if all(not cell or not str(cell).strip() for cell in row):
            continue

        # Validate row length matches data fields (not including metadata)
        if len(row) != len(data_fields):
            context.log.warning(f"   Skipping row with mismatched column count: expected {len(data_fields)} data columns, got {len(row)}")
            continue

        # POSITIONAL MAPPING: Map data fields to row positions
        record = {}
        row_idx = 0  # Track position in the actual table row

        for field in field_schema:
            field_name = field['name']
            field_type = field.get('type', 'TEXT')

            # Skip metadata fields (populated separately)
            if field_name in ['report_month', 'report_year']:
                continue

            # Get value from table row at current position
            if row_idx < len(row):
                value = row[row_idx]

                # Apply Textract OCR cleaning
                cleaned_value = clean_cell_value(value, field_name, field_type, context)
                record[field_name] = cleaned_value

                row_idx += 1  # Move to next column in table

        # Add metadata
        if len(record) >= len(data_fields) * 0.4:  # At least 40% of data fields populated
            record['report_month'] = report_month
            record['report_year'] = report_year
            record['_artifact_id'] = artifact['id']
            record['_source_id'] = artifact.get('source_id')
            records.append(record)

    return records


def batch_insert_records(supabase, table_name: str, records: List[Dict], context) -> tuple:
    """Insert records in batches with error handling."""
    batch_size = 100
    loaded_count = 0
    failed_count = 0

    # Clean records (remove metadata fields starting with _)
    clean_records = []
    for record in records:
        clean_record = {k: v for k, v in record.items() if not k.startswith('_')}
        clean_records.append(clean_record)

    for i in range(0, len(clean_records), batch_size):
        batch = clean_records[i:i + batch_size]

        try:
            response = supabase.table(table_name).insert(batch).execute()
            loaded_count += len(batch)
        except Exception as e:
            context.log.error(f"Batch insert failed: {str(e)}")

            # Try one by one
            for record in batch:
                try:
                    supabase.table(table_name).insert(record).execute()
                    loaded_count += 1
                except Exception as record_error:
                    context.log.error(f"Failed to insert record: {str(record_error)}")
                    failed_count += 1

    return (loaded_count, failed_count)
`;
}

/**
 * Check if template is a multi-entity template
 */
function isMultiEntityTemplate(template: Template | null): boolean {
  return template?.selectors?.isMultiEntity === true;
}

/**
 * Generate extraction asset (uses template, AI, or NABCA Textract)
 */
function generateExtractionAsset(
  entity: Entity,
  fields: EntityField[],
  template: Template | null,
  config: PipelineConfig
): string {
  const assetName = `extract_${entity.table_name || entity.name}`;
  const tableName = entity.table_name || entity.name;

  // Check if this is a multi-entity template (NABCA All Tables)
  if (isMultiEntityTemplate(template)) {
    // Generate multi-entity extraction code
    return generateMultiEntityExtractionAsset(entity, fields, template!, config);
  }

  // Check if this is a single-entity NABCA entity
  const nabcaInfo = getNabcaSectionInfo(fields, template);

  if (nabcaInfo) {
    // Generate NABCA-specific extraction code (single entity/section)
    return generateNabcaExtractionAsset(entity, fields, nabcaInfo, config);
  }

  return `@asset(
    name="${assetName}",
    description="Extract data from source artifacts using ${template ? 'template' : 'AI extraction'}",
    compute_kind="extraction",
    retry_policy=RetryPolicy(max_retries=3),
)
def ${assetName}(context: AssetExecutionContext) -> Dict[str, Any]:
    """
    Extract ${entity.display_name || entity.name} data from source artifacts.

    Strategy: ${config.extraction_strategy}
    Entity Type: ${entity.entity_type}
    """
    try:
        context.log.info(f"Starting extraction for ${entity.name}")

        # Initialize Supabase client
        from supabase import create_client
        import os

        supabase = create_client(
            os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Fetch source artifacts
        source_ids = ${JSON.stringify(config.source_ids)}

        query = supabase.table("artifacts").select("*")
        if source_ids:
            query = query.in_("source_id", source_ids)

        artifacts_response = query.execute()
        artifacts = artifacts_response.data

        context.log.info(f"Found {len(artifacts)} artifacts to process")

        # Extract data from each artifact
        extracted_records = []
        failed_count = 0

        for artifact in artifacts:
            try:
                record = extract_from_artifact(
                    artifact,
                    template_id=${template ? `"${template.id}"` : 'None'},
                    context=context
                )

                if record:
                    # Validate required fields
                    if validate_record(record, ${JSON.stringify(fields.filter(f => f.is_required).map(f => f.name))}):
                        extracted_records.append(record)
                    else:
                        context.log.warning(f"Validation failed for artifact {artifact['id']}")
                        failed_count += 1
                else:
                    failed_count += 1

            except Exception as e:
                context.log.error(f"Failed to extract artifact {artifact['id']}: {str(e)}")
                failed_count += 1
                continue

        success_rate = (len(extracted_records) / len(artifacts) * 100) if artifacts else 0

        context.log.info(
            f"Extraction complete: {len(extracted_records)} successful, "
            f"{failed_count} failed ({success_rate:.1f}% success rate)"
        )

        # Quality check: Alert if success rate is too low
        if success_rate < 80:
            context.log.warning(
                f"⚠️ Low extraction success rate: {success_rate:.1f}%. "
                f"Template may need adjustment."
            )

        return {
            "records": extracted_records,
            "metadata": {
                "total_artifacts": len(artifacts),
                "extracted": len(extracted_records),
                "failed": failed_count,
                "success_rate": success_rate,
            }
        }

    except Exception as e:
        context.log.error(f"Extraction failed: {str(e)}")
        context.log.error(traceback.format_exc())
        raise


def extract_from_artifact(
    artifact: Dict[str, Any],
    template_id: Optional[str],
    context: AssetExecutionContext
) -> Optional[Dict[str, Any]]:
    """
    Extract data from a single artifact using template or AI.
    """
    try:
        raw_content = artifact.get("raw_content", {})

        # Priority 1: AI-extracted fields
        if isinstance(raw_content, dict) and "fields" in raw_content:
            context.log.debug(f"Using AI-extracted fields for {artifact['id']}")
            return raw_content["fields"]

        # Priority 2: Template extraction from HTML text
        if isinstance(raw_content, dict) and "text" in raw_content:
            context.log.debug(f"Extracting from HTML text for {artifact['id']}")
            text = raw_content["text"]

            # Load template selectors if template_id provided
            template_selectors = None
            if template_id:
                try:
                    from supabase import create_client
                    import os
                    supabase = create_client(
                        os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
                        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
                    )
                    template_response = supabase.table("templates").select("selectors").eq("id", template_id).single().execute()
                    if template_response.data and template_response.data.get("selectors"):
                        template_selectors = template_response.data["selectors"]
                        context.log.debug(f"Loaded template selectors for template {template_id}")
                except Exception as e:
                    context.log.warning(f"Failed to load template selectors: {str(e)}")

            # Field extraction with template selectors
            extracted = {}
            ${generateFieldExtractionPatterns(fields, template)}

            return extracted if extracted else None

        # Priority 3: Use metadata
        if artifact.get("metadata", {}).get("extracted_data"):
            context.log.debug(f"Using metadata extraction for {artifact['id']}")
            return artifact["metadata"]["extracted_data"]

        return None

    except Exception as e:
        context.log.error(f"Extraction error for artifact {artifact['id']}: {str(e)}")
        return None
`;
}

/**
 * Generate field extraction patterns for template-based extraction
 * Generates Python code that uses template selectors at runtime
 */
function generateFieldExtractionPatterns(fields: EntityField[], template: Template | null): string {
  return fields.map(field => {
    const fieldName = field.name.toLowerCase();

    // Generate list of possible selector field names (handle name variations)
    // e.g., "ct_number" should also check "ct", "or_number" should check "or"
    const selectorFieldNames = [field.name];
    if (field.name.endsWith('_number')) {
      selectorFieldNames.push(field.name.replace('_number', ''));
    }
    if (field.name.endsWith('_id')) {
      selectorFieldNames.push(field.name.replace('_id', ''));
    }

    // ALWAYS generate code to try template selectors first (checked at runtime)
    let extractionCode = `            # Extract ${field.name}\n`;
    extractionCode += `            # Try template selector first if available (check variations)\n`;
    extractionCode += `            selector_names = ${JSON.stringify(selectorFieldNames)}\n`;
    extractionCode += `            field_selector = None\n`;
    extractionCode += `            if template_selectors and template_selectors.get("fields"):\n`;
    extractionCode += `                for sel_name in selector_names:\n`;
    extractionCode += `                    if sel_name in template_selectors["fields"]:\n`;
    extractionCode += `                        field_selector = template_selectors["fields"][sel_name]\n`;
    extractionCode += `                        break\n`;
    extractionCode += `            if field_selector:\n`;
    extractionCode += `                # Try primary pattern\n`;
    extractionCode += `                if "pattern" in field_selector and "primary" in field_selector["pattern"]:\n`;
    extractionCode += `                    pattern = field_selector["pattern"]["primary"]\n`;
    extractionCode += `                    match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)\n`;
    extractionCode += `                    if match:\n`;
    extractionCode += `                        extracted["${field.name}"] = match.group(1).strip()\n`;
    extractionCode += `                        context.log.debug(f"Extracted ${field.name} using template primary pattern")\n`;
    extractionCode += `                # Try fallback pattern if primary failed\n`;
    extractionCode += `                if "${field.name}" not in extracted and "fallback" in field_selector.get("pattern", {}):\n`;
    extractionCode += `                    pattern = field_selector["pattern"]["fallback"]\n`;
    extractionCode += `                    match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)\n`;
    extractionCode += `                    if match:\n`;
    extractionCode += `                        extracted["${field.name}"] = match.group(1).strip()\n`;
    extractionCode += `                        context.log.debug(f"Extracted ${field.name} using template fallback pattern")\n`;
    extractionCode += `            # Fallback to basic pattern if no template selector or template extraction failed\n`;
    extractionCode += `            if "${field.name}" not in extracted:\n`;

    // Generate basic fallback patterns
    const patterns: Record<string, string> = {
      'ttbid': 'TTB\\s+ID\\s*(\\d+)',
      'ttb_id': 'TTB\\s+ID\\s*(\\d+)',
      'ct': '\\bCT\\s*(\\d+)',
      'ct_number': '\\bCT\\s*(\\d+)',
      'or': '\\bOR\\s*(\\d+)',
      'or_number': '\\bOR\\s*(\\d+)',
      'serial_number': 'SERIAL\\s+NUMBER[^0-9]*(\\d+)',
      'brand_name': 'BRAND\\s+NAME[^A-Z]*([A-Z][A-Z\\s]+)',
      'product_type': 'TYPE\\s+OF\\s+PRODUCT[^A-Z]*(WINE|DISTILLED SPIRITS|MALT BEVERAGE)',
    };

    const pattern = patterns[fieldName] || `${field.display_name || field.name}[:\\s]+([^\\n]+)`;

    extractionCode += `                match = re.search(r'${pattern}', text, re.IGNORECASE)\n`;
    extractionCode += `                if match:\n`;
    extractionCode += `                    extracted["${field.name}"] = match.group(1).strip()\n`;
    extractionCode += `                    context.log.debug(f"Extracted ${field.name} using basic pattern")`;

    return extractionCode;
  }).join('\n');
}

/**
 * Generate transformation assets (Interim → Reference, Reference → Master)
 */
function generateTransformationAssets(
  entity: Entity,
  fields: EntityField[],
  relationships: Relationship[]
): string {
  if (entity.entity_type === 'INTERIM') {
    return `# No transformation needed for INTERIM entities
# Data flows directly to downstream Reference/Master entities
`;
  }

  const assetName = `transform_${entity.table_name || entity.name}`;
  const extractAssetName = `extract_${entity.table_name || entity.name}`;

  return `@asset(
    name="${assetName}",
    description="Transform extracted data to ${entity.entity_type} entity schema",
    compute_kind="transformation",
    deps=["${extractAssetName}"],
    retry_policy=RetryPolicy(max_retries=2),
)
def ${assetName}(
    context: AssetExecutionContext,
    ${extractAssetName}: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Transform ${entity.display_name || entity.name} data.

    Transformations:
    - Data type conversions
    - Field mappings
    - Deduplication
    - Data quality checks
    """
    try:
        context.log.info(f"Starting transformation for ${entity.name}")

        records = ${extractAssetName}["records"]
        transformed_records = []

        for record in records:
            try:
                transformed = transform_record(record, context)
                if transformed:
                    transformed_records.append(transformed)
            except Exception as e:
                context.log.error(f"Failed to transform record: {str(e)}")
                continue

        # Deduplication (if needed)
        if "${entity.entity_type}" == "REFERENCE":
            transformed_records = deduplicate_records(
                transformed_records,
                key_fields=${JSON.stringify(fields.filter(f => f.name.includes('id') || f.name.includes('key')).map(f => f.name))}
            )

        context.log.info(f"Transformation complete: {len(transformed_records)} records")

        return {
            "records": transformed_records,
            "metadata": {
                "input_count": len(records),
                "output_count": len(transformed_records),
                "entity_type": "${entity.entity_type}",
            }
        }

    except Exception as e:
        context.log.error(f"Transformation failed: {str(e)}")
        context.log.error(traceback.format_exc())
        raise


def transform_record(record: Dict[str, Any], context: AssetExecutionContext) -> Dict[str, Any]:
    """Apply transformations to a single record."""
    transformed = {}

    # Field mappings and type conversions
    ${generateFieldTransformations(fields)}

    return transformed
`;
}

/**
 * Generate field transformation code
 */
function generateFieldTransformations(fields: EntityField[]): string {
  return fields.map(field => {
    const typeConversions: Record<string, string> = {
      'INTEGER': 'int(record.get(field_name)) if record.get(field_name) else None',
      'BIGINT': 'int(record.get(field_name)) if record.get(field_name) else None',
      'NUMERIC': 'float(record.get(field_name)) if record.get(field_name) else None',
      'BOOLEAN': 'bool(record.get(field_name)) if record.get(field_name) is not None else None',
      'DATE': 'parse_date(record.get(field_name))',
      'TIMESTAMPTZ': 'parse_timestamp(record.get(field_name))',
      'UUID': 'str(record.get(field_name)) if record.get(field_name) else None',
      'TEXT': 'str(record.get(field_name)) if record.get(field_name) else None',
    };

    const conversion = typeConversions[field.data_type] || `record.get("${field.name}")`;

    return `    field_name = "${field.name}"
    try:
        transformed[field_name] = ${conversion}
    except (ValueError, TypeError) as e:
        context.log.warning(f"Failed to convert {field_name}: {e}")
        transformed[field_name] = None`;
  }).join('\n    \n');
}

/**
 * Generate load asset (insert into database)
 */
function generateLoadAsset(entity: Entity, fields: EntityField[], template: Template | null): string {
  // Skip load asset for multi-entity templates (extraction handles loading)
  if (isMultiEntityTemplate(template)) {
    return `# No separate load assets needed for multi-entity templates
# Data loading is handled within the multi-entity extraction asset
`;
  }

  const assetName = `load_${entity.table_name || entity.name}`;
  const transformAssetName = entity.entity_type === 'INTERIM'
    ? `extract_${entity.table_name || entity.name}`
    : `transform_${entity.table_name || entity.name}`;
  const tableName = entity.table_name || entity.name;

  return `@asset(
    name="${assetName}",
    description="Load transformed data into ${tableName} table",
    compute_kind="load",
    deps=["${transformAssetName}"],
    retry_policy=RetryPolicy(max_retries=3),
)
def ${assetName}(
    context: AssetExecutionContext,
    ${transformAssetName}: Dict[str, Any]
) -> MaterializeResult:
    """
    Load ${entity.display_name || entity.name} data into database.

    Target Table: ${tableName}
    Entity Type: ${entity.entity_type}
    """
    try:
        context.log.info(f"Starting load for ${entity.name}")

        # Initialize Supabase client
        from supabase import create_client
        import os

        supabase = create_client(
            os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        records = ${transformAssetName}["records"]

        if not records:
            context.log.warning("No records to load")
            return MaterializeResult(
                metadata={
                    "records_loaded": 0,
                    "records_failed": 0,
                }
            )

        # Remove metadata fields and clean data types
        clean_records = []
        for record in records:
            clean_record = {}
            for k, v in record.items():
                # Skip metadata fields
                if k.startswith('_'):
                    continue

                # Convert empty strings to None
                if v == '' or v is None:
                    clean_record[k] = None
                else:
                    # Remove commas and convert to proper types
                    if isinstance(v, str):
                        # Remove leading apostrophes (common in CSV/Textract output), percentages, commas, and spaces
                        v_clean = v.lstrip("'").replace('%', '').replace(',', '').replace(' ', '').strip()

                        # Try to convert to number if it looks numeric
                        if v_clean and v_clean.replace('.', '', 1).replace('-', '', 1).replace('+', '', 1).isdigit():
                            try:
                                clean_record[k] = float(v_clean) if '.' in v_clean else int(v_clean)
                            except ValueError:
                                clean_record[k] = v
                        else:
                            clean_record[k] = v
                    else:
                        clean_record[k] = v

            clean_records.append(clean_record)

        context.log.info(f"Cleaned {len(clean_records)} records (removed metadata, converted types)")

        # Batch insert with error handling
        batch_size = 100
        loaded_count = 0
        failed_count = 0

        for i in range(0, len(clean_records), batch_size):
            batch = clean_records[i:i + batch_size]

            try:
                response = supabase.table("${tableName}").insert(batch).execute()
                loaded_count += len(batch)
                context.log.info(f"Loaded batch {i//batch_size + 1}: {len(batch)} records")

            except Exception as e:
                context.log.error(f"Batch insert failed: {str(e)}")

                # Try inserting records one by one
                for record in batch:
                    try:
                        supabase.table("${tableName}").insert(record).execute()
                        loaded_count += 1
                    except Exception as record_error:
                        context.log.error(
                            f"Failed to insert record: {str(record_error)}"
                        )
                        failed_count += 1

        success_rate = (loaded_count / len(clean_records) * 100) if clean_records else 0

        context.log.info(
            f"Load complete: {loaded_count} loaded, {failed_count} failed "
            f"({success_rate:.1f}% success rate)"
        )

        # Quality check
        if success_rate < 95:
            context.log.warning(
                f"⚠️ Load success rate below 95%: {success_rate:.1f}%"
            )

        return MaterializeResult(
            metadata={
                "records_loaded": MetadataValue.int(loaded_count),
                "records_failed": MetadataValue.int(failed_count),
                "success_rate": MetadataValue.float(success_rate),
                "table_name": MetadataValue.text("${tableName}"),
            }
        )

    except Exception as e:
        context.log.error(f"Load failed: {str(e)}")
        context.log.error(traceback.format_exc())
        raise
`;
}

/**
 * Generate utility functions
 */
function generateUtilityFunctions(): string {
  return `def validate_record(record: Dict[str, Any], required_fields: List[str]) -> bool:
    """Validate that all required fields are present and non-empty."""
    for field in required_fields:
        if field not in record or record[field] is None or record[field] == "":
            return False
    return True


def deduplicate_records(
    records: List[Dict[str, Any]],
    key_fields: List[str]
) -> List[Dict[str, Any]]:
    """Remove duplicate records based on key fields."""
    seen = set()
    unique_records = []

    for record in records:
        # Create a key from specified fields
        key = tuple(record.get(field) for field in key_fields)

        if key not in seen:
            seen.add(key)
            unique_records.append(record)

    return unique_records


def parse_date(value: Any) -> Optional[str]:
    """Parse various date formats to ISO format."""
    if not value:
        return None

    import dateutil.parser

    try:
        if isinstance(value, str):
            dt = dateutil.parser.parse(value)
            return dt.date().isoformat()
        return str(value)
    except Exception:
        return None


def parse_timestamp(value: Any) -> Optional[str]:
    """Parse various timestamp formats to ISO format."""
    if not value:
        return None

    import dateutil.parser

    try:
        if isinstance(value, str):
            dt = dateutil.parser.parse(value)
            return dt.isoformat()
        return str(value)
    except Exception:
        return None
`;
}

/**
 * Build dependency graph for assets
 */
function buildDependencyGraph(
  entity: Entity,
  relationships: Relationship[]
): Record<string, string[]> {
  const extractAsset = `extract_${entity.table_name || entity.name}`;
  const transformAsset = `transform_${entity.table_name || entity.name}`;
  const loadAsset = `load_${entity.table_name || entity.name}`;

  const dependencies: Record<string, string[]> = {};

  if (entity.entity_type === 'INTERIM') {
    dependencies[loadAsset] = [extractAsset];
  } else {
    dependencies[transformAsset] = [extractAsset];
    dependencies[loadAsset] = [transformAsset];
  }

  // Add relationship dependencies
  for (const rel of relationships) {
    if (rel.to_entity_id === entity.id) {
      // This entity depends on another
      const depAsset = `load_${rel.from_entity_id}`;
      if (!dependencies[extractAsset]) {
        dependencies[extractAsset] = [];
      }
      dependencies[extractAsset].push(depAsset);
    }
  }

  return dependencies;
}
