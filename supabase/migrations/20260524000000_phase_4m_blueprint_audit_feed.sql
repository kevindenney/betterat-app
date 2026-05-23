-- Phase 4m · admin_blueprint_audit_feed
-- Read RPC that returns audit_events scoped to a single blueprint
-- (target_type='blueprint', target_id=<blueprint uuid>), gated by
-- is_org_admin_member. Mirrors admin_audit_feed but filters down.

CREATE OR REPLACE FUNCTION public.admin_blueprint_audit_feed(
  p_blueprint_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  occurred_at timestamptz,
  actor_user_id uuid,
  actor_name text,
  actor_initials text,
  actor_tone text,
  verb text,
  verb_label text,
  target_type text,
  target_id uuid,
  target_label text,
  description text,
  payload jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- Qualify both columns: `id` in the RETURNS TABLE shadows the
  -- column name in PL/pgSQL bodies, so an unqualified `id` was
  -- ambiguous (42702).
  SELECT b.org_id INTO v_org FROM public.blueprints b WHERE b.id = p_blueprint_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Blueprint not found' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT public.is_org_admin_member(v_org) THEN
    RAISE EXCEPTION 'Not authorized to view blueprint audit log'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.occurred_at,
    e.actor_user_id,
    COALESCE(NULLIF(trim(u.full_name), ''), u.email, 'System') AS actor_name,
    upper(COALESCE(
      substr(NULLIF(trim(u.full_name), ''), 1, 1) ||
        substr(split_part(NULLIF(trim(u.full_name), ''), ' ', 2), 1, 1),
      substr(u.email, 1, 2),
      'SY'
    )) AS actor_initials,
    (ARRAY['navy','brown','warm','green'])[
      1 + (abs(hashtext(COALESCE(e.actor_user_id::text, 'system'))) % 4)
    ] AS actor_tone,
    e.verb,
    e.verb_label,
    e.target_type,
    e.target_id,
    e.target_label,
    e.description,
    e.payload
  FROM public.audit_events e
  LEFT JOIN public.users u ON u.id = e.actor_user_id
  WHERE e.org_id = v_org
    AND e.target_type = 'blueprint'
    AND e.target_id = p_blueprint_id
  ORDER BY e.occurred_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.admin_blueprint_audit_feed(uuid, integer) IS
  'Audit log feed scoped to a single blueprint. SECURITY DEFINER + is_org_admin_member gate.';
