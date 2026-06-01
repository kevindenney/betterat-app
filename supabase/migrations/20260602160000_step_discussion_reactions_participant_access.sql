-- Let step owners & collaborators react on personal-step discussions.
--
-- step_discussion_reactions only had subscriber-scoped policies
-- (is_subscriber_to_step_blueprint). step_discussions itself gates posting
-- with the broader can_access_step_discussion() — owner + collaborators —
-- via its participant_insert/read policies. The reactions table never got
-- the matching participant policies, so on a MINE/personal step (no
-- blueprint → is_subscriber_to_step_blueprint = false) the owner's own
-- reaction INSERT was silently rejected and the tap did nothing.
--
-- Mirror step_discussions' participant policies onto the reactions table so
-- reaction access tracks note access. Subscriber policies stay as-is for
-- cohort/blueprint threads.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

CREATE POLICY step_discussion_reactions_participant_insert
  ON public.step_discussion_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
        FROM public.step_discussions d
       WHERE d.id = step_discussion_reactions.discussion_id
         AND d.step_id IS NOT NULL
         AND public.can_access_step_discussion(d.step_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY step_discussion_reactions_participant_read
  ON public.step_discussion_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.step_discussions d
       WHERE d.id = step_discussion_reactions.discussion_id
         AND d.step_id IS NOT NULL
         AND public.can_access_step_discussion(d.step_id, (SELECT auth.uid()))
    )
  );
