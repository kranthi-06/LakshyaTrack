-- ============================================================
-- Profile Skills & Saved Resumes Schema
-- ============================================================

-- 1. Add skills to profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;

-- 2. Create Saved Resumes table
CREATE TABLE IF NOT EXISTS public.saved_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    resume_name TEXT DEFAULT 'Untitled Resume',
    resume_url TEXT,
    resume_data JSONB NOT NULL,
    template_id TEXT DEFAULT 'modern',
    theme TEXT DEFAULT 'default',
    target_role TEXT,
    ats_score DOUBLE PRECISION,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_resumes_user ON public.saved_resumes(user_id);

-- Row Level Security
ALTER TABLE public.saved_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resumes"
    ON public.saved_resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own resumes"
    ON public.saved_resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own resumes"
    ON public.saved_resumes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own resumes"
    ON public.saved_resumes FOR DELETE USING (auth.uid() = user_id);
