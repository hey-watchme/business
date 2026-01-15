-- Business Subjects Table (児童/支援対象者管理)
-- business系のテーブル命名規則に従い、business_subjectsとする

CREATE TABLE IF NOT EXISTS public.business_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NULL,
  gender TEXT NULL CHECK (gender IN ('male', 'female', 'other', NULL)),
  avatar_url TEXT NULL,
  notes TEXT NULL,
  prefecture TEXT NULL,
  city TEXT NULL,
  cognitive_type TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT business_subjects_pkey PRIMARY KEY (id),
  CONSTRAINT business_subjects_facility_fkey FOREIGN KEY (facility_id)
    REFERENCES business_facilities(id) ON DELETE CASCADE,
  CONSTRAINT cognitive_type_check CHECK (
    cognitive_type IS NULL OR cognitive_type IN (
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
CREATE INDEX IF NOT EXISTS idx_business_subjects_facility_id
  ON public.business_subjects USING btree (facility_id);

CREATE INDEX IF NOT EXISTS idx_business_subjects_created_by
  ON public.business_subjects USING btree (created_by);

-- RLS (Row Level Security) を有効化
ALTER TABLE public.business_subjects ENABLE ROW LEVEL SECURITY;

-- RLS ポリシーの作成（認証済みユーザーはすべて読み取り可能）
CREATE POLICY "business_subjects_read_policy" ON public.business_subjects
  FOR SELECT USING (true);

-- RLS ポリシーの作成（認証済みユーザーは作成・更新・削除可能）
CREATE POLICY "business_subjects_write_policy" ON public.business_subjects
  FOR ALL USING (auth.role() = 'authenticated');

-- サンプルデータの挿入（開発用）
INSERT INTO public.business_subjects (facility_id, name, age, gender, notes, prefecture, city, cognitive_type)
VALUES
  ('00000000-0000-0000-0000-000000000001', '田中太郎', 5, 'male', '明るく活発な男の子。集団活動では積極的に参加。', '東京都', '港区', 'verbal_expressive'),
  ('00000000-0000-0000-0000-000000000001', '山田花子', 4, 'female', '絵を描くことが好き。少し人見知りする傾向がある。', '東京都', '渋谷区', 'cognitive_intuitive'),
  ('00000000-0000-0000-0000-000000000001', '佐藤次郎', 6, 'male', '運動が得意。ルールの理解に時間がかかることがある。', '東京都', '新宿区', 'behavioral_impulsive'),
  ('00000000-0000-0000-0000-000000000001', '鈴木美咲', 5, 'female', '音楽が好き。感情表現が豊か。', '東京都', '世田谷区', 'emotional_unstable'),
  ('00000000-0000-0000-0000-000000000001', '高橋健太', 4, 'male', '電車や車に興味がある。こだわりが強い。', '東京都', '目黒区', 'sensory_sensitive')
ON CONFLICT DO NOTHING;

-- business_support_plansテーブルも更新して、subject_idカラムを追加（まだない場合）
ALTER TABLE public.business_support_plans
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES business_subjects(id) ON DELETE SET NULL;

-- business_interview_sessionsテーブルのsubject_idをbusiness_subjectsに関連付ける
-- （既存のsubject_idカラムがある場合、外部キー制約を更新）
ALTER TABLE public.business_interview_sessions
  DROP CONSTRAINT IF EXISTS business_interview_sessions_subject_fkey,
  ADD CONSTRAINT business_interview_sessions_subject_fkey
    FOREIGN KEY (subject_id) REFERENCES business_subjects(id) ON DELETE SET NULL;