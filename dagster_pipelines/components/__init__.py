"""
Inspector Dom Dagster Components

Data extraction components for different source types:
- JSONExtractorComponent: Extract from JSON files using JSONPath
- CSVExtractorComponent: Extract from CSV files using column mappings
- HTMLExtractorComponent: Extract from HTML files using CSS/XPath selectors
- PDFExtractorComponent: Extract from PDF files using AWS Textract
- EMLExtractorComponent: Extract from email files (.eml)
"""

from dagster import Definitions
from .json_extractor import json_extraction_job
from .csv_extractor import csv_extraction_job
from .html_extractor import html_extraction_job
from .email_extractor import email_extraction_job

# Define all Dagster assets and jobs
defs = Definitions(
    jobs=[
        json_extraction_job,
        csv_extraction_job,
        html_extraction_job,
        email_extraction_job,
    ],
)
