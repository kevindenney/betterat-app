-- Studio marketplace subscriber mentoring.
--
-- Marketplace blueprint subscribers copy blueprint_step_templates into their own
-- timeline_steps rows. Give primary authors and co-authors a narrow read/update
-- path to those copied rows so the existing CreatorMentoringPanel can approve,
-- request retry, and suggest next work.

CREATE OR REPLACE FUNCTION public.is_blueprint_author_or_coauthor(
  p_blueprint_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blueprints b
    WHERE b.id = p_blueprint_id
      AND (
        b.author_user_id = p_user_id
        OR EXISTS (
          SELECT 1
          FROM public.blueprint_authors ba
          WHERE ba.blueprint_id = b.id
            AND ba.user_id = p_user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_studio_author_marketplace_step_ids(
  p_user_id uuid
)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT ts.id
  FROM public.timeline_steps ts
  JOIN public.blueprint_step_templates bst
    ON ts.source_type = 'marketplace_copy'
   AND ts.source_id = bst.id
  JOIN public.blueprints b
    ON b.id = bst.blueprint_id
  WHERE public.is_blueprint_author_or_coauthor(b.id, p_user_id);
$$;

DROP POLICY IF EXISTS "Blueprint authors can view adopted step copies"
  ON public.timeline_steps;

CREATE POLICY "Blueprint authors can view adopted step copies"
  ON public.timeline_steps
  FOR SELECT
  USING (
    id IN (
      SELECT public.get_blueprint_author_adopted_step_ids((SELECT auth.uid()))
    )
    OR id IN (
      SELECT public.get_studio_author_marketplace_step_ids((SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Blueprint authors can update adopted step metadata"
  ON public.timeline_steps;

CREATE POLICY "Blueprint authors can update adopted step metadata"
  ON public.timeline_steps
  FOR UPDATE
  USING (
    id IN (
      SELECT public.get_blueprint_author_adopted_step_ids((SELECT auth.uid()))
    )
    OR id IN (
      SELECT public.get_studio_author_marketplace_step_ids((SELECT auth.uid()))
    )
  )
  WITH CHECK (
    id IN (
      SELECT public.get_blueprint_author_adopted_step_ids((SELECT auth.uid()))
    )
    OR id IN (
      SELECT public.get_studio_author_marketplace_step_ids((SELECT auth.uid()))
    )
  );

CREATE OR REPLACE FUNCTION public.studio_author_subscriber_steps(
  p_blueprint_id uuid,
  p_subscriber_id uuid
)
RETURNS TABLE (
  step_id uuid,
  template_id uuid,
  sort_order integer,
  title text,
  status text,
  updated_at timestamptz,
  completed_at timestamptz,
  review_status text,
  review_note text,
  suggested_next text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    ts.id AS step_id,
    bst.id AS template_id,
    bst.sort_order,
    COALESCE(ts.title, bst.title, 'Untitled step') AS title,
    ts.status,
    ts.updated_at,
    ts.completed_at,
    ts.metadata #>> '{review,instructor_review_status}' AS review_status,
    ts.metadata #>> '{review,instructor_review_note}' AS review_note,
    ts.metadata #>> '{review,instructor_suggested_next}' AS suggested_next
  FROM public.blueprints b
  JOIN public.blueprint_step_templates bst
    ON bst.blueprint_id = b.id
  JOIN public.timeline_steps ts
    ON ts.source_type = 'marketplace_copy'
   AND ts.source_id = bst.id
   AND ts.user_id = p_subscriber_id
  WHERE b.id = p_blueprint_id
    AND public.is_blueprint_author_or_coauthor(b.id, (SELECT auth.uid()))
  ORDER BY bst.sort_order ASC, ts.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.is_blueprint_author_or_coauthor(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_studio_author_marketplace_step_ids(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.studio_author_subscriber_steps(uuid, uuid)
  TO authenticated;
