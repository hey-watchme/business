-- Minimal setup for business recording feature
-- Execute this in Supabase SQL Editor

-- 1. Create facilities table first (minimal)
CREATE TABLE IF NOT EXISTS public.business_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create children table (minimal)
CREATE TABLE IF NOT EXISTS public.business_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.business_facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create interview sessions table
CREATE TABLE IF NOT EXISTS public.business_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL,
  child_id UUID NOT NULL REFERENCES public.business_children(id) ON DELETE CASCADE,
  s3_audio_path TEXT,
  transcription TEXT,
  status TEXT DEFAULT 'uploaded',
  duration_seconds INTEGER,
  staff_id UUID,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Insert test data
-- Test facility
INSERT INTO public.business_facilities (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Facility')
ON CONFLICT (id) DO NOTHING;

-- Test child
INSERT INTO public.business_children (id, facility_id, name)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test Child')
ON CONFLICT (id) DO NOTHING;

-- 5. Enable Row Level Security (RLS) - but allow all for now
ALTER TABLE public.business_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_interview_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (development mode)
CREATE POLICY "Allow all operations on facilities" ON public.business_facilities
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on children" ON public.business_children
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on sessions" ON public.business_interview_sessions
  FOR ALL USING (true) WITH CHECK (true);