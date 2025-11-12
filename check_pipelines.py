#!/usr/bin/env python3
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('.env.local')

supabase = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Check pipelines table
result = supabase.table("pipelines").select("id,name,is_active,created_at").order("created_at", desc=True).limit(5).execute()

print("📊 PIPELINES IN DATABASE:")
for p in result.data:
    print(f"  - {p['name']} (id: {p['id'][:8]}..., active: {p['is_active']})")

# Check for NABCA specifically
nabca = supabase.table("pipelines").select("*").ilike("name", "%nabca%").execute()
print(f"\n🔍 NABCA Pipelines: {len(nabca.data)} found")
for p in nabca.data:
    print(f"  - ID: {p['id']}")
    print(f"    Name: {p['name']}")
    print(f"    Active: {p['is_active']}")
