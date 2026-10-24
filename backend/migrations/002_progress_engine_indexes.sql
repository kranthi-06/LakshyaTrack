-- ============================================================
-- Progress Engine Table Creation and Performance Optimization
-- Run this in Supabase SQL Editor to create tables and indexes
-- ============================================================

-- 1. Create ActivityLog table (SQL fallback for Progress Engine)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ActivityLog
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_timestamp
ON public.activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_type
ON public.activity_logs(user_id, event_type);

-- 2. Index for SavedResume queries
CREATE INDEX IF NOT EXISTS idx_saved_resumes_user_created
ON public.saved_resumes(user_id, created_at DESC);

-- 3. Index for UserActivityDay (streak calculation)
CREATE INDEX IF NOT EXISTS idx_user_activity_days_user_date
ON public.user_activity_days(user_id, activity_date DESC);

-- 4. Composite index for roadmaps (counting roadmaps_created)
CREATE INDEX IF NOT EXISTS idx_roadmaps_user_created
ON public.roadmaps(user_id, created_at DESC);

-- 5. Index for Quiz Attempts (counting quizzes_passed)
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_passed
ON public.quiz_attempts(user_id, passed, attempted_at DESC);

-- 6. Index for Interview Sessions (counting interviews_done)
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_completed
ON public.interview_sessions(user_id, completed_at DESC);

-- 7. Index for Multi-Stage Interviews
CREATE INDEX IF NOT EXISTS idx_multistage_interviews_user_completed
ON public.multistage_interviews(user_id, is_completed, created_at DESC);
