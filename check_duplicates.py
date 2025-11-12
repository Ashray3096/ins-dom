import os
from dotenv import load_dotenv

load_dotenv('.env.local')

# Use psycopg2 to query directly
import psycopg2

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

# Check total records
cur.execute("SELECT COUNT(*) FROM raw_nabca_brand_leaders")
total = cur.fetchone()[0]
print(f"📊 Total records: {total}")

# Check unique brands
cur.execute("SELECT COUNT(DISTINCT brand) FROM raw_nabca_brand_leaders")
unique_brands = cur.fetchone()[0]
print(f"🏷️  Unique brands: {unique_brands}")

# Check if we have artifact tracking (if _artifact_id exists)
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'raw_nabca_brand_leaders' AND column_name = 'created_at'
""")
has_created_at = cur.fetchone() is not None

# Group by brand and count
cur.execute("""
    SELECT brand, COUNT(*) as count 
    FROM raw_nabca_brand_leaders 
    WHERE brand IS NOT NULL
    GROUP BY brand 
    ORDER BY count DESC 
    LIMIT 10
""")
print("\n🔍 Top brands by occurrence:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]} times")

# Check for exact duplicates
cur.execute("""
    SELECT brand, type, ytd_rank, ytd_case_sales, COUNT(*) as count
    FROM raw_nabca_brand_leaders
    WHERE brand IS NOT NULL
    GROUP BY brand, type, ytd_rank, ytd_case_sales
    HAVING COUNT(*) > 1
    LIMIT 5
""")
dupes = cur.fetchall()
if dupes:
    print("\n⚠️  Found duplicate records:")
    for row in dupes:
        print(f"  {row[0]} | {row[1]} | Rank {row[2]} | Sales {row[3]} - appears {row[4]} times")
else:
    print("\n✅ No duplicate records found!")

cur.close()
conn.close()
