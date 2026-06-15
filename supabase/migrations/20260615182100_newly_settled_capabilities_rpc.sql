-- Signature moment: Trophy of Becoming.
-- When completing a step writes a confirmed + strong capability-evidence row,
-- a capability "settles" the first time ANY of the owner's steps reaches that
-- bar (mirrors get_person_public_face's settled = bool_or(confirmed AND strong)).
--
-- newly_settled_capabilities(step) returns the capability names that became
-- settled *because of* this step — i.e. they have a confirmed+strong row on
-- this step and on no other step the owner holds. Empty when nothing crossed.

CREATE OR REPLACE FUNCTION public.newly_settled_capabilities(p_step_id UUID)
RETURNS TABLE(capability_name TEXT, evidence_count INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owner AS (
    SELECT user_id FROM public.timeline_steps WHERE id = p_step_id
  ),
  this_strong AS (
    SELECT sce.capability_name, sce.evidence_count
    FROM public.step_capability_evidence sce
    WHERE sce.step_id = p_step_id
      AND sce.confirmed
      AND sce.strength = 'strong'
  )
  SELECT t.capability_name, t.evidence_count
  FROM this_strong t
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.step_capability_evidence other
    JOIN public.timeline_steps ts ON ts.id = other.step_id
    WHERE ts.user_id = (SELECT user_id FROM owner)
      AND other.step_id <> p_step_id
      AND other.capability_name = t.capability_name
      AND other.confirmed
      AND other.strength = 'strong'
  );
$$;

REVOKE ALL ON FUNCTION public.newly_settled_capabilities(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newly_settled_capabilities(UUID) TO authenticated;
