-- =============================================
-- Step 3: インデックス作成
-- =============================================
-- 実行後、「Success. No rows returned」と表示されればOK

CREATE INDEX idx_support_plans_facility ON business_support_plans(facility_id);
CREATE INDEX idx_support_plans_subject ON business_support_plans(subject_id);
CREATE INDEX idx_support_plans_session ON business_support_plans(session_id);
CREATE INDEX idx_support_plans_created_by ON business_support_plans(created_by);
