-- Wrap bare auth.uid() as (SELECT auth.uid()) in step-link RLS policies.
-- Bare auth.uid() in USING/WITH CHECK re-decodes the JWT per row, which is the
-- documented root cause of statement-timeout (HTTP 500) storms on these tables.
-- Semantically identical; only hoists the auth.uid() evaluation out of the row loop.

ALTER POLICY "Access step concept links via parent step" ON public.step_concept_links
  USING (EXISTS (
    SELECT 1 FROM public.timeline_steps ts
    WHERE ts.id = step_concept_links.step_id
      AND ts.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.timeline_steps ts
    WHERE ts.id = step_concept_links.step_id
      AND ts.user_id = (SELECT auth.uid())
  ));

ALTER POLICY "Access step playbook links via parent step" ON public.step_playbook_links
  USING (EXISTS (
    SELECT 1 FROM public.timeline_steps ts
    WHERE ts.id = step_playbook_links.step_id
      AND (ts.user_id = (SELECT auth.uid())
           OR (SELECT auth.uid())::text = ANY (ts.collaborator_user_ids))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.timeline_steps ts
    WHERE ts.id = step_playbook_links.step_id
      AND (ts.user_id = (SELECT auth.uid())
           OR (SELECT auth.uid())::text = ANY (ts.collaborator_user_ids))
  ));

ALTER POLICY "step_discussions_author_delete" ON public.step_discussions
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "step_discussions_author_update" ON public.step_discussions
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
