#!/usr/bin/env python3
"""
Extraction Runner Script

Executes Dagster extraction components from command line
Called by Next.js API to run pipelines

Usage:
    python run_extraction.py --entity-id UUID --template-id UUID --source-id UUID
"""

import sys
import json
import argparse
from components.json_extractor import JSONExtractorComponent
from components.csv_extractor import CSVExtractorComponent
from components.html_extractor import HTMLExtractorComponent
from components.email_extractor import EmailExtractorComponent


def main():
    parser = argparse.ArgumentParser(description='Run data extraction pipeline')
    parser.add_argument('--entity-id', required=True, help='Target entity ID')
    parser.add_argument('--template-id', required=True, help='Template ID with extraction rules')
    parser.add_argument('--source-id', required=True, help='Source ID to fetch data from')
    parser.add_argument('--artifact-type', required=True, help='Artifact type (json, csv, html, pdf, email)')

    args = parser.parse_args()

    config = {
        'entity_id': args.entity_id,
        'template_id': args.template_id,
        'source_id': args.source_id,
    }

    # Select appropriate extractor based on artifact type
    extractor_map = {
        'json': JSONExtractorComponent,
        'csv': CSVExtractorComponent,
        'html': HTMLExtractorComponent,
        'email': EmailExtractorComponent,
        # TODO: Add PDF when ready
    }

    extractor_class = extractor_map.get(args.artifact_type)

    if not extractor_class:
        print(json.dumps({
            'success': False,
            'error': f'Unsupported artifact type: {args.artifact_type}'
        }))
        sys.exit(1)

    try:
        # Create extractor and run
        extractor = extractor_class(config)
        result = extractor.run()

        # Return success result as JSON
        print(json.dumps({
            'success': True,
            **result
        }))
        sys.exit(0)

    except Exception as e:
        # Return error as JSON
        print(json.dumps({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
