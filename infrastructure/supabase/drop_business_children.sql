-- ===================================================================
-- business_children テーブル削除
--
-- 理由: subjects テーブルに統一（統合アーキテクチャ採用）
-- 実行日: 2026-01-15
-- 影響: データ1件削除、外部キー制約なし
-- ===================================================================

-- 1. テーブル削除（インデックスも自動削除）
DROP TABLE IF EXISTS public.business_children CASCADE;

-- 2. 削除確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'business_children';
-- 期待結果: 0件（テーブルが存在しない）
