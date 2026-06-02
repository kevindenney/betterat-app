-- Seed RHKYC memberships for the demo Dragon fleet sailors.
--
-- Watch › Nearby (and Atlas) gate a step_location with audience='fleet'
-- through atlas_can_view_step_location, which requires the viewer and the
-- step's setter to share an ACTIVE organization_membership. The four seed
-- crew (Markus, Yvonne, Ricardo, Tomás — the 11111111-… demo sailors) pin
-- fleet-visible steps around Victoria Harbour, but had no org memberships at
-- all, so the fleet gate never matched and Watch › Nearby read empty for
-- RHKYC members like the demo personas.
--
-- They are RHKYC Dragon crew by design, so this records that membership.
-- denneyke / demo-sailor are already active RHKYC members, so once these
-- rows exist the fleet gate matches and their nearby pins become visible.
-- (Demo Sailor's own HK steps remain audience='private' and stay hidden —
-- that is correct privacy behaviour, not a bug.)
--
-- Idempotent: only inserts memberships that don't already exist.
-- Applied to dev project qavekrwdbsobecwrfxwu.

INSERT INTO public.organization_memberships
  (organization_id, user_id, role, status, membership_status, verification_source)
SELECT 'a1000001-0000-0000-0000-000000000001', u.id, 'member', 'active', 'active', 'invite'
FROM (VALUES
  ('11111111-1111-1111-1111-000000000001'::uuid),
  ('11111111-1111-1111-1111-000000000002'::uuid),
  ('11111111-1111-1111-1111-000000000003'::uuid),
  ('11111111-1111-1111-1111-000000000004'::uuid)
) AS u(id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_memberships om
  WHERE om.organization_id = 'a1000001-0000-0000-0000-000000000001'
    AND om.user_id = u.id
);
