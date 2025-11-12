#!/usr/bin/env python3
"""
Test script to debug NABCA extraction and loading
Mimics the exact pipeline logic with detailed debugging
"""

import os
import json
import time
import io
from typing import List, Dict, Any
from difflib import SequenceMatcher
from dotenv import load_dotenv
import boto3
from supabase import create_client

# Load environment variables
load_dotenv('.env.local')

def parse_textract_tables(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Parse Textract blocks into table structure - EXACT COPY FROM PIPELINE"""
    tables = []

    # Find all TABLE blocks
    table_blocks = [b for b in blocks if b.get('BlockType') == 'TABLE']

    for table_block in table_blocks:
        table_id = table_block['Id']

        # Get table dimensions
        rows = table_block.get('RowSpan', 0)
        cols = table_block.get('ColumnSpan', 0)

        # Initialize grid
        if rows > 0 and cols > 0:
            grid = [['' for _ in range(cols)] for _ in range(rows)]
        else:
            # Fallback: count cells
            if 'Relationships' not in table_block:
                continue

            cells = []
            for rel in table_block['Relationships']:
                if rel['Type'] == 'CHILD':
                    for cell_id in rel['Ids']:
                        cell_block = next((b for b in blocks if b.get('Id') == cell_id), None)
                        if cell_block and cell_block.get('BlockType') == 'CELL':
                            cells.append(cell_block)

            if not cells:
                continue

            max_row = max(cell.get('RowIndex', 1) for cell in cells)
            max_col = max(cell.get('ColumnIndex', 1) for cell in cells)
            grid = [['' for _ in range(max_col)] for _ in range(max_row)]

        # Fill grid with cell values
        if 'Relationships' not in table_block:
            continue

        for rel in table_block['Relationships']:
            if rel['Type'] == 'CHILD':
                for cell_id in rel['Ids']:
                    cell_block = next((b for b in blocks if b.get('Id') == cell_id), None)
                    if not cell_block or cell_block.get('BlockType') != 'CELL':
                        continue

                    row = cell_block.get('RowIndex', 1) - 1
                    col = cell_block.get('ColumnIndex', 1) - 1

                    # Get cell text
                    cell_text = ''
                    if 'Relationships' in cell_block:
                        for cell_rel in cell_block['Relationships']:
                            if cell_rel['Type'] == 'CHILD':
                                for word_id in cell_rel['Ids']:
                                    word_block = next((b for b in blocks if b.get('Id') == word_id), None)
                                    if word_block and word_block.get('BlockType') == 'WORD':
                                        cell_text += word_block.get('Text', '') + ' '

                    grid[row][col] = cell_text.strip()

        tables.append({'data': grid})

    return tables


def similarity(a: str, b: str) -> float:
    """Calculate similarity ratio between two strings."""
    return SequenceMatcher(None, a, b).ratio()


def extract_nabca_table_data(
    textract_result: Dict[str, Any],
    semantic_fields: List[Dict[str, str]]
) -> List[Dict[str, Any]]:
    """Extract and map table data - EXACT COPY FROM PIPELINE"""

    tables = textract_result.get("tables", [])
    if not tables:
        print("⚠️  No tables found in Textract results")
        return []

    print(f"\n🔍 Processing {len(tables)} tables...")

    # Merge all tables (NABCA PDFs often span multiple pages/tables)
    all_table_data = []
    for idx, table in enumerate(tables):
        table_data_raw = table.get("data", [])
        print(f"  Table {idx + 1}: {len(table_data_raw)} rows")

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
            print(f"    Skipping {data_start_idx} header rows, merging {len(table_data_raw) - data_start_idx} data rows")
            all_table_data.extend(table_data_raw[data_start_idx:])

    table_data = all_table_data
    print(f"\n✅ Merged table data: {len(table_data)} total rows")

    if len(table_data) < 2:
        print("⚠️  Table has no data rows")
        return []

    print(f"\n📊 RAW TABLE DATA ({len(table_data)} rows total):")
    for idx, row in enumerate(table_data[:10]):  # Show first 10 rows
        print(f"  Row {idx}: {row[:3]}... (showing first 3 cells)")

    # Find the real header row
    header_row_idx = 0
    max_non_empty = 0

    for idx, row in enumerate(table_data[:5]):
        non_empty_count = sum(1 for cell in row if cell and cell.strip() and cell.strip() != "'")
        if non_empty_count > max_non_empty:
            max_non_empty = non_empty_count
            header_row_idx = idx
        print(f"  Row {idx}: {non_empty_count} non-empty cells")

    print(f"\n✅ Detected header row at index {header_row_idx} (has {max_non_empty} non-empty cells)")

    headers = table_data[header_row_idx]
    data_rows = table_data[header_row_idx + 1:]

    print(f"📋 Headers: {headers}")
    print(f"📈 Data rows: {len(data_rows)}")
    print(f"🎯 Semantic fields: {[f['name'] for f in semantic_fields]}")

    # Build column mapping
    column_mapping = {}

    # Check if headers are empty OR if we have duplicate headers (like multiple "Case Sales")
    headers_empty = all(not h or not h.strip() for h in headers)
    has_duplicates = len(headers) != len(set(h.strip().lower() for h in headers if h and h.strip()))

    if headers_empty or has_duplicates:
        if headers_empty:
            print("\n⚠️  All headers are empty! Using positional mapping.")
        else:
            print(f"\n⚠️  Duplicate headers detected! Using positional mapping.")
            print(f"    Headers: {headers}")
        if len(semantic_fields) == len(headers):
            for idx, field in enumerate(semantic_fields):
                column_mapping[idx] = field["name"]
                print(f"  ✅ Column {idx} -> {field['name']}")
        else:
            print(f"  ❌ Column count mismatch: {len(headers)} vs {len(semantic_fields)}")
    else:
        print("\n🔍 Using fuzzy matching for headers:")
        for col_idx, header in enumerate(headers):
            if not header or not header.strip():
                continue

            best_match = None
            best_score = 0.0

            for field in semantic_fields:
                score1 = similarity(header.lower(), field["name"].lower())
                score2 = similarity(header.lower(), field["displayName"].lower())
                score = max(score1, score2)

                if score > best_score:
                    best_score = score
                    best_match = field["name"]

            if best_match and best_score > 0.5:
                column_mapping[col_idx] = best_match
                print(f"  ✅ Column {col_idx} '{header}' -> '{best_match}' (score: {best_score:.2f})")
            else:
                print(f"  ⚠️  No match for '{header}' (best: {best_match}, score: {best_score:.2f})")

    print(f"\n📊 Final mapping: {column_mapping}")

    # Extract records
    records = []
    for row_idx, row in enumerate(data_rows):
        record = {}
        for col_idx, value in enumerate(row):
            if col_idx in column_mapping:
                field_name = column_mapping[col_idx]
                record[field_name] = value.strip() if isinstance(value, str) else value

        # Only include records with at least 50% fields mapped
        if len(record) >= len(semantic_fields) * 0.5:
            records.append(record)
            if row_idx < 5:  # Show first 5 records
                print(f"  ✅ Record {row_idx + 1}: {record}")
        else:
            print(f"  ⚠️  Skipping row {row_idx + 1} with too few fields: {record}")

    print(f"\n✅ Extracted {len(records)} valid records")
    return records


def clean_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Clean and convert data types - EXACT COPY FROM PIPELINE"""
    clean_rec = {}

    for k, v in record.items():
        if k.startswith('_'):
            continue

        if v == '' or v is None:
            clean_rec[k] = None
        else:
            if isinstance(v, str):
                # Remove leading apostrophes, percentages, commas, and spaces
                v_clean = v.lstrip("'").replace('%', '').replace(',', '').replace(' ', '').strip()

                # Try to convert to number
                if v_clean and v_clean.replace('.', '', 1).replace('-', '', 1).replace('+', '', 1).isdigit():
                    try:
                        clean_rec[k] = float(v_clean) if '.' in v_clean else int(v_clean)
                    except ValueError:
                        clean_rec[k] = v
                else:
                    clean_rec[k] = v
            else:
                clean_rec[k] = v

    return clean_rec


def main():
    print("🚀 NABCA Extraction Test Script\n")
    print("=" * 80)

    # 1. Setup clients
    print("\n📦 Setting up AWS and Supabase clients...")
    textract = boto3.client('textract', region_name=os.getenv("AWS_REGION", "us-east-1"))
    s3_client = boto3.client('s3', region_name=os.getenv("AWS_REGION", "us-east-1"))

    supabase = create_client(
        os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # 2. Read section.pdf
    pdf_path = "section.pdf"
    if not os.path.exists(pdf_path):
        print(f"❌ {pdf_path} not found! Please ensure it exists in the current directory.")
        return

    print(f"✅ Found {pdf_path}")

    with open(pdf_path, 'rb') as f:
        pdf_data = f.read()

    print(f"📄 PDF size: {len(pdf_data)} bytes")

    # 3. Upload to S3
    print("\n📤 Uploading to S3 for Textract...")
    s3_bucket = os.getenv("TEXTRACT_S3_BUCKET") or os.getenv("AWS_S3_BUCKET")
    s3_key = "textract-temp/test-nabca-extraction/section.pdf"

    s3_client.put_object(Bucket=s3_bucket, Key=s3_key, Body=pdf_data)
    print(f"✅ Uploaded to s3://{s3_bucket}/{s3_key}")

    # 4. Start Textract job
    print("\n🔍 Starting Textract async analysis...")
    response = textract.start_document_analysis(
        DocumentLocation={'S3Object': {'Bucket': s3_bucket, 'Name': s3_key}},
        FeatureTypes=['TABLES', 'FORMS']
    )

    job_id = response['JobId']
    print(f"✅ Job started: {job_id}")

    # 5. Wait for completion
    print("\n⏳ Waiting for Textract to complete...")
    max_wait = 300  # 5 minutes
    start_time = time.time()

    while True:
        elapsed = time.time() - start_time
        if elapsed > max_wait:
            print("❌ Timeout waiting for Textract")
            return

        response = textract.get_document_analysis(JobId=job_id)
        status = response.get('JobStatus', response.get('Status', 'UNKNOWN'))

        if status == 'SUCCEEDED':
            print(f"✅ Textract completed in {elapsed:.1f}s")
            break
        elif status == 'FAILED':
            print(f"❌ Textract failed: {response.get('StatusMessage')}")
            return

        print(f"  Status: {status} ({elapsed:.1f}s)")
        time.sleep(2)

    # 6. Get all results
    print("\n📥 Retrieving Textract results...")
    blocks = response.get('Blocks', [])

    # Get additional pages if any
    next_token = response.get('NextToken')
    while next_token:
        response = textract.get_document_analysis(JobId=job_id, NextToken=next_token)
        blocks.extend(response.get('Blocks', []))
        next_token = response.get('NextToken')

    print(f"✅ Retrieved {len(blocks)} blocks")

    # 7. Parse tables
    print("\n📊 Parsing tables...")
    tables = parse_textract_tables(blocks)
    print(f"✅ Found {len(tables)} tables")

    # 8. Extract data
    print("\n🎯 Extracting data with field mapping...")
    semantic_fields = [
        {"name": "brand", "displayName": "brand"},
        {"name": "type", "displayName": "type"},
        {"name": "ytd_rank", "displayName": "ytd_rank"},
        {"name": "ytd_pct_total", "displayName": "ytd_pct_total"},
        {"name": "ytd_case_sales", "displayName": "ytd_case_sales"},
        {"name": "ytd_vs_last_year", "displayName": "ytd_vs_last_year"},
        {"name": "current_month_case_sales", "displayName": "current_month_case_sales"},
        {"name": "current_month_vs_last_year", "displayName": "current_month_vs_last_year"},
        {"name": "l12m_case_sales", "displayName": "l12m_case_sales"},
    ]

    textract_result = {"tables": tables}
    records = extract_nabca_table_data(textract_result, semantic_fields)

    # 9. Clean records
    print("\n🧹 Cleaning records...")
    clean_records = [clean_record(r) for r in records]

    print(f"\n📋 Sample cleaned records (first 3):")
    for idx, rec in enumerate(clean_records[:3]):
        print(f"\n  Record {idx + 1}:")
        for k, v in rec.items():
            print(f"    {k}: {v} ({type(v).__name__})")

    # 10. Insert into Supabase
    print(f"\n💾 Attempting to insert {len(clean_records)} records into Supabase...")

    table_name = "raw_nabca_brand_leaders"
    loaded = 0
    failed = 0

    # Try batch insert first
    try:
        response = supabase.table(table_name).insert(clean_records).execute()
        loaded = len(clean_records)
        print(f"✅ Batch insert succeeded: {loaded} records")
    except Exception as e:
        print(f"⚠️  Batch insert failed: {str(e)}")
        print("\n🔄 Trying one-by-one insertion...")

        for idx, record in enumerate(clean_records):
            try:
                supabase.table(table_name).insert(record).execute()
                loaded += 1
                if idx < 5:  # Show first 5
                    print(f"  ✅ Record {idx + 1} inserted")
            except Exception as rec_error:
                failed += 1
                print(f"  ❌ Record {idx + 1} failed: {str(rec_error)}")
                if idx < 3:  # Show first 3 failures
                    print(f"     Data: {record}")

    # 11. Summary
    print("\n" + "=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    print(f"  Extracted records: {len(records)}")
    print(f"  Cleaned records:   {len(clean_records)}")
    print(f"  Loaded to DB:      {loaded}")
    print(f"  Failed:            {failed}")
    if clean_records:
        print(f"  Success rate:      {loaded / len(clean_records) * 100:.1f}%")
    else:
        print(f"  Success rate:      N/A (no records)")

    if loaded == len(clean_records):
        print("\n🎉 SUCCESS! All records loaded correctly!")
    else:
        print(f"\n⚠️  Only {loaded}/{len(clean_records)} records loaded. Check errors above.")


if __name__ == "__main__":
    main()
