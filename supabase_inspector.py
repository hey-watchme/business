#!/usr/bin/env python3
"""
Supabase Database Inspector
Interactive CLI tool to query Supabase database
"""

import os
import sys
import json
from pathlib import Path
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from backend/.env
env_path = Path(__file__).parent / 'backend' / '.env'
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_KEY must be set")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def print_table(data: List[Dict[str, Any]], max_width: int = 100):
    """Print data as formatted table"""
    if not data:
        print("No data found")
        return

    # Get all keys
    keys = list(data[0].keys())

    # Calculate column widths
    col_widths = {}
    for key in keys:
        col_widths[key] = min(max(len(key), max(len(str(row.get(key, ''))) for row in data)), max_width)

    # Print header
    header = " | ".join(key.ljust(col_widths[key]) for key in keys)
    print(header)
    print("-" * len(header))

    # Print rows
    for row in data:
        print(" | ".join(str(row.get(key, '')).ljust(col_widths[key]) for key in keys))


def get_support_plans():
    """Get all support plans"""
    result = supabase.table('business_support_plans').select('*').execute()
    return result.data


def get_support_plan_with_subject(plan_id: Optional[str] = None):
    """Get support plan with subject info (JOIN)"""
    query = supabase.table('business_support_plans').select('*, subjects(*)')

    if plan_id:
        query = query.eq('id', plan_id).single()
        result = query.execute()
        return [result.data] if result.data else []
    else:
        result = query.execute()
        return result.data


def get_subjects():
    """Get all subjects"""
    result = supabase.table('subjects').select('*').execute()
    return result.data


def get_sessions(limit: int = 10):
    """Get interview sessions"""
    result = supabase.table('business_interview_sessions').select('*').limit(limit).execute()
    return result.data


def update_support_plan_subject(plan_id: str, subject_id: str):
    """Update support plan's subject_id"""
    result = supabase.table('business_support_plans')\
        .update({'subject_id': subject_id})\
        .eq('id', plan_id)\
        .execute()
    return result.data


def main():
    """Interactive CLI"""
    print("=" * 60)
    print("Supabase Database Inspector")
    print("=" * 60)
    print()

    while True:
        print("\nCommands:")
        print("  1. List support plans")
        print("  2. Show support plan with subject (JOIN)")
        print("  3. List subjects")
        print("  4. List interview sessions")
        print("  5. Update support plan subject")
        print("  6. Custom query")
        print("  q. Quit")
        print()

        choice = input("Enter command: ").strip()

        if choice == 'q':
            print("Goodbye!")
            break

        elif choice == '1':
            print("\nSupport Plans:")
            data = get_support_plans()
            print_table(data)

        elif choice == '2':
            plan_id = input("Enter plan ID (or press Enter for all): ").strip()
            plan_id = plan_id if plan_id else None

            print("\nSupport Plans with Subjects (JOIN):")
            data = get_support_plan_with_subject(plan_id)

            # Pretty print JSON for better readability
            for item in data:
                print(json.dumps(item, indent=2, ensure_ascii=False))

        elif choice == '3':
            print("\nSubjects:")
            data = get_subjects()
            print_table(data)

        elif choice == '4':
            limit = input("Enter limit (default 10): ").strip()
            limit = int(limit) if limit else 10

            print(f"\nInterview Sessions (limit {limit}):")
            data = get_sessions(limit)
            print_table(data)

        elif choice == '5':
            plan_id = input("Enter support plan ID: ").strip()
            subject_id = input("Enter subject ID: ").strip()

            if plan_id and subject_id:
                data = update_support_plan_subject(plan_id, subject_id)
                print("\nUpdated:")
                print(json.dumps(data, indent=2, ensure_ascii=False))
            else:
                print("Error: Both IDs are required")

        elif choice == '6':
            print("\nCustom Query:")
            table = input("Table name: ").strip()
            columns = input("Columns (comma-separated, * for all): ").strip()

            if not table:
                print("Error: Table name required")
                continue

            columns = columns if columns else '*'

            try:
                result = supabase.table(table).select(columns).execute()
                print_table(result.data)
            except Exception as e:
                print(f"Error: {e}")

        else:
            print("Invalid command")


if __name__ == '__main__':
    main()
