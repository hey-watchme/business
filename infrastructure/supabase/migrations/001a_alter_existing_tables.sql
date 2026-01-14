-- ================================================================
-- 既存テーブルへのカラム追加
-- 作成日: 2026-01-14
-- 注意: 001_support_plans_architecture.sql の前に実行してください
-- ================================================================

-- ----------------------------------------------------------------
-- 1. usersテーブルの拡張
-- ----------------------------------------------------------------

-- roleカラムを追加（既存の場合はスキップ）
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  role text DEFAULT 'parent';

-- roleの制約を追加（既に存在する場合はエラーになるので注意）
DO $$
BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('parent', 'staff', 'admin', 'self'));
EXCEPTION
  WHEN duplicate_object THEN
    -- 制約が既に存在する場合は何もしない
    NULL;
END $$;

-- facility_idカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  facility_id UUID;

-- 外部キー制約を追加（既に存在する場合はエラーになるので注意）
DO $$
BEGIN
  ALTER TABLE users ADD CONSTRAINT users_facility_id_fkey
    FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN
    -- 制約が既に存在する場合は何もしない
    NULL;
END $$;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_facility_id ON users(facility_id);

-- ----------------------------------------------------------------
-- 2. business_interview_sessionsテーブルの拡張
-- ----------------------------------------------------------------

-- support_plan_idカラムを追加（後でbusiness_support_plansテーブル作成後に外部キー追加）
ALTER TABLE business_interview_sessions
  ADD COLUMN IF NOT EXISTS support_plan_id UUID;

-- session_typeカラムを追加
ALTER TABLE business_interview_sessions
  ADD COLUMN IF NOT EXISTS session_type text;

-- session_typeの制約を追加
DO $$
BEGIN
  ALTER TABLE business_interview_sessions ADD CONSTRAINT business_interview_sessions_session_type_check
    CHECK (session_type IN ('initial_planning', 'mid_review', 'periodic_review', 'revision', 'consultation'));
EXCEPTION
  WHEN duplicate_object THEN
    -- 制約が既に存在する場合は何もしない
    NULL;
END $$;

-- session_numberカラムを追加
ALTER TABLE business_interview_sessions
  ADD COLUMN IF NOT EXISTS session_number integer DEFAULT 1;

-- child_idをsubject_idにリネーム（既に変更済みの場合はスキップ）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_interview_sessions'
    AND column_name = 'child_id'
  ) THEN
    ALTER TABLE business_interview_sessions
      RENAME COLUMN child_id TO subject_id;
  END IF;
END $$;

-- ================================================================
-- 実行完了
-- ================================================================