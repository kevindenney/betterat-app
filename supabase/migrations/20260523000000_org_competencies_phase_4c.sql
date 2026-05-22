-- Per-org competency framework: what skills does this institution track?
-- The Insights view + future accreditation reports read from here.
-- Evidence (which student evidenced which competency at which site) is a
-- separate join — wires up when step_reflections lands.
--
-- Applied to dev project qavekrwdbsobecwrfxwu on 2026-05-23 via Supabase MCP.

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_competencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  short_label     text NOT NULL,                  -- "IV", "Med admin", "H2T"
  full_label      text NOT NULL,                  -- "IV insertion · supervised"
  category        text NOT NULL,                  -- "Procedural", "Assessment", "Communication", ...
  description     text,
  display_order   int  NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_competencies_unique_short_per_org UNIQUE (org_id, short_label)
);

CREATE INDEX IF NOT EXISTS org_competencies_org_idx
  ON public.org_competencies(org_id, display_order)
  WHERE is_active = true;

ALTER TABLE public.org_competencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_competencies_authed_read ON public.org_competencies;
CREATE POLICY org_competencies_authed_read ON public.org_competencies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS org_competencies_admin_write ON public.org_competencies;
CREATE POLICY org_competencies_admin_write ON public.org_competencies
  FOR ALL TO authenticated
  USING (public.is_org_admin_member(org_id))
  WITH CHECK (public.is_org_admin_member(org_id));

CREATE OR REPLACE FUNCTION public.org_competencies_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS org_competencies_touch ON public.org_competencies;
CREATE TRIGGER org_competencies_touch
  BEFORE UPDATE ON public.org_competencies
  FOR EACH ROW EXECUTE FUNCTION public.org_competencies_touch_updated_at();

COMMIT;
