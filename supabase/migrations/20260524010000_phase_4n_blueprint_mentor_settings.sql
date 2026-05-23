-- Phase 4n · blueprint_mentor_settings
-- One row per blueprint storing the Mentor settings sub-tab state. All
-- columns have sane defaults so a missing row reads as defaults.

CREATE TABLE IF NOT EXISTS public.blueprint_mentor_settings (
  blueprint_id uuid PRIMARY KEY REFERENCES public.blueprints(id) ON DELETE CASCADE,
  -- who can mentor
  faculty_can_mentor boolean NOT NULL DEFAULT true,
  preceptors_can_mentor boolean NOT NULL DEFAULT true,
  peers_can_mentor boolean NOT NULL DEFAULT false,
  -- what mentors can do
  can_comment boolean NOT NULL DEFAULT true,
  can_settle boolean NOT NULL DEFAULT true,
  can_propose_followup boolean NOT NULL DEFAULT true,
  can_edit_blueprint boolean NOT NULL DEFAULT false,
  -- notification cadence (free text for v1 — picker comes later)
  daily_digest_time text NOT NULL DEFAULT '8:00 AM · weekdays',
  on_action_ping text NOT NULL DEFAULT 'Flagged + Wants follow-up',
  weekly_summary_time text NOT NULL DEFAULT 'Fri 4:00 PM',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.blueprint_mentor_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bms_org_read" ON public.blueprint_mentor_settings;
CREATE POLICY "bms_org_read"
  ON public.blueprint_mentor_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_mentor_settings.blueprint_id
        AND public.is_org_active_member(b.org_id)
    )
  );

DROP POLICY IF EXISTS "bms_author_or_admin_write" ON public.blueprint_mentor_settings;
CREATE POLICY "bms_author_or_admin_write"
  ON public.blueprint_mentor_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_mentor_settings.blueprint_id
        AND (b.author_user_id = (SELECT auth.uid()) OR public.is_org_admin_member(b.org_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blueprints b
      WHERE b.id = blueprint_mentor_settings.blueprint_id
        AND (b.author_user_id = (SELECT auth.uid()) OR public.is_org_admin_member(b.org_id))
    )
  );

COMMENT ON TABLE public.blueprint_mentor_settings IS
  'Mentor eligibility, permissions, and notification cadence for one blueprint.';
