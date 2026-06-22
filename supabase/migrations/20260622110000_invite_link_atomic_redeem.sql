-- Make invite-link redemption claim max-use capacity atomically.
--
-- The original redeem_invite_link implementation checked max_uses before
-- membership writes, then incremented uses_count at the end. Concurrent
-- redeems could both pass the pre-check and overrun max_uses. This version
-- validates revoked/expired state first, then claims a use with one guarded
-- UPDATE ... RETURNING before any membership side effects.

CREATE OR REPLACE FUNCTION public.redeem_invite_link(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.org_invite_links%ROWTYPE;
  v_claimed_link public.org_invite_links%ROWTYPE;
  v_uid uuid;
  v_role text;
  v_existing_membership uuid;
BEGIN
  v_uid := (SELECT auth.uid());
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to redeem an invite link'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_link FROM public.org_invite_links WHERE token = p_token;
  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Invite link not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_link.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite link has been revoked.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RAISE EXCEPTION 'This invite link has expired.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.org_invite_links
    SET uses_count = uses_count + 1
    WHERE id = v_link.id
      AND (max_uses IS NULL OR uses_count < max_uses)
    RETURNING * INTO v_claimed_link;

  IF v_claimed_link.id IS NULL THEN
    RAISE EXCEPTION 'This invite link has no remaining uses.' USING ERRCODE = 'check_violation';
  END IF;

  v_link := v_claimed_link;

  v_role := CASE v_link.role_key
    WHEN 'admin'     THEN 'admin'
    WHEN 'faculty'   THEN 'faculty'
    WHEN 'preceptor' THEN 'preceptor'
    ELSE 'member'
  END;

  SELECT id INTO v_existing_membership
  FROM public.organization_memberships
  WHERE organization_id = v_link.org_id AND user_id = v_uid;

  IF v_existing_membership IS NULL THEN
    INSERT INTO public.organization_memberships
      (organization_id, user_id, role, status, membership_status, is_verified, joined_at, metadata)
    VALUES
      (v_link.org_id, v_uid, v_role, 'active', 'active', true, now(),
       jsonb_build_object('source', 'invite_link', 'token', v_link.token));
  ELSE
    UPDATE public.organization_memberships
      SET membership_status = 'active', status = 'active',
          joined_at = COALESCE(joined_at, now()),
          updated_at = now(),
          metadata = COALESCE(metadata, '{}'::jsonb)
                       || jsonb_build_object('last_redeemed_link', v_link.token)
      WHERE id = v_existing_membership;
  END IF;

  IF v_link.cohort_id IS NOT NULL THEN
    INSERT INTO public.betterat_org_cohort_members (cohort_id, user_id, role)
    SELECT v_link.cohort_id, v_uid, v_role
    WHERE NOT EXISTS (
      SELECT 1 FROM public.betterat_org_cohort_members
      WHERE cohort_id = v_link.cohort_id AND user_id = v_uid
    );
  END IF;

  BEGIN
    INSERT INTO public.audit_events
      (org_id, actor_user_id, verb, verb_label, target_type, target_id, target_label, description, payload)
    VALUES
      (v_link.org_id, v_uid, 'membership_added', 'Redeemed invite link',
       'invite_link', v_link.id, v_link.label,
       'A user redeemed an invite link.',
       jsonb_build_object('token', v_link.token, 'role', v_role, 'cohort_id', v_link.cohort_id));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'org_id', v_link.org_id,
    'role', v_role,
    'cohort_id', v_link.cohort_id,
    'already_member', v_existing_membership IS NOT NULL
  );
END;
$$;

COMMENT ON FUNCTION public.redeem_invite_link(text) IS
  'Authenticated redemption: atomically claims invite-link capacity, idempotently joins the caller to the org+cohort encoded in the link, emits audit.';
