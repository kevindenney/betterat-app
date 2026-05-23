-- Phase 4q · payouts stripe sync
-- Tracks when Stripe Connect status was last refreshed, per-author,
-- and surfaces a max() rollup via admin_org_payouts so the surface can
-- show "Stripe Connect last synced X ago".

ALTER TABLE public.org_author_payouts
  ADD COLUMN IF NOT EXISTS stripe_status_synced_at timestamptz;

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
  v_last_sync timestamptz;
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view org payouts'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', oap.id,
      'author_user_id', oap.author_user_id,
      'author_kind', oap.author_kind,
      'author_name', COALESCE(NULLIF(trim(u.full_name), ''), u.email, 'Author'),
      'author_initials', upper(COALESCE(
        substr(NULLIF(trim(u.full_name), ''), 1, 1) ||
          substr(split_part(NULLIF(trim(u.full_name), ''), ' ', 2), 1, 1),
        substr(u.email, 1, 2),
        'AU'
      )),
      'author_tone',
        (ARRAY['navy','brown','warm','green','purple'])[
          1 + (abs(hashtext(oap.author_user_id::text)) % 5)
        ],
      'active_seats', oap.active_seats,
      'earned_ytd_cents', oap.earned_ytd_cents,
      'last_payout_date', oap.last_payout_date,
      'last_payout_amount_cents', oap.last_payout_amount_cents,
      'stripe_connect_status', oap.stripe_connect_status,
      'stripe_connect_account_id', oap.stripe_connect_account_id,
      'stripe_status_synced_at', oap.stripe_status_synced_at,
      'blueprint_count', COALESCE(bp.cnt, 0),
      'blueprint_titles', COALESCE(bp.titles, '{}')
    )
    ORDER BY oap.earned_ytd_cents DESC
  ) INTO v_authors
  FROM public.org_author_payouts oap
  LEFT JOIN public.users u ON u.id = oap.author_user_id
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt, array_agg(b.title ORDER BY b.created_at) AS titles
    FROM public.blueprints b
    WHERE b.author_user_id = oap.author_user_id
      AND b.org_id = oap.org_id
  ) bp ON true
  WHERE oap.org_id = p_org_id;

  SELECT COALESCE(SUM(earned_ytd_cents), 0)::int INTO v_paid_ytd_cents
  FROM public.org_author_payouts WHERE org_id = p_org_id;

  SELECT batch_total_cents, scheduled_for INTO v_pending_cents, v_pending_clears
  FROM public.org_payout_cycles
  WHERE org_id = p_org_id AND status = 'scheduled'
  ORDER BY scheduled_for ASC NULLS LAST
  LIMIT 1;

  SELECT batch_total_cents, cleared_date, authors_paid
    INTO v_last_batch_cents, v_last_batch_date, v_last_batch_authors
  FROM public.org_payout_cycles
  WHERE org_id = p_org_id AND status IN ('cleared','processing')
  ORDER BY cleared_date DESC NULLS LAST, scheduled_for DESC
  LIMIT 1;

  SELECT
    COALESCE(SUM(coc.max_seats), 0),
    string_agg(coc.name, ', ' ORDER BY coc.name)
  INTO v_seats, v_cohort_label
  FROM public.betterat_org_cohorts coc
  WHERE coc.org_id = p_org_id;

  SELECT period_start, period_end, authors_paid, authors_total, rebate_cents
    INTO v_upcoming_period_start, v_upcoming_period_end,
         v_upcoming_authors_paid, v_upcoming_authors_total, v_upcoming_rebate_cents
  FROM public.org_payout_cycles
  WHERE org_id = p_org_id AND status = 'scheduled'
  ORDER BY scheduled_for ASC NULLS LAST
  LIMIT 1;

  SELECT max(stripe_status_synced_at) INTO v_last_sync
  FROM public.org_author_payouts WHERE org_id = p_org_id;

  RETURN jsonb_build_object(
    'authors', COALESCE(v_authors, '[]'::jsonb),
    'paid_ytd_cents', v_paid_ytd_cents,
    'pending_cents', COALESCE(v_pending_cents, 0),
    'pending_clears', v_pending_clears,
    'last_batch_cents', COALESCE(v_last_batch_cents, 0),
    'last_batch_date', v_last_batch_date,
    'last_batch_authors', COALESCE(v_last_batch_authors, 0),
    'cohort_seats', v_seats,
    'cohort_label', v_cohort_label,
    'upcoming_period_start', v_upcoming_period_start,
    'upcoming_period_end', v_upcoming_period_end,
    'upcoming_authors_paid', COALESCE(v_upcoming_authors_paid, 0),
    'upcoming_authors_total', COALESCE(v_upcoming_authors_total, 0),
    'upcoming_rebate_cents', COALESCE(v_upcoming_rebate_cents, 0),
    'stripe_status_synced_at', v_last_sync
  );
END;
$$;
