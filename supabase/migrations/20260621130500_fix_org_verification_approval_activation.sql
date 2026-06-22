-- Fix org verification approval to activate approved placeholders.
--
-- Existing review_org_verification_request marks the organization official and
-- claimed, but leaves status='placeholder' unless the org had been archived.
-- For institution request intake, approval should promote the org to a live
-- active org record.

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
    UPDATE public.organizations
    SET official = true,
        claim_status = 'claimed',
        creation_source = 'verified',
        adopted_at = COALESCE(adopted_at, now()),
        status = CASE
          WHEN status IN ('placeholder', 'archived') THEN 'active'
          ELSE status
        END,
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
  'Platform-admin review of org verification requests. On approve: flips org official+claimed+verified and activates approved placeholders.';
