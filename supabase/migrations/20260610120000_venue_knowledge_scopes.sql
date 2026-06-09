-- Area Local Knowledge — Commit 1 (docs/redesign/specs/AREA_LOCAL_KNOWLEDGE_SPEC.md)
--
-- venue_discussions gains a generic audience pair (scope_type, scope_id):
--   public    — everyone, incl. anon
--   private   — author only (safe landing for legacy is_public=false rows)
--   fleet     — fleet_members (status='active')
--   org       — organization_memberships (status/membership_status='active')
--   blueprint — blueprint_subscriptions, plus the blueprint owner
--
-- Folds the dormant fleet_id column into scope_id, keeps is_public
-- trigger-synced for legacy read paths, and rewrites RLS so comments
-- and votes inherit the parent discussion's scope (the old
-- "Anyone can view comments" USING (true) policy leaked comments on
-- non-public discussions).
--
-- NOTE: step "fleet" visibility (phase 7) is resolved by blueprint
-- co-subscription; venue knowledge is addressed TO a group, so it
-- scopes by explicit fleet_members membership. Intentionally different.

-- ============================================
-- 1. SCOPE COLUMNS
-- ============================================

ALTER TABLE venue_discussions
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'public'
    CHECK (scope_type IN ('public', 'private', 'fleet', 'org', 'blueprint')),
  ADD COLUMN IF NOT EXISTS scope_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venue_discussions_scope_pair'
  ) THEN
    ALTER TABLE venue_discussions
      ADD CONSTRAINT venue_discussions_scope_pair
      CHECK ((scope_type IN ('public', 'private')) = (scope_id IS NULL));
  END IF;
END $$;

-- ============================================
-- 2. BACKFILL (dev data is all is_public=true today; arms below are
--    defensive for any environment where that isn't true)
-- ============================================

UPDATE venue_discussions
SET scope_type = 'fleet', scope_id = fleet_id
WHERE fleet_id IS NOT NULL;

-- Hidden legacy rows must not become public (fail closed).
UPDATE venue_discussions
SET scope_type = 'private'
WHERE is_public = false AND scope_type = 'public';

UPDATE venue_discussions SET is_public = (scope_type = 'public');

-- ============================================
-- 3. RETIRE fleet_id (drop dependent policies first)
-- ============================================

DROP POLICY IF EXISTS "Fleet discussions are readable by fleet members" ON venue_discussions;
DROP POLICY IF EXISTS "Comments on fleet discussions are readable by members" ON venue_discussion_comments;

ALTER TABLE venue_discussions DROP COLUMN IF EXISTS fleet_id;

-- ============================================
-- 4. KEEP is_public IN SYNC (legacy read paths) UNTIL CLIENT CUTOVER
-- ============================================

CREATE OR REPLACE FUNCTION sync_venue_discussion_is_public()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_public := (NEW.scope_type = 'public');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_venue_discussion_is_public ON venue_discussions;
CREATE TRIGGER trg_sync_venue_discussion_is_public
BEFORE INSERT OR UPDATE ON venue_discussions
FOR EACH ROW EXECUTE FUNCTION sync_venue_discussion_is_public();

-- ============================================
-- 5. SCOPE PREDICATES (single source of truth)
-- ============================================

-- Is the user a member of the audience a scoped post is addressed to?
CREATE OR REPLACE FUNCTION public.can_access_venue_scope(
  p_scope_type TEXT,
  p_scope_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_user_id IS NULL OR p_scope_id IS NULL THEN false
    WHEN p_scope_type = 'fleet' THEN EXISTS (
      SELECT 1 FROM fleet_members fm
      WHERE fm.fleet_id = p_scope_id
        AND fm.user_id = p_user_id
        AND fm.status = 'active'
    )
    WHEN p_scope_type = 'org' THEN EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.organization_id = p_scope_id
        AND om.user_id = p_user_id
        AND (om.status = 'active' OR om.membership_status = 'active')
    )
    WHEN p_scope_type = 'blueprint' THEN EXISTS (
      SELECT 1 FROM blueprint_subscriptions bs
      WHERE bs.blueprint_id = p_scope_id
        AND bs.subscriber_id = p_user_id
    ) OR EXISTS (
      SELECT 1 FROM timeline_blueprints bp
      WHERE bp.id = p_scope_id
        AND bp.user_id = p_user_id
    )
    ELSE false
  END;
$$;

-- Full read check for a discussion row (used by comments/votes RLS).
CREATE OR REPLACE FUNCTION public.can_read_venue_discussion(
  p_discussion_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM venue_discussions vd
    WHERE vd.id = p_discussion_id
      AND (
        vd.scope_type = 'public'
        OR (p_user_id IS NOT NULL AND vd.author_id = p_user_id)
        OR public.can_access_venue_scope(vd.scope_type, vd.scope_id, p_user_id)
      )
  );
$$;

-- Org-scope moderation (owner/admin/manager of the scoped org).
CREATE OR REPLACE FUNCTION public.is_org_knowledge_moderator(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.organization_id = p_org_id
      AND om.user_id = p_user_id
      AND om.role IN ('owner', 'admin', 'manager')
      AND (om.status = 'active' OR om.membership_status = 'active')
  );
$$;

-- ============================================
-- 6. RLS REWRITE — venue_discussions
-- ============================================

DROP POLICY IF EXISTS "Public discussions are readable by all" ON venue_discussions;

CREATE POLICY "Knowledge readable by scope"
  ON venue_discussions FOR SELECT
  USING (
    scope_type = 'public'
    OR (SELECT auth.uid()) = author_id
    OR public.can_access_venue_scope(scope_type, scope_id, (SELECT auth.uid()))
  );

-- Collapse duplicate insert policies into one scope-aware policy:
-- you can't post INTO an audience you don't belong to.
DROP POLICY IF EXISTS "Members can create discussions" ON venue_discussions;
DROP POLICY IF EXISTS "Users can create discussions" ON venue_discussions;

CREATE POLICY "Authors can post to scopes they belong to"
  ON venue_discussions FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = author_id
    AND (
      scope_type IN ('public', 'private')
      OR public.can_access_venue_scope(scope_type, scope_id, (SELECT auth.uid()))
    )
  );

-- Collapse duplicate update/delete policies; moderation is per-scope:
-- venue moderators moderate the public layer, org admins the org layer.
-- ("Allow vote count updates on discussions" is left untouched — the
-- comment/vote count triggers run as the acting user and need it.)
DROP POLICY IF EXISTS "Authors can update own discussions" ON venue_discussions;
DROP POLICY IF EXISTS "Authors can delete own discussions" ON venue_discussions;
DROP POLICY IF EXISTS "Authors or moderators can update discussions" ON venue_discussions;
DROP POLICY IF EXISTS "Authors or moderators can delete discussions" ON venue_discussions;

CREATE POLICY "Authors or scope moderators can update discussions"
  ON venue_discussions FOR UPDATE
  USING (
    (SELECT auth.uid()) = author_id
    OR (scope_type = 'public' AND is_venue_moderator((SELECT auth.uid()), venue_id))
    OR (scope_type = 'org' AND public.is_org_knowledge_moderator(scope_id, (SELECT auth.uid())))
  );

CREATE POLICY "Authors or scope moderators can delete discussions"
  ON venue_discussions FOR DELETE
  USING (
    (SELECT auth.uid()) = author_id
    OR (scope_type = 'public' AND is_venue_moderator((SELECT auth.uid()), venue_id))
    OR (scope_type = 'org' AND public.is_org_knowledge_moderator(scope_id, (SELECT auth.uid())))
  );

-- ============================================
-- 7. RLS REWRITE — comments inherit the parent's scope
-- ============================================

-- "Anyone can view comments" leaked comments on non-public discussions.
DROP POLICY IF EXISTS "Anyone can view comments" ON venue_discussion_comments;
DROP POLICY IF EXISTS "Comments on public discussions are readable" ON venue_discussion_comments;

CREATE POLICY "Comments readable with parent discussion"
  ON venue_discussion_comments FOR SELECT
  USING (public.can_read_venue_discussion(discussion_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can create comments" ON venue_discussion_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON venue_discussion_comments;

CREATE POLICY "Members can comment on readable discussions"
  ON venue_discussion_comments FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = author_id
    AND public.can_read_venue_discussion(discussion_id, (SELECT auth.uid()))
  );

-- Deduplicate author update/delete pairs.
DROP POLICY IF EXISTS "Users can update their own comments" ON venue_discussion_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON venue_discussion_comments;
-- (kept: "Authors can update own comments", "Authors can delete own comments")

-- ============================================
-- 8. RLS REWRITE — votes require a readable target
-- ============================================

DROP POLICY IF EXISTS "Users can manage own votes" ON venue_discussion_votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON venue_discussion_votes;
DROP POLICY IF EXISTS "Users can view their own votes" ON venue_discussion_votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON venue_discussion_votes;

CREATE POLICY "Users can view own votes"
  ON venue_discussion_votes FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can vote on readable targets"
  ON venue_discussion_votes FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND public.can_read_venue_discussion(
      CASE WHEN target_type = 'discussion' THEN target_id
           ELSE (SELECT c.discussion_id FROM venue_discussion_comments c WHERE c.id = target_id)
      END,
      (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own votes"
  ON venue_discussion_votes FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own votes"
  ON venue_discussion_votes FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ============================================
-- 9. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_venue_discussions_scope
  ON venue_discussions(scope_type, scope_id) WHERE scope_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venue_discussions_area_scope
  ON venue_discussions(racing_area_id, scope_type)
  WHERE racing_area_id IS NOT NULL;

-- ============================================
-- 10. COMMENTS
-- ============================================

COMMENT ON COLUMN venue_discussions.scope_type IS
  'Audience: public | private (author only) | fleet | org | blueprint. Gates fail closed.';
COMMENT ON COLUMN venue_discussions.scope_id IS
  'fleets.id / organizations.id / timeline_blueprints.id when scope_type is fleet/org/blueprint; NULL for public/private.';
COMMENT ON COLUMN venue_discussions.is_public IS
  'LEGACY — trigger-synced to (scope_type = public). Drop after client read paths move to scope_type.';
