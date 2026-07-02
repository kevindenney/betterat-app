-- Replace "any authenticated user can write" RLS policies (audit #7) with
-- ownership/role scoping. These policies were all gated on `auth.uid() IS NOT NULL`
-- — i.e. every logged-in user could rewrite or delete any club's documents, any
-- venue's cultural profile, and any boat's live race position.

-- ── club_documents: only the doc's creator or a club admin may modify ──────────
DROP POLICY IF EXISTS "Authenticated users can insert club documents" ON public.club_documents;
DROP POLICY IF EXISTS "Authenticated users can update club documents" ON public.club_documents;
DROP POLICY IF EXISTS "Authenticated users can delete club documents" ON public.club_documents;

CREATE POLICY "Club document creators and admins can insert" ON public.club_documents
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Club document creators and admins can update" ON public.club_documents
  FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_documents.club_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role = 'admin'
        AND m.is_active
    )
  );

CREATE POLICY "Club document creators and admins can delete" ON public.club_documents
  FOR DELETE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.club_members m
      WHERE m.club_id = club_documents.club_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role = 'admin'
        AND m.is_active
    )
  );

-- ── cultural_profiles: venue reference data, no owner column and no client writer.
-- Make it read-only for clients; seeding/admin edits go through service_role,
-- which bypasses RLS. ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS cultural_profiles_insert ON public.cultural_profiles;
DROP POLICY IF EXISTS cultural_profiles_update ON public.cultural_profiles;
DROP POLICY IF EXISTS cultural_profiles_delete ON public.cultural_profiles;

-- ── boat_positions: live race telemetry, no client writer. Lock writes to
-- service_role (bypasses RLS); keep public read for race displays. ────────────────
DROP POLICY IF EXISTS "Authenticated users can insert boat positions" ON public.boat_positions;
DROP POLICY IF EXISTS "Authenticated users can update boat positions" ON public.boat_positions;
