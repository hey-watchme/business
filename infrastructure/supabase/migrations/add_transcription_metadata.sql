-- ===================================================================
-- Migration: Add transcription_metadata column
-- Created: 2026-01-11
-- Purpose: Store extended Deepgram transcription data
-- ===================================================================

-- Add transcription_metadata column (JSONB)
ALTER TABLE public.business_interview_sessions
ADD COLUMN IF NOT EXISTS transcription_metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN public.business_interview_sessions.transcription_metadata IS
'Extended transcription data from Deepgram: utterances, paragraphs, speaker_count, etc.';

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'business_interview_sessions'
  AND column_name = 'transcription_metadata';
