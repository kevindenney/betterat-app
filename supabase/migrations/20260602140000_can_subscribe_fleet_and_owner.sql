-- can_subscribe_to_blueprint: add the missing 'fleet' access level + owner case.
--
-- timeline_blueprints.access_level can be 'fleet', but the RLS gate function
-- only handled public/org_members/paid, so every fleet blueprint fell through
-- to RETURN false. The app-side checkBlueprintAccess() DOES allow fleet access,
-- so subscribing to a published fleet blueprint passed the app check then
-- 42501'd on the blueprint_subscriptions INSERT policy ("new row violates
-- row-level security policy"). This mirrors the app's fleet rule (open fleet or
-- active fleet_members row) and lets an owner subscribe to their own published
-- blueprint regardless of access level.

CREATE OR REPLACE FUNCTION public.can_subscribe_to_blueprint(p_blueprint_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_access_level text;
  v_org_id uuid;
  v_is_published boolean;
  v_fleet_id uuid;
  v_owner_id uuid;
  v_has_purchase boolean;
BEGIN
  SELECT access_level, organization_id, is_published, fleet_id, user_id
  INTO v_access_level, v_org_id, v_is_published, v_fleet_id, v_owner_id
  FROM timeline_blueprints
  WHERE id = p_blueprint_id;

  IF NOT FOUND OR NOT v_is_published THEN RETURN false; END IF;

  -- Owner can always subscribe to their own published blueprint.
  IF v_owner_id = (SELECT auth.uid()) THEN RETURN true; END IF;

  IF v_access_level = 'public' THEN RETURN true; END IF;

  IF v_access_level = 'org_members' THEN
    RETURN is_org_active_member(v_org_id);
  END IF;

  IF v_access_level = 'fleet' THEN
    -- No specific fleet => open to anyone; otherwise require active membership.
    IF v_fleet_id IS NULL THEN RETURN true; END IF;
    RETURN EXISTS (
      SELECT 1 FROM fleet_members
      WHERE fleet_id = v_fleet_id
        AND user_id = (SELECT auth.uid())
        AND status = 'active'
    );
  END IF;

  IF v_access_level = 'paid' THEN
    -- Allow if org member (free access for org members)
    IF v_org_id IS NOT NULL AND is_org_active_member(v_org_id) THEN
      RETURN true;
    END IF;
    -- Allow if user has completed purchase
    SELECT EXISTS (
      SELECT 1 FROM blueprint_purchases
      WHERE blueprint_id = p_blueprint_id
        AND buyer_id = (SELECT auth.uid())
        AND status = 'completed'
    ) INTO v_has_purchase;
    RETURN v_has_purchase;
  END IF;

  RETURN false;
END;
$function$;
