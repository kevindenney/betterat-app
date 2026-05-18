-- Phase 10 PR-4 follow-up · update the Dragon Worlds blueprint to the
-- 12-step canonical from the Claude Design document (§A FULL BLUEPRINT /
-- §A-phase-6 lifecycle scenes).
--
-- Renames the existing 8 step rows to match the design titles + adds 4
-- new rows so the blueprint reaches the canonical 12 ("Blueprint index ·
-- all 12 steps" per §A).
--
-- Steps after rename:
--   1.  Goal-setting · your Worlds outcome
--   2.  Crew roster & comms baseline
--   3.  Rig tune · light-air settings
--   4.  Boat-speed baseline · all points of sail
--   5.  Starts · light-air, shifty breeze
--   6.  Heavy-air helm work · 25–30 kt
--   7.  Boat optimisation · hull, rig, sails
--   8.  Ship the boat to Hong Kong
--   9.  Local conditions · Victoria Harbour
--   10. Tactical · mark roundings under pressure
--   11. Pre-Worlds tune-up · APAC Championship
--   12. Race the Worlds · execute the plan
--
-- The 4 new steps (9-12) are inserted with the blueprint owner's user_id
-- and the same interest_id as the existing steps. The blueprint_steps
-- mapping is appended at sort_order 8-11.

BEGIN;

-- ─── Rename the existing 8 steps to the canonical titles ────────────────

UPDATE public.timeline_steps SET
  title = 'Goal-setting · your Worlds outcome',
  description = 'Write down what success at the Worlds looks like for you. A finish target, a learning target, or both. This is the north star that the next 11 steps point at.'
WHERE id = '908728c3-8ce0-4703-db9b-908eb187bf3d';

UPDATE public.timeline_steps SET
  title = 'Crew roster & comms baseline',
  description = 'Lock in the crew. Set roles, communication preferences, and a debrief cadence. Trust on the boat starts here, weeks before you race.'
WHERE id = 'd18d8867-021c-1b20-2cfd-a981761dfe12';

UPDATE public.timeline_steps SET
  title = 'Rig tune · light-air settings',
  description = 'Set rig tension and shroud numbers for the under-12 kt range. Document your starting point so adjustments later mean something.'
WHERE id = '00dad46e-b8dd-7859-7e79-7de27a4ae520';

UPDATE public.timeline_steps SET
  title = 'Boat-speed baseline · all points of sail',
  description = 'Capture target speeds on all four points of sail in flat water. Boatspeed measurement + honest debrief. These numbers become your reference for the next 8 steps.'
WHERE id = 'cc12f9a9-46dd-5ad2-f850-5649f7301ce6';

UPDATE public.timeline_steps SET
  title = 'Starts · light-air, shifty breeze',
  description = 'Drill clean starts in 8–14 kt with windshift practice. Hold a lane off the line. Same race, same conditions, same fleet — the building block for tactical work later.'
WHERE id = '17825274-a9b0-a292-2d77-8c8bb82e50e6';

UPDATE public.timeline_steps SET
  title = 'Heavy-air helm work · 25–30 kt',
  description = 'Hong Kong November can serve up real breeze. Practise upwind and downwind helm technique at the top end so race-day power doesn''t catch you out.'
WHERE id = '94a14232-e5f8-66f7-b7d1-61f1dc3b3a17';

UPDATE public.timeline_steps SET
  title = 'Boat optimisation · hull, rig, sails',
  description = 'Hull fairing pass, rig tune review against new baseline, sail inventory check. Sea-trial new sails against your boatspeed baseline and lock in your Worlds set.'
WHERE id = '6fb73475-db94-9ca0-c4cb-04f570c81252';

UPDATE public.timeline_steps SET
  title = 'Ship the boat to Hong Kong',
  description = 'Container packing, paperwork, customs. Aim for arrival 4 weeks before racing so you have a full practice block on-site.'
WHERE id = 'b9b260d4-0ee6-8965-a3eb-e5498943a8ee';

-- ─── Add 4 new steps (sort_orders 8-11) ─────────────────────────────────

WITH owner_id AS (SELECT 'd67f765e-7fe6-4f79-b514-f1b7f9a1ba3f'::uuid AS id),
     interest_id AS (
       SELECT interest_id FROM public.timeline_steps
       WHERE id = '908728c3-8ce0-4703-db9b-908eb187bf3d'
     ),
     inserted AS (
       INSERT INTO public.timeline_steps (
         user_id, interest_id, title, description, source_type,
         visibility, sort_order
       )
       SELECT
         (SELECT id FROM owner_id),
         (SELECT interest_id FROM interest_id),
         v.title, v.description, 'manual', 'public', v.sort_order
       FROM (VALUES
         (
           'Local conditions · Victoria Harbour',
           'Sail your home stretch of Victoria Harbour. Wind shadows, current windows, chop patterns. Spend a session inside the venue so you''ve seen the day-to-day variability.',
           1000
         ),
         (
           'Tactical · mark roundings under pressure',
           'Three-boat drills around a windward mark. Inside overlap, room calls, gybe-to-leeward execution. Build the muscle for fleet-tactic decisions in real time.',
           1001
         ),
         (
           'Pre-Worlds tune-up · APAC Championship',
           'Sail the APAC Championship in late October as your live tune-up event. Use it for fleet exposure, condition variance, and a real-stakes debrief.',
           1002
         ),
         (
           'Race the Worlds · execute the plan',
           'Daily debriefs, hydration, between-race nutrition. Trust the prep. One race at a time.',
           1003
         )
       ) AS v(title, description, sort_order)
       ON CONFLICT DO NOTHING
       RETURNING id, title, sort_order
     ),
     local_conditions AS (
       SELECT id FROM inserted WHERE title = 'Local conditions · Victoria Harbour'
     ),
     tactical AS (
       SELECT id FROM inserted WHERE title = 'Tactical · mark roundings under pressure'
     ),
     pre_worlds AS (
       SELECT id FROM inserted WHERE title = 'Pre-Worlds tune-up · APAC Championship'
     ),
     race_worlds AS (
       SELECT id FROM inserted WHERE title = 'Race the Worlds · execute the plan'
     )
INSERT INTO public.blueprint_steps (blueprint_id, step_id, sort_order)
SELECT 'f419fa18-de41-3976-4d36-22d294a03d92'::uuid, id, 8
  FROM local_conditions
UNION ALL
SELECT 'f419fa18-de41-3976-4d36-22d294a03d92'::uuid, id, 9
  FROM tactical
UNION ALL
SELECT 'f419fa18-de41-3976-4d36-22d294a03d92'::uuid, id, 10
  FROM pre_worlds
UNION ALL
SELECT 'f419fa18-de41-3976-4d36-22d294a03d92'::uuid, id, 11
  FROM race_worlds
ON CONFLICT DO NOTHING;

COMMIT;
