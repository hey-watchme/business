#!/usr/bin/env python3
"""
Supabase database schema extractor
Retrieves table structure information from Supabase
"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv('backend/.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Get all tables in public schema
query = """
SELECT
    table_name
FROM
    information_schema.tables
WHERE
    table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY
    table_name;
"""

try:
    response = supabase.rpc('exec_sql', {'query': query}).execute()
    print("Available tables:")
    print(response.data)
except Exception as e:
    print(f"Error with RPC: {e}")
    print("\nTrying alternative method...")

    # Alternative: Get tables from information_schema directly
    tables_query = """
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
    """

    try:
        result = supabase.table('information_schema.columns').select('*').execute()
        print("Tables found:")
        print(result.data)
    except Exception as e2:
        print(f"Alternative method also failed: {e2}")
        print("\nTrying to list known tables...")

        # Try to access known tables
        known_tables = ['users', 'facilities', 'subjects', 'business_children',
                       'sessions', 'session_recordings', 'recordings']

        for table in known_tables:
            try:
                result = supabase.table(table).select('*').limit(0).execute()
                print(f"✅ Table exists: {table}")
            except Exception as e3:
                print(f"❌ Table not accessible: {table} - {e3}")
