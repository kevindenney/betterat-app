-- Add primary_boat_class to public.coaching_clients.
--
-- The coach client model treats boat class as a coach-entered attribute of
-- the coaching relationship: app/coach/client/new.tsx collects it, the coach
-- dashboard + client detail screens display it, and CoachClient declares it.
-- The column was never created, so:
--   * CoachingService.createClient() always 42703'd (the insert payload always
--     carries primary_boat_class) -> creating a coaching client was impossible.
--   * useCoachDashboardData selected it -> the whole clients query 42703'd and
--     the dashboard silently rendered zero clients.
-- Backfilling the column the code already reads/writes fixes both.

ALTER TABLE public.coaching_clients
  ADD COLUMN IF NOT EXISTS primary_boat_class text;
