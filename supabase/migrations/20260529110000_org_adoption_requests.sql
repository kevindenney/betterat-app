-- Create-org flow slice 4A — adoption + carryover
-- See docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md (sections "Adoption handoff"
-- and "Blueprint carryover").
--
-- A verified org admin proposes adoption of a user-created org. The founder
-- (target admin) accepts or declines. On accept: target gets parent_org_id,
-- adopted_at, flips to verified+claimed; every blueprint under target gets
-- adopted_at stamped (the "Carried over" pill flag).

-- 1. Table.
CREATE TABLE IF NOT EXISTS public.org_adoption_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_parent_org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_org_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending'::text,
      'accepted'::text,
      'declined'::text,
      'withdrawn'::text
    ])),
  message text,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT org_adoption_requests_distinct_orgs
    CHECK (proposed_parent_org_id <> target_org_id)
);

-- A target org can have at most one pending request at a time. Withdrawn /
-- declined / accepted rows remain for history.
CREATE UNIQUE INDEX IF NOT EXISTS org_adoption_requests_one_pending_per_target
  ON public.org_adoption_requests (target_org_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS org_adoption_requests_target_admin_idx
  ON public.org_adoption_requests (target_admin_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS org_adoption_requests_proposer_idx
  ON public.org_adoption_requests (proposed_by, created_at DESC);

-- 2. RLS.
ALTER TABLE public.org_adoption_requests ENABLE ROW LEVEL SECURITY;

-- Target admin: any active admin/owner/manager of the target org sees
-- requests aimed at their org.
CREATE POLICY org_adoption_requests_target_admin_select
  ON public.org_adoption_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = org_adoption_requests.target_org_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role IN ('owner', 'admin', 'manager')
        AND COALESCE(m.membership_status, m.status) = 'active'
    )
  );

-- Proposer: anyone who proposed sees their own.
CREATE POLICY org_adoption_requests_proposer_select
  ON public.org_adoption_requests
  FOR SELECT
  TO authenticated
  USING (proposed_by = (SELECT auth.uid()));

-- Platform admin can see everything for diagnostics.
CREATE POLICY org_adoption_requests_admin_select
  ON public.org_adoption_requests
  FOR SELECT
  TO authenticated
  USING (public.is_betterat_platform_admin());

-- Writes go through RPCs (no INSERT or UPDATE policies — SECURITY DEFINER
-- bypasses RLS while enforcing checks in function body).

-- 3. Propose RPC. Verified-parent admin opens an adoption request.
CREATE OR REPLACE FUNCTION public.propose_org_adoption(
  p_parent_org_id uuid,
  p_target_org_id uuid,
  p_message text DEFAULT NULL
)
RETURNS public.org_adoption_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.organizations%ROWTYPE;
  v_target public.organizations%ROWTYPE;
  v_target_admin uuid;
  v_caller uuid;
  v_request public.org_adoption_requests%ROWTYPE;
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  IF p_parent_org_id = p_target_org_id THEN
    RAISE EXCEPTION 'Parent and target must differ';
  END IF;

  SELECT * INTO v_parent FROM public.organizations WHERE id = p_parent_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent org not found';
  END IF;
  IF v_parent.official IS NOT TRUE THEN
    RAISE EXCEPTION 'Only a verified (official) org can propose adoption';
  END IF;

  -- Caller must be admin/owner/manager of the parent.
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.organization_id = p_parent_org_id
      AND m.user_id = v_caller
      AND m.role IN ('owner', 'admin', 'manager')
      AND COALESCE(m.membership_status, m.status) = 'active'
  ) THEN
    RAISE EXCEPTION 'You must admin the parent org';
  END IF;

  SELECT * INTO v_target FROM public.organizations WHERE id = p_target_org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target org not found';
  END IF;
  IF v_target.parent_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'Target is already under a parent';
  END IF;
  IF v_target.claim_status = 'claimed' AND v_target.official IS TRUE THEN
    RAISE EXCEPTION 'Target is already verified and cannot be adopted';
  END IF;

  -- Pick the first active admin of the target as the consent owner.
  -- The target org might have several admins; any of them can decide.
  SELECT m.user_id INTO v_target_admin
  FROM public.organization_memberships m
  WHERE m.organization_id = p_target_org_id
    AND m.role IN ('owner', 'admin')
    AND COALESCE(m.membership_status, m.status) = 'active'
  ORDER BY
    CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END,
    m.created_at ASC
  LIMIT 1;

  INSERT INTO public.org_adoption_requests (
    proposed_parent_org_id,
    target_org_id,
    proposed_by,
    target_admin_user_id,
    message,
    status
  )
  VALUES (
    p_parent_org_id,
    p_target_org_id,
    v_caller,
    v_target_admin,
    p_message,
    'pending'
  )
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.propose_org_adoption(uuid, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION public.propose_org_adoption(uuid, uuid, text) IS
  'Verified-parent admin proposes adoption of a user-created org. Target admin decides via decide_org_adoption.';

-- 4. Decide RPC. Target admin accepts or declines.
CREATE OR REPLACE FUNCTION public.decide_org_adoption(
  p_request_id uuid,
  p_decision text,
  p_decision_notes text DEFAULT NULL
)
RETURNS public.org_adoption_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.org_adoption_requests%ROWTYPE;
  v_caller uuid;
  v_now timestamptz := now();
BEGIN
  v_caller := (SELECT auth.uid());
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  IF p_decision NOT IN ('accepted', 'declined', 'withdrawn') THEN
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  SELECT * INTO v_request
  FROM public.org_adoption_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Adoption request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already decided: %', v_request.status;
  END IF;

  -- Auth: only the proposer can withdraw; only a target-org admin can
  -- accept or decline. Platform admins are allowed for safety overrides.
  IF p_decision = 'withdrawn' THEN
    IF v_request.proposed_by <> v_caller
       AND NOT public.is_betterat_platform_admin() THEN
      RAISE EXCEPTION 'Only the proposer can withdraw';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = v_request.target_org_id
        AND m.user_id = v_caller
        AND m.role IN ('owner', 'admin', 'manager')
        AND COALESCE(m.membership_status, m.status) = 'active'
    ) AND NOT public.is_betterat_platform_admin() THEN
      RAISE EXCEPTION 'Only a target-org admin can accept or decline';
    END IF;
  END IF;

  UPDATE public.org_adoption_requests
  SET status = p_decision,
      decision_notes = p_decision_notes,
      decided_by = v_caller,
      decided_at = v_now
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF p_decision = 'accepted' THEN
    -- Flip target to verified, under parent.
    UPDATE public.organizations
    SET parent_org_id = v_request.proposed_parent_org_id,
        adopted_at = v_now,
        official = true,
        claim_status = 'claimed',
        creation_source = 'verified',
        status = CASE WHEN status = 'archived' THEN 'active' ELSE status END,
        is_active = true,
        updated_at = v_now
    WHERE id = v_request.target_org_id;

    -- Carryover stamp on all blueprints under the target. Already-stamped
    -- rows (re-adoption edge case) are left alone.
    UPDATE public.blueprints
    SET adopted_at = v_now,
        updated_at = v_now
    WHERE org_id = v_request.target_org_id
      AND adopted_at IS NULL;
  END IF;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_org_adoption(uuid, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.decide_org_adoption(uuid, text, text) IS
  'Target admin (or proposer for withdraw) decides an adoption request. On accept: flips target to verified+under-parent and stamps blueprint carryover.';
