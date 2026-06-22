-- Let active affinity groupmates see each other's non-private steps for the
-- group's interest. Watch > Groups uses this for non-sailing practice groups
-- such as FastForward DTC Founders Circle.

CREATE OR REPLACE FUNCTION public.can_view_affinity_group_step(
  author_id uuid,
  step_interest_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.affinity_group_members viewer
    JOIN public.affinity_group_members author
      ON author.group_id = viewer.group_id
     AND author.user_id = author_id
     AND author.status = 'active'
    JOIN public.affinity_groups ag
      ON ag.id = viewer.group_id
     AND ag.is_active = true
    LEFT JOIN public.interests i
      ON i.id = step_interest_id
    WHERE viewer.user_id = (SELECT auth.uid())
      AND viewer.status = 'active'
      AND author_id <> (SELECT auth.uid())
      AND (
        ag.interest_slug IS NULL
        OR i.slug IS NULL
        OR ag.interest_slug = i.slug
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_affinity_group_step(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.can_view_affinity_group_step(uuid, uuid) IS
  'True when the current user and author share an active affinity_group for this step interest. Used by timeline_steps RLS for Watch > Groups.';

DROP POLICY IF EXISTS "Affinity groupmates can view peer steps" ON public.timeline_steps;

CREATE POLICY "Affinity groupmates can view peer steps"
  ON public.timeline_steps
  FOR SELECT
  USING (
    visibility IN ('crew', 'fleet', 'public')
    AND public.can_view_affinity_group_step(user_id, interest_id)
  );

COMMENT ON POLICY "Affinity groupmates can view peer steps" ON public.timeline_steps IS
  'Allows Watch > Groups to show non-private step activity from active affinity groupmates without requiring user_follows rows.';
