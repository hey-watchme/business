-- 個別支援計画テーブル: 2カラム版管理構造へ全面改訂
-- 実行日: 2026-02-02
-- 実行場所: Supabase SQL Editor
-- 目的: AI生成値と修正後値を分離保存するための2カラム構造

-- ⚠️ 注意: 既存データは削除されます（開発中のためOK）

-- 既存テーブルを削除
DROP TABLE IF EXISTS business_support_plans CASCADE;

-- 2カラム版管理構造で再作成
CREATE TABLE business_support_plans (
    -- 基本情報
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES business_facilities(id),
    subject_id UUID REFERENCES subjects(id),
    session_id UUID REFERENCES business_interview_sessions(id),
    title TEXT,
    plan_number TEXT,
    status TEXT DEFAULT 'draft',
    created_by UUID REFERENCES users(user_id),
    
    -- タイムスタンプ
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- モニタリング期間
    monitoring_start DATE,
    monitoring_end DATE,
    
    -- ===== 2カラム版管理フィールド =====
    
    -- 本人の意向
    child_intention_ai_generated TEXT,
    child_intention_user_edited TEXT,
    
    -- 保護者の意向
    family_intention_ai_generated TEXT,
    family_intention_user_edited TEXT,
    
    -- 総合的な支援の方針（子どもの理解・見立て）
    general_policy_ai_generated TEXT,
    general_policy_user_edited TEXT,
    
    -- 主要アプローチ（JSONBで配列）
    key_approaches_ai_generated JSONB,
    key_approaches_user_edited JSONB,
    
    -- 連携事項
    collaboration_notes_ai_generated TEXT,
    collaboration_notes_user_edited TEXT,
    
    -- 長期目標
    long_term_goal_ai_generated TEXT,
    long_term_goal_user_edited TEXT,
    long_term_period_ai_generated TEXT DEFAULT '1年',
    long_term_period_user_edited TEXT,
    long_term_rationale_ai_generated TEXT,
    long_term_rationale_user_edited TEXT,
    
    -- 短期目標（JSONBで配列）
    short_term_goals_ai_generated JSONB,
    short_term_goals_user_edited JSONB,
    
    -- 支援項目（7列テーブル、JSONBで配列）
    support_items_ai_generated JSONB,
    support_items_user_edited JSONB,
    
    -- 家族支援
    family_support_ai_generated JSONB,
    family_support_user_edited JSONB,
    
    -- 移行支援・地域連携
    transition_support_ai_generated JSONB,
    transition_support_user_edited JSONB,
    
    -- ===== 手動入力専用フィールド =====
    
    -- 支援の標準的な提供時間（手動入力）
    service_schedule TEXT,
    
    -- 留意点・備考（手動入力）
    notes TEXT,
    
    -- 説明・同意
    explainer_name TEXT,
    consent_date DATE,
    guardian_signature TEXT
);

-- インデックス
CREATE INDEX idx_support_plans_facility ON business_support_plans(facility_id);
CREATE INDEX idx_support_plans_subject ON business_support_plans(subject_id);
CREATE INDEX idx_support_plans_session ON business_support_plans(session_id);
CREATE INDEX idx_support_plans_created_by ON business_support_plans(created_by);

-- Updated_at トリガー（既存関数がない場合のみ作成）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー削除（存在する場合）
DROP TRIGGER IF EXISTS update_support_plans_updated_at ON business_support_plans;

-- トリガー作成
CREATE TRIGGER update_support_plans_updated_at
    BEFORE UPDATE ON business_support_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLSポリシー（既存設定を再適用）
ALTER TABLE business_support_plans ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを削除して再作成
DROP POLICY IF EXISTS "Users can view support plans in their facility" ON business_support_plans;
DROP POLICY IF EXISTS "Users can insert support plans in their facility" ON business_support_plans;
DROP POLICY IF EXISTS "Users can update support plans in their facility" ON business_support_plans;

CREATE POLICY "Users can view support plans in their facility"
ON business_support_plans FOR SELECT
USING (
    facility_id IN (
        SELECT facility_id FROM business_facility_staff 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert support plans in their facility"
ON business_support_plans FOR INSERT
WITH CHECK (
    facility_id IN (
        SELECT facility_id FROM business_facility_staff 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update support plans in their facility"
ON business_support_plans FOR UPDATE
USING (
    facility_id IN (
        SELECT facility_id FROM business_facility_staff 
        WHERE user_id = auth.uid()
    )
);

-- 確認クエリ
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'business_support_plans'
ORDER BY ordinal_position;
