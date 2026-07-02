-- Promote legacy timeline-authored blueprints into the Studio catalog.
--
-- Creator Studio is the canonical authoring interface. Older group/get-inspired
-- blueprints live in timeline_blueprints + blueprint_steps; copy them into
-- blueprints + blueprint_step_templates with matching ids so existing group
-- attachments can open in Studio after this migration.

BEGIN;

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS legacy_timeline_blueprint_id uuid
    REFERENCES public.timeline_blueprints(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blueprints_legacy_timeline_blueprint
  ON public.blueprints(legacy_timeline_blueprint_id)
  WHERE legacy_timeline_blueprint_id IS NOT NULL;

ALTER TABLE public.blueprint_step_templates
  ADD COLUMN IF NOT EXISTS legacy_timeline_step_id uuid
    REFERENCES public.timeline_steps(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_blueprint_step_templates_legacy_step
  ON public.blueprint_step_templates(blueprint_id, legacy_timeline_step_id)
  WHERE legacy_timeline_step_id IS NOT NULL;

INSERT INTO public.blueprints (
  id,
  org_id,
  author_user_id,
  interest_id,
  title,
  slug,
  category,
  version,
  status,
  step_count,
  description,
  subtitle,
  access_mode,
  price_per_seat_cents,
  stripe_price_id,
  billing_cadence,
  trial_days,
  created_at,
  updated_at,
  last_edited_at,
  published_at,
  legacy_timeline_blueprint_id
)
SELECT
  tb.id,
  tb.organization_id,
  tb.user_id,
  tb.interest_id,
  tb.title,
  tb.slug,
  'other',
  CASE WHEN tb.is_published THEN 'v1.0' ELSE 'v0.1 draft' END,
  CASE WHEN tb.is_published THEN 'live' ELSE 'draft' END,
  COALESCE(step_counts.count, 0),
  tb.description,
  tb.tagline,
  CASE WHEN tb.organization_id IS NULL THEN 'independent' ELSE 'institutional' END,
  tb.price_cents,
  tb.stripe_price_id,
  CASE WHEN tb.pricing_type = 'recurring' THEN 'monthly' ELSE 'one_time' END,
  7,
  tb.created_at,
  tb.updated_at,
  tb.updated_at,
  CASE WHEN tb.is_published THEN tb.updated_at ELSE NULL END,
  tb.id
FROM public.timeline_blueprints tb
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS count
  FROM public.blueprint_steps bs
  WHERE bs.blueprint_id = tb.id
) step_counts ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.blueprints b
  WHERE b.id = tb.id
     OR b.legacy_timeline_blueprint_id = tb.id
);

UPDATE public.blueprints b
SET legacy_timeline_blueprint_id = tb.id
FROM public.timeline_blueprints tb
WHERE b.id = tb.id
  AND b.legacy_timeline_blueprint_id IS NULL;

INSERT INTO public.blueprint_step_templates (
  blueprint_id,
  sort_order,
  title,
  description,
  category,
  what_question,
  sub_steps,
  preceptor_role,
  capability_tags,
  plan_metadata,
  created_at,
  updated_at,
  legacy_timeline_step_id
)
SELECT
  tb.id,
  bs.sort_order,
  s.title,
  s.description,
  CASE
    WHEN s.category IN ('procedural', 'assessment', 'communication', 'reasoning', 'other')
      THEN s.category
    ELSE 'other'
  END,
  COALESCE(NULLIF(s.metadata->>'what_question', ''), NULLIF(s.metadata->>'what', '')),
  COALESCE(
    CASE
      WHEN jsonb_typeof(s.metadata->'sub_steps') = 'array' THEN s.metadata->'sub_steps'
      WHEN jsonb_typeof(s.metadata->'how_sub_steps') = 'array' THEN s.metadata->'how_sub_steps'
      ELSE NULL
    END,
    '[]'::jsonb
  ),
  NULLIF(s.metadata->>'preceptor_role', ''),
  CASE
    WHEN jsonb_typeof(s.metadata->'capability_tags') = 'array' THEN ARRAY(
      SELECT value
      FROM jsonb_array_elements_text(s.metadata->'capability_tags') AS tags(value)
    )
    ELSE ARRAY[]::text[]
  END,
  jsonb_strip_nulls(
    jsonb_build_object(
      'why', NULLIF(COALESCE(s.metadata->>'why', s.metadata->>'why_reasoning'), ''),
      'when_label', NULLIF(COALESCE(s.metadata->>'when_label', s.metadata->>'when'), ''),
      'where_label', NULLIF(COALESCE(s.location_name, s.metadata->>'where_label'), ''),
      'beats', COALESCE(
        CASE
          WHEN jsonb_typeof(s.metadata->'beats') = 'array' THEN s.metadata->'beats'
          ELSE NULL
        END,
        '[]'::jsonb
      )
    )
  ),
  s.created_at,
  s.updated_at,
  s.id
FROM public.timeline_blueprints tb
JOIN public.blueprints b ON b.id = tb.id
JOIN public.blueprint_steps bs ON bs.blueprint_id = tb.id
JOIN public.timeline_steps s ON s.id = bs.step_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.blueprint_step_templates t
  WHERE t.blueprint_id = tb.id
    AND t.legacy_timeline_step_id = s.id
);

UPDATE public.blueprints b
SET step_count = counts.count,
    last_edited_at = GREATEST(b.last_edited_at, counts.last_edited_at),
    updated_at = GREATEST(b.updated_at, counts.last_edited_at)
FROM (
  SELECT
    blueprint_id,
    count(*)::integer AS count,
    max(updated_at) AS last_edited_at
  FROM public.blueprint_step_templates
  GROUP BY blueprint_id
) counts
WHERE b.id = counts.blueprint_id
  AND b.legacy_timeline_blueprint_id IS NOT NULL;

COMMIT;
