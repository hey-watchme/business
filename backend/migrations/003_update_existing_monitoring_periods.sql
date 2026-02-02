-- 既存の個別支援計画のモニタリング期間を自動設定
-- 実行日: 2026-02-02
-- 実行場所: Supabase SQL Editor

-- 既存のレコードで monitoring_start/monitoring_end が NULL の場合、
-- created_at から6ヶ月後までを設定

UPDATE business_support_plans
SET 
  monitoring_start = DATE(created_at),
  monitoring_end = DATE(created_at) + INTERVAL '6 months'
WHERE 
  monitoring_start IS NULL 
  OR monitoring_end IS NULL;

-- 確認クエリ
SELECT 
  id,
  title,
  created_at,
  monitoring_start,
  monitoring_end,
  monitoring_end - monitoring_start as period_days
FROM business_support_plans
ORDER BY created_at DESC;
