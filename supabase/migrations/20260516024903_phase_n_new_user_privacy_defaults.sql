-- Phase N: new-user privacy defaults only.
--
-- Existing rows are intentionally untouched. Phase O owns existing-user
-- migration after the May 20 demo and user communication.

BEGIN;

ALTER TABLE public.profiles
  ALTER COLUMN profile_public SET DEFAULT false;

ALTER TABLE public.sailor_profiles
  ALTER COLUMN is_profile_public SET DEFAULT false;

DROP POLICY IF EXISTS "Users can view all profiles for discovery" ON public.profiles;

CREATE POLICY "Users can view all profiles for discovery"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(profile_public, false) = true
    OR EXISTS (
      SELECT 1
      FROM public.user_follows
      WHERE follower_id = auth.uid()
        AND following_id = profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships om1
      JOIN public.organization_memberships om2
        ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
        AND om2.user_id = profiles.id
    )
  );

COMMENT ON COLUMN public.profiles.profile_public IS
  'When true the profile is discoverable by anyone. Defaults false; public profile visibility is explicit opt-in.';

DROP POLICY IF EXISTS "Users can view all sailor profiles for discovery" ON public.sailor_profiles;

CREATE POLICY "Users can view all sailor profiles for discovery"
  ON public.sailor_profiles
  FOR SELECT
  TO authenticated
  USING (COALESCE(is_profile_public, false) = true);

COMMENT ON COLUMN public.sailor_profiles.is_profile_public IS
  'When true the sailing-specific profile is discoverable by authenticated users. Defaults false; public visibility is explicit opt-in.';

COMMIT;
