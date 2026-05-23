-- Phase 4f · org_billing + org_invoices
-- Stripe-shaped billing state so the Admin · Billing surface reads from
-- real rows instead of hardcoded demo values. Stripe webhooks will write
-- into these tables when the integration ships.

CREATE TABLE IF NOT EXISTS public.org_billing (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_tier text NOT NULL,
  plan_label text NOT NULL,
  price_monthly_cents integer NOT NULL,
  billing_cadence text NOT NULL CHECK (billing_cadence IN ('monthly','annual')),
  net_terms integer NOT NULL DEFAULT 0,
  seats_total integer NOT NULL,
  seats_used integer NOT NULL DEFAULT 0,
  seats_students integer NOT NULL DEFAULT 0,
  seats_mentors integer NOT NULL DEFAULT 0,
  seats_faculty integer NOT NULL DEFAULT 0,
  next_renewal_date date,
  auto_renew boolean NOT NULL DEFAULT true,
  payment_method_brand text,
  payment_method_last4 text,
  payment_method_exp_month integer,
  payment_method_exp_year integer,
  billing_contact_name text,
  billing_contact_email text,
  pilot_locked_until date,
  list_rate_monthly_cents integer,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  seats_billed integer NOT NULL,
  amount_cents integer NOT NULL,
  status text NOT NULL CHECK (status IN ('paid','open','void','waived','past_due')),
  paid_at date,
  due_at date,
  pdf_url text,
  stripe_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_org_invoices_org_period
  ON public.org_invoices(org_id, period_start DESC);

ALTER TABLE public.org_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_billing_admin_read" ON public.org_billing;
CREATE POLICY "org_billing_admin_read"
  ON public.org_billing FOR SELECT
  USING (public.is_org_admin_member(org_id));

DROP POLICY IF EXISTS "org_invoices_admin_read" ON public.org_invoices;
CREATE POLICY "org_invoices_admin_read"
  ON public.org_invoices FOR SELECT
  USING (public.is_org_admin_member(org_id));

CREATE OR REPLACE FUNCTION public.admin_org_billing(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billing jsonb;
  v_invoices jsonb;
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view org billing'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT to_jsonb(b) INTO v_billing
  FROM public.org_billing b
  WHERE b.org_id = p_org_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.period_start DESC), '[]'::jsonb) INTO v_invoices
  FROM public.org_invoices i
  WHERE i.org_id = p_org_id;

  RETURN jsonb_build_object(
    'billing', v_billing,
    'invoices', v_invoices
  );
END;
$$;

COMMENT ON FUNCTION public.admin_org_billing(uuid) IS
  'Admin · Billing surface — returns { billing, invoices } for the org. SECURITY DEFINER + is_org_admin_member gate.';
