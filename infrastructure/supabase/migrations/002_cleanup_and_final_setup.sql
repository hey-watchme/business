-- ================================================================
-- WatchMe/Business 統合アーキテクチャ - クリーンアップと最終設定
-- 作成日: 2026-01-14
-- 実行済み: 2026-01-14
-- ================================================================

-- このファイルは、実際にSupabaseで実行した手順の記録です
-- 既に実行済みのため、再実行不要

-- ----------------------------------------------------------------
-- 1. 古いテーブルの削除
-- ----------------------------------------------------------------

-- 外部キー制約を削除
ALTER TABLE business_interview_sessions
DROP CONSTRAINT IF EXISTS business_interview_sessions_subject_id_fkey;

ALTER TABLE business_interview_sessions
DROP CONSTRAINT IF EXISTS business_interview_sessions_facility_id_fkey;

-- 古いテーブルを削除
DROP TABLE IF EXISTS business_children CASCADE;
DROP TABLE IF EXISTS business_facilities CASCADE;

-- 新しい外部キー制約を追加
ALTER TABLE business_interview_sessions
ADD CONSTRAINT business_interview_sessions_subject_id_fkey
FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE;

ALTER TABLE business_interview_sessions
ADD CONSTRAINT business_interview_sessions_facility_id_fkey
FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------
-- 2. business_support_plans テーブルの再作成
-- ----------------------------------------------------------------

DROP TABLE IF EXISTS business_support_plans CASCADE;

CREATE TABLE business_support_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  title text NOT NULL,
  plan_number text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_business_support_plans_facility_id ON business_support_plans(facility_id);
CREATE INDEX idx_business_support_plans_subject_id ON business_support_plans(subject_id);
CREATE INDEX idx_business_support_plans_status ON business_support_plans(status);
CREATE INDEX idx_business_support_plans_created_by ON business_support_plans(created_by);

-- RLS有効化
ALTER TABLE business_support_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_support_plans_facility_access ON business_support_plans
  FOR ALL
  USING (
    business_support_plans.facility_id IN (
      SELECT u.facility_id FROM users u WHERE u.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 3. subject_relations テーブルの作成
-- ----------------------------------------------------------------

CREATE TABLE subject_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('parent', 'self', 'staff', 'therapist', 'teacher')),
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  is_primary boolean DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subject_id, user_id)
);

CREATE INDEX idx_subject_relations_subject_id ON subject_relations(subject_id);
CREATE INDEX idx_subject_relations_user_id ON subject_relations(user_id);
CREATE INDEX idx_subject_relations_relation_type ON subject_relations(relation_type);

-- RLS有効化
ALTER TABLE subject_relations ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY subject_relations_edit ON subject_relations
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.user_id = auth.uid()
      AND u.role IN ('staff', 'admin')
    )
  );

CREATE POLICY subject_relations_update ON subject_relations
  FOR UPDATE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM subject_relations sr
      WHERE sr.subject_id = subject_relations.subject_id
      AND sr.user_id = auth.uid()
      AND sr.can_edit = true
    )
  );

CREATE POLICY subject_relations_delete ON subject_relations
  FOR DELETE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.user_id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- ----------------------------------------------------------------
-- 4. business_interview_sessionsへの外部キー追加
-- ----------------------------------------------------------------

ALTER TABLE business_interview_sessions
ADD CONSTRAINT business_interview_sessions_support_plan_id_fkey
FOREIGN KEY (support_plan_id) REFERENCES business_support_plans(id) ON DELETE CASCADE;

CREATE INDEX idx_business_interview_sessions_support_plan_id
  ON business_interview_sessions(support_plan_id);
CREATE INDEX idx_business_interview_sessions_session_type
  ON business_interview_sessions(session_type);

-- ----------------------------------------------------------------
-- 5. トリガー関数
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_business_support_plans_updated_at ON business_support_plans;
CREATE TRIGGER update_business_support_plans_updated_at
  BEFORE UPDATE ON business_support_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subject_relations_updated_at ON subject_relations;
CREATE TRIGGER update_subject_relations_updated_at
  BEFORE UPDATE ON subject_relations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------
-- 6. ビュー
-- ----------------------------------------------------------------

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
-- 7. コメント
-- ----------------------------------------------------------------

COMMENT ON TABLE business_support_plans IS '個別支援計画テーブル - 複数のセッションを束ねるコンテナ';
COMMENT ON TABLE subject_relations IS '観測対象との関係性テーブル - 権限管理を含む';
COMMENT ON COLUMN business_support_plans.status IS '計画のステータス: draft(下書き), active(実施中), completed(完了), archived(アーカイブ)';
COMMENT ON COLUMN subject_relations.relation_type IS '関係性のタイプ: parent(親), self(本人), staff(職員), therapist(療法士), teacher(教師)';
COMMENT ON COLUMN subject_relations.is_primary IS '主担当/主保護者フラグ';

-- ================================================================
-- 実行完了
-- ================================================================
