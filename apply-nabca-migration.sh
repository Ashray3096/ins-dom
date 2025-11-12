#!/bin/bash

# Apply NABCA Tables Migration
# This script applies the migration to create all 8 NABCA database tables

echo "🚀 Applying NABCA Tables Migration..."
echo "========================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo ""
  echo "Please set your DATABASE_URL:"
  echo "  export DATABASE_URL='postgresql://...'"
  exit 1
fi

# Apply the migration
echo "📡 Running migration: 010_create_nabca_tables.sql"
psql "$DATABASE_URL" -f supabase/migrations/010_create_nabca_tables.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migration applied successfully!"
  echo ""

  # Verify tables exist
  echo "🔍 Verifying tables were created..."
  echo ""

  psql "$DATABASE_URL" -c "
    SELECT
      table_name,
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
    FROM information_schema.tables t
    WHERE table_name LIKE 'raw_nabca_table_%'
    ORDER BY table_name;
  "

  echo ""
  echo "✅ All done! NABCA tables are ready."
else
  echo ""
  echo "❌ Migration failed. Please check the error messages above."
  exit 1
fi
