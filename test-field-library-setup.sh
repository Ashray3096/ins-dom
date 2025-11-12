#!/bin/bash

# =====================================================
# Test Field Library Setup
# Verify tables and data are created correctly
# =====================================================

echo "🧪 Testing Field Library Setup..."
echo ""

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in .env.local"
    exit 1
fi

echo "1️⃣ Checking if field_library table exists..."
TABLE_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'field_library');")
if [[ "$TABLE_CHECK" == *"t"* ]]; then
    echo "   ✅ field_library table exists"
else
    echo "   ❌ field_library table does NOT exist"
    exit 1
fi

echo ""
echo "2️⃣ Checking if template_fields table exists..."
TABLE_CHECK=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'template_fields');")
if [[ "$TABLE_CHECK" == *"t"* ]]; then
    echo "   ✅ template_fields table exists"
else
    echo "   ❌ template_fields table does NOT exist"
    exit 1
fi

echo ""
echo "3️⃣ Counting fields in field_library..."
FIELD_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM field_library;")
echo "   📊 Total fields: $FIELD_COUNT"

if [ "$FIELD_COUNT" -gt 0 ]; then
    echo "   ✅ Fields seeded successfully"
else
    echo "   ⚠️  No fields found - seed may not have run"
fi

echo ""
echo "4️⃣ Sample fields by category:"
psql "$DATABASE_URL" -c "
SELECT
    category,
    COUNT(*) as field_count
FROM field_library
GROUP BY category
ORDER BY field_count DESC
LIMIT 10;
"

echo ""
echo "5️⃣ Top 10 fields:"
psql "$DATABASE_URL" -c "
SELECT
    name,
    label,
    field_type,
    category
FROM field_library
ORDER BY name
LIMIT 10;
"

echo ""
echo "6️⃣ Checking RLS policies..."
POLICY_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'field_library';")
echo "   📋 RLS policies on field_library: $POLICY_COUNT"

if [ "$POLICY_COUNT" -gt 0 ]; then
    echo "   ✅ RLS policies enabled"
else
    echo "   ⚠️  No RLS policies found"
fi

echo ""
echo "🎉 Setup verification complete!"
