-- 個別支援計画の編集機能用カラム追加
-- 実行日: 2026-01-31
-- 実行場所: Supabase SQL Editor

-- ヘッダー情報
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS facility_name TEXT;
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS manager_name TEXT;
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS monitoring_start DATE;
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS monitoring_end DATE;

-- 利用者情報
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS child_birth_date DATE;
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS guardian_name TEXT;

-- 意向・ニーズ
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS child_intention TEXT;
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS family_intention TEXT;

-- 支援の提供時間
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS service_schedule TEXT;

-- 留意点・備考
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS notes TEXT;

-- 総合的な支援の方針
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS general_policy TEXT;

-- 目標
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS long_term_goal TEXT;
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS long_term_period TEXT DEFAULT '1年';
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS short_term_goal TEXT;
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS short_term_period TEXT DEFAULT '6ヶ月';

-- 支援詳細（7列テーブルの内容）
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS support_items JSONB;

-- 同意情報
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS explainer_name TEXT;
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS consent_date DATE;
ALTER TABLE business_support_plans ADD COLUMN IF NOT EXISTS guardian_signature TEXT;

-- 確認クエリ
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'business_support_plans' 
ORDER BY ordinal_position;
