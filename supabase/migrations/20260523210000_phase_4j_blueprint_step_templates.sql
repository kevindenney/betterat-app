-- Phase 4j · blueprint_step_templates
-- Authored step content for the Studio blueprint editor's Steps sub-tab.
-- Separate from the existing blueprint_steps junction (which curates
-- timeline_steps into blueprints for adopters). When a subscriber adopts
-- a blueprint, the step-template rows materialize into per-user
-- timeline_steps via a copy.

CREATE TABLE IF NOT EXISTS public.blueprint_step_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES public.blueprints(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('procedural','assessment','communication','reasoning','other')),
  what_question text,
  sub_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  preceptor_role text,
  capability_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_step_templates_blueprint
  ON public.blueprint_step_templates(blueprint_id, sort_order);

ALTER TABLE public.blueprint_step_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blueprint_step_templates_org_read" ON public.blueprint_step_templates;
CREATE POLICY "blueprint_step_templates_org_read"
  ON public.blueprint_step_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_id
        AND public.is_org_active_member(b.org_id)
    )
  );

DROP POLICY IF EXISTS "blueprint_step_templates_author_or_admin_write" ON public.blueprint_step_templates;
CREATE POLICY "blueprint_step_templates_author_or_admin_write"
  ON public.blueprint_step_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_id
        AND (
          b.author_user_id = (SELECT auth.uid())
          OR public.is_org_admin_member(b.org_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_id
        AND (
          b.author_user_id = (SELECT auth.uid())
          OR public.is_org_admin_member(b.org_id)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.blueprint_step_templates_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_blueprint_step_templates_updated_at ON public.blueprint_step_templates;
CREATE TRIGGER trg_blueprint_step_templates_updated_at
  BEFORE UPDATE ON public.blueprint_step_templates
  FOR EACH ROW EXECUTE FUNCTION public.blueprint_step_templates_touch_updated_at();
