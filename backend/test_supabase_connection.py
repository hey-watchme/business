#!/usr/bin/env python3
"""
Test Supabase connection and table access directly
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

print(f"SUPABASE_URL: {SUPABASE_URL}")
print(f"SUPABASE_KEY: {SUPABASE_KEY[:20]}...")
print()

# Connect to Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Testing table access...")
print("=" * 50)

# Test 1: Try to query the table
try:
    print("\n1. Testing SELECT on business_interview_sessions:")
    result = supabase.table('business_interview_sessions').select("*").limit(1).execute()
    print(f"   SUCCESS: Table exists and is accessible")
    print(f"   Data: {result.data}")
except Exception as e:
    print(f"   ERROR: {str(e)}")

# Test 2: Try to get table schema
try:
    print("\n2. Testing table columns:")
    # Try to insert a dummy record to get column info
    test_data = {
        'id': '11111111-1111-1111-1111-111111111111',
        'facility_id': '00000000-0000-0000-0000-000000000001',
        'child_id': '00000000-0000-0000-0000-000000000002',
        's3_audio_path': 'test/path.webm',
        'status': 'uploaded'
    }
    print(f"   Attempting to insert test data...")
    result = supabase.table('business_interview_sessions').insert(test_data).execute()
    print(f"   SUCCESS: Insert successful")
    print(f"   Data: {result.data}")

    # Clean up test data
    supabase.table('business_interview_sessions').delete().eq('id', '11111111-1111-1111-1111-111111111111').execute()
    print("   Cleaned up test data")
except Exception as e:
    print(f"   ERROR: {str(e)}")

# Test 3: Check other tables
print("\n3. Testing other business tables:")
tables = ['business_facilities', 'business_children', 'business_interview_sessions']
for table_name in tables:
    try:
        result = supabase.table(table_name).select("*").limit(1).execute()
        print(f"   ✓ {table_name}: accessible")
    except Exception as e:
        print(f"   ✗ {table_name}: {str(e)[:50]}...")

print("\n" + "=" * 50)
print("Test complete!")