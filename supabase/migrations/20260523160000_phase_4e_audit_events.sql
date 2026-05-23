-- Phase 4e · audit_events
-- SOC 2-style audit trail for org admin actions. Read via SECURITY DEFINER
-- RPC gated by is_org_admin_member. Writes happen at admin-action sites
-- (invite send, role change, blueprint publish, site claim, SSO config edit,
-- cohort edit).

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verb text NOT NULL CHECK (verb IN (
    'role_changed', 'published', 'invited', 'edited', 'claimed', 'removed',
    'sso_config', 'cohort_edit', 'blueprint_publish', 'site_claim',
    'membership_added', 'membership_removed', 'login', 'config_change'
  )),
  verb_label text NOT NULL,
  target_type text,
  target_id uuid,
  target_label text,
  description text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_org_occurred
  ON public.audit_events(org_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor
  ON public.audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_verb
  ON public.audit_events(verb);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_events_admin_read" ON public.audit_events;
CREATE POLICY "audit_events_admin_read"
  ON public.audit_events FOR SELECT
  USING (public.is_org_admin_member(org_id));

CREATE OR REPLACE FUNCTION public.admin_audit_feed(
  p_org_id uuid,
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
  payload jsonb,
  ip text,
  user_agent text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to view audit log'
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
    e.payload,
    e.ip,
    e.user_agent
  FROM public.audit_events e
  LEFT JOIN public.users u ON u.id = e.actor_user_id
  WHERE e.org_id = p_org_id
  ORDER BY e.occurred_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.admin_audit_feed(uuid, integer) IS
  'Org admin audit log feed. SECURITY DEFINER + is_org_admin_member gate.';

CREATE OR REPLACE FUNCTION public.audit_log_event(
  p_org_id uuid,
  p_verb text,
  p_verb_label text,
  p_description text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_target_label text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL OR NOT public.is_org_active_member(p_org_id) THEN
    RAISE EXCEPTION 'Not authorized to write audit event'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.audit_events
    (org_id, actor_user_id, verb, verb_label, target_type, target_id, target_label, description, payload)
  VALUES
    (p_org_id, v_actor, p_verb, p_verb_label, p_target_type, p_target_id, p_target_label, p_description, p_payload)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.audit_log_event(uuid, text, text, text, text, uuid, text, jsonb) IS
  'Insert an audit_events row. Caller must be an active org member.';
