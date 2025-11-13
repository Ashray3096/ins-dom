"""
HTML Extractor Component

Extracts data from HTML files using AI-based extraction
Uses Claude to understand HTML structure and extract field values
"""

import sys
import os
import requests
from typing import Dict, List, Any
from dagster import op, job, Config, Out
from .base_extractor import BaseExtractor


class HTMLExtractorComponent(BaseExtractor):
    """Extract data from HTML files using AI"""

    def extract(self, artifact: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract data from HTML artifact using AI

        Args:
            artifact: Dict containing either:
                - 'content': bytes (from S3)
                - 'raw_content': dict (from artifacts table with 'html' key)

        Returns:
            List of records (typically just 1 record per HTML file)
        """
        # Get HTML content
        if 'content' in artifact:
            # From S3 - decode bytes
            html_content = artifact['content'].decode('utf-8')
        elif 'raw_content' in artifact:
            # From artifacts table
            if isinstance(artifact['raw_content'], dict):
                html_content = artifact['raw_content'].get('html', '')
            elif isinstance(artifact['raw_content'], str):
                html_content = artifact['raw_content']
            else:
                raise ValueError(f"Unknown raw_content format: {type(artifact['raw_content'])}")
        else:
            raise ValueError("Artifact missing content")

        # Call Next.js AI extraction API
        api_url = 'http://localhost:3000'

        try:
            print(f"Calling AI extraction API for file: {artifact.get('filename', 'unknown')}", file=sys.stderr, flush=True)

            response = requests.post(
                f'{api_url}/api/extract/html-ai',
                json={
                    'html': html_content,
                    'template': self.template  # Pass full template with fields + selectors
                },
                timeout=60  # AI takes longer than selector-based
            )

            if response.status_code != 200:
                error_text = response.text
                print(f"❌ AI extraction failed: {error_text}", file=sys.stderr, flush=True)
                return [{}]

            result = response.json()

            if not result.get('success'):
                print(f"❌ Extraction failed: {result.get('error')}", file=sys.stderr, flush=True)
                return [{}]

            record = result.get('data', {})
            fields_with_values = result.get('fieldsWithValues', 0)
            total_fields = result.get('fieldsExtracted', 0)

            print(f"✅ AI extracted {fields_with_values}/{total_fields} fields with values", file=sys.stderr, flush=True)

            return [record]

        except Exception as e:
            print(f"❌ Error calling AI extraction API: {e}", file=sys.stderr, flush=True)
            return [{}]


# Dagster job configuration
class HTMLExtractionConfig(Config):
    """Configuration for HTML extraction job"""
    entity_id: str
    template_id: str
    source_id: str


@op(out=Out(Dict[str, Any]))
def run_html_extraction(config: HTMLExtractionConfig) -> Dict[str, Any]:
    """Dagster op to run HTML extraction"""
    extractor = HTMLExtractorComponent({
        'entity_id': config.entity_id,
        'template_id': config.template_id,
        'source_id': config.source_id,
    })

    return extractor.run()


@job
def html_extraction_job():
    """Dagster job for HTML extraction"""
    run_html_extraction()
