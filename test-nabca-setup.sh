#!/bin/bash

# Test script for NABCA Multi-Entity Setup
# This tests the foundation without needing any PDF

echo "🧪 Testing NABCA Multi-Entity Setup..."
echo "======================================"
echo ""

# Call the API endpoint
echo "📡 Calling /api/templates/generate-nabca-multi..."
response=$(curl -s -X POST http://localhost:3000/api/templates/generate-nabca-multi \
  -H "Content-Type: application/json" \
  -d '{"template_name": "NABCA All Tables Test"}')

# Pretty print the response
echo "$response" | python3 -m json.tool

echo ""
echo "======================================"
echo "✅ API call completed!"
echo ""
echo "Next steps:"
echo "1. Check the response above for success: true"
echo "2. Verify 8 entities were created"
echo "3. Verify template was created"
echo ""
echo "To verify in database, run:"
echo "  psql \$DATABASE_URL -c \"SELECT name FROM entities WHERE name LIKE 'raw_nabca_table_%' ORDER BY name;\""
echo "  psql \$DATABASE_URL -c \"SELECT id, name, description FROM templates WHERE name = 'NABCA All Tables Test';\""
