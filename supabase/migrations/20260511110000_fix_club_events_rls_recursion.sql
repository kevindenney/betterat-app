-- Fix infinite recursion in club_events / event_registrations RLS.
--
-- Symptom: GET /rest/v1/club_events returns 500 with
--   code "42P17" / "infinite recursion detected in policy for relation 'club_events'"
--
-- Cause: a "Registered users can view events" SELECT policy on club_events was
-- added out-of-band (not in tracked migrations) and references event_registrations.
-- event_registrations in turn has a "Club admins can view event registrations"
-- policy that JOINs club_events. Postgres detects the cycle and aborts.
--
-- Fix: replace cross-table EXISTS subqueries with SECURITY DEFINER helpers that
-- bypass RLS so policies on one table no longer trigger policies on the other.

-- =====================================================
-- Helpers (SECURITY DEFINER bypasses RLS)
-- =====================================================

CREATE OR REPLACE FUNCTION public._user_is_registered_for_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_registrations er
    WHERE er.event_id = p_event_id
      AND er.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public._user_is_club_admin_for_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_events e
    JOIN public.club_members cm ON cm.club_id = e.club_id
    WHERE e.id = p_event_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'owner')
      AND cm.is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public._user_is_registered_for_event(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public._user_is_club_admin_for_event(uuid) TO authenticated, anon;

-- =====================================================
-- Replace recursive policies on club_events
-- =====================================================

DROP POLICY IF EXISTS "Registered users can view events" ON public.club_events;
CREATE POLICY "Registered users can view events"
  ON public.club_events FOR SELECT
  USING (public._user_is_registered_for_event(id));

-- =====================================================
-- Replace recursive policies on event_registrations
-- =====================================================

DROP POLICY IF EXISTS "Club admins can view event registrations" ON public.event_registrations;
CREATE POLICY "Club admins can view event registrations"
  ON public.event_registrations FOR SELECT
  USING (public._user_is_club_admin_for_event(event_id));

DROP POLICY IF EXISTS "Club admins can update registrations" ON public.event_registrations;
CREATE POLICY "Club admins can update registrations"
  ON public.event_registrations FOR UPDATE
  USING (public._user_is_club_admin_for_event(event_id));
