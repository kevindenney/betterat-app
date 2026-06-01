-- ============================================================================
-- Fleet plans
--
-- A fleet captain authors a curated, ORDERED plan of steps for the fleet — the
-- races AND the prep steps between them (practice day, measure mast rake,
-- replace running rigging, fleet training, post-race dinner). It is a
-- timeline_blueprint scoped to the fleet via fleet_id + access_level='fleet'.
--
-- Members browse the plan, then SELECTIVELY adopt individual steps into their
-- own timeline (never bulk — the plan is a menu, not a calendar; see
-- feedback_plan_is_menu_not_calendar). Order is the captain's sort_order, NOT
-- date — improvement lives in the reorderable in-between steps.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.
-- ============================================================================

-- 1. fleet_id on the SUBSCRIBABLE blueprint table.
--    The org-admin `blueprints` table already had fleet_id, but the subscribe
--    machinery (subscribe / blueprint_subscriptions / blueprint_steps /
--    step_discussions) all hang off timeline_blueprints, so the column has to
--    live here for fleet plans to be subscribable.
ALTER TABLE public.timeline_blueprints
  ADD COLUMN IF NOT EXISTS fleet_id uuid
    REFERENCES public.fleets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_blueprints_fleet
  ON public.timeline_blueprints(fleet_id)
  WHERE fleet_id IS NOT NULL;

COMMENT ON COLUMN public.timeline_blueprints.fleet_id IS
  'When set, this blueprint is a fleet plan — browsable + subscribable by active members of the fleet (access_level=''fleet'').';

-- 2. Allow access_level = 'fleet'.
ALTER TABLE public.timeline_blueprints
  DROP CONSTRAINT IF EXISTS timeline_blueprints_access_level_check;
ALTER TABLE public.timeline_blueprints
  ADD CONSTRAINT timeline_blueprints_access_level_check
  CHECK (access_level IN ('public', 'org_members', 'paid', 'fleet'));

-- 3. Helper: active fleet membership. SECURITY DEFINER so it bypasses
--    fleet_members RLS (avoids policy recursion when used inside other
--    tables' policies).
CREATE OR REPLACE FUNCTION public.is_active_fleet_member(p_fleet_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM fleet_members fm
    WHERE fm.fleet_id = p_fleet_id
      AND fm.user_id = p_user_id
      AND fm.status = 'active'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_active_fleet_member(uuid, uuid) TO authenticated;

-- 4. Let active fleet members SELECT their fleet's published plans directly
--    (so BlueprintService.getBlueprintById works for a member who is
--    subscribing/viewing). Preserves the prior policy and adds the fleet branch.
DROP POLICY IF EXISTS "Published blueprints viewable with access check" ON public.timeline_blueprints;
CREATE POLICY "Published blueprints viewable with access check"
  ON public.timeline_blueprints
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (
      is_published = true
      AND (
        access_level = 'public'
        OR access_level = 'paid'
        OR (access_level = 'org_members' AND is_org_active_member(organization_id))
        OR (access_level = 'fleet'
            AND fleet_id IS NOT NULL
            AND is_active_fleet_member(fleet_id, (SELECT auth.uid())))
      )
    )
  );

-- 5. get_fleet_plans — list a fleet's plans for the hub card. Returns published
--    plans to any active member, plus the caller's own drafts. SECURITY DEFINER
--    so it can read across the captain's authored plan regardless of per-row
--    RLS, gated explicitly to active fleet members.
CREATE OR REPLACE FUNCTION public.get_fleet_plans(p_fleet_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  cover_image_url text,
  is_published boolean,
  author_id uuid,
  author_name text,
  interest_id uuid,
  step_count bigint,
  subscriber_count integer,
  viewer_subscribed boolean,
  viewer_is_author boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.title,
    b.description,
    b.cover_image_url,
    b.is_published,
    b.user_id AS author_id,
    p.full_name AS author_name,
    b.interest_id,
    (SELECT count(*) FROM blueprint_steps bs WHERE bs.blueprint_id = b.id) AS step_count,
    COALESCE(b.subscriber_count, 0)::int AS subscriber_count,
    EXISTS (
      SELECT 1 FROM blueprint_subscriptions s
      WHERE s.blueprint_id = b.id AND s.subscriber_id = (SELECT auth.uid())
    ) AS viewer_subscribed,
    (b.user_id = (SELECT auth.uid())) AS viewer_is_author,
    b.created_at,
    b.updated_at
  FROM timeline_blueprints b
  LEFT JOIN profiles p ON p.id = b.user_id
  WHERE b.fleet_id = p_fleet_id
    AND is_active_fleet_member(p_fleet_id, (SELECT auth.uid()))
    AND (b.is_published = true OR b.user_id = (SELECT auth.uid()))
  ORDER BY b.is_published ASC, b.updated_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_fleet_plans(uuid) TO authenticated;

-- 6. get_fleet_plan_steps — preview the curated, ordered steps of a fleet plan
--    BEFORE subscribing (the underlying timeline_steps are owner/follower-gated,
--    so a non-subscribed member can't read them directly). Includes whether the
--    viewer has already adopted each step.
CREATE OR REPLACE FUNCTION public.get_fleet_plan_steps(p_blueprint_id uuid)
RETURNS TABLE (
  step_id uuid,
  title text,
  description text,
  category text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_name text,
  sort_order integer,
  viewer_adopted boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ts.id AS step_id,
    ts.title,
    ts.description,
    ts.category,
    ts.starts_at,
    ts.ends_at,
    ts.location_name,
    bs.sort_order,
    EXISTS (
      SELECT 1 FROM timeline_steps mine
      WHERE mine.user_id = (SELECT auth.uid())
        AND mine.source_id = ts.id
    ) AS viewer_adopted
  FROM timeline_blueprints b
  JOIN blueprint_steps bs ON bs.blueprint_id = b.id
  JOIN timeline_steps ts ON ts.id = bs.step_id
  WHERE b.id = p_blueprint_id
    AND b.fleet_id IS NOT NULL
    AND (
      b.user_id = (SELECT auth.uid())
      OR is_active_fleet_member(b.fleet_id, (SELECT auth.uid()))
    )
  ORDER BY bs.sort_order ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_fleet_plan_steps(uuid) TO authenticated;

-- 7. get_suggested_next_steps — honor curation.
--    The original pulled EVERY non-private step the author owns in the interest,
--    so a fleet plan would suggest the captain's entire step history. When a
--    blueprint has curated blueprint_steps, restrict suggestions to those and
--    order by the curated sort_order; otherwise keep the legacy fallback.
CREATE OR REPLACE FUNCTION get_suggested_next_steps(
  p_subscriber_id UUID,
  p_interest_id UUID DEFAULT NULL
)
RETURNS TABLE (
  subscription_id UUID,
  blueprint_id UUID,
  blueprint_title TEXT,
  blueprint_slug TEXT,
  author_id UUID,
  author_name TEXT,
  next_step_id UUID,
  next_step_title TEXT,
  next_step_description TEXT,
  next_step_sort_order INTEGER,
  total_steps BIGINT,
  adopted_count BIGINT,
  dismissed_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sub.id AS subscription_id,
    bp.id AS blueprint_id,
    bp.title AS blueprint_title,
    bp.slug AS blueprint_slug,
    bp.user_id AS author_id,
    p.full_name AS author_name,
    next_step.id AS next_step_id,
    next_step.title AS next_step_title,
    next_step.description AS next_step_description,
    next_step.ord AS next_step_sort_order,
    totals.total_steps,
    totals.adopted_count,
    totals.dismissed_count
  FROM blueprint_subscriptions sub
  JOIN timeline_blueprints bp ON bp.id = sub.blueprint_id AND bp.is_published = true
  LEFT JOIN profiles p ON p.id = bp.user_id
  CROSS JOIN LATERAL (
    SELECT
      count(*) AS total_steps,
      count(*) FILTER (WHERE bsa.action = 'adopted') AS adopted_count,
      count(*) FILTER (WHERE bsa.action = 'dismissed') AS dismissed_count
    FROM timeline_steps ts
    LEFT JOIN blueprint_steps bs
      ON bs.blueprint_id = bp.id AND bs.step_id = ts.id
    LEFT JOIN blueprint_step_actions bsa
      ON bsa.subscription_id = sub.id AND bsa.source_step_id = ts.id
    WHERE ts.user_id = bp.user_id
      AND ts.interest_id = bp.interest_id
      AND ts.visibility <> 'private'
      AND (
        NOT EXISTS (SELECT 1 FROM blueprint_steps b2 WHERE b2.blueprint_id = bp.id)
        OR bs.step_id IS NOT NULL
      )
  ) totals
  CROSS JOIN LATERAL (
    SELECT ts.id, ts.title, ts.description,
           COALESCE(bs.sort_order, ts.sort_order) AS ord
    FROM timeline_steps ts
    LEFT JOIN blueprint_steps bs
      ON bs.blueprint_id = bp.id AND bs.step_id = ts.id
    WHERE ts.user_id = bp.user_id
      AND ts.interest_id = bp.interest_id
      AND ts.visibility <> 'private'
      AND (
        NOT EXISTS (SELECT 1 FROM blueprint_steps b2 WHERE b2.blueprint_id = bp.id)
        OR bs.step_id IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM blueprint_step_actions bsa
        WHERE bsa.subscription_id = sub.id
          AND bsa.source_step_id = ts.id
      )
    ORDER BY ord ASC
    LIMIT 1
  ) next_step
  WHERE sub.subscriber_id = p_subscriber_id
    AND (p_interest_id IS NULL OR bp.interest_id = p_interest_id);
$$;

GRANT EXECUTE ON FUNCTION get_suggested_next_steps(UUID, UUID) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
