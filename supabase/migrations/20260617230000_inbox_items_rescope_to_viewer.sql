-- P0 regression fix: 20260617220000_unify_step_suggestions recreated the
-- inbox_items view with a plain `CREATE OR REPLACE VIEW` that dropped BOTH
-- protections 20260529160000 had added:
--   1. WITH (security_invoker = true)  → view ran as definer, bypassing the
--      underlying tables' per-user RLS.
--   2. the per-arm `target_user_id = auth.uid()` recipient filter.
-- Result: the Practice Inbox again leaked EVERY user's pending suggestions /
-- on-deck / reflections to any authenticated user.
--
-- This re-applies both protections while preserving the suggested_title /
-- suggested_description columns the unify migration introduced.
CREATE OR REPLACE VIEW public.inbox_items
WITH (security_invoker = true) AS
  SELECT
    s.id                     AS id,
    'suggestion'::text       AS kind,
    s.target_user_id         AS user_id,
    s.source_user_id         AS from_user_id,
    NULL::uuid               AS from_plan_id,
    s.source_step_id         AS step_id,
    s.message                AS body,
    s.status                 AS status,
    s.created_at             AS created_at,
    s.suggested_title        AS suggested_title,
    s.suggested_description  AS suggested_description
  FROM public.step_suggestions s
  WHERE s.status = 'pending'
    AND s.target_user_id = (SELECT auth.uid())
UNION ALL
  SELECT
    d.id                     AS id,
    'on_deck'::text          AS kind,
    d.user_id                AS user_id,
    NULL::uuid               AS from_user_id,
    NULL::uuid               AS from_plan_id,
    d.source_id              AS step_id,
    d.body                   AS body,
    d.status                 AS status,
    d.added_at               AS created_at,
    NULL::text               AS suggested_title,
    NULL::text               AS suggested_description
  FROM public.step_deck d
  WHERE d.status = 'on_deck'
    AND d.user_id = (SELECT auth.uid())
UNION ALL
  SELECT
    r.id                     AS id,
    'reflection'::text       AS kind,
    r.target_user_id         AS user_id,
    r.source_user_id         AS from_user_id,
    NULL::uuid               AS from_plan_id,
    r.target_step_id         AS step_id,
    r.body                   AS body,
    r.status                 AS status,
    r.created_at             AS created_at,
    NULL::text               AS suggested_title,
    NULL::text               AS suggested_description
  FROM public.peer_reflections r
  WHERE r.status IN ('unread', 'read')
    AND r.target_user_id = (SELECT auth.uid());
