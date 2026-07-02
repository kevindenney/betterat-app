-- The blueprint Activity tab only read audit_events (author/admin edits), so a
-- subscriber completing a delivered step never appeared ("No activity yet" even
-- though Emily completed step 1). Institutional steps are per-user copies in
-- timeline_steps linked to the blueprint via source_id -> blueprint_step_templates.
-- UNION those completions in as synthetic activity rows.
CREATE OR REPLACE FUNCTION public.admin_blueprint_audit_feed(p_blueprint_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(
  id uuid,
  occurred_at timestamp with time zone,
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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT b.org_id INTO v_org FROM public.blueprints b WHERE b.id = p_blueprint_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Blueprint not found' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NOT public.is_org_admin_member(v_org) THEN
    RAISE EXCEPTION 'Not authorized to view blueprint audit log'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH audit_rows AS (
    SELECT
      e.id,
      e.occurred_at,
      e.actor_user_id,
      COALESCE(NULLIF(trim(u.full_name), ''), u.email, 'System') AS actor_name,
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
  ),
  completion_rows AS (
    SELECT
      ts.id,
      ts.completed_at AS occurred_at,
      ts.user_id AS actor_user_id,
      COALESCE(NULLIF(trim(u.full_name), ''), u.email, 'A learner') AS actor_name,
      'step_completed'::text AS verb,
      'Completed step'::text AS verb_label,
      'blueprint'::text AS target_type,
      p_blueprint_id AS target_id,
      ts.title AS target_label,
      ('Completed “' || COALESCE(ts.title, 'a step') || '”')::text AS description,
      NULL::jsonb AS payload
    FROM public.timeline_steps ts
    JOIN public.blueprint_step_templates t ON t.id = ts.source_id
    LEFT JOIN public.users u ON u.id = ts.user_id
    WHERE t.blueprint_id = p_blueprint_id
      AND ts.completed_at IS NOT NULL
  ),
  combined AS (
    SELECT * FROM audit_rows
    UNION ALL
    SELECT * FROM completion_rows
  )
  SELECT
    c.id,
    c.occurred_at,
    c.actor_user_id,
    c.actor_name,
    upper(COALESCE(
      substr(NULLIF(trim(c.actor_name), ''), 1, 1) ||
        substr(split_part(NULLIF(trim(c.actor_name), ''), ' ', 2), 1, 1),
      'SY'
    )) AS actor_initials,
    (ARRAY['navy','brown','warm','green'])[
      1 + (abs(hashtext(COALESCE(c.actor_user_id::text, 'system'))) % 4)
    ] AS actor_tone,
    c.verb,
    c.verb_label,
    c.target_type,
    c.target_id,
    c.target_label,
    c.description,
    c.payload
  FROM combined c
  ORDER BY c.occurred_at DESC
  LIMIT p_limit;
END;
$function$;
