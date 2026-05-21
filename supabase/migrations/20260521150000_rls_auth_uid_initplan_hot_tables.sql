-- Wrap bare `auth.uid()` / `auth.jwt()` calls in policy predicates with
-- `(SELECT ...)` so Postgres caches them as InitPlans evaluated once per
-- query instead of once per row scanned.
--
-- Targets the 5 hottest authenticated-path tables (per Supabase advisor
-- `auth_rls_initplan` counts):
--   timeline_steps           (11 inline auth.uid() calls)
--   organization_memberships  (9)
--   playbook_concepts         (6)
--   timeline_blueprints       (4 — full table)
--   blueprint_step_actions    (2 — full table)
--
-- Symptom this fixes: heavy multi-query hooks (useSubscribedPlansForLibrary,
-- useLifecycleConcepts, OrganizationProvider session load) tripping the
-- 30s SUPABASE_REQUEST_TIMEOUT_MS abort in services/supabase.ts:146 because
-- each row scan was re-decoding the JWT and re-evaluating 6-12 OR'd
-- permissive policies.
--
-- This migration ONLY rewrites predicate expressions; policy names, roles,
-- and command coverage are unchanged. Logic is preserved verbatim aside from
-- the (SELECT ...) wrapper.

-- =============================================================================
-- timeline_steps
-- =============================================================================

ALTER POLICY "Blueprint authors can update adopted step metadata" ON public.timeline_steps
  USING (id IN (SELECT get_blueprint_author_adopted_step_ids((SELECT auth.uid()))))
  WITH CHECK (id IN (SELECT get_blueprint_author_adopted_step_ids((SELECT auth.uid()))));

ALTER POLICY "Blueprint authors can view adopted step copies" ON public.timeline_steps
  USING (id IN (SELECT get_blueprint_author_adopted_step_ids((SELECT auth.uid()))));

ALTER POLICY "Blueprint co-subscribers can view peer steps" ON public.timeline_steps
  USING (
    (visibility <> 'private')
    AND (user_id IN (SELECT get_blueprint_co_subscriber_ids((SELECT auth.uid()))))
  );

ALTER POLICY "Co-subscribers can see peer steps" ON public.timeline_steps
  USING (
    (visibility = ANY (ARRAY['crew', 'fleet', 'public']))
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = timeline_steps.user_id
        AND profiles.allow_peer_visibility = true
    )
    AND EXISTS (
      SELECT 1
      FROM blueprint_subscriptions my_sub
      JOIN blueprint_subscriptions peer_sub
        ON my_sub.blueprint_id = peer_sub.blueprint_id
      JOIN timeline_blueprints bp ON bp.id = my_sub.blueprint_id
      WHERE my_sub.subscriber_id = (SELECT auth.uid())
        AND peer_sub.subscriber_id = timeline_steps.user_id
        AND bp.interest_id = timeline_steps.interest_id
        AND bp.is_published = true
    )
  );

ALTER POLICY "Collaborators can view steps they are added to" ON public.timeline_steps
  USING (((SELECT auth.uid()))::text = ANY (collaborator_user_ids));

ALTER POLICY "Users can delete own timeline steps" ON public.timeline_steps
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can insert own timeline steps" ON public.timeline_steps
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can update own timeline steps" ON public.timeline_steps
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can view followed users timeline steps" ON public.timeline_steps
  USING (
    (visibility = ANY (ARRAY['crew', 'fleet', 'public']))
    AND EXISTS (
      SELECT 1
      FROM user_follows
      WHERE user_follows.follower_id = (SELECT auth.uid())
        AND user_follows.following_id = timeline_steps.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = timeline_steps.user_id
        AND profiles.allow_follower_sharing = true
    )
  );

ALTER POLICY "Users can view own timeline steps" ON public.timeline_steps
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "faculty_read_org_member_steps_v1" ON public.timeline_steps
  USING (EXISTS (
    SELECT 1
    FROM organization_memberships viewer_om
    JOIN organization_memberships student_om
      ON student_om.organization_id = viewer_om.organization_id
     AND student_om.user_id = timeline_steps.user_id
     AND COALESCE(student_om.membership_status, student_om.status) = 'active'
    WHERE viewer_om.user_id = (SELECT auth.uid())
      AND COALESCE(viewer_om.membership_status, viewer_om.status) = 'active'
      AND viewer_om.role = ANY (ARRAY[
        'owner', 'admin', 'manager', 'faculty', 'instructor',
        'evaluator', 'preceptor', 'clinical_instructor'
      ])
  ));

-- =============================================================================
-- organization_memberships
-- =============================================================================

ALTER POLICY "org_memberships_admin_read_org" ON public.organization_memberships
  USING (has_org_role(
    organization_id,
    ARRAY['owner', 'admin', 'manager', 'faculty', 'instructor'],
    (SELECT auth.uid()),
    false
  ));

ALTER POLICY "org_memberships_admin_update_org" ON public.organization_memberships
  USING (has_org_role(
    organization_id,
    ARRAY['owner', 'admin', 'manager', 'faculty', 'instructor'],
    (SELECT auth.uid()),
    false
  ))
  WITH CHECK (has_org_role(
    organization_id,
    ARRAY['owner', 'admin', 'manager', 'faculty', 'instructor'],
    (SELECT auth.uid()),
    false
  ));

ALTER POLICY "org_memberships_insert_own" ON public.organization_memberships
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "org_memberships_read_own" ON public.organization_memberships
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "org_memberships_update_own_pending" ON public.organization_memberships
  USING (
    user_id = (SELECT auth.uid())
    AND status = ANY (ARRAY['pending', 'invited'])
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = ANY (ARRAY['pending', 'invited'])
  );

ALTER POLICY "organization_memberships_insert_open_join_v1" ON public.organization_memberships
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'member'
    AND status = 'active'
    AND membership_status = 'active'
    AND EXISTS (
      SELECT 1
      FROM organizations o
      WHERE o.id = organization_memberships.organization_id
        AND o.join_mode = 'open_join'
    )
  );

ALTER POLICY "organization_memberships_insert_request_join_v1" ON public.organization_memberships
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'member'
    AND status = 'pending'
    AND membership_status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM organizations o
      WHERE o.id = organization_memberships.organization_id
        AND o.join_mode = 'request_to_join'
    )
  );

ALTER POLICY "organization_memberships_select_own_or_org_admin_v3" ON public.organization_memberships
  USING (
    user_id = (SELECT auth.uid())
    OR is_org_admin_member(organization_id)
  );

ALTER POLICY "organization_memberships_update_org_admin_v2" ON public.organization_memberships
  USING (is_org_admin_member(organization_id))
  WITH CHECK (is_org_admin_member(organization_id));

ALTER POLICY "organization_memberships_update_own_rejected_to_pending_v1" ON public.organization_memberships
  USING (
    user_id = (SELECT auth.uid())
    AND COALESCE(membership_status, status) = 'rejected'
    AND EXISTS (
      SELECT 1
      FROM organizations o
      WHERE o.id = organization_memberships.organization_id
        AND o.join_mode = 'request_to_join'
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'member'
    AND status = 'pending'
    AND membership_status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM organizations o
      WHERE o.id = organization_memberships.organization_id
        AND o.join_mode = 'request_to_join'
    )
  );

-- =============================================================================
-- playbook_concepts
-- =============================================================================

ALTER POLICY "Shared viewers can read concepts" ON public.playbook_concepts
  USING (
    playbook_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM playbook_shares ps
      WHERE ps.playbook_id = playbook_concepts.playbook_id
        AND ps.invite_status = ANY (ARRAY['pending', 'accepted'])
        AND (
          ps.shared_with_user_id = (SELECT auth.uid())
          OR ps.shared_with_email = (SELECT auth.jwt() ->> 'email')
        )
    )
  );

ALTER POLICY "Shared viewers can read playbook concepts" ON public.playbook_concepts
  USING (
    playbook_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM playbook_shares ps
      WHERE ps.playbook_id = playbook_concepts.playbook_id
        AND ps.shared_with_user_id = (SELECT auth.uid())
        AND ps.invite_status = 'accepted'
    )
  );

ALTER POLICY "Users can delete own concepts" ON public.playbook_concepts
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can insert own concepts" ON public.playbook_concepts
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can update own concepts" ON public.playbook_concepts
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can view own concepts" ON public.playbook_concepts
  USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- timeline_blueprints
-- =============================================================================

ALTER POLICY "Published blueprints viewable with access check" ON public.timeline_blueprints
  USING (
    user_id = (SELECT auth.uid())
    OR (
      is_published = true
      AND (
        access_level = 'public'
        OR access_level = 'paid'
        OR (access_level = 'org_members' AND is_org_active_member(organization_id))
      )
    )
  );

ALTER POLICY "Users delete own blueprints" ON public.timeline_blueprints
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "Users insert own blueprints" ON public.timeline_blueprints
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (organization_id IS NULL OR is_org_active_member(organization_id))
  );

ALTER POLICY "Users update own blueprints" ON public.timeline_blueprints
  USING (user_id = (SELECT auth.uid()));

-- =============================================================================
-- blueprint_step_actions
-- =============================================================================

ALTER POLICY "Blueprint authors can view step actions" ON public.blueprint_step_actions
  USING (subscription_id IN (
    SELECT bs.id
    FROM blueprint_subscriptions bs
    JOIN timeline_blueprints tb ON tb.id = bs.blueprint_id
    WHERE tb.user_id = (SELECT auth.uid())
  ));

ALTER POLICY "Manage own step actions" ON public.blueprint_step_actions
  USING (subscription_id IN (
    SELECT blueprint_subscriptions.id
    FROM blueprint_subscriptions
    WHERE blueprint_subscriptions.subscriber_id = (SELECT auth.uid())
  ));
