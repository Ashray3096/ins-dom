#!/bin/bash

# =====================================================
# Run Field Library Migrations
# =====================================================

echo "🚀 Running Field Library Migrations..."
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ psql is not installed. Please install PostgreSQL client."
    exit 1
fi

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found in .env.local"
    echo "Please set your Supabase database URL:"
    echo "  DATABASE_URL=postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres"
    exit 1
fi

echo "📊 Running Migration 010: Create field_library tables..."
psql "$DATABASE_URL" -f supabase/migrations/010_create_field_library.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration 010 completed successfully"
    echo ""
else
    echo "❌ Migration 010 failed"
    exit 1
fi

echo "🌱 Running Migration 011: Seed field_library with NABCA fields..."
psql "$DATABASE_URL" -f supabase/migrations/011_seed_field_library.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration 011 completed successfully"
    echo ""
else
    echo "❌ Migration 011 failed"
    exit 1
fi

echo "🎉 All migrations completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Verify tables created: field_library, template_fields"
echo "  2. Check field count: SELECT COUNT(*) FROM field_library;"
echo "  3. View sample fields: SELECT name, label, category FROM field_library LIMIT 10;"
