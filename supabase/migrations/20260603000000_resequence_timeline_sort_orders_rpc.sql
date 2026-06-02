-- Single-statement reorder for timeline steps.
--
-- TimelineStepService.resequenceTimelineSortOrders previously issued one
-- UPDATE per step id in a loop (an N+1 write fired on every drag-reorder).
-- This RPC assigns sort_order = position-1 for the supplied ordered id array
-- in one statement, writing only the rows whose value actually changes.
--
-- SECURITY INVOKER (default): the existing "Users can update own timeline
-- steps" RLS policy (auth.uid() = user_id) already restricts the UPDATE to the
-- caller's own rows; the explicit user_id guard below is belt-and-suspenders.
--
-- Applied to dev project via Supabase MCP.

CREATE OR REPLACE FUNCTION public.resequence_timeline_sort_orders(p_step_ids uuid[])
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.timeline_steps ts
  SET sort_order = (v.ord - 1)
  FROM unnest(p_step_ids) WITH ORDINALITY AS v(step_id, ord)
  WHERE ts.id = v.step_id
    AND ts.user_id = (SELECT auth.uid())
    AND ts.sort_order IS DISTINCT FROM (v.ord - 1)::integer;
$$;

GRANT EXECUTE ON FUNCTION public.resequence_timeline_sort_orders(uuid[]) TO authenticated;
