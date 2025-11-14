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
import os
from supabase import create_client, Client
from components.json_extractor import JSONExtractorComponent
from components.csv_extractor import CSVExtractorComponent
from components.html_extractor import HTMLExtractorComponent
from components.email_extractor import EmailExtractorComponent

# Initialize Supabase client for progress updates
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def update_job_progress(job_id, current, total, message, status='running'):
    """Update pipeline job progress in database"""
    if not job_id or not supabase:
        return

    try:
        supabase.table('pipeline_jobs').update({
            'status': status,
            'progress_current': current,
            'progress_total': total,
            'progress_message': message,
            'updated_at': 'now()'
        }).eq('id', job_id).execute()
    except Exception as e:
        print(f"Warning: Failed to update job progress: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description='Run data extraction pipeline')
    parser.add_argument('--entity-id', required=True, help='Target entity ID')
    parser.add_argument('--template-id', required=True, help='Template ID with extraction rules')
    parser.add_argument('--source-id', required=True, help='Source ID to fetch data from')
    parser.add_argument('--artifact-type', required=True, help='Artifact type (json, csv, html, pdf, email)')
    parser.add_argument('--job-id', required=False, help='Pipeline job ID for progress tracking')

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
        # Update job status to running
        if args.job_id:
            update_job_progress(args.job_id, 0, 0, 'Starting extraction...', 'running')

        # Create extractor and run
        extractor = extractor_class(config)

        # Pass job_id to extractor for progress updates
        if args.job_id:
            extractor.job_id = args.job_id
            extractor.update_progress = lambda current, total, msg: update_job_progress(
                args.job_id, current, total, msg, 'running'
            )

        result = extractor.run()

        # Mark job as completed
        if args.job_id:
            update_job_progress(
                args.job_id,
                result.get('artifacts_processed', 0),
                result.get('artifacts_processed', 0),
                f"Completed: {result.get('records_loaded', 0)} records loaded",
                'completed'
            )

            # Store final result
            supabase.table('pipeline_jobs').update({
                'completed_at': 'now()',
                'result': result
            }).eq('id', args.job_id).execute()

        # Return success result as JSON
        print(json.dumps({
            'success': True,
            **result
        }))
        sys.exit(0)

    except Exception as e:
        # Mark job as failed
        if args.job_id:
            update_job_progress(
                args.job_id, 0, 0, f'Error: {str(e)}', 'failed'
            )
            supabase.table('pipeline_jobs').update({
                'completed_at': 'now()',
                'error': str(e)
            }).eq('id', args.job_id).execute()

        # Return error as JSON
        print(json.dumps({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
