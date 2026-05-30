-- The original affinity_group_members_read policy recursed: its USING
-- clause queried affinity_group_members inside affinity_group_members'
-- own RLS check, hitting the 42P17 / 500 pattern documented in
-- feedback_rls_cross_table_recursion.md.
--
-- Fix: wrap the membership lookup in a SECURITY DEFINER helper that
-- bypasses RLS, so the policy can call it without re-entering.

CREATE OR REPLACE FUNCTION public.is_active_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affinity_group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

COMMENT ON FUNCTION public.is_active_group_member IS
  'SECURITY DEFINER helper that bypasses RLS so policies on affinity_group_members can ask "is this user a member?" without recursing into the same table.';

DROP POLICY IF EXISTS affinity_group_members_read ON public.affinity_group_members;

CREATE POLICY affinity_group_members_read ON public.affinity_group_members
  FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND public.is_active_group_member(group_id, (SELECT auth.uid()))
  );
