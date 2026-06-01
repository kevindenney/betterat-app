-- ============================================================================
-- get_blueprint_titles — resolve blueprint ids to titles for the Watch tab's
-- "By blueprint" grouping.
--
-- The followed-steps feed carries source_blueprint_id, but a step a followed
-- person adopted may come from an org_members blueprint the VIEWER can't read
-- under timeline_blueprints RLS — so a plain title query would intermittently
-- return null and the group header would be blank. Titles aren't sensitive
-- (they show on every discovery surface), so expose a narrow SECURITY DEFINER
-- lookup gated to authenticated, mirroring the fleet RPC pattern.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_blueprint_titles(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  title text,
  slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.title, b.slug
  FROM timeline_blueprints b
  WHERE b.id = ANY(p_ids);
$$;
GRANT EXECUTE ON FUNCTION public.get_blueprint_titles(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
