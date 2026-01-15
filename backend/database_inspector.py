#!/usr/bin/env python3
"""
Supabaseデータベース構造を自動取得して開発に使用
実行: python3 database_inspector.py
"""
import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client
import psycopg2
from urllib.parse import urlparse

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_database_url():
    """Supabase URLからPostgreSQL接続文字列を生成"""
    # Supabase URLからプロジェクトIDを抽出
    parsed = urlparse(SUPABASE_URL)
    project_id = parsed.hostname.split('.')[0]

    # Supabaseのデータベース接続情報（標準形式）
    # 注意: これは例です。実際の接続情報はSupabaseダッシュボードから取得
    db_host = f"db.{project_id}.supabase.co"
    db_password = "postgres"  # デフォルトのパスワード（実際は環境変数から）
    db_name = "postgres"
    db_user = "postgres"
    db_port = "5432"

    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

def inspect_with_supabase():
    """Supabase Python clientを使用した調査"""
    print("=" * 60)
    print("Supabase API経由でのテーブル調査")
    print("=" * 60)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 各テーブルのデータを取得してスキーマを推測
    tables = ['business_interview_sessions', 'business_facilities', 'business_children']

    for table_name in tables:
        print(f"\n■ {table_name}")
        print("-" * 40)

        try:
            # 1件だけ取得してカラムを確認
            result = supabase.table(table_name).select("*").limit(1).execute()

            if result.data and len(result.data) > 0:
                columns = list(result.data[0].keys())
                print(f"カラム数: {len(columns)}")
                print(f"カラム名: {', '.join(columns)}")

                # データ型を推測
                sample = result.data[0]
                print("\nカラム詳細:")
                for col, val in sample.items():
                    val_type = type(val).__name__
                    print(f"  - {col}: {val_type} (サンプル: {str(val)[:50]})")
            else:
                print("  データなし（空のテーブル）")

            # 行数を取得（count機能があれば）
            all_data = supabase.table(table_name).select("id", count='exact').execute()
            print(f"\n総行数: {all_data.count if hasattr(all_data, 'count') else len(all_data.data)}")

        except Exception as e:
            print(f"  エラー: {str(e)}")

def save_schema_to_file():
    """スキーマ情報をJSONファイルに保存"""
    print("\n" + "=" * 60)
    print("スキーマ情報をファイルに保存")
    print("=" * 60)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    schema = {}
    tables = ['business_interview_sessions', 'business_facilities', 'business_children']

    for table_name in tables:
        try:
            result = supabase.table(table_name).select("*").limit(1).execute()
            if result.data and len(result.data) > 0:
                schema[table_name] = {
                    'columns': list(result.data[0].keys()),
                    'sample': result.data[0]
                }
        except Exception as e:
            schema[table_name] = {'error': str(e)}

    # JSONファイルに保存
    output_file = 'database_schema.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(schema, f, indent=2, ensure_ascii=False, default=str)

    print(f"✅ スキーマ情報を {output_file} に保存しました")

    # Markdownドキュメントも生成
    generate_markdown_doc(schema)

def generate_markdown_doc(schema):
    """スキーマからMarkdownドキュメントを生成"""
    output_file = 'DATABASE_SCHEMA.md'

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# Database Schema Documentation\n\n")
        f.write(f"Generated: {os.popen('date').read().strip()}\n\n")

        for table_name, table_info in schema.items():
            f.write(f"## Table: `{table_name}`\n\n")

            if 'error' in table_info:
                f.write(f"⚠️ Error: {table_info['error']}\n\n")
                continue

            f.write("### Columns\n\n")
            f.write("| Column Name | Sample Value | Type |\n")
            f.write("|------------|--------------|------|\n")

            if 'columns' in table_info and 'sample' in table_info:
                for col in table_info['columns']:
                    sample_val = str(table_info['sample'].get(col, 'null'))[:50]
                    val_type = type(table_info['sample'].get(col)).__name__
                    f.write(f"| {col} | {sample_val} | {val_type} |\n")

            f.write("\n")

    print(f"✅ ドキュメントを {output_file} に生成しました")

if __name__ == "__main__":
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ 環境変数 SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください")
        print("\n.envファイルに以下を追加:")
        print("SUPABASE_URL=https://xxxxx.supabase.co")
        print("SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...")
        exit(1)

    try:
        inspect_with_supabase()
        save_schema_to_file()
    except Exception as e:
        print(f"❌ エラー: {str(e)}")