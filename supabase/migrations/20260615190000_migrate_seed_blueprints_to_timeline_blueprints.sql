-- Resolve the seed/Studio blueprint 404s by making timeline_blueprints the
-- single source of truth the detail page reads (app/blueprint/[slug].tsx →
-- getBlueprintBySlug → timeline_blueprints; steps via blueprint_steps →
-- timeline_steps).
--
-- The Studio `blueprints` catalog (slug + blueprint_step_templates) powers the
-- discovery cards (DiscoverTodayContent, AtlasSearchSheet) but its slugs never
-- existed in `timeline_blueprints`, so every card linked to a "Blueprint not
-- found" page. This migration bridges the two by, for each orphaned live
-- `blueprints` row that actually has template steps:
--   1. inserting a slug-matched `timeline_blueprints` header (author → user_id),
--   2. materializing each `blueprint_step_templates` row as a public,
--      is_plan_template `timeline_steps` row owned by the author, and
--   3. curating those steps into `blueprint_steps`.
--
-- `blueprints` rows are intentionally left in place — they still back the
-- discovery cards; the matching slug in `timeline_blueprints` is what lets the
-- card resolve. Visibility relies on the existing "Blueprint viewers can see
-- author steps" RLS policy, which matches non-private steps whose
-- (user_id, interest_id) belong to a published public blueprint.
--
-- Idempotent: NOT EXISTS guards on slug mean a re-run is a no-op. The 5
-- org-owned nursing skills with step_count > 0 but zero template rows
-- (foley, h2t, isbar, iv-supervised, med-admin) are deliberately excluded —
-- they have no step content to materialize and need authored steps first.

WITH src AS (
  SELECT
    b.id            AS old_bp_id,
    b.author_user_id,
    b.interest_id,
    b.slug,
    b.title,
    b.description,
    b.subtitle
  FROM blueprints b
  WHERE b.status = 'live'
    AND b.author_user_id IS NOT NULL
    AND b.interest_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM blueprint_step_templates t WHERE t.blueprint_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM timeline_blueprints tb WHERE tb.slug = b.slug)
),
new_bp AS (
  INSERT INTO timeline_blueprints
    (user_id, interest_id, slug, title, description, is_published, access_level, tagline)
  SELECT
    author_user_id, interest_id, slug, title, description, true, 'public', subtitle
  FROM src
  RETURNING id AS new_bp_id, slug
),
map AS (
  SELECT nb.new_bp_id, s.old_bp_id, s.author_user_id, s.interest_id
  FROM new_bp nb
  JOIN src s ON s.slug = nb.slug
),
new_steps AS (
  INSERT INTO timeline_steps
    (user_id, interest_id, title, description, visibility, is_plan_template,
     source_type, source_blueprint_id, status, category)
  SELECT
    m.author_user_id,
    m.interest_id,
    t.title,
    t.description,
    'public',
    true,
    'blueprint',
    m.new_bp_id,
    'pending',
    'general'
  FROM map m
  JOIN blueprint_step_templates t ON t.blueprint_id = m.old_bp_id
  RETURNING id AS step_id, source_blueprint_id, title
)
INSERT INTO blueprint_steps (blueprint_id, step_id, sort_order)
SELECT
  ns.source_blueprint_id,
  ns.step_id,
  COALESCE((
    SELECT MIN(t.sort_order)
    FROM blueprint_step_templates t
    JOIN map m2 ON m2.old_bp_id = t.blueprint_id
    WHERE m2.new_bp_id = ns.source_blueprint_id
      AND t.title = ns.title
  ), 0)
FROM new_steps ns;
