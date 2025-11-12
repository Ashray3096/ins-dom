# Phase 1.1: Database Setup Instructions

## What We're Installing

- **field_library** table - Stores reusable field definitions
- **template_fields** table - Links templates to fields
- **~50 common fields** - Pre-seeded NABCA fields

## Step 1: Run Migrations

You have two options:

### Option A: Using the helper script (Recommended)

```bash
./run-field-library-migrations.sh
```

This will:
1. Check if psql is installed
2. Read DATABASE_URL from .env.local
3. Run both migration files
4. Show success/error messages

### Option B: Manual execution via Supabase SQL Editor

If the script doesn't work, you can manually run the SQL:

1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy and paste the contents of:
   - `supabase/migrations/010_create_field_library.sql`
   - Click "Run"
4. Then copy and paste:
   - `supabase/migrations/011_seed_field_library.sql`
   - Click "Run"

## Step 2: Verify Setup

Run the test script to verify everything worked:

```bash
./test-field-library-setup.sh
```

Expected output:
```
🧪 Testing Field Library Setup...

1️⃣ Checking if field_library table exists...
   ✅ field_library table exists

2️⃣ Checking if template_fields table exists...
   ✅ template_fields table exists

3️⃣ Counting fields in field_library...
   📊 Total fields: 50+
   ✅ Fields seeded successfully

4️⃣ Sample fields by category:
 category | field_count
----------+-------------
 sales    |        12
 vendor   |         8
 product  |         7
 ...

5️⃣ Top 10 fields:
    name          |        label        | field_type | category
------------------+---------------------+------------+----------
 brand_name       | Brand Name          | TEXT       | product
 brand_rank       | Brand Rank          | NUMBER     | product
 case_sales       | Case Sales          | NUMBER     | sales
 ...

6️⃣ Checking RLS policies...
   📋 RLS policies on field_library: 4
   ✅ RLS policies enabled

🎉 Setup verification complete!
```

## Step 3: Quick Manual Test (Optional)

You can also manually verify in Supabase:

1. Open Supabase Table Editor
2. Look for new tables:
   - `field_library`
   - `template_fields`
3. Check field_library has rows:
   ```sql
   SELECT COUNT(*) FROM field_library;
   -- Should return 50+
   ```

## Troubleshooting

### Error: "psql: command not found"
- Install PostgreSQL client:
  ```bash
  brew install postgresql
  ```

### Error: "DATABASE_URL not found"
- Check `.env.local` has:
  ```
  DATABASE_URL=postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres
  ```
- Get this from: Supabase Dashboard → Settings → Database → Connection String (URI)

### Error: "relation already exists"
- Tables already created! Skip to Step 2 to verify

### Tables created but no fields
- Run just the seed migration:
  ```bash
  psql "$DATABASE_URL" -f supabase/migrations/011_seed_field_library.sql
  ```

## What's Next?

After successful verification, we'll move to Phase 1.2:
- Create API routes for field library
- Build UI to browse/manage fields

**DO NOT PROCEED until you confirm:**
- ✅ Both tables exist
- ✅ Field count > 0
- ✅ Test script passes

**Reply with "Database setup complete" when ready for next step!**
