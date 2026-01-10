-- ===================================================================
-- WatchMe Business (B2B) - Database Tables
--
-- Project: Individual Support Plan Generator
-- Purpose: Create tables for child development support facilities
-- Created: 2026-01-10
--
-- IMPORTANT: Execute in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/YOUR_PROJECT/editor
-- ===================================================================

-- ===================================================================
-- 1. Facilities (Business Facilities Master)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.business_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  license_number TEXT,  -- Business license number
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.business_facilities IS 'Child development support facilities master data';
COMMENT ON COLUMN public.business_facilities.license_number IS 'Government-issued facility license number';

-- ===================================================================
-- 2. Children (Child Information)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.business_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.business_facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  enrollment_date DATE,
  guardian_name TEXT,
  guardian_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.business_children IS 'Children enrolled in support programs';
COMMENT ON COLUMN public.business_children.guardian_name IS 'Primary guardian name';

-- ===================================================================
-- 3. Interview Sessions (Hearing Sessions)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.business_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL,
  child_id UUID NOT NULL REFERENCES public.business_children(id) ON DELETE CASCADE,

  -- Audio & Transcription
  s3_audio_path TEXT,           -- S3 path: watchme-business/recordings/{facility_id}/{child_id}/...
  transcription TEXT,            -- Whisper transcription result

  -- Processing Status
  status TEXT DEFAULT 'recording' CHECK (status IN ('recording', 'processing', 'completed', 'failed')),

  -- Metadata
  duration_seconds INTEGER,
  staff_id UUID,                 -- Staff member who conducted interview
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.business_interview_sessions IS 'Parent interview sessions for support planning';
COMMENT ON COLUMN public.business_interview_sessions.status IS 'Processing status: recording, processing, completed, failed';

CREATE INDEX IF NOT EXISTS idx_interview_sessions_child ON public.business_interview_sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON public.business_interview_sessions(status);

-- ===================================================================
-- 4. Support Plans (Individual Support Plans)
-- ===================================================================
CREATE TABLE IF NOT EXISTS public.business_support_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.business_interview_sessions(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.business_children(id) ON DELETE CASCADE,

  -- Basic Information
  child_name TEXT,
  birth_date DATE,
  age_years INTEGER,
  age_months INTEGER,

  -- Intentions (本人・家族の意向)
  child_intention TEXT,          -- Child's wishes
  family_intention TEXT,         -- Family's wishes

  -- Support Policy (支援方針)
  general_policy TEXT,           -- Overall support policy
  current_status TEXT,           -- Current situation analysis

  -- Goals (目標)
  long_term_goal TEXT,
  long_term_period TEXT DEFAULT '6ヶ月',
  short_term_goal TEXT,
  short_term_period TEXT DEFAULT '3ヶ月',

  -- Support Details (支援内容 - 5 Domains)
  support_details JSONB DEFAULT '{
    "health_life": [],
    "motor_sensory": [],
    "cognitive_behavior": [],
    "language_communication": [],
    "social_relationships": []
  }'::jsonb,

  /*
  support_details structure:
  {
    "health_life": [
      {
        "goal": "Specific achievement goal",
        "content": "Support content and methods",
        "period": "3ヶ月 or 6ヶ月",
        "staff": "Assigned staff member",
        "notes": "Important notes",
        "priority": 1-3
      }
    ],
    "motor_sensory": [...],
    "cognitive_behavior": [...],
    "language_communication": [...],
    "social_relationships": [...]
  }
  */

  -- Validity Period
  valid_from DATE,
  valid_until DATE,

  -- Management
  created_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.business_support_plans IS 'Individual support plans (個別支援計画書)';
COMMENT ON COLUMN public.business_support_plans.support_details IS '5 domains: health_life, motor_sensory, cognitive_behavior, language_communication, social_relationships';

CREATE INDEX IF NOT EXISTS idx_support_plans_child ON public.business_support_plans(child_id);
CREATE INDEX IF NOT EXISTS idx_support_plans_session ON public.business_support_plans(session_id);

-- ===================================================================
-- 5. Row Level Security (RLS) Policies
-- ===================================================================

-- Enable RLS
ALTER TABLE public.business_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_support_plans ENABLE ROW LEVEL SECURITY;

-- POC: Allow all access (TEMPORARY - replace with proper auth later)
CREATE POLICY "POC: Allow all access" ON public.business_facilities FOR ALL USING (true);
CREATE POLICY "POC: Allow all access" ON public.business_children FOR ALL USING (true);
CREATE POLICY "POC: Allow all access" ON public.business_interview_sessions FOR ALL USING (true);
CREATE POLICY "POC: Allow all access" ON public.business_support_plans FOR ALL USING (true);

-- ===================================================================
-- 6. Updated At Trigger (自動更新日時)
-- ===================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all business tables
CREATE TRIGGER update_business_facilities_updated_at BEFORE UPDATE ON public.business_facilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_children_updated_at BEFORE UPDATE ON public.business_children
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_interview_sessions_updated_at BEFORE UPDATE ON public.business_interview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_support_plans_updated_at BEFORE UPDATE ON public.business_support_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- 7. Sample Data (POC Testing)
-- ===================================================================

-- Insert sample facility
INSERT INTO public.business_facilities (id, name, address, phone)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'POC施設（テスト用）', '東京都渋谷区1-2-3', '03-1234-5678')
ON CONFLICT (id) DO NOTHING;

-- Insert sample child
INSERT INTO public.business_children (id, facility_id, name, birth_date)
VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'テスト 太郎', '2019-04-30')
ON CONFLICT (id) DO NOTHING;

-- ===================================================================
-- Verification
-- ===================================================================

-- Check tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'business_%'
ORDER BY table_name;

-- Expected output:
-- business_children
-- business_facilities
-- business_interview_sessions
-- business_support_plans