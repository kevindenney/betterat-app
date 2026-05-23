-- Phase 4k · blueprint_capabilities
-- Which org_competencies a blueprint trains, with coverage strength
-- (1=supporting / 2=secondary / 3=primary). Lets the Insights heatmap
-- link evidence rows back to the blueprint that trains the competency.

CREATE TABLE IF NOT EXISTS public.blueprint_capabilities (
  blueprint_id uuid NOT NULL REFERENCES public.blueprints(id) ON DELETE CASCADE,
  competency_id uuid NOT NULL REFERENCES public.org_competencies(id) ON DELETE CASCADE,
  strength integer NOT NULL DEFAULT 2 CHECK (strength BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blueprint_id, competency_id)
);

CREATE INDEX IF NOT EXISTS idx_blueprint_capabilities_blueprint
  ON public.blueprint_capabilities(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_blueprint_capabilities_competency
  ON public.blueprint_capabilities(competency_id);

ALTER TABLE public.blueprint_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blueprint_capabilities_org_read" ON public.blueprint_capabilities;
CREATE POLICY "blueprint_capabilities_org_read"
  ON public.blueprint_capabilities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_id
        AND public.is_org_active_member(b.org_id)
    )
  );

DROP POLICY IF EXISTS "blueprint_capabilities_author_or_admin_write" ON public.blueprint_capabilities;
CREATE POLICY "blueprint_capabilities_author_or_admin_write"
  ON public.blueprint_capabilities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_id
        AND (b.author_user_id = (SELECT auth.uid()) OR public.is_org_admin_member(b.org_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_id
        AND (b.author_user_id = (SELECT auth.uid()) OR public.is_org_admin_member(b.org_id))
    )
  );

CREATE OR REPLACE FUNCTION public.blueprint_capabilities_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_blueprint_capabilities_updated_at ON public.blueprint_capabilities;
CREATE TRIGGER trg_blueprint_capabilities_updated_at
  BEFORE UPDATE ON public.blueprint_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.blueprint_capabilities_touch_updated_at();
