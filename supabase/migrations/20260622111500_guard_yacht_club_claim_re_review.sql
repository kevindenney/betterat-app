-- Prevent re-reviewing yacht-club claims after a decision.
--
-- review_org_verification_request already rejects non-pending rows. The
-- yacht-club claim review RPC did not, so a previously approved claim could
-- later be rejected and flip the organization back to placeholder while the
-- claimant's admin membership remained active.

CREATE OR REPLACE FUNCTION public.review_organization_claim(
  p_claim_id uuid,
  p_decision text,
  p_review_note text DEFAULT NULL
)
RETURNS public.organization_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.organization_claims%ROWTYPE;
BEGIN
  IF NOT public.is_betterat_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin required';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'needs_more_info') THEN
    RAISE EXCEPTION 'Invalid claim decision: %', p_decision;
  END IF;

  SELECT * INTO v_claim
  FROM public.organization_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  IF v_claim.status <> 'pending' THEN
    RAISE EXCEPTION 'Claim already decided: %', v_claim.status;
  END IF;

  UPDATE public.organization_claims
  SET status = p_decision,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note,
      updated_at = now()
  WHERE id = p_claim_id
  RETURNING * INTO v_claim;

  IF p_decision = 'approved' THEN
    UPDATE public.organizations
    SET claim_status = 'claimed',
        official = true,
        status = 'active',
        pricing_tier = COALESCE(NULLIF(pricing_tier, ''), 'club_free'),
        updated_at = now()
    WHERE id = v_claim.organization_id;

    INSERT INTO public.organization_memberships (
      organization_id,
      user_id,
      role,
      status,
      membership_status,
      is_verified,
      verification_source,
      verified_at,
      joined_at,
      metadata
    )
    VALUES (
      v_claim.organization_id,
      v_claim.submitted_by_user_id,
      'admin',
      'active',
      'active',
      true,
      'admin',
      now(),
      now(),
      jsonb_build_object(
        'claim_id', v_claim.id,
        'claimant_role', v_claim.claimant_role,
        'verification_source', 'yacht_club_claim'
      )
    )
    ON CONFLICT DO NOTHING;
  ELSIF p_decision = 'rejected' THEN
    UPDATE public.organizations
    SET claim_status = 'rejected',
        official = false,
        status = 'placeholder',
        updated_at = now()
    WHERE id = v_claim.organization_id;
  END IF;

  RETURN v_claim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_organization_claim(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.review_organization_claim(uuid, text, text) IS
  'Platform-admin review of yacht-club organization claims. Only pending claims can be reviewed; approvals activate the org and grant admin membership.';
