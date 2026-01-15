-- ===================================================================
-- 未使用ビュー削除
--
-- 理由: v_support_plans_with_sessions, v_user_subjects は未実装機能用
-- 実行日: 2026-01-15
-- 影響: ビュー2つ削除、アプリケーションコードでは未使用
-- ===================================================================

-- 1. ビュー削除
DROP VIEW IF EXISTS public.v_support_plans_with_sessions CASCADE;
DROP VIEW IF EXISTS public.v_user_subjects CASCADE;

-- 2. 削除確認
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('v_support_plans_with_sessions', 'v_user_subjects');
-- 期待結果: 0件（ビューが存在しない）
