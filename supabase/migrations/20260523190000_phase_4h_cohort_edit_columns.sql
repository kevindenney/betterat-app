-- Phase 4h · cohort edit columns
-- Add the fields the cohort edit modal expects to persist: status,
-- max_seats, start/end dates, program. Plus an updated_at touch trigger.

ALTER TABLE public.betterat_org_cohorts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS max_seats integer,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS program text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.betterat_org_cohorts
  DROP CONSTRAINT IF EXISTS betterat_org_cohorts_status_check;
ALTER TABLE public.betterat_org_cohorts
  ADD CONSTRAINT betterat_org_cohorts_status_check
  CHECK (status IN ('recruiting','active','completed','on_hold','archived'));

CREATE OR REPLACE FUNCTION public.betterat_org_cohorts_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_betterat_org_cohorts_updated_at ON public.betterat_org_cohorts;
CREATE TRIGGER trg_betterat_org_cohorts_updated_at
  BEFORE UPDATE ON public.betterat_org_cohorts
  FOR EACH ROW EXECUTE FUNCTION public.betterat_org_cohorts_touch_updated_at();

DROP POLICY IF EXISTS "betterat_org_cohorts_admin_update" ON public.betterat_org_cohorts;
CREATE POLICY "betterat_org_cohorts_admin_update"
  ON public.betterat_org_cohorts FOR UPDATE
  USING (public.is_org_admin_member(org_id))
  WITH CHECK (public.is_org_admin_member(org_id));
