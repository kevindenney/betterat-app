-- A non-member deep-linking to an audience-scoped post gets zero rows from
-- RLS, indistinguishable from a deleted post — the detail screen could only
-- say "Post not found". This RPC reveals existence (not content or scope) so
-- the UI can show a "shared with a group you're not in" state instead.
CREATE OR REPLACE FUNCTION public.venue_post_visibility(p_post_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM venue_discussions WHERE id = p_post_id) THEN 'not_found'
    WHEN public.can_read_venue_discussion(p_post_id, (SELECT auth.uid())) THEN 'visible'
    ELSE 'members_only'
  END;
$$;
