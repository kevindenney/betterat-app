-- Phase 4i · org_author_payouts + org_payout_cycles
-- Per-author payout state + per-cycle aggregate for the Admin · Author
-- payouts surface. Stripe Connect lives outside the database; these
-- rows mirror what the Stripe API would return, updated by a future
-- Stripe webhook on payout / connected-account events.

CREATE TABLE IF NOT EXISTS public.org_author_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_kind text NOT NULL DEFAULT 'institutional'
    CHECK (author_kind IN ('institutional','independent','contractor')),
  active_seats integer NOT NULL DEFAULT 0,
  earned_ytd_cents integer NOT NULL DEFAULT 0,
  last_payout_date date,
  last_payout_amount_cents integer,
  stripe_connect_status text NOT NULL DEFAULT 'pending'
    CHECK (stripe_connect_status IN ('verified','action_needed','pending','rejected','disabled')),
  stripe_connect_account_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, author_user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_author_payouts_org ON public.org_author_payouts(org_id);

CREATE TABLE IF NOT EXISTS public.org_payout_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled','processing','cleared','skipped','failed')) DEFAULT 'scheduled',
  authors_paid integer NOT NULL DEFAULT 0,
  authors_total integer NOT NULL DEFAULT 0,
  active_seats integer NOT NULL DEFAULT 0,
  batch_total_cents integer NOT NULL DEFAULT 0,
  rebate_cents integer NOT NULL DEFAULT 0,
  scheduled_for date NOT NULL,
  cleared_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_org_payout_cycles_org_status
  ON public.org_payout_cycles(org_id, status);

ALTER TABLE public.org_author_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_payout_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_author_payouts_admin_read" ON public.org_author_payouts;
CREATE POLICY "org_author_payouts_admin_read"
  ON public.org_author_payouts FOR SELECT
  USING (public.is_org_admin_member(org_id));

DROP POLICY IF EXISTS "org_payout_cycles_admin_read" ON public.org_payout_cycles;
CREATE POLICY "org_payout_cycles_admin_read"
  ON public.org_payout_cycles FOR SELECT
  USING (public.is_org_admin_member(org_id));

CREATE OR REPLACE FUNCTION public.admin_org_payouts(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authors jsonb;
  v_paid_ytd_cents integer;
  v_pending_cents integer;
  v_pending_clears date;
  v_last_batch_cents integer;
  v_last_batch_date date;
  v_last_batch_authors integer;
  v_seats integer;
  v_cohort_label text;
  v_upcoming_period_start date;
  v_upcoming_period_end date;
  v_upcoming_authors_paid integer;
  v_upcoming_authors_total integer;
  v_upcoming_rebate_cents integer;
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view org payouts'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(jsonb_agg(row_payload ORDER BY (row_payload->>'earned_ytd_cents')::int DESC), '[]'::jsonb)
  INTO v_authors
  FROM (
    SELECT jsonb_build_object(
      'id', ap.id,
      'author_user_id', ap.author_user_id,
      'author_kind', ap.author_kind,
      'author_name', COALESCE(NULLIF(trim(u.full_name), ''), u.email, 'Author'),
      'author_initials', upper(COALESCE(
        substr(NULLIF(trim(u.full_name), ''), 1, 1) ||
          substr(split_part(NULLIF(trim(u.full_name), ''), ' ', 2), 1, 1),
        substr(u.email, 1, 2),
        'AU'
      )),
      'author_tone', (ARRAY['brown','purple','warm','green','navy'])[
        1 + (abs(hashtext(ap.author_user_id::text)) % 5)
      ],
      'active_seats', ap.active_seats,
      'earned_ytd_cents', ap.earned_ytd_cents,
      'last_payout_date', ap.last_payout_date,
      'last_payout_amount_cents', ap.last_payout_amount_cents,
      'stripe_connect_status', ap.stripe_connect_status,
      'blueprint_count', (
        SELECT count(*) FROM public.blueprints b
        WHERE b.author_user_id = ap.author_user_id
          AND b.org_id = ap.org_id
          AND b.status <> 'archived'
      ),
      'blueprint_titles', COALESCE((
        SELECT jsonb_agg(b.title ORDER BY b.last_edited_at DESC)
        FROM public.blueprints b
        WHERE b.author_user_id = ap.author_user_id
          AND b.org_id = ap.org_id
          AND b.status <> 'archived'
      ), '[]'::jsonb)
    ) AS row_payload
    FROM public.org_author_payouts ap
    LEFT JOIN public.users u ON u.id = ap.author_user_id
    WHERE ap.org_id = p_org_id
  ) sub;

  SELECT COALESCE(SUM(earned_ytd_cents), 0) INTO v_paid_ytd_cents
  FROM public.org_author_payouts WHERE org_id = p_org_id;

  SELECT batch_total_cents, cleared_date, authors_paid
  INTO v_last_batch_cents, v_last_batch_date, v_last_batch_authors
  FROM public.org_payout_cycles
  WHERE org_id = p_org_id AND status = 'cleared'
  ORDER BY cleared_date DESC NULLS LAST
  LIMIT 1;

  SELECT
    batch_total_cents, scheduled_for, period_start, period_end,
    authors_paid, authors_total, active_seats, rebate_cents
  INTO
    v_pending_cents, v_pending_clears, v_upcoming_period_start, v_upcoming_period_end,
    v_upcoming_authors_paid, v_upcoming_authors_total, v_seats, v_upcoming_rebate_cents
  FROM public.org_payout_cycles
  WHERE org_id = p_org_id AND status IN ('scheduled','processing')
  ORDER BY scheduled_for ASC
  LIMIT 1;

  SELECT name INTO v_cohort_label
  FROM public.betterat_org_cohorts
  WHERE org_id = p_org_id ORDER BY created_at ASC LIMIT 1;

  RETURN jsonb_build_object(
    'authors', COALESCE(v_authors, '[]'::jsonb),
    'paid_ytd_cents', COALESCE(v_paid_ytd_cents, 0),
    'pending_cents', COALESCE(v_pending_cents, 0),
    'pending_clears', v_pending_clears,
    'last_batch_cents', COALESCE(v_last_batch_cents, 0),
    'last_batch_date', v_last_batch_date,
    'last_batch_authors', COALESCE(v_last_batch_authors, 0),
    'cohort_seats', COALESCE(v_seats, 0),
    'cohort_label', v_cohort_label,
    'upcoming_period_start', v_upcoming_period_start,
    'upcoming_period_end', v_upcoming_period_end,
    'upcoming_authors_paid', COALESCE(v_upcoming_authors_paid, 0),
    'upcoming_authors_total', COALESCE(v_upcoming_authors_total, 0),
    'upcoming_rebate_cents', COALESCE(v_upcoming_rebate_cents, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.admin_org_payouts(uuid) IS
  'Admin · Author payouts surface — author rows + org-level cycle aggregates.';
