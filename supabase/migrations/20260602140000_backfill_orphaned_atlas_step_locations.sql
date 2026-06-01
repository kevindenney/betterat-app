-- Backfill timeline_steps for orphaned step_location pins.
--
-- atlas_peer_steps_near surfaces pins straight from step_location (a
-- SECURITY DEFINER read), but the step-detail route (/step/[id] →
-- getStepById) reads public.timeline_steps under RLS. 25 demo-seed
-- step_location rows had step_id values with no matching timeline_steps
-- row, so the pins rendered on Atlas but tapping them dead-ended on
-- "Step not found".
--
-- step_location.step_id has no FK, which is how these orphans accrued.
-- This recreates the missing backing steps from the pin data so each pin
-- opens. visibility='crew' matches the existing demo steps and makes them
-- peer-openable (owners have allow_peer_visibility=true); owners can
-- always open their own via the own-steps policy regardless.
--
-- Idempotent: only inserts pins that still lack a timeline_steps row.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

INSERT INTO public.timeline_steps (
  id, user_id, interest_id, title, category, status, visibility,
  location_name, location_lat, location_lng, starts_at,
  metadata, created_at, updated_at
)
SELECT
  sl.step_id,
  sl.set_by,
  i.id,
  COALESCE(NULLIF(btrim(sl.name), ''), 'Step'),
  'general',
  'pending',
  'crew',
  sl.name,
  sl.lat,
  sl.lng,
  sl.set_at,
  '{}'::jsonb,
  sl.set_at,
  sl.set_at
FROM public.step_location sl
LEFT JOIN public.interests i ON i.slug = sl.interest_slug
WHERE sl.set_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.timeline_steps ts WHERE ts.id = sl.step_id
  )
ON CONFLICT (id) DO NOTHING;
