-- Reset Schema
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create Users Table (Mirrors auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  login_type TEXT DEFAULT 'custom',
  is_active BOOLEAN DEFAULT TRUE,
  is_superuser BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Profiles Table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  profile_photo_url TEXT,
  profile_image_url TEXT,
  resume_url TEXT,
  certificate_url TEXT,
  project_image_url TEXT,
  phone_number TEXT,
  bio TEXT,
  links JSONB DEFAULT '{}'::jsonb,
  activity_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_login_type TEXT;
  v_full_name TEXT;
BEGIN
  -- Detect login type and full name from metadata
  v_login_type := 'custom';
  v_full_name := new.raw_user_meta_data->>'full_name';
  
  IF new.raw_app_meta_data->>'provider' = 'google' OR new.raw_user_meta_data->>'iss' LIKE '%google%' THEN
    v_login_type := 'google';
  END IF;

  -- Insert into public.users
  INSERT INTO public.users (id, email, login_type, is_active, is_superuser)
  VALUES (
    new.id, 
    new.email, 
    v_login_type, 
    TRUE, 
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert into public.profiles
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id, 
    COALESCE(v_full_name, new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name
  WHERE public.profiles.full_name IS NULL;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
