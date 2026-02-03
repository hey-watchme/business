-- =============================================
-- 参照先テーブルの構造確認
-- =============================================
-- このクエリを実行して、各テーブルのカラム名を確認してください

SELECT 
    table_name, 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name IN ('business_facilities', 'subjects', 'business_interview_sessions', 'users')
  AND column_name LIKE '%id%'
ORDER BY table_name, ordinal_position;
