-- Fast path for "steps shared with me as a collaborator".
--
-- TimelineStepService.getUserTimeline runs two reads: own steps (user_id = me)
-- and collaborator steps (collaborator_user_ids @> [me]). The own read is cheap
-- (idx_timeline_steps_user_status). The collaborator read was timing out
-- (statement_timeout, 57014): timeline_steps has 10 OR'd SELECT policies, several
-- with per-row SECURITY DEFINER joins (org-membership faculty check, blueprint
-- co-subscriber 3-way joins). RLS OR-expands all of them into the scan filter and
-- evaluates the expensive faculty EXISTS subplan FIRST for every row, so the
-- planner does a Seq Scan over the whole table and the cheap GIN-indexable
-- `collaborator_user_ids @>` predicate is ANDed last — the GIN index is never used.
--
-- This function reproduces exactly ONE of those policies ("Collaborators can view
-- steps they are added to": auth.uid() = ANY(collaborator_user_ids)) as a single
-- predicate, with no OR-block. It uses the `@>` containment form (not `= ANY`) so
-- the GIN index idx_timeline_steps_collaborator_user_ids applies — `= ANY` is not
-- GIN-indexable, `@> ARRAY[x]` is and is equivalent for a single element.
-- SECURITY DEFINER lets it skip RLS, but the WHERE clause is the policy, so it
-- returns nothing the caller couldn't already read. A null auth.uid() yields an
-- empty array element → no rows (fail-closed).

CREATE OR REPLACE FUNCTION get_collaborator_timeline_steps(
  p_interest_ids UUID[] DEFAULT NULL
)
RETURNS SETOF timeline_steps
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM timeline_steps
  WHERE collaborator_user_ids @> ARRAY[(SELECT auth.uid())::text]
    AND user_id <> (SELECT auth.uid())
    AND is_plan_template = false
    AND (p_interest_ids IS NULL OR interest_id = ANY(p_interest_ids))
  ORDER BY sort_order ASC, created_at ASC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION get_collaborator_timeline_steps(UUID[]) TO authenticated;

COMMENT ON FUNCTION get_collaborator_timeline_steps(UUID[]) IS
  'Returns timeline steps where the caller is listed in collaborator_user_ids. SECURITY DEFINER to avoid the 10-policy RLS OR-expansion that forced a full Seq Scan and timed the collaborator read out; the WHERE clause enforces the same collaborator-visibility policy, so no extra rows are exposed.';
