#!/usr/bin/env python3
"""
Test S3-based Textract Async API

This script:
1. Lists files in s3://nabca-data/raw-pdfs/
2. Picks one file
3. Processes with Textract async API
4. Analyzes results
"""

import boto3
import time
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Initialize clients
s3_client = boto3.client(
    's3',
    region_name=os.getenv('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
)

textract_client = boto3.client(
    'textract',
    region_name=os.getenv('AWS_REGION', 'us-east-1'),
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
)

def list_s3_files(bucket, prefix):
    """List files in S3 bucket"""
    print(f"📂 Listing files in s3://{bucket}/{prefix}")

    response = s3_client.list_objects_v2(
        Bucket=bucket,
        Prefix=prefix,
        MaxKeys=10
    )

    return response.get('Contents', [])

def process_with_textract(bucket, key):
    """Process PDF with Textract async API"""
    print(f"\n🚀 Starting Textract async job for s3://{bucket}/{key}")

    # Start async job
    response = textract_client.start_document_analysis(
        DocumentLocation={
            'S3Object': {
                'Bucket': bucket,
                'Name': key
            }
        },
        FeatureTypes=['TABLES', 'FORMS']
    )

    job_id = response['JobId']
    print(f"✅ Job started: {job_id}")

    # Poll for completion
    status = 'IN_PROGRESS'
    blocks = []
    pages = 0
    start_time = time.time()

    while status == 'IN_PROGRESS':
        time.sleep(5)  # Poll every 5 seconds

        elapsed_time = int(time.time() - start_time)
        print(f"⏳ Polling job status... ({elapsed_time}s elapsed)")

        response = textract_client.get_document_analysis(JobId=job_id)
        status = response['JobStatus']
        print(f"   Status: {status}")

        if status == 'SUCCEEDED':
            # Collect all blocks
            if 'Blocks' in response:
                blocks.extend(response['Blocks'])

            pages = response.get('DocumentMetadata', {}).get('Pages', 0)

            # Handle pagination
            next_token = response.get('NextToken')
            while next_token:
                print(f"   Fetching next page of results...")
                response = textract_client.get_document_analysis(
                    JobId=job_id,
                    NextToken=next_token
                )
                if 'Blocks' in response:
                    blocks.extend(response['Blocks'])
                next_token = response.get('NextToken')

            print(f"✅ Job completed! Found {len(blocks)} blocks across {pages} pages")
            break

        elif status == 'FAILED':
            raise Exception(f"Textract job failed: {response.get('StatusMessage')}")

        # Safety timeout after 20 minutes
        if elapsed_time > 1200:
            raise Exception('Job timed out after 20 minutes')

    return blocks, pages

def extract_tables(blocks):
    """Extract tables from Textract blocks"""
    tables = []
    block_map = {block['Id']: block for block in blocks}

    # Find all TABLE blocks
    table_blocks = [b for b in blocks if b.get('BlockType') == 'TABLE']

    for table_idx, table_block in enumerate(table_blocks):
        cells = {}
        max_row = 0
        max_col = 0

        # Get all CELL blocks for this table
        relationships = table_block.get('Relationships', [])
        for relationship in relationships:
            if relationship['Type'] == 'CHILD':
                for cell_id in relationship['Ids']:
                    cell_block = block_map.get(cell_id)
                    if cell_block and cell_block.get('BlockType') == 'CELL':
                        row_idx = cell_block.get('RowIndex', 0)
                        col_idx = cell_block.get('ColumnIndex', 0)
                        max_row = max(max_row, row_idx)
                        max_col = max(max_col, col_idx)

                        # Get cell text
                        cell_text = get_cell_text(cell_block, block_map)
                        cells[f"{row_idx},{col_idx}"] = cell_text

        # Build 2D array
        data = []
        for row in range(1, max_row + 1):
            row_data = []
            for col in range(1, max_col + 1):
                row_data.append(cells.get(f"{row},{col}", ''))
            data.append(row_data)

        tables.append({
            'tableIndex': table_idx,
            'rows': max_row,
            'columns': max_col,
            'data': data,
            'page': table_block.get('Page', 1)
        })

    return tables

def get_cell_text(cell_block, block_map):
    """Get text content from a CELL block"""
    texts = []
    relationships = cell_block.get('Relationships', [])

    for relationship in relationships:
        if relationship['Type'] == 'CHILD':
            for child_id in relationship['Ids']:
                child_block = block_map.get(child_id)
                if child_block and 'Text' in child_block:
                    texts.append(child_block['Text'])

    return ' '.join(texts).strip()

def analyze_results(blocks, pages):
    """Analyze Textract results"""
    print(f"\n📊 Analyzing Textract Results:")
    print(f"   Total Blocks: {len(blocks)}")
    print(f"   Total Pages: {pages}")

    # Count block types
    block_types = {}
    for block in blocks:
        block_type = block.get('BlockType', 'UNKNOWN')
        block_types[block_type] = block_types.get(block_type, 0) + 1

    print(f"\n📋 Block Types:")
    for block_type, count in block_types.items():
        print(f"   {block_type}: {count}")

    # Extract tables
    tables = extract_tables(blocks)

    print(f"\n✅ Extraction Summary:")
    print(f"   Tables: {len(tables)}")

    # Show sample of first table
    if tables:
        print(f"\n📋 Sample: First Table (Table 0)")
        first_table = tables[0]
        print(f"   Size: {first_table['rows']} rows × {first_table['columns']} columns")
        print(f"   Page: {first_table['page']}")
        print(f"   Data (first 5 rows):")
        for idx, row in enumerate(first_table['data'][:5]):
            row_preview = ' | '.join(row[:5])
            if len(row) > 5:
                row_preview += ' | ...'
            print(f"     Row {idx}: [{row_preview}]")

    # Show some LINE blocks
    line_blocks = [b for b in blocks if b.get('BlockType') == 'LINE'][:20]
    if line_blocks:
        print(f"\n📝 Sample: First 20 Text Lines")
        for idx, block in enumerate(line_blocks):
            text = block.get('Text', '')
            page = block.get('Page', 1)
            print(f"   {idx}. [Page {page}] {text}")

    return tables

def main():
    try:
        print('🧪 Testing S3-based Textract Async API\n')

        # Step 1: List files
        files = list_s3_files('nabca-data', 'raw-pdfs/')

        if not files:
            print('❌ No files found in bucket')
            return

        print(f"\n📁 Found {len(files)} files:")
        for idx, file in enumerate(files):
            size_kb = round(file.get('Size', 0) / 1024)
            print(f"   {idx + 1}. {file['Key']} ({size_kb} KB)")

        # Step 2: Pick the first PDF
        selected_file = files[0]
        print(f"\n✨ Selected: {selected_file['Key']}")

        # Step 3: Process with Textract
        blocks, pages = process_with_textract('nabca-data', selected_file['Key'])

        # Step 4: Analyze results
        tables = analyze_results(blocks, pages)

        print(f"\n✅ Test Complete!")
        print(f"\nConclusion:")
        print(f"  - S3-based async API works: ✅")
        print(f"  - Tables extracted: {len(tables)}")
        print(f"  - Data quality: {'✅ Good' if tables else '⚠️ Check manually'}")

    except Exception as error:
        print(f'❌ Error: {error}')
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == '__main__':
    main()
