#!/usr/bin/env python3
"""
Analyze NABCA Textract output to extract actual table headers
"""

import json
import sys

def parse_textract_tables(blocks):
    """Extract tables from Textract blocks"""
    tables = []

    # Build lookup dictionaries
    block_map = {block['Id']: block for block in blocks}

    # Find all TABLE blocks
    for block in blocks:
        if block['BlockType'] == 'TABLE':
            table = parse_table(block, block_map)
            if table:
                tables.append(table)

    return tables

def parse_table(table_block, block_map):
    """Parse a single table block"""
    if 'Relationships' not in table_block:
        return None

    rows = {}

    # Get all CELL blocks
    for relationship in table_block['Relationships']:
        if relationship['RelationshipType'] == 'CHILD':
            for cell_id in relationship['Ids']:
                cell = block_map.get(cell_id)
                if cell and cell['BlockType'] == 'CELL':
                    row_index = cell.get('RowIndex', 1)
                    col_index = cell.get('ColumnIndex', 1)

                    if row_index not in rows:
                        rows[row_index] = {}

                    # Get cell text
                    cell_text = ''
                    if 'Relationships' in cell:
                        for rel in cell['Relationships']:
                            if rel['RelationshipType'] == 'CHILD':
                                for word_id in rel['Ids']:
                                    word = block_map.get(word_id)
                                    if word and 'Text' in word:
                                        cell_text += word['Text'] + ' '

                    rows[row_index][col_index] = cell_text.strip()

    # Convert to 2D array
    if not rows:
        return None

    max_row = max(rows.keys())
    max_col = max(max(row.keys()) if row else 0 for row in rows.values())

    table_data = []
    for r in range(1, max_row + 1):
        row_data = []
        for c in range(1, max_col + 1):
            row_data.append(rows.get(r, {}).get(c, ''))
        table_data.append(row_data)

    return table_data

def main():
    print("Loading Textract output...")
    with open('sample_all_tables_results.json', 'r') as f:
        data = json.load(f)

    blocks = data.get('Blocks', [])
    print(f"Total blocks: {len(blocks)}")

    print("\nParsing tables...")
    tables = parse_textract_tables(blocks)
    print(f"Found {len(tables)} tables")

    print("\n" + "="*80)
    print("TABLE HEADERS ANALYSIS")
    print("="*80)

    for i, table in enumerate(tables, 1):
        if not table or len(table) < 1:
            continue

        print(f"\n{'='*80}")
        print(f"TABLE {i}")
        print(f"{'='*80}")
        print(f"Dimensions: {len(table)} rows x {len(table[0]) if table else 0} columns")

        # Print first 5 rows to see where headers might be
        print(f"\nFirst 5 rows:")
        for row_idx, row in enumerate(table[:5], 1):
            # Filter out empty cells
            non_empty = [cell for cell in row if cell.strip()]
            if non_empty:
                print(f"  Row {row_idx}: {non_empty}")

        print()

if __name__ == '__main__':
    main()
