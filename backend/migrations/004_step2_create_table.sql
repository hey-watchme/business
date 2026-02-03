-- =============================================
-- Step 2: テーブル作成（2カラム版管理構造）
-- =============================================
-- 実行後、「Success. No rows returned」と表示されればOK

CREATE TABLE business_support_plans (
    -- 基本情報
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES business_facilities(id),
    subject_id UUID REFERENCES subjects(subject_id),
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
