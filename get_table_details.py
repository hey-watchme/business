#!/usr/bin/env python3
"""
Get detailed table structure from Supabase
"""
import os
from supabase import create_client
from dotenv import load_dotenv
import json

load_dotenv('backend/.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

tables = ['users', 'facilities', 'subjects', 'business_children']

print("# Database Schema\n")
print(f"Project: WatchMe Business")
print(f"Date: 2026-01-15\n")

for table in tables:
    print(f"## Table: {table}\n")

    try:
        # Get a sample row to see the structure
        result = supabase.table(table).select('*').limit(1).execute()

        if result.data and len(result.data) > 0:
            row = result.data[0]
            print(f"Columns found: {len(row.keys())}\n")

            for key, value in row.items():
                value_type = type(value).__name__
                print(f"  - **{key}**: {value_type}")

                # Show sample value if not None
                if value is not None:
                    if isinstance(value, str) and len(value) > 50:
                        print(f"    Example: {value[:50]}...")
                    else:
                        print(f"    Example: {value}")

            print()
        else:
            print(f"  (No data found, checking if table is empty...)\n")

            # Try to get count
            count_result = supabase.table(table).select('*', count='exact').execute()
            print(f"  Row count: {count_result.count}\n")

    except Exception as e:
        print(f"  Error: {e}\n")

    print("---\n")
