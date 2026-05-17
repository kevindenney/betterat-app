-- Phase 7 · Network Browsing & Add-to-Timeline
--
-- Schema changes:
-- 1. Replace the old timeline-step visibility model
--    ('private','followers','coaches','organization')
--    with the Phase 7 model ('private','crew','fleet','public').
--    Backfill is intentionally conservative:
--      followers    -> crew
--      coaches      -> crew
--      organization -> fleet
--    We do NOT widen older rows to public.
-- 2. Add step_deck for "save to deck for later".
-- 3. Add step_user_progress for per-blueprint user pill state.
-- 4. Extend timeline_steps.source_type to support Phase 7 provenance values.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TIMELINE STEP VISIBILITY + SOURCE-TYPE UPGRADE
-- -----------------------------------------------------------------------------

-- Drop dependent checks first so the data can be backfilled safely.
ALTER TABLE public.timeline_steps
  DROP CONSTRAINT IF EXISTS timeline_steps_visibility_check,
  DROP CONSTRAINT IF EXISTS timeline_steps_source_type_check;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_step_visibility_check;

-- Conservative backfill: preserve privacy rather than widen older sharing.
UPDATE public.timeline_steps
SET visibility = CASE visibility
  WHEN 'followers' THEN 'crew'
  WHEN 'coaches' THEN 'crew'
  WHEN 'organization' THEN 'fleet'
  ELSE visibility
END
WHERE visibility IN ('followers', 'coaches', 'organization');

UPDATE public.profiles
SET default_step_visibility = CASE default_step_visibility
  WHEN 'followers' THEN 'crew'
  WHEN 'coaches' THEN 'crew'
  WHEN 'organization' THEN 'fleet'
  ELSE default_step_visibility
END
WHERE default_step_visibility IN ('followers', 'coaches', 'organization');

ALTER TABLE public.timeline_steps
  ALTER COLUMN visibility SET DEFAULT 'private',
  ADD CONSTRAINT timeline_steps_visibility_check
    CHECK (visibility IN ('private', 'crew', 'fleet', 'public')),
  ADD CONSTRAINT timeline_steps_source_type_check
    CHECK (
      source_type IN (
        'manual',
        'template',
        'copied',
        'program_session',
        'blueprint',
        'user_fork',
        'suggestion'
      )
    );

ALTER TABLE public.profiles
  ALTER COLUMN default_step_visibility SET DEFAULT 'private',
  ADD CONSTRAINT profiles_default_step_visibility_check
    CHECK (default_step_visibility IN ('private', 'crew', 'fleet', 'public'));

COMMENT ON COLUMN public.timeline_steps.visibility IS
  'Phase 7 visibility model for timeline steps: private, crew, fleet, public.';

COMMENT ON COLUMN public.profiles.default_step_visibility IS
  'Default visibility for newly created steps: private, crew, fleet, or public.';

-- Followers can still see the owner's crew/fleet/public steps when the owner
-- explicitly allows follower sharing. The followed-person timeline itself
-- applies an additional query-layer filter to only show public steps.
DROP POLICY IF EXISTS "Users can view followed users timeline steps" ON public.timeline_steps;

CREATE POLICY "Users can view followed users timeline steps"
  ON public.timeline_steps
  FOR SELECT
  USING (
    visibility IN ('crew', 'fleet', 'public')
    AND EXISTS (
      SELECT 1 FROM public.user_follows
      WHERE follower_id = auth.uid()
        AND following_id = timeline_steps.user_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = timeline_steps.user_id
        AND allow_follower_sharing = true
    )
  );

DROP POLICY IF EXISTS "Co-subscribers can see peer steps" ON public.timeline_steps;

CREATE POLICY "Co-subscribers can see peer steps"
  ON public.timeline_steps
  FOR SELECT
  USING (
    visibility IN ('crew', 'fleet', 'public')
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = timeline_steps.user_id
        AND allow_peer_visibility = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.blueprint_subscriptions my_sub
      JOIN public.blueprint_subscriptions peer_sub
        ON my_sub.blueprint_id = peer_sub.blueprint_id
      JOIN public.timeline_blueprints bp
        ON bp.id = my_sub.blueprint_id
      WHERE my_sub.subscriber_id = auth.uid()
        AND peer_sub.subscriber_id = timeline_steps.user_id
        AND bp.interest_id = timeline_steps.interest_id
        AND bp.is_published = true
    )
  );

-- Keep the single-round-trip create RPC aligned with the new default.
CREATE OR REPLACE FUNCTION public.create_timeline_step(p_input JSONB)
RETURNS SETOF public.timeline_steps
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := (p_input->>'user_id')::UUID;
  v_interest_id UUID := (p_input->>'interest_id')::UUID;
  v_visibility TEXT;
  v_sort_order INTEGER;
  v_starts_at TIMESTAMPTZ;
BEGIN
  IF p_input ? 'visibility' AND p_input->>'visibility' IS NOT NULL THEN
    v_visibility := p_input->>'visibility';
  ELSE
    SELECT COALESCE(
      (
        SELECT up.interest_visibility_defaults ->> (v_interest_id::TEXT)
          FROM public.user_preferences up
         WHERE up.user_id = v_user_id
         LIMIT 1
      ),
      (
        SELECT p.default_step_visibility
          FROM public.profiles p
         WHERE p.id = v_user_id
         LIMIT 1
      ),
      'private'
    ) INTO v_visibility;
  END IF;

  IF p_input ? 'sort_order' AND p_input->>'sort_order' IS NOT NULL THEN
    v_sort_order := (p_input->>'sort_order')::INTEGER;
  ELSE
    v_sort_order := (
      EXTRACT(EPOCH FROM NOW())
      - EXTRACT(EPOCH FROM TIMESTAMPTZ '2024-01-01 00:00:00+00')
    )::INTEGER;
  END IF;

  IF p_input ? 'starts_at' THEN
    v_starts_at := NULLIF(p_input->>'starts_at', '')::TIMESTAMPTZ;
  ELSE
    v_starts_at := NOW();
  END IF;

  RETURN QUERY
  INSERT INTO public.timeline_steps (
    user_id,
    interest_id,
    organization_id,
    program_session_id,
    source_type,
    source_id,
    title,
    description,
    category,
    status,
    starts_at,
    ends_at,
    location_name,
    location_lat,
    location_lng,
    location_place_id,
    visibility,
    share_approximate_location,
    sort_order,
    metadata
  ) VALUES (
    v_user_id,
    v_interest_id,
    NULLIF(p_input->>'organization_id', '')::UUID,
    NULLIF(p_input->>'program_session_id', '')::UUID,
    COALESCE(p_input->>'source_type', 'manual'),
    NULLIF(p_input->>'source_id', '')::UUID,
    p_input->>'title',
    p_input->>'description',
    COALESCE(p_input->>'category', 'general'),
    COALESCE(p_input->>'status', 'pending'),
    v_starts_at,
    NULLIF(p_input->>'ends_at', '')::TIMESTAMPTZ,
    p_input->>'location_name',
    NULLIF(p_input->>'location_lat', '')::DOUBLE PRECISION,
    NULLIF(p_input->>'location_lng', '')::DOUBLE PRECISION,
    p_input->>'location_place_id',
    v_visibility,
    COALESCE((p_input->>'share_approximate_location')::BOOLEAN, FALSE),
    v_sort_order,
    COALESCE(p_input->'metadata', '{}'::jsonb)
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_timeline_step(JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_timeline_step(JSONB) IS
  'Creates a timeline step in a single round-trip: resolves visibility cascade using the Phase 7 privacy model, assigns sort_order, inserts the row, and returns it.';

-- -----------------------------------------------------------------------------
-- 2. STEP_DECK (HELD ITEMS)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.step_deck (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES public.interests(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('blueprint', 'user_fork', 'suggestion')),
  source_id UUID,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'on_deck'
    CHECK (status IN ('on_deck', 'placed', 'discarded')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  placed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_step_deck_user_interest_added_at
  ON public.step_deck (user_id, interest_id, added_at DESC);

CREATE INDEX IF NOT EXISTS idx_step_deck_active_user_interest
  ON public.step_deck (user_id, interest_id, status, added_at DESC);

ALTER TABLE public.step_deck ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "step_deck_owner_read" ON public.step_deck;
CREATE POLICY "step_deck_owner_read"
  ON public.step_deck
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_deck_owner_insert" ON public.step_deck;
CREATE POLICY "step_deck_owner_insert"
  ON public.step_deck
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_deck_owner_update" ON public.step_deck;
CREATE POLICY "step_deck_owner_update"
  ON public.step_deck
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_deck_owner_delete" ON public.step_deck;
CREATE POLICY "step_deck_owner_delete"
  ON public.step_deck
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.step_deck IS
  'Held step ideas saved for later placement into the user timeline.';

-- -----------------------------------------------------------------------------
-- 3. STEP_USER_PROGRESS (BLUEPRINT-STEP STATE PER USER)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.step_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blueprint_step_id UUID NOT NULL REFERENCES public.blueprint_steps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'current', 'settled')),
  started_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, blueprint_step_id)
);

CREATE INDEX IF NOT EXISTS idx_step_user_progress_user_status
  ON public.step_user_progress (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_step_user_progress_blueprint_step
  ON public.step_user_progress (blueprint_step_id);

ALTER TABLE public.step_user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "step_user_progress_owner_read" ON public.step_user_progress;
CREATE POLICY "step_user_progress_owner_read"
  ON public.step_user_progress
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_user_progress_owner_insert" ON public.step_user_progress;
CREATE POLICY "step_user_progress_owner_insert"
  ON public.step_user_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_user_progress_owner_update" ON public.step_user_progress;
CREATE POLICY "step_user_progress_owner_update"
  ON public.step_user_progress
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "step_user_progress_owner_delete" ON public.step_user_progress;
CREATE POLICY "step_user_progress_owner_delete"
  ON public.step_user_progress
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_step_user_progress_updated_at ON public.step_user_progress;
CREATE TRIGGER trigger_step_user_progress_updated_at
  BEFORE UPDATE ON public.step_user_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timeline_steps_updated_at();

COMMENT ON TABLE public.step_user_progress IS
  'Per-user progress state for a blueprint step: planned, current, or settled.';

COMMIT;
