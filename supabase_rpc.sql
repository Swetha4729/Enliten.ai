-- Function to check if a user exists by email (bypassing RLS)
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.user_exists(email_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to run with privileges to bypass RLS
SET search_path = public -- Secure search path
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE email = email_check);
END;
$$;

-- Grant access to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.user_exists(text) TO anon, authenticated, service_role;
