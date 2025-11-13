"""
Base Extractor Class

Abstract base class for all extraction components.
Provides common functionality:
- Supabase connection
- Artifact fetching (from S3 or Supabase Storage)
- GraphQL data loading
- Error handling
"""

import os
from typing import Dict, List, Any, Optional
from abc import ABC, abstractmethod
from supabase import create_client, Client
import boto3
from dagster import get_dagster_logger

class BaseExtractor(ABC):
    """Base class for all extraction components"""

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize extractor with configuration

        Args:
            config: Dict containing:
                - entity_id: Target entity ID
                - template_id: Template with extraction rules
                - source_id: Source to fetch data from
        """
        self.config = config
        self.entity_id = config['entity_id']
        self.template_id = config['template_id']
        self.source_id = config['source_id']
        self.logger = get_dagster_logger()

        # Initialize Supabase client
        supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

        if not supabase_url or not supabase_key:
            raise ValueError("Missing Supabase credentials")

        self.supabase: Client = create_client(supabase_url, supabase_key)

        # Load entity, template, and source
        self._load_configuration()

    def _load_configuration(self):
        """Load entity, template, and source from Supabase"""
        # Get entity
        entity_response = self.supabase.table('entities').select('*').eq('id', self.entity_id).single().execute()
        self.entity = entity_response.data

        # Get template with selectors
        template_response = self.supabase.table('templates').select('*').eq('id', self.template_id).single().execute()
        self.template = template_response.data

        # Get source configuration
        source_response = self.supabase.table('sources').select('*').eq('id', self.source_id).single().execute()
        self.source = source_response.data

        self.logger.info(f"Configuration loaded: entity={self.entity['name']}, template={self.template['name']}, source={self.source['name']}")

    def fetch_artifacts(self) -> List[Dict[str, Any]]:
        """
        Fetch artifacts from source
        Returns list of artifacts with content
        """
        if self.source['source_type'] == 's3_bucket':
            return self._fetch_from_s3()
        elif self.source['source_type'] == 'manual_upload':
            return self._fetch_from_artifacts()
        else:
            raise ValueError(f"Unknown source type: {self.source['source_type']}")

    def _fetch_from_s3(self) -> List[Dict[str, Any]]:
        """Fetch files directly from S3"""
        config = self.source['configuration']

        # Initialize S3 client
        s3 = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=config.get('region', 'us-east-1')
        )

        # List objects
        prefix = config.get('prefix', '').lstrip('/')
        response = s3.list_objects_v2(
            Bucket=config['bucket'],
            Prefix=prefix
        )

        artifacts = []
        for obj in response.get('Contents', []):
            # Skip folders
            if obj['Key'].endswith('/'):
                continue

            # Download file content
            file_obj = s3.get_object(Bucket=config['bucket'], Key=obj['Key'])
            content = file_obj['Body'].read()

            artifacts.append({
                's3_key': obj['Key'],
                'filename': obj['Key'].split('/')[-1],
                'content': content,
                'size': obj['Size']
            })

        self.logger.info(f"Fetched {len(artifacts)} files from S3")
        return artifacts

    def _fetch_from_artifacts(self) -> List[Dict[str, Any]]:
        """Fetch from artifacts table (manual uploads)"""
        response = self.supabase.table('artifacts')\
            .select('*')\
            .eq('source_id', self.source_id)\
            .eq('extraction_status', 'completed')\
            .execute()

        self.logger.info(f"Fetched {len(response.data)} artifacts from database")
        return response.data

    @abstractmethod
    def extract(self, artifact: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract data from artifact using template rules
        Must be implemented by subclass

        Args:
            artifact: Artifact data (content + metadata)

        Returns:
            List of records to load into entity table
        """
        pass

    def load_data(self, records: List[Dict[str, Any]]) -> int:
        """
        Load extracted records into entity table using GraphQL

        Args:
            records: List of dicts matching entity schema

        Returns:
            Number of records loaded
        """
        if not records:
            return 0

        table_name = self.entity['name']

        # Batch insert (1000 at a time)
        batch_size = 1000
        total_loaded = 0

        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]

            try:
                response = self.supabase.table(table_name).insert(batch).execute()
                total_loaded += len(batch)
                self.logger.info(f"Loaded batch {i//batch_size + 1}: {len(batch)} records")
            except Exception as e:
                self.logger.error(f"Error loading batch: {e}")
                # Continue with next batch

        return total_loaded

    def run(self) -> Dict[str, Any]:
        """
        Execute full pipeline: fetch → extract → load

        Returns:
            Dict with run statistics
        """
        self.logger.info(f"Starting pipeline run for entity: {self.entity['name']}")

        # Fetch artifacts
        artifacts = self.fetch_artifacts()
        self.logger.info(f"Fetched {len(artifacts)} artifacts")

        # Extract data from each artifact
        all_records = []
        for artifact in artifacts:
            try:
                records = self.extract(artifact)
                all_records.extend(records)
                self.logger.info(f"Extracted {len(records)} records from {artifact.get('filename', 'unknown')}")
            except Exception as e:
                self.logger.error(f"Error extracting from artifact: {e}")
                # Continue with next artifact

        # Load data
        loaded_count = self.load_data(all_records)

        return {
            'artifacts_processed': len(artifacts),
            'records_extracted': len(all_records),
            'records_loaded': loaded_count,
            'entity': self.entity['name'],
            'template': self.template['name'],
        }
