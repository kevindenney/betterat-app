-- Seed JHSON capability evidence for the dean's Insights demo.
-- Run AFTER 20260523120000_phase_4d_competency_evidence_join.sql is applied
-- and org_competencies + atlas_pois are seeded for JHSON.
--
-- Strategy:
--   For each (cohort member, competency) pair, deterministically gate by
--   per-competency hit rate (Med admin 100% → Sepsis 25%). For passing
--   pairs, deterministically pick one of 5 hospital sites weighted toward
--   JH Hospital (35%) → Howard County (10%). One timeline_step +
--   step_location + step_capability_evidence row per triple, dated within
--   the last 8 weeks. Idempotent-ish: re-running creates duplicate steps,
--   so delete first if you want a clean re-seed.

WITH
  jhson AS (SELECT
    '678e149e-2abb-422c-ac61-b76756a2150e'::uuid AS org_id,
    'bec249c5-6412-4d16-bb84-bfcfb887ff67'::uuid AS interest_id),
  members AS (
    SELECT m.user_id
      FROM betterat_org_cohort_members m
      JOIN betterat_org_cohorts c ON c.id = m.cohort_id
      WHERE c.org_id = (SELECT org_id FROM jhson)
  ),
  sites AS (
    SELECT id AS poi_id, name, lat, lng,
      ROW_NUMBER() OVER (ORDER BY
        CASE name
          WHEN 'Johns Hopkins Hospital — East Baltimore' THEN 1
          WHEN 'Johns Hopkins Bayview Medical Center' THEN 2
          WHEN 'Suburban Hospital' THEN 3
          WHEN 'Sibley Memorial Hospital' THEN 4
          WHEN 'Howard County General Hospital' THEN 5
        END) AS bucket
      FROM atlas_pois
      WHERE claimed_by_org_id = (SELECT org_id FROM jhson)
        AND kind = 'hospital'
  ),
  competencies AS (
    SELECT id AS competency_id, short_label, full_label,
      CASE short_label
        WHEN 'Med admin' THEN 100 WHEN 'H2T' THEN 100
        WHEN 'Handoff' THEN 90 WHEN 'Teach-back' THEN 80
        WHEN 'IV' THEN 75 WHEN 'Foley' THEN 60
        WHEN 'Cardiac' THEN 55 WHEN 'NG tube' THEN 30
        WHEN 'Sepsis' THEN 25 ELSE 50
      END AS hit_pct
    FROM org_competencies
    WHERE org_id = (SELECT org_id FROM jhson) AND is_active = true
  ),
  triples_raw AS (
    SELECT m.user_id, c.competency_id, c.short_label, c.full_label, c.hit_pct,
      (abs(hashtext(m.user_id::text || c.competency_id::text || 'gate')) % 100) AS hash_gate,
      (abs(hashtext(m.user_id::text || c.competency_id::text || 'site')) % 100) AS hash_site,
      (abs(hashtext(m.user_id::text || c.competency_id::text || 'days')) % 56) AS days_ago
    FROM members m CROSS JOIN competencies c
  ),
  triples AS (
    SELECT user_id, competency_id, short_label, full_label, hash_gate, hash_site, days_ago,
      CASE
        WHEN hash_site < 35 THEN 1
        WHEN hash_site < 60 THEN 2
        WHEN hash_site < 75 THEN 3
        WHEN hash_site < 90 THEN 4
        ELSE 5
      END AS site_bucket
    FROM triples_raw
    WHERE hash_gate < hit_pct
  ),
  seed AS (
    SELECT
      gen_random_uuid() AS step_id,
      t.user_id, t.competency_id, t.short_label, t.full_label,
      s.poi_id, s.lat, s.lng, s.name AS site_name,
      (now() - (t.days_ago || ' days')::interval) AS happened_at
    FROM triples t
    JOIN sites s ON s.bucket = t.site_bucket
  ),
  ins_steps AS (
    INSERT INTO timeline_steps
      (id, user_id, interest_id, organization_id, title, category,
       status, completed_at, sort_order, created_at, updated_at)
    SELECT step_id, user_id, (SELECT interest_id FROM jhson),
           (SELECT org_id FROM jhson),
           short_label || ' — clinical rotation',
           'clinical', 'settled', happened_at, 0, happened_at, happened_at
      FROM seed
    RETURNING id
  ),
  ins_locations AS (
    INSERT INTO step_location
      (step_id, lat, lng, name, poi_id, is_healthcare_site, location_precision, set_at)
    SELECT step_id, lat, lng, site_name, poi_id, true, 'site', happened_at FROM seed
    RETURNING step_id
  ),
  ins_evidence AS (
    INSERT INTO step_capability_evidence
      (step_id, capability_id, capability_name, org_competency_id,
       confirmed, strength, pip_level, evidence_count, created_at, updated_at)
    SELECT step_id, 'cap:' || competency_id::text, full_label, competency_id,
           true, 'material', 3, 1, happened_at, happened_at
      FROM seed
    RETURNING step_id
  )
SELECT
  (SELECT count(*) FROM ins_steps) AS steps_inserted,
  (SELECT count(*) FROM ins_locations) AS locations_inserted,
  (SELECT count(*) FROM ins_evidence) AS evidence_inserted;
