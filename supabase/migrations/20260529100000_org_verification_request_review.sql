-- Create-org flow slice 3 — verification path
-- See docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md
--
-- Adds the platform-admin RLS surface and the review RPC for
-- org_verification_requests. Modeled on review_organization_claim
-- (20260525100000_dragonworlds_yacht_club_placeholders.sql:230).

-- 1. Platform-admin policies on the request queue.

DROP POLICY IF EXISTS org_verification_requests_admin_select
  ON public.org_verification_requests;
CREATE POLICY org_verification_requests_admin_select
  ON public.org_verification_requests
  FOR SELECT
  TO authenticated
  USING (public.is_betterat_platform_admin());

DROP POLICY IF EXISTS org_verification_requests_admin_update
  ON public.org_verification_requests;
CREATE POLICY org_verification_requests_admin_update
  ON public.org_verification_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_betterat_platform_admin())
  WITH CHECK (public.is_betterat_platform_admin());

-- 2. Review RPC. Admin-only via SECURITY DEFINER + internal check.
--    Approval flips the org to verified+claimed and stamps adopted_at.
--    Rejection just closes the request (org stays as-is — user can
--    submit again or wait for adoption).

CREATE OR REPLACE FUNCTION public.review_org_verification_request(
  p_request_id uuid,
  p_decision text,
  p_review_note text DEFAULT NULL
)
RETURNS public.org_verification_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.org_verification_requests%ROWTYPE;
BEGIN
  IF NOT public.is_betterat_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin required';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected', 'needs_info') THEN
    RAISE EXCEPTION 'Invalid verification decision: %', p_decision;
  END IF;

  SELECT * INTO v_request
  FROM public.org_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already decided: %', v_request.status;
  END IF;

  UPDATE public.org_verification_requests
  SET status = p_decision,
      reviewer_id = (SELECT auth.uid()),
      reviewer_notes = p_review_note,
      decided_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF p_decision = 'approved' THEN
    -- Flip the org to verified. If it was user-created, this is the
    -- "self-serve graduated to official" path; if it was a placeholder,
    -- this is the claim path. Either way: official + claimed + verified.
    UPDATE public.organizations
    SET official = true,
        claim_status = 'claimed',
        creation_source = 'verified',
        adopted_at = COALESCE(adopted_at, now()),
        status = CASE WHEN status = 'archived' THEN 'active' ELSE status END,
        is_active = true,
        updated_at = now()
    WHERE id = v_request.organization_id;
  END IF;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_org_verification_request(uuid, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.review_org_verification_request(uuid, text, text) IS
  'Platform-admin review of org verification requests. On approve: flips org official+claimed+verified, stamps adopted_at, unarchives if needed.';
