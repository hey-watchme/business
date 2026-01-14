-- ================================================================
-- WatchMe/Business 基本テーブル作成
-- 作成日: 2026-01-14
-- 注意: 既存テーブルがある場合はスキップされます
--
-- 重要: WatchMeプロジェクトでは auth.users への直接参照は禁止
--      すべて public.users を使用します
-- ================================================================

-- ----------------------------------------------------------------
-- 1. facilities（施設）テーブル
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text CHECK (type IN ('therapy_center', 'daycare', 'school', 'clinic', 'other')),
  address text,
  phone text,
  email text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_facilities_type ON public.facilities(type);

-- テスト用施設データ
INSERT INTO public.facilities (id, name, type, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'テスト療育施設', 'therapy_center', NOW())
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------
-- 2. users テーブル（既存の場合はスキップ）
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ----------------------------------------------------------------
-- 3. subjects テーブル（既存の場合はスキップ）
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subjects (
  subject_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age integer,
  gender text,
  avatar_url text,
  notes text,
  created_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  prefecture text,
  city text,
  cognitive_type text CHECK (
    cognitive_type IS NULL OR
    cognitive_type IN (
      'sensory_sensitive',
      'sensory_insensitive',
      'cognitive_analytical',
      'cognitive_intuitive',
      'verbal_expressive',
      'verbal_introspective',
      'behavioral_impulsive',
      'behavioral_deliberate',
      'emotional_stable',
      'emotional_unstable'
    )
  )
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_subjects_created_by_user_id ON public.subjects(created_by_user_id);

-- テスト用サブジェクトデータ
INSERT INTO public.subjects (subject_id, name, age, gender, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'テスト対象者', 5, '男性', NOW())
ON CONFLICT (subject_id) DO NOTHING;

-- ----------------------------------------------------------------
-- コメント追加
-- ----------------------------------------------------------------

COMMENT ON TABLE public.facilities IS '施設マスタテーブル';
COMMENT ON TABLE public.users IS 'ユーザーマスタテーブル';
COMMENT ON TABLE public.subjects IS '観測対象マスタテーブル';
COMMENT ON COLUMN public.facilities.type IS '施設タイプ: therapy_center(療育施設), daycare(保育園), school(学校), clinic(クリニック), other(その他)';
COMMENT ON COLUMN public.subjects.cognitive_type IS '認知タイプの分類';

-- ================================================================
-- 実行完了
-- ================================================================