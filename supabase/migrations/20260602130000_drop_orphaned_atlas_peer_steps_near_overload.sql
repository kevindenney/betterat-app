-- Drop the orphaned 4-arg overload of atlas_peer_steps_near.
--
-- 20260602120000_atlas_peer_steps_near_return_sailor.sql added the OUT
-- columns set_by_name/set_by_avatar via DROP + CREATE, but its DROP only
-- targeted the 5-arg signature (..., restrict_user_ids uuid[]). An older
-- 4-arg overload (target_lat, target_lng, radius_km, interest_filter) — from
-- before restrict_user_ids was introduced — survived, leaving two functions
-- with the same name. That stale overload lacks set_by_name, so any caller
-- that invoked the 4-arg form would silently get name-less rows, and the
-- pair is a PostgREST overload-resolution hazard.
--
-- The only caller (hooks/useAtlasPeerSteps.ts) always passes all five
-- params, so removing the 4-arg form changes no live behaviour.
--
-- Applied to dev project qavekrwdbsobecwrfxwu.

DROP FUNCTION IF EXISTS public.atlas_peer_steps_near(numeric, numeric, numeric, text);

NOTIFY pgrst, 'reload schema';
