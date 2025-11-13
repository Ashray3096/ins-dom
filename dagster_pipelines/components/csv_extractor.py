"""
CSV Extractor Component

Extracts data from CSV files using column mappings defined in templates
"""

import csv
import io
from typing import Dict, List, Any
from dagster import op, job, Config, Out
from .base_extractor import BaseExtractor


class CSVExtractorComponent(BaseExtractor):
    """Extract data from CSV files using column mappings"""

    def extract(self, artifact: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract data from CSV artifact using column mappings from template

        Args:
            artifact: Dict containing either:
                - 'content': bytes (from S3)
                - 'raw_content': dict/str (from artifacts table)

        Returns:
            List of records matching entity schema
        """
        # Parse CSV content
        if 'content' in artifact:
            # From S3 - decode bytes
            csv_text = artifact['content'].decode('utf-8')
        elif 'raw_content' in artifact:
            # From artifacts table
            if isinstance(artifact['raw_content'], dict):
                csv_text = artifact['raw_content'].get('content', '')
            elif isinstance(artifact['raw_content'], str):
                csv_text = artifact['raw_content']
            else:
                raise ValueError(f"Unknown raw_content format: {type(artifact['raw_content'])}")
        else:
            raise ValueError("Artifact missing content")

        # Parse CSV
        csv_reader = csv.reader(io.StringIO(csv_text))
        rows = list(csv_reader)

        if len(rows) == 0:
            self.logger.warning("CSV file is empty")
            return []

        # Assume first row is headers
        headers = rows[0]
        data_rows = rows[1:]

        # Get field selectors from template
        selectors = self.template.get('selectors', {}).get('fields', {})

        if not selectors:
            self.logger.warning("No selectors defined in template")
            return []

        # Extract data using column mappings
        records = []

        for row in data_rows:
            record = {}

            for field_name, selector in selectors.items():
                column_index = selector.get('columnIndex')

                if column_index is not None and column_index < len(row):
                    value = row[column_index].strip()

                    # Type conversion based on validation format
                    validation = selector.get('validation', {})
                    format_type = validation.get('format', 'text')

                    if format_type == 'numeric':
                        try:
                            record[field_name] = str(float(value)) if value else None
                        except ValueError:
                            record[field_name] = value
                    elif format_type == 'boolean':
                        record[field_name] = value.lower() in ['true', 'yes', '1']
                    else:
                        record[field_name] = value or None
                else:
                    record[field_name] = None

            records.append(record)

        self.logger.info(f"Extracted {len(records)} records from CSV")
        return records


# Dagster job configuration
class CSVExtractionConfig(Config):
    """Configuration for CSV extraction job"""
    entity_id: str
    template_id: str
    source_id: str


@op(out=Out(Dict[str, Any]))
def run_csv_extraction(config: CSVExtractionConfig) -> Dict[str, Any]:
    """Dagster op to run CSV extraction"""
    extractor = CSVExtractorComponent({
        'entity_id': config.entity_id,
        'template_id': config.template_id,
        'source_id': config.source_id,
    })

    return extractor.run()


@job
def csv_extraction_job():
    """Dagster job for CSV extraction"""
    run_csv_extraction()
