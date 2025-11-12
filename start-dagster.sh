#!/bin/bash

# Start Dagster locally to view and run pipelines
#
# This script:
# 1. Activates virtual environment
# 2. Creates a Dagster workspace.yaml if needed
# 3. Starts Dagster daemon (for schedules)
# 4. Starts Dagster web UI on http://localhost:3001

set -e

echo "🚀 Starting Dagster..."

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Run: python3 -m venv venv && source venv/bin/activate && pip install dagster dagster-webserver"
    exit 1
fi

source venv/bin/activate
echo "✅ Virtual environment activated"

# Create dagster_home if it doesn't exist
mkdir -p dagster_home/pipelines

# Create workspace.yaml to tell Dagster where to find pipelines
cat > dagster_home/workspace.yaml << 'EOF'
load_from:
  - python_module:
      module_name: pipelines
      working_directory: dagster_home
      location_name: inspector_dom_pipelines
EOF

# Load environment variables from .env.local
if [ -f ".env.local" ]; then
    echo "📦 Loading environment variables from .env.local..."
    export $(grep -v '^#' .env.local | xargs)
    echo "  ✓ Environment variables loaded"
else
    echo "⚠️  Warning: .env.local not found"
fi

# Set environment
export DAGSTER_HOME=$(pwd)/dagster_home

echo "📁 DAGSTER_HOME: $DAGSTER_HOME"
echo ""

# Check if Dagster is installed
if ! command -v dagster &> /dev/null; then
    echo "❌ Dagster not installed in venv!"
    echo "Run: source venv/bin/activate && pip install dagster dagster-webserver"
    exit 1
fi

echo "✅ Dagster installed ($(dagster --version))"
echo ""

# Start Dagster web server
echo "🌐 Starting Dagster UI at http://localhost:3002"
echo ""
echo "Press Ctrl+C to stop"
echo ""

dagster dev -h 0.0.0.0 -p 3002 -w dagster_home/workspace.yaml
