-- Seed PRADAN Khunti SHG cohort peer outcomes + mentor link for the
-- Pitroda / India funder demo.
--
-- Before this seed only Savitri Devi Munda had a plan + 12 weeks of
-- business_outcomes, so the cohort-outcome rollup on
-- /admin/pradan-khunti/overview showed a single earner — no "funder
-- story". This seeds the other three SHG cohort members with their own
-- "Grow the lac-craft business" plan and 12 weeks of varied weekly
-- outcomes, and links the SHG coach (Suman Tirkey) as a mentor on
-- Savitri's recent steps so the mentorship narrative is visible.
--
-- Trajectories are deliberately varied so the rollup reads as a real
-- cohort, not a copy: Phulmani steady, Champa a fast riser, Basanti the
-- lagging member whose gap the funder/mentor is meant to close.
--
-- Idempotent: deletes this seed's own plans/outcomes (by the three peer
-- user_ids + plan title) and the seeded mentor links before re-inserting.
-- Weeks mirror Savitri's window: 2026-03-09 .. 2026-05-25 (12 weeks).

WITH
  ctx AS (
    SELECT
      '680270d5-9567-4d8c-a18c-afecc2e0c2b0'::uuid AS interest_id,
      'f160779d-5a54-465e-a0f9-b97b94f6a475'::uuid AS savitri_id,
      'fe401f10-7298-4d46-921b-fed3df41398e'::uuid AS suman_id,
      DATE '2026-03-09' AS week0,
      TIMESTAMPTZ '2025-12-30 03:39:11.936161+00' AS plan_started
  ),
  -- (user_id, vision, trajectory endpoints over 12 weeks)
  peers(user_id, vision, u0, u1, r0, r1, c0, c1, rep0, rep1) AS (
    VALUES
      -- Phulmani Oraon — steady, dependable climber
      ('56efef49-3da0-4322-8ed7-8c02af8cb5fb'::uuid, 'Save ₹8,000 every month.',  6, 17,  70000, 220000,  5, 14, 1, 8),
      -- Champa Kumari — slow start, fast riser, nearly catches Savitri
      ('f920a955-668a-4078-bc35-5cc6c4807542'::uuid, 'Save ₹10,000 every month.', 4, 19,  48000, 240000,  3, 16, 0, 9),
      -- Basanti Mahto — lagging member; the gap the cohort is meant to close
      ('a48de0fb-d235-4dd9-9e89-6955149280d4'::uuid, 'Save ₹5,000 every month.',  3, 11,  36000, 140000,  2,  9, 0, 4)
  ),
  -- Clean prior runs of this seed
  del_outcomes AS (
    DELETE FROM business_outcomes bo
    USING peers p
    WHERE bo.user_id = p.user_id
    RETURNING 1
  ),
  del_plans AS (
    DELETE FROM plans pl
    USING peers p
    WHERE pl.user_id = p.user_id AND pl.title = 'Grow the lac-craft business'
    RETURNING 1
  ),
  del_mentor AS (
    DELETE FROM step_collaborators sc
    USING ctx
    WHERE sc.user_id = ctx.suman_id AND sc.role = 'mentor'
    RETURNING 1
  ),
  new_plans AS (
    INSERT INTO plans (user_id, interest_id, title, vision_statement, status, started_at)
    SELECT p.user_id, ctx.interest_id, 'Grow the lac-craft business', p.vision, 'active', ctx.plan_started
    FROM peers p CROSS JOIN ctx
    RETURNING id, user_id
  ),
  ins_outcomes AS (
    INSERT INTO business_outcomes
      (user_id, plan_id, week_start, units_sold, revenue_minor, currency, customer_count, repeat_count)
    SELECT
      np.user_id,
      np.id,
      ctx.week0 + (i * 7),
      round(p.u0   + (p.u1   - p.u0)   * i / 11.0)::int,
      round(p.r0   + (p.r1   - p.r0)   * i / 11.0)::bigint,
      'INR',
      round(p.c0   + (p.c1   - p.c0)   * i / 11.0)::int,
      round(p.rep0 + (p.rep1 - p.rep0) * i / 11.0)::int
    FROM new_plans np
    JOIN peers p ON p.user_id = np.user_id
    CROSS JOIN ctx
    CROSS JOIN generate_series(0, 11) AS i
    RETURNING 1
  ),
  -- Link Suman as mentor on Savitri's 4 most recent steps
  savitri_recent AS (
    SELECT ts.id AS step_id
    FROM timeline_steps ts, ctx
    WHERE ts.user_id = ctx.savitri_id
    ORDER BY COALESCE(ts.completed_at, ts.updated_at, ts.created_at) DESC
    LIMIT 4
  ),
  ins_mentor AS (
    INSERT INTO step_collaborators (step_id, user_id, role, added_by, added_at)
    SELECT sr.step_id, ctx.suman_id, 'mentor', ctx.suman_id, now()
    FROM savitri_recent sr CROSS JOIN ctx
    RETURNING 1
  )
SELECT
  (SELECT count(*) FROM new_plans)   AS plans_inserted,
  (SELECT count(*) FROM ins_outcomes) AS outcomes_inserted,
  (SELECT count(*) FROM ins_mentor)   AS mentor_links_inserted;
