-- can_subscribe_to_blueprint gated subscription INSERTs on is_published, with no
-- exception for the blueprint's author. The Get Inspired flow builds a blueprint
-- as a draft (is_published = false) and then auto-subscribes the creator to it,
-- so that auto-subscribe always 403'd ("Subscribe to blueprints" WITH CHECK calls
-- this function). An author must be able to subscribe to their own blueprint
-- regardless of publish state; everyone else still needs it published + accessible.
--
-- Note: auth.uid() reads the request JWT claims, so it returns the *calling* user
-- even though this function is SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.can_subscribe_to_blueprint(p_blueprint_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_access_level text;
  v_org_id uuid;
  v_is_published boolean;
  v_owner uuid;
BEGIN
  SELECT access_level, organization_id, is_published, user_id
  INTO v_access_level, v_org_id, v_is_published, v_owner
  FROM timeline_blueprints
  WHERE id = p_blueprint_id;

  IF NOT FOUND THEN RETURN false; END IF;

  -- Author can always subscribe to their own blueprint, even as a draft.
  IF v_owner = (SELECT auth.uid()) THEN RETURN true; END IF;

  IF NOT v_is_published THEN RETURN false; END IF;
  IF v_access_level = 'public' THEN RETURN true; END IF;
  IF v_access_level IN ('org_members', 'paid') THEN
    RETURN is_org_active_member(v_org_id);
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_subscribe_to_blueprint(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_subscribe_to_blueprint(uuid) TO authenticated;
