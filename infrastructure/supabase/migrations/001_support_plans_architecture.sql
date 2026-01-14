-- ================================================================
-- WatchMe/Business 統合アーキテクチャ - Phase 1 スキーマ
-- 作成日: 2026-01-14
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 既存テーブルの拡張
-- ----------------------------------------------------------------

-- usersテーブルにロールとfacility_idを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  role text DEFAULT 'parent' CHECK (role IN ('parent', 'staff', 'admin', 'self'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  facility_id UUID REFERENCES facilities(id);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_facility_id ON users(facility_id);

-- ----------------------------------------------------------------
-- 2. 個別支援計画テーブル
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS business_support_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  title text NOT NULL,
  plan_number text, -- 施設の管理番号
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_business_support_plans_facility_id ON business_support_plans(facility_id);
CREATE INDEX IF NOT EXISTS idx_business_support_plans_subject_id ON business_support_plans(subject_id);
CREATE INDEX IF NOT EXISTS idx_business_support_plans_status ON business_support_plans(status);
CREATE INDEX IF NOT EXISTS idx_business_support_plans_created_by ON business_support_plans(created_by);

-- Row Level Security (RLS)
ALTER TABLE business_support_plans ENABLE ROW LEVEL SECURITY;

-- Facility内のスタッフのみアクセス可能
CREATE POLICY business_support_plans_facility_access ON business_support_plans
  FOR ALL
  USING (
    facility_id IN (
      SELECT facility_id FROM users WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 3. 観測対象との関係性テーブル
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subject_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN
    ('parent', 'self', 'staff', 'therapist', 'teacher')),
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  is_primary boolean DEFAULT false, -- 主担当/主保護者フラグ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subject_id, user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_subject_relations_subject_id ON subject_relations(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_relations_user_id ON subject_relations(user_id);
CREATE INDEX IF NOT EXISTS idx_subject_relations_relation_type ON subject_relations(relation_type);

-- Row Level Security (RLS)
ALTER TABLE subject_relations ENABLE ROW LEVEL SECURITY;

-- 関係者と施設スタッフのみアクセス可能
CREATE POLICY subject_relations_access ON subject_relations
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    subject_id IN (
      SELECT sr.subject_id FROM subject_relations sr
      WHERE sr.user_id = auth.uid() AND sr.can_view = true
    ) OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.user_id = auth.uid()
      AND u.role = 'staff'
      AND u.facility_id IS NOT NULL
    )
  );

-- 編集は権限がある人のみ
CREATE POLICY subject_relations_edit ON subject_relations
  FOR ALL
  USING (
    user_id = auth.uid() OR
    (
      EXISTS (
        SELECT 1 FROM subject_relations sr
        WHERE sr.subject_id = subject_relations.subject_id
        AND sr.user_id = auth.uid()
        AND sr.can_edit = true
      )
    )
  );

-- ----------------------------------------------------------------
-- 4. 既存テーブルの改修
-- ----------------------------------------------------------------

-- business_interview_sessionsテーブルの改修
ALTER TABLE business_interview_sessions
  ADD COLUMN IF NOT EXISTS support_plan_id UUID REFERENCES business_support_plans(id) ON DELETE CASCADE;

-- child_idをsubject_idに変更（既存データがある場合は注意）
-- ALTER TABLE business_interview_sessions
--   RENAME COLUMN child_id TO subject_id;

-- セッションタイプを追加
ALTER TABLE business_interview_sessions
  ADD COLUMN IF NOT EXISTS session_type text CHECK (session_type IN
    ('initial_planning', 'mid_review', 'periodic_review', 'revision', 'consultation'));

ALTER TABLE business_interview_sessions
  ADD COLUMN IF NOT EXISTS session_number integer DEFAULT 1;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_business_interview_sessions_support_plan_id
  ON business_interview_sessions(support_plan_id);
CREATE INDEX IF NOT EXISTS idx_business_interview_sessions_session_type
  ON business_interview_sessions(session_type);

-- ----------------------------------------------------------------
-- 5. トリガー関数（更新日時の自動更新）
-- ----------------------------------------------------------------

-- updated_at自動更新トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- business_support_plansのトリガー
DROP TRIGGER IF EXISTS update_business_support_plans_updated_at ON business_support_plans;
CREATE TRIGGER update_business_support_plans_updated_at
  BEFORE UPDATE ON business_support_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- subject_relationsのトリガー
DROP TRIGGER IF EXISTS update_subject_relations_updated_at ON subject_relations;
CREATE TRIGGER update_subject_relations_updated_at
  BEFORE UPDATE ON subject_relations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------
-- 6. ビュー（便利なビュー）
-- ----------------------------------------------------------------

-- 支援計画とセッション数を含むビュー
CREATE OR REPLACE VIEW v_support_plans_with_sessions AS
SELECT
  sp.*,
  s.name as subject_name,
  s.age as subject_age,
  s.gender as subject_gender,
  COUNT(DISTINCT bis.id) as session_count,
  MAX(bis.recorded_at) as last_session_date
FROM business_support_plans sp
LEFT JOIN subjects s ON sp.subject_id = s.subject_id
LEFT JOIN business_interview_sessions bis ON sp.id = bis.support_plan_id
GROUP BY sp.id, s.subject_id, s.name, s.age, s.gender;

-- 権限付きsubject関係性ビュー
CREATE OR REPLACE VIEW v_user_subjects AS
SELECT
  sr.user_id,
  sr.subject_id,
  sr.relation_type,
  sr.can_view,
  sr.can_edit,
  sr.is_primary,
  s.name as subject_name,
  s.age as subject_age,
  s.avatar_url
FROM subject_relations sr
JOIN subjects s ON sr.subject_id = s.subject_id
WHERE sr.can_view = true;

-- ----------------------------------------------------------------
-- 7. 初期データ投入（開発用）
-- ----------------------------------------------------------------

-- テスト用施設（既に存在する場合はスキップ）
INSERT INTO facilities (id, name, type, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'テスト療育施設', 'therapy_center', NOW())
ON CONFLICT (id) DO NOTHING;

-- コメント追加
COMMENT ON TABLE business_support_plans IS '個別支援計画テーブル - 複数のセッションを束ねるコンテナ';
COMMENT ON TABLE subject_relations IS '観測対象との関係性テーブル - 権限管理を含む';
COMMENT ON COLUMN business_support_plans.status IS '計画のステータス: draft(下書き), active(実施中), completed(完了), archived(アーカイブ)';
COMMENT ON COLUMN subject_relations.relation_type IS '関係性のタイプ: parent(親), self(本人), staff(職員), therapist(療法士), teacher(教師)';
COMMENT ON COLUMN subject_relations.is_primary IS '主担当/主保護者フラグ';

-- ================================================================
-- 実行完了
-- ================================================================