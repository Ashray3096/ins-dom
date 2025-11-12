"""
Inspector Dom Pipeline Loader

This module dynamically loads all deployed pipeline files from this directory.
When you deploy a pipeline in Inspector Dom, it creates a .py file here.
"""

import importlib
import sys
from pathlib import Path
from dagster import Definitions, load_assets_from_modules

# Get all Python files in this directory (except __init__.py)
pipeline_dir = Path(__file__).parent
pipeline_files = [f for f in pipeline_dir.glob("*.py") if f.name != "__init__.py"]

# Collect all assets from deployed pipelines
all_assets = []

if not pipeline_files:
    print("🔔 No pipelines deployed yet!")
    print("   Deploy a pipeline from Inspector Dom UI to see it here.")
else:
    print(f"📦 Found {len(pipeline_files)} deployed pipeline(s):")

    for pipeline_file in pipeline_files:
        module_name = f"pipelines.{pipeline_file.stem}"

        try:
            # Import the pipeline module
            if module_name in sys.modules:
                # Reload if already imported
                module = importlib.reload(sys.modules[module_name])
            else:
                module = importlib.import_module(module_name)

            # Load all assets from the module
            assets = load_assets_from_modules([module])
            all_assets.extend(assets)

            print(f"   ✓ {pipeline_file.name} - Loaded {len(assets)} asset(s)")

        except Exception as e:
            print(f"   ✗ {pipeline_file.name} - Failed to load: {e}")

# Create Definitions with all loaded assets
definitions = Definitions(
    assets=all_assets,
)
