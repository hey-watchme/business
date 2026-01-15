-- ===================================================================
-- facilities テーブル削除
--
-- 理由: business_facilities に統一（Business系テーブルのプリフィックス統一）
-- 実行日: 2026-01-15
-- 影響: ダミーデータ1件削除
-- ===================================================================

-- 1. テーブル削除（外部キー制約も含めて削除）
DROP TABLE IF EXISTS public.facilities CASCADE;

-- 2. 削除確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'facilities';
-- 期待結果: 0件（テーブルが存在しない）

-- 3. business_facilities が残っていることを確認
SELECT COUNT(*) AS business_facilities_count FROM business_facilities;
-- 期待結果: 1件
