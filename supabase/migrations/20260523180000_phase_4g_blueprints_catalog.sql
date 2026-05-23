-- Phase 4g · blueprints catalog
-- Real blueprints table backing the Admin · Blueprints list (and eventually
-- the editor's data layer). Separate from timeline_blueprints which is the
-- per-user instantiation; this is the authored template.

CREATE TABLE IF NOT EXISTS public.blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL,
  category text NOT NULL CHECK (category IN ('procedural','assessment','communication','reasoning','other')),
  version text NOT NULL DEFAULT 'v0.1 draft',
  status text NOT NULL CHECK (status IN ('draft','review','live','archived')) DEFAULT 'draft',
  step_count integer NOT NULL DEFAULT 0,
  description text,
  last_edited_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_blueprints_org ON public.blueprints(org_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_author ON public.blueprints(author_user_id);
CREATE INDEX IF NOT EXISTS idx_blueprints_status ON public.blueprints(status);

CREATE TABLE IF NOT EXISTS public.blueprint_cohorts (
  blueprint_id uuid NOT NULL REFERENCES public.blueprints(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.betterat_org_cohorts(id) ON DELETE CASCADE,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blueprint_id, cohort_id)
);

ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blueprint_cohorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blueprints_org_member_read" ON public.blueprints;
CREATE POLICY "blueprints_org_member_read"
  ON public.blueprints FOR SELECT
  USING (public.is_org_active_member(org_id));

DROP POLICY IF EXISTS "blueprint_cohorts_org_member_read" ON public.blueprint_cohorts;
CREATE POLICY "blueprint_cohorts_org_member_read"
  ON public.blueprint_cohorts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_id
        AND public.is_org_active_member(b.org_id)
    )
  );

CREATE OR REPLACE FUNCTION public.admin_org_blueprints(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  category text,
  version text,
  status text,
  step_count integer,
  description text,
  author_user_id uuid,
  author_name text,
  author_initials text,
  author_tone text,
  subscribers integer,
  cohort_labels text[],
  last_edited_at timestamptz,
  published_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_active_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view org blueprints'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH cohort_data AS (
    SELECT
      bc.blueprint_id,
      array_agg(c.name ORDER BY c.name) AS cohort_labels,
      COALESCE(SUM(c.member_count), 0)::integer AS subscriber_count
    FROM public.blueprint_cohorts bc
    JOIN (
      SELECT
        c.id,
        c.name,
        (SELECT count(*) FROM public.betterat_org_cohort_members m WHERE m.cohort_id = c.id) AS member_count
      FROM public.betterat_org_cohorts c
    ) c ON c.id = bc.cohort_id
    GROUP BY bc.blueprint_id
  )
  SELECT
    b.id,
    b.slug,
    b.title,
    b.category,
    b.version,
    b.status,
    b.step_count,
    b.description,
    b.author_user_id,
    COALESCE(NULLIF(trim(u.full_name), ''), u.email, 'Author') AS author_name,
    upper(COALESCE(
      substr(NULLIF(trim(u.full_name), ''), 1, 1) ||
        substr(split_part(NULLIF(trim(u.full_name), ''), ' ', 2), 1, 1),
      substr(u.email, 1, 2),
      'AU'
    )) AS author_initials,
    (ARRAY['navy','brown','warm','green'])[
      1 + (abs(hashtext(COALESCE(b.author_user_id::text, b.id::text))) % 4)
    ] AS author_tone,
    COALESCE(cd.subscriber_count, 0) AS subscribers,
    COALESCE(cd.cohort_labels, ARRAY[]::text[]) AS cohort_labels,
    b.last_edited_at,
    b.published_at
  FROM public.blueprints b
  LEFT JOIN public.users u ON u.id = b.author_user_id
  LEFT JOIN cohort_data cd ON cd.blueprint_id = b.id
  WHERE b.org_id = p_org_id
    AND b.status <> 'archived'
  ORDER BY
    CASE b.status WHEN 'live' THEN 1 WHEN 'review' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END,
    b.last_edited_at DESC;
END;
$$;

COMMENT ON FUNCTION public.admin_org_blueprints(uuid) IS
  'Admin · Blueprints list. SECURITY DEFINER + is_org_active_member gate (any org member can browse the catalog).';
