-- Seed the Suman (SHG coach) ↔ Savitri (mentee) two-account interaction for
-- the Pitroda / India demo. The funder-rollup seed
-- (pradan_khunti_peer_outcomes.sql) makes the cohort *outcomes* real; this
-- one makes the *social loop* real: a coach-reply discussion thread on
-- Savitri's steps, reactions, a pending step suggestion from Suman, and the
-- follow graph (cohort follows its coach). Together they let the demo open
-- into a populated, interacting network rather than a single-earner shell.
--
-- The "one live action" beat: the threads here are pre-seeded so both sides
-- render on first load, but at demo time Suman posts ONE additional live
-- coach reply on stage to prove the loop is real, not canned.
--
-- Notifications are intentionally NOT hand-seeded for discussions/follows:
-- inserting the rows below fires the existing triggers
--   * trg_notify_collaborators_on_personal_step_post (step_discussions)
--   * the user_follows new_follower trigger
-- which create the genuine bell/inbox pings. Only the step_suggestion bell is
-- inserted manually, because step_suggestions has no notify trigger.
--
-- Idempotent: a re-run deletes this seed's own rows (and the
-- trigger-generated notifications among these demo actors) before
-- re-inserting, so counts never accumulate.
--
-- Actors (verified against dev qavekrwdbsobecwrfxwu):
--   org pradan-khunti  87195fe7-b9d7-4308-968f-532300a8d813
--   Suman (coach)      fe401f10-7298-4d46-921b-fed3df41398e  demo-suman@betterat.app
--   Savitri (mentee)   f160779d-5a54-465e-a0f9-b97b94f6a475  demo-savitri@betterat.app
--   Phulmani           56efef49-3da0-4322-8ed7-8c02af8cb5fb
--   Champa             f920a955-668a-4078-bc35-5cc6c4807542
--   Basanti            a48de0fb-d235-4dd9-9e89-6955149280d4
-- Savitri keystone steps (both carry Suman as a 'mentor' collaborator, so the
-- participant-access RPC grants Suman read+post):
--   d4f64609-312f-4e6f-b879-eea631cc0f4c  "Calculate your real costs"
--   f1253fad-fbbd-478e-b628-eb8a946f5165  "Confirm your SHG is NRLM-registered"
-- Suman's own step he suggests to Savitri:
--   070ca4ec-a16f-470b-b958-cc5a1ac183c6  "Get bank linkage loan (up to 4x your savings)"

BEGIN;

-- ── Promote Suman to a role the funder RPCs accept ──────────────────────────
-- admin_cohort_outcomes / overview gate on has_org_role_in(..., manager|admin).
-- Suman seeded as 'coach', which those RPCs reject → the funder card would
-- hide. 'manager' is the proven-working role (the retired pradan-field used it).
UPDATE organization_memberships
SET role = 'manager'
WHERE organization_id = '87195fe7-b9d7-4308-968f-532300a8d813'
  AND user_id = 'fe401f10-7298-4d46-921b-fed3df41398e';

-- ── Clean prior runs (delete before insert; triggers re-create fresh) ───────
-- Notifications among these demo actors (both auto-fired and hand-seeded).
DELETE FROM social_notifications
WHERE type IN ('step_discussion_post', 'new_follower', 'step_suggested')
  AND user_id  IN ('fe401f10-7298-4d46-921b-fed3df41398e',
                   'f160779d-5a54-465e-a0f9-b97b94f6a475',
                   '56efef49-3da0-4322-8ed7-8c02af8cb5fb',
                   'f920a955-668a-4078-bc35-5cc6c4807542',
                   'a48de0fb-d235-4dd9-9e89-6955149280d4')
  AND actor_id IN ('fe401f10-7298-4d46-921b-fed3df41398e',
                   'f160779d-5a54-465e-a0f9-b97b94f6a475',
                   '56efef49-3da0-4322-8ed7-8c02af8cb5fb',
                   'f920a955-668a-4078-bc35-5cc6c4807542',
                   'a48de0fb-d235-4dd9-9e89-6955149280d4');

-- Reactions on the seeded threads (delete before the discussions they hang off).
DELETE FROM step_discussion_reactions r
USING step_discussions d
WHERE r.discussion_id = d.id
  AND d.step_id IN ('d4f64609-312f-4e6f-b879-eea631cc0f4c',
                    'f1253fad-fbbd-478e-b628-eb8a946f5165')
  AND d.user_id IN ('fe401f10-7298-4d46-921b-fed3df41398e',
                    'f160779d-5a54-465e-a0f9-b97b94f6a475');

-- The seeded discussion threads (includes any live coach reply from last run).
DELETE FROM step_discussions
WHERE step_id IN ('d4f64609-312f-4e6f-b879-eea631cc0f4c',
                  'f1253fad-fbbd-478e-b628-eb8a946f5165')
  AND user_id IN ('fe401f10-7298-4d46-921b-fed3df41398e',
                  'f160779d-5a54-465e-a0f9-b97b94f6a475');

-- The pending suggestion from Suman → Savitri.
DELETE FROM step_suggestions
WHERE source_user_id = 'fe401f10-7298-4d46-921b-fed3df41398e'
  AND target_user_id = 'f160779d-5a54-465e-a0f9-b97b94f6a475'
  AND source_step_id = '070ca4ec-a16f-470b-b958-cc5a1ac183c6';

-- The seeded follow edges.
DELETE FROM user_follows
WHERE (follower_id, following_id) IN (
  ('f160779d-5a54-465e-a0f9-b97b94f6a475', 'fe401f10-7298-4d46-921b-fed3df41398e'),
  ('56efef49-3da0-4322-8ed7-8c02af8cb5fb', 'fe401f10-7298-4d46-921b-fed3df41398e'),
  ('f920a955-668a-4078-bc35-5cc6c4807542', 'fe401f10-7298-4d46-921b-fed3df41398e'),
  ('a48de0fb-d235-4dd9-9e89-6955149280d4', 'fe401f10-7298-4d46-921b-fed3df41398e'),
  ('f160779d-5a54-465e-a0f9-b97b94f6a475', '56efef49-3da0-4322-8ed7-8c02af8cb5fb')
);

-- ── Thread 1: "Calculate your real costs" (Savitri asks → Suman coaches) ─────
INSERT INTO step_discussions (step_id, user_id, parent_id, body, is_coach_reply, created_at, updated_at)
VALUES (
  'd4f64609-312f-4e6f-b879-eea631cc0f4c',
  'f160779d-5a54-465e-a0f9-b97b94f6a475',
  NULL,
  'Suman didi, I finally added it all up — lac, sticks, and the bus fare to Ranchi. My real cost per bangle is ₹42, not ₹30 like I always thought.',
  false,
  TIMESTAMPTZ '2026-05-20 04:00:00+00',
  TIMESTAMPTZ '2026-05-20 04:00:00+00'
);

INSERT INTO step_discussions (step_id, user_id, parent_id, body, is_coach_reply, created_at, updated_at)
SELECT
  'd4f64609-312f-4e6f-b879-eea631cc0f4c',
  'fe401f10-7298-4d46-921b-fed3df41398e',
  r.id,
  'This is the number that changes everything, Savitri. Now price at ₹70 and your margin stays healthy even after the loan repayment. Bring last month''s sales book on Thursday and we''ll set the new rate together.',
  true,
  TIMESTAMPTZ '2026-05-20 06:30:00+00',
  TIMESTAMPTZ '2026-05-20 06:30:00+00'
FROM step_discussions r
WHERE r.step_id = 'd4f64609-312f-4e6f-b879-eea631cc0f4c'
  AND r.user_id = 'f160779d-5a54-465e-a0f9-b97b94f6a475'
  AND r.parent_id IS NULL;

-- ── Thread 2: "Confirm your SHG is NRLM-registered" (Savitri asks → Suman) ───
INSERT INTO step_discussions (step_id, user_id, parent_id, body, is_coach_reply, created_at, updated_at)
VALUES (
  'f1253fad-fbbd-478e-b628-eb8a946f5165',
  'f160779d-5a54-465e-a0f9-b97b94f6a475',
  NULL,
  'I went to the block office. They said our Khunti Mahila SHG is on the NRLM list, but the registration number is not showing in my passbook. What should I do next?',
  false,
  TIMESTAMPTZ '2026-05-22 03:30:00+00',
  TIMESTAMPTZ '2026-05-22 03:30:00+00'
);

INSERT INTO step_discussions (step_id, user_id, parent_id, body, is_coach_reply, created_at, updated_at)
SELECT
  'f1253fad-fbbd-478e-b628-eb8a946f5165',
  'fe401f10-7298-4d46-921b-fed3df41398e',
  r.id,
  'Good that you checked early. The number won''t be in your passbook — ask the CRP for the SHG''s NRLM code, it''s on the federation register. Once you have it, the Revolving Fund claim is quick. I''ll bring the register Thursday.',
  true,
  TIMESTAMPTZ '2026-05-22 05:00:00+00',
  TIMESTAMPTZ '2026-05-22 05:00:00+00'
FROM step_discussions r
WHERE r.step_id = 'f1253fad-fbbd-478e-b628-eb8a946f5165'
  AND r.user_id = 'f160779d-5a54-465e-a0f9-b97b94f6a475'
  AND r.parent_id IS NULL;

-- ── Reactions ───────────────────────────────────────────────────────────────
-- Suman flags Savitri's cost realization as an insight.
INSERT INTO step_discussion_reactions (discussion_id, user_id, kind, created_at)
SELECT d.id, 'fe401f10-7298-4d46-921b-fed3df41398e', 'insight', TIMESTAMPTZ '2026-05-20 06:31:00+00'
FROM step_discussions d
WHERE d.step_id = 'd4f64609-312f-4e6f-b879-eea631cc0f4c'
  AND d.user_id = 'f160779d-5a54-465e-a0f9-b97b94f6a475'
  AND d.parent_id IS NULL;

-- Savitri fires on Suman's NRLM-code guidance.
INSERT INTO step_discussion_reactions (discussion_id, user_id, kind, created_at)
SELECT d.id, 'f160779d-5a54-465e-a0f9-b97b94f6a475', 'fire', TIMESTAMPTZ '2026-05-22 05:05:00+00'
FROM step_discussions d
WHERE d.step_id = 'f1253fad-fbbd-478e-b628-eb8a946f5165'
  AND d.user_id = 'fe401f10-7298-4d46-921b-fed3df41398e'
  AND d.is_coach_reply = true;

-- ── Pending step suggestion: Suman → Savitri ────────────────────────────────
-- First sentence reads as the inbox card title (see hooks/useInboxItems.ts).
INSERT INTO step_suggestions (source_user_id, target_user_id, source_step_id, message, status, created_at)
VALUES (
  'fe401f10-7298-4d46-921b-fed3df41398e',
  'f160779d-5a54-465e-a0f9-b97b94f6a475',
  '070ca4ec-a16f-470b-b958-cc5a1ac183c6',
  'Apply for a bank-linkage loan — up to 4× your SHG savings. You''ve hit the savings milestone, so the SBI branch will process it. I''ll help you with the paperwork.',
  'pending',
  TIMESTAMPTZ '2026-05-24 04:00:00+00'
);

-- Bell ping for the suggestion (step_suggestions has no notify trigger).
INSERT INTO social_notifications (user_id, type, actor_id, title, body, data, is_read, created_at)
VALUES (
  'f160779d-5a54-465e-a0f9-b97b94f6a475',
  'step_suggested',
  'fe401f10-7298-4d46-921b-fed3df41398e',
  'Suman Tirkey suggested a step',
  'Apply for a bank-linkage loan — up to 4× your SHG savings.',
  jsonb_build_object('source_step_id', '070ca4ec-a16f-470b-b958-cc5a1ac183c6'),
  false,
  TIMESTAMPTZ '2026-05-24 04:00:00+00'
);

-- ── Follow graph: the cohort follows its coach; one peer link ────────────────
-- Triggers auto-create the new_follower bell notifications.
INSERT INTO user_follows (follower_id, following_id, created_at)
VALUES
  ('f160779d-5a54-465e-a0f9-b97b94f6a475', 'fe401f10-7298-4d46-921b-fed3df41398e', TIMESTAMPTZ '2026-05-10 04:00:00+00'),
  ('56efef49-3da0-4322-8ed7-8c02af8cb5fb', 'fe401f10-7298-4d46-921b-fed3df41398e', TIMESTAMPTZ '2026-05-11 04:00:00+00'),
  ('f920a955-668a-4078-bc35-5cc6c4807542', 'fe401f10-7298-4d46-921b-fed3df41398e', TIMESTAMPTZ '2026-05-12 04:00:00+00'),
  ('a48de0fb-d235-4dd9-9e89-6955149280d4', 'fe401f10-7298-4d46-921b-fed3df41398e', TIMESTAMPTZ '2026-05-13 04:00:00+00'),
  ('f160779d-5a54-465e-a0f9-b97b94f6a475', '56efef49-3da0-4322-8ed7-8c02af8cb5fb', TIMESTAMPTZ '2026-05-14 04:00:00+00');

COMMIT;
