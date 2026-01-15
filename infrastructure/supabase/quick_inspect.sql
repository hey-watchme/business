-- =====================================================
-- クイック調査SQL（これだけ実行すればOK）
-- =====================================================

-- テーブル構造を表形式で確認
SELECT
    'business_interview_sessions のカラム一覧' as "調査項目";

SELECT
    ordinal_position as "順番",
    column_name as "カラム名",
    data_type as "データ型",
    is_nullable as "NULL可",
    column_default as "デフォルト値"
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'business_interview_sessions'
ORDER BY ordinal_position;