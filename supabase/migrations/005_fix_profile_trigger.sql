-- Only create a profile for admin-invited users (who have full_name in metadata).
-- Landing page OTP users do NOT get a profile, so they cannot access the admin portal.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if the user was invited by an admin (has full_name metadata)
  IF NEW.raw_user_meta_data->>'full_name' IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'full_name'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up profiles that were created for OTP-only users (no full_name metadata).
-- These users exist in auth.users but should NOT have a profile.
-- Only delete profiles where the user has no role explicitly set to 'admin'.
DELETE FROM public.profiles
WHERE id IN (
  SELECT p.id FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.raw_user_meta_data->>'full_name' IS NULL
  AND p.role = 'staff'
);
