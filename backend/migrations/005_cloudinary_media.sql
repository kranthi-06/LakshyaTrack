-- ============================================================
-- Cloudinary Media URL Columns
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resume_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certificate_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS project_image_url TEXT;

UPDATE public.profiles
SET profile_image_url = COALESCE(profile_image_url, profile_photo_url),
    profile_photo_url = COALESCE(profile_photo_url, profile_image_url);

ALTER TABLE public.saved_resumes ADD COLUMN IF NOT EXISTS resume_url TEXT;
