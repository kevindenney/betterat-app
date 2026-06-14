-- Mark is_org_active_member STABLE to cut timeline_steps RLS planning cost.
--
-- timeline_steps has 10 OR'd SELECT policies; several expand the
-- timeline_blueprints visibility predicate, which calls is_org_active_member
-- many times in a deeply nested plan tree. The function was VOLATILE, so the
-- planner could not fold or cache those repeated calls and re-planned the
-- whole expansion on every read.
--
-- Measured on a single-row timeline_steps lookup (authenticated role):
--   VOLATILE:  Planning 161 ms / Execution 8 ms
--   STABLE:    Planning  20 ms / Execution 2.5 ms
--
-- Under the post-settle invalidation burst this 161 ms planning cost (paid on
-- every timeline_steps read, x concurrency) is what tripped the 8 s
-- statement_timeout (57014). The function is a pure read-only EXISTS over
-- organization_memberships keyed on auth.uid(), so STABLE is correct — and it
-- matches the other RLS helpers (is_active_fleet_member,
-- get_blueprint_*_ids) which are already STABLE.

ALTER FUNCTION public.is_org_active_member(uuid) STABLE;
