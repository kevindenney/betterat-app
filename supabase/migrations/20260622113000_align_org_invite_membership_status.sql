-- Keep organization_memberships.status and membership_status aligned when
-- accepting legacy organization_invites.
--
-- The previous respond_to_organization_invite conflict update promoted
-- status='active' but did not update membership_status. Existing pending or
-- rejected rows could therefore become split-status memberships that later UI
-- gates reject as stale/inconsistent.

CREATE OR REPLACE FUNCTION public.respond_to_organization_invite(
  p_invite_token text,
  p_decision text
)
RETURNS public.organization_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text := lower(trim(COALESCE(p_invite_token, '')));
  v_decision text := lower(trim(COALESCE(p_decision, '')));
  v_now timestamptz := now();
  v_user_id uuid := auth.uid();
  v_user_email text := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
  v_invite public.organization_invites;
  v_role text;
  v_membership_metadata jsonb;
  v_activation_allowed boolean := false;
  v_inviter_role text;
BEGIN
  IF v_token = '' THEN
    RAISE EXCEPTION 'Invite token is required.';
  END IF;

  IF v_decision NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Decision must be accepted or declined.';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.organization_invites oi
  WHERE lower(oi.invite_token) = v_token
  LIMIT 1
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found.';
  END IF;

  IF v_invite.status IN ('revoked', 'failed') THEN
    RAISE EXCEPTION 'Invite is no longer active.';
  END IF;

  IF v_invite.invitee_email IS NULL OR lower(trim(v_invite.invitee_email)) <> v_user_email THEN
    RAISE EXCEPTION 'Invite email does not match signed-in user.';
  END IF;

  IF v_invite.status IN ('accepted', 'declined') THEN
    IF v_invite.status = v_decision THEN
      RETURN v_invite;
    END IF;
    RAISE EXCEPTION 'Invite already responded to.';
  END IF;

  IF v_decision = 'accepted' THEN
    v_role := public.map_org_invite_role(v_invite.role_key, v_invite.role_label);
    v_inviter_role := public.get_org_membership_role(v_invite.organization_id, v_invite.invited_by);

    IF v_inviter_role IS NULL THEN
      RAISE EXCEPTION 'Invite issuer is no longer authorized.';
    END IF;

    IF NOT public.can_inviter_issue_org_invite_role(v_inviter_role, v_role) THEN
      RAISE EXCEPTION 'Invite role is not permitted for inviter role.';
    END IF;

    v_membership_metadata := jsonb_build_object(
      'accepted_invite_id', v_invite.id,
      'accepted_invite_token', v_invite.invite_token,
      'accepted_invite_role_label', v_invite.role_label,
      'accepted_invite_at', v_now,
      'resolved_target_role', v_role,
      'inviter_role_at_accept', v_inviter_role
    );

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
      v_invite.organization_id,
      v_user_id,
      v_role,
      'active',
      'active',
      true,
      'invite',
      v_now,
      v_now,
      v_membership_metadata
    )
    ON CONFLICT (organization_id, user_id)
    DO UPDATE
    SET
      role = CASE
        WHEN COALESCE(organization_memberships.membership_status, organization_memberships.status) IN ('pending', 'rejected')
          OR organization_memberships.status IN ('pending', 'invited', 'inactive', 'rejected')
          THEN EXCLUDED.role
        ELSE organization_memberships.role
      END,
      status = CASE
        WHEN COALESCE(organization_memberships.membership_status, organization_memberships.status) IN ('pending', 'rejected')
          OR organization_memberships.status IN ('pending', 'invited', 'inactive', 'rejected')
          THEN 'active'
        ELSE organization_memberships.status
      END,
      membership_status = CASE
        WHEN COALESCE(organization_memberships.membership_status, organization_memberships.status) IN ('pending', 'rejected')
          OR organization_memberships.status IN ('pending', 'invited', 'inactive', 'rejected')
          THEN 'active'
        ELSE organization_memberships.membership_status
      END,
      is_verified = CASE
        WHEN COALESCE(organization_memberships.membership_status, organization_memberships.status) IN ('pending', 'rejected')
          OR organization_memberships.status IN ('pending', 'invited', 'inactive', 'rejected')
          THEN true
        ELSE organization_memberships.is_verified
      END,
      verification_source = CASE
        WHEN COALESCE(organization_memberships.membership_status, organization_memberships.status) IN ('pending', 'rejected')
          OR organization_memberships.status IN ('pending', 'invited', 'inactive', 'rejected')
          THEN 'invite'
        ELSE organization_memberships.verification_source
      END,
      verified_at = CASE
        WHEN COALESCE(organization_memberships.membership_status, organization_memberships.status) IN ('pending', 'rejected')
          OR organization_memberships.status IN ('pending', 'invited', 'inactive', 'rejected')
          THEN v_now
        ELSE organization_memberships.verified_at
      END,
      joined_at = COALESCE(organization_memberships.joined_at, v_now),
      metadata = COALESCE(organization_memberships.metadata, '{}'::jsonb) || v_membership_metadata,
      updated_at = v_now
    RETURNING (
      status = 'active' AND membership_status = 'active'
    )
    INTO v_activation_allowed;

    IF NOT v_activation_allowed THEN
      RAISE EXCEPTION 'Membership activation failed.';
    END IF;
  END IF;

  UPDATE public.organization_invites oi
  SET
    status = v_decision,
    responded_at = COALESCE(oi.responded_at, v_now)
  WHERE oi.id = v_invite.id
  RETURNING *
  INTO v_invite;

  RETURN v_invite;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_organization_invite(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_organization_invite(text, text) TO authenticated;

COMMENT ON FUNCTION public.respond_to_organization_invite(text, text) IS
  'Authenticated invite response. Accepting aligns status and membership_status to active and revalidates inviter role authority.';
