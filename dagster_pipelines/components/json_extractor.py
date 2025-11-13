"""
JSON Extractor Component

Extracts data from JSON files using JSONPath expressions defined in templates
"""

import json
from typing import Dict, List, Any
from jsonpath_ng import parse
from dagster import op, job, In, Out, Config
from .base_extractor import BaseExtractor


class JSONExtractorComponent(BaseExtractor):
    """Extract data from JSON files using JSONPath"""

    def extract(self, artifact: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract data from JSON artifact using JSONPath selectors from template

        Args:
            artifact: Dict containing either:
                - 'content': bytes (from S3)
                - 'raw_content': dict/str (from artifacts table)

        Returns:
            List of records matching entity schema
        """
        # Parse JSON content
        if 'content' in artifact:
            # From S3 - decode bytes
            json_text = artifact['content'].decode('utf-8')
            json_data = json.loads(json_text)
        elif 'raw_content' in artifact:
            # From artifacts table
            if isinstance(artifact['raw_content'], dict):
                # Already parsed
                if 'content' in artifact['raw_content']:
                    # Wrapped format: {content: "..."}
                    content = artifact['raw_content']['content']
                    json_data = json.loads(content) if isinstance(content, str) else content
                else:
                    json_data = artifact['raw_content']
            elif isinstance(artifact['raw_content'], str):
                json_data = json.loads(artifact['raw_content'])
            else:
                raise ValueError(f"Unknown raw_content format: {type(artifact['raw_content'])}")
        else:
            raise ValueError("Artifact missing content")

        # Get field selectors from template
        selectors = self.template.get('selectors', {}).get('fields', {})

        if not selectors:
            self.logger.warning("No selectors defined in template")
            return []

        # Extract data using JSONPath
        records = []

        # Check if any field is an array (indicates multiple records)
        is_multi_record = any(
            selector.get('isArray', False)
            for selector in selectors.values()
        )

        if is_multi_record:
            # Extract array of records
            # Find the array field and determine record count
            array_field = next(
                (name for name, sel in selectors.items() if sel.get('isArray', False)),
                None
            )

            if array_field:
                array_path = selectors[array_field]['jsonPath']
                jsonpath_expr = parse(array_path)
                matches = jsonpath_expr.find(json_data)

                if matches:
                    array_values = matches[0].value
                    if isinstance(array_values, list):
                        # Create one record per array element
                        for i, item in enumerate(array_values):
                            record = {}
                            for field_name, selector in selectors.items():
                                if selector.get('isArray', False):
                                    # Use the array item directly
                                    record[field_name] = item
                                else:
                                    # Evaluate path on root JSON
                                    record[field_name] = self._extract_field(json_data, selector)
                            records.append(record)
        else:
            # Extract single record
            record = {}
            for field_name, selector in selectors.items():
                record[field_name] = self._extract_field(json_data, selector)
            records.append(record)

        self.logger.info(f"Extracted {len(records)} records from JSON")
        return records

    def _extract_field(self, json_data: Any, selector: Dict[str, Any]) -> Any:
        """Extract a single field value using JSONPath"""
        json_path = selector.get('jsonPath', '')

        if not json_path:
            return None

        try:
            jsonpath_expr = parse(json_path)
            matches = jsonpath_expr.find(json_data)

            if matches:
                value = matches[0].value
                # Convert to string for TEXT fields
                return str(value) if value is not None else None
            else:
                return None
        except Exception as e:
            self.logger.warning(f"Error extracting field with path {json_path}: {e}")
            return None


# Dagster job configuration
class JSONExtractionConfig(Config):
    """Configuration for JSON extraction job"""
    entity_id: str
    template_id: str
    source_id: str


@op(out=Out(Dict[str, Any]))
def run_json_extraction(config: JSONExtractionConfig) -> Dict[str, Any]:
    """Dagster op to run JSON extraction"""
    extractor = JSONExtractorComponent({
        'entity_id': config.entity_id,
        'template_id': config.template_id,
        'source_id': config.source_id,
    })

    return extractor.run()


@job
def json_extraction_job():
    """Dagster job for JSON extraction"""
    run_json_extraction()
