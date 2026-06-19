-- Let the Watch "Touches your {gap}" chip read followed people's competency
-- attempts for steps the viewer can already see.
--
-- `betterat_competency_attempts` SELECT is locked to the row owner
-- (`attempts_own_read`: user_id = auth.uid()), plus preceptor/faculty. The
-- gap-touch chip needs the opposite: given a FOLLOWED person's step the viewer
-- can see on their feed, which competencies does it evidence? That read crosses
-- users, so it returned zero rows under RLS and the chip never fired.
--
-- Rather than widen the table's SELECT surface, expose only the minimal
-- (event_id, competency_id) projection through a SECURITY DEFINER function that
-- re-checks the SAME visibility gate the Watch feed uses
-- (`can_view_peer_timeline_step`). The caller passes the step ids it already
-- received from the feed and its own gap competency ids; nothing else leaks.

CREATE OR REPLACE FUNCTION public.followed_step_gap_attempts(
  p_step_ids uuid[],
  p_competency_ids uuid[]
)
RETURNS TABLE(event_id uuid, competency_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.event_id, a.competency_id
  FROM betterat_competency_attempts a
  JOIN timeline_steps ts ON ts.id = a.event_id
  WHERE a.event_id = ANY(p_step_ids)
    AND a.competency_id = ANY(p_competency_ids)
    AND public.can_view_peer_timeline_step(
          (SELECT auth.uid()), ts.id, ts.user_id, ts.interest_id, ts.visibility
        );
$$;

REVOKE ALL ON FUNCTION public.followed_step_gap_attempts(uuid[], uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.followed_step_gap_attempts(uuid[], uuid[]) TO authenticated;
