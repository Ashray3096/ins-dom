#!/usr/bin/env python3
"""Test if we can load template selectors from Dagster environment"""

import os
import sys

# Load environment
from dotenv import load_dotenv
load_dotenv('.env.local')

print(f"NEXT_PUBLIC_SUPABASE_URL: {os.getenv('NEXT_PUBLIC_SUPABASE_URL')}")
print(f"SUPABASE_SERVICE_ROLE_KEY: {'SET' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else 'NOT SET'}")

try:
    from supabase import create_client
    print("✓ supabase-py imported successfully")

    supabase = create_client(
        os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )
    print("✓ Supabase client created")

    template_id = "7e4d486a-44f0-4a4a-b6e1-a884b5b302af"
    response = supabase.table("templates").select("id, name, selectors").eq("id", template_id).single().execute()

    print(f"✓ Template loaded: {response.data.get('name')}")
    print(f"✓ Has selectors: {'YES' if response.data.get('selectors') else 'NO'}")

    if response.data.get('selectors'):
        selectors = response.data['selectors']
        print(f"✓ Selector fields: {list(selectors.get('fields', {}).keys())}")

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
