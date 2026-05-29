-- Allow a step's owner and its "with who" participants (collaborators) to post and
-- read notes in a step's Discuss thread. Previously only blueprint members/subscribers
-- could insert, so a collaborator added via "with who" (e.g. crew added by the owner)
-- got a 403 when posting on a non-blueprint step.
--
-- can_access_step_discussion is SECURITY DEFINER so it can read timeline_steps /
-- step_collaborators without tripping those tables' own RLS (avoids cross-table
-- recursion). auth.uid() is wrapped as (SELECT auth.uid()) so it's evaluated once
-- per statement rather than re-decoded per row.
--
-- collaborator_user_ids is text[], so the uid is cast to text for the ANY() check.

CREATE OR REPLACE FUNCTION public.can_access_step_discussion(p_step_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.timeline_steps ts
     WHERE ts.id = p_step_id
       AND (ts.user_id = p_user_id OR p_user_id::text = ANY(ts.collaborator_user_ids))
  )
  OR EXISTS (
    SELECT 1
      FROM public.step_collaborators sc
     WHERE sc.step_id = p_step_id
       AND sc.user_id = p_user_id
  );
$function$;

CREATE POLICY step_discussions_participant_insert ON public.step_discussions
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND blueprint_step_id IS NULL
    AND step_id IS NOT NULL
    AND public.can_access_step_discussion(step_id, (SELECT auth.uid()))
  );

CREATE POLICY step_discussions_participant_read ON public.step_discussions
  FOR SELECT
  USING (
    step_id IS NOT NULL
    AND public.can_access_step_discussion(step_id, (SELECT auth.uid()))
  );
