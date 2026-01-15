-- =====================================================
-- 最重要：テーブル構造の確認
-- =====================================================

-- 1. business_interview_sessions の完全な構造
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'business_interview_sessions'
ORDER BY ordinal_position;

-- 2. 実際のデータ（最新5件）
SELECT * FROM public.business_interview_sessions
ORDER BY created_at DESC
LIMIT 5;

-- 3. 外部キー制約の確認
SELECT
    tc.constraint_name,
    kcu.column_name as local_column,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.table_name = 'business_interview_sessions'
    AND tc.constraint_type = 'FOREIGN KEY';

-- 4. RLS設定とポリシー
SELECT
    tablename,
    policyname,
    permissive,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'business_interview_sessions';