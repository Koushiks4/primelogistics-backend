-- SECURITY FIX: Remove the auto-profile trigger entirely.
--
-- Problem: The handle_new_user trigger created a profile for every new auth.users entry.
-- Since the Supabase anon key is public (embedded in frontend), anyone could craft a
-- signup with full_name metadata and get a staff profile, granting admin portal access.
--
-- Fix: Profile creation now happens ONLY through the admin invite endpoint
-- (POST /api/admin/users), which requires admin authentication and uses the
-- service role key server-side. No client-side action can create a profile.

-- Drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function
DROP FUNCTION IF EXISTS handle_new_user();

-- Clean up any profiles that belong to OTP-only users (no admin invite).
-- These users exist in auth.users but should NOT have admin portal access.
-- We identify them by checking if they have NO role metadata set by admin invite.
-- Safety: only delete staff profiles, never admin profiles.
DELETE FROM public.profiles
WHERE role = 'staff'
AND id IN (
  SELECT p.id FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.raw_user_meta_data->>'full_name' IS NULL
);
