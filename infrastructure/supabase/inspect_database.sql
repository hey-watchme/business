-- =====================================================
-- Supabase データベース完全調査スクリプト
-- =====================================================
-- このSQLをSupabase SQL Editorで実行して結果を共有してください

-- 1. business_* テーブルの一覧と構造
-- =====================================================
SELECT '========== 1. BUSINESS TABLES LIST ==========' as section;

SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name LIKE 'business_%'
ORDER BY table_name;

-- 2. 各テーブルの詳細構造
-- =====================================================
SELECT '========== 2. TABLE STRUCTURES ==========' as section;

-- business_interview_sessions の構造
SELECT '--- business_interview_sessions columns ---' as table_info;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'business_interview_sessions'
ORDER BY ordinal_position;

-- business_facilities の構造
SELECT '--- business_facilities columns ---' as table_info;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'business_facilities'
ORDER BY ordinal_position;

-- business_children の構造
SELECT '--- business_children columns ---' as table_info;
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'business_children'
ORDER BY ordinal_position;

-- 3. 外部キー制約
-- =====================================================
SELECT '========== 3. FOREIGN KEY CONSTRAINTS ==========' as section;

SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name LIKE 'business_%'
ORDER BY tc.table_name, tc.constraint_name;

-- 4. インデックス
-- =====================================================
SELECT '========== 4. INDEXES ==========' as section;

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename LIKE 'business_%'
ORDER BY tablename, indexname;

-- 5. RLS（Row Level Security）設定
-- =====================================================
SELECT '========== 5. RLS STATUS ==========' as section;

SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename LIKE 'business_%'
ORDER BY tablename;

-- 6. RLSポリシー詳細
-- =====================================================
SELECT '========== 6. RLS POLICIES ==========' as section;

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename LIKE 'business_%'
ORDER BY tablename, policyname;

-- 7. 実データのサンプル（各テーブル5件）
-- =====================================================
SELECT '========== 7. SAMPLE DATA ==========' as section;

-- business_facilities
SELECT '--- business_facilities (max 5 rows) ---' as sample;
SELECT * FROM public.business_facilities LIMIT 5;

-- business_children
SELECT '--- business_children (max 5 rows) ---' as sample;
SELECT * FROM public.business_children LIMIT 5;

-- business_interview_sessions
SELECT '--- business_interview_sessions (max 5 rows) ---' as sample;
SELECT * FROM public.business_interview_sessions LIMIT 5;

-- 8. テーブルの行数
-- =====================================================
SELECT '========== 8. ROW COUNTS ==========' as section;

SELECT
    'business_facilities' as table_name,
    COUNT(*) as row_count
FROM public.business_facilities
UNION ALL
SELECT
    'business_children',
    COUNT(*)
FROM public.business_children
UNION ALL
SELECT
    'business_interview_sessions',
    COUNT(*)
FROM public.business_interview_sessions
ORDER BY table_name;

-- 9. 最近のデータ変更（直近10件）
-- =====================================================
SELECT '========== 9. RECENT DATA CHANGES ==========' as section;

SELECT
    'business_interview_sessions' as table_name,
    id,
    status,
    created_at,
    updated_at
FROM public.business_interview_sessions
ORDER BY created_at DESC
LIMIT 10;

-- 10. Supabaseの認証関連
-- =====================================================
SELECT '========== 10. AUTH RELATED ==========' as section;

-- service_role権限で実行可能か確認
SELECT current_user, session_user, current_database();

-- 現在のロール
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin
FROM pg_roles
WHERE rolname = current_user;