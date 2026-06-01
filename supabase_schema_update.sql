-- Add subscription_expires_at column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_expires_at timestamp with time zone;

-- Ensure RLS allows users to update their own subscription status (if not already allowed)
-- You might have a policy like "Users can update own profile". ensure it covers these columns.
-- Example Policy (if you need it):
-- CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
    