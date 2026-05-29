-- inbox_items leaked every user's pending suggestions / on-deck / reflections.
-- The view ran with security_invoker off (so it bypassed the underlying
-- tables' per-user RLS) and had no recipient filter in its body, so any
-- authenticated user saw ALL rows. Brand-new accounts landed with a full
-- inbox of other people's items.
--
-- Fix: run the view as the invoker (so step_suggestions / step_deck /
-- peer_reflections RLS applies) AND scope each arm to the viewer explicitly
-- so the inbox only shows items addressed to the current user (never ones
-- they sent).
CREATE OR REPLACE VIEW public.inbox_items
WITH (security_invoker = true) AS
  SELECT s.id,
         'suggestion'::text AS kind,
         s.target_user_id AS user_id,
         s.source_user_id AS from_user_id,
         NULL::uuid AS from_plan_id,
         s.source_step_id AS step_id,
         s.message AS body,
         s.status,
         s.created_at
    FROM step_suggestions s
   WHERE s.status = 'pending'::text
     AND s.target_user_id = (SELECT auth.uid())
  UNION ALL
  SELECT d.id,
         'on_deck'::text AS kind,
         d.user_id,
         NULL::uuid AS from_user_id,
         NULL::uuid AS from_plan_id,
         d.source_id AS step_id,
         d.body,
         d.status,
         d.added_at AS created_at
    FROM step_deck d
   WHERE d.status = 'on_deck'::text
     AND d.user_id = (SELECT auth.uid())
  UNION ALL
  SELECT r.id,
         'reflection'::text AS kind,
         r.target_user_id AS user_id,
         r.source_user_id AS from_user_id,
         NULL::uuid AS from_plan_id,
         r.target_step_id AS step_id,
         r.body,
         r.status,
         r.created_at
    FROM peer_reflections r
   WHERE r.status = ANY (ARRAY['unread'::text, 'read'::text])
     AND r.target_user_id = (SELECT auth.uid());
