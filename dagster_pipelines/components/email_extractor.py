"""
Email Extractor Component

Extracts data from email files using AI-based extraction
Parses RFC822/MIME format and uses Claude to extract structured data
"""

import sys
import requests
from typing import Dict, List, Any
from dagster import op, job, Config, Out
from .base_extractor import BaseExtractor


class EmailExtractorComponent(BaseExtractor):
    """Extract data from email files using AI"""

    def extract(self, artifact: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract data from email artifact using AI

        Args:
            artifact: Dict containing either:
                - 'content': bytes (from S3)
                - 'raw_content': dict/str (from artifacts table)

        Returns:
            List of records (typically just 1 record per email)
        """
        # Get email content
        if 'content' in artifact:
            # From S3 - decode bytes
            email_content = artifact['content'].decode('utf-8')
        elif 'raw_content' in artifact:
            # From artifacts table
            if isinstance(artifact['raw_content'], dict):
                email_content = artifact['raw_content'].get('content', '')
            elif isinstance(artifact['raw_content'], str):
                email_content = artifact['raw_content']
            else:
                raise ValueError(f"Unknown raw_content format: {type(artifact['raw_content'])}")
        else:
            raise ValueError("Artifact missing content")

        # Call Next.js AI extraction API
        api_url = 'http://localhost:3000'

        try:
            print(f"Calling AI email extraction for file: {artifact.get('filename', 'unknown')}", file=sys.stderr, flush=True)

            response = requests.post(
                f'{api_url}/api/extract/email-ai',
                json={
                    'email_content': email_content,
                    'template': self.template
                },
                timeout=60
            )

            if response.status_code != 200:
                error_text = response.text
                print(f"❌ AI email extraction failed: {error_text}", file=sys.stderr, flush=True)
                return [{}]

            result = response.json()

            if not result.get('success'):
                print(f"❌ Extraction failed: {result.get('error')}", file=sys.stderr, flush=True)
                return [{}]

            record = result.get('data', {})
            fields_with_values = result.get('fieldsWithValues', 0)
            total_fields = result.get('fieldsExtracted', 0)

            print(f"✅ AI extracted {fields_with_values}/{total_fields} fields from email", file=sys.stderr, flush=True)

            return [record]

        except Exception as e:
            print(f"❌ Error calling AI email extraction API: {e}", file=sys.stderr, flush=True)
            return [{}]


# Dagster job configuration
class EmailExtractionConfig(Config):
    """Configuration for email extraction job"""
    entity_id: str
    template_id: str
    source_id: str


@op(out=Out(Dict[str, Any]))
def run_email_extraction(config: EmailExtractionConfig) -> Dict[str, Any]:
    """Dagster op to run email extraction"""
    extractor = EmailExtractorComponent({
        'entity_id': config.entity_id,
        'template_id': config.template_id,
        'source_id': config.source_id,
    })

    return extractor.run()


@job
def email_extraction_job():
    """Dagster job for email extraction"""
    run_email_extraction()
