-- get_blueprint_titles resolved only System-A timeline_blueprints, so the
-- Watch tab's "From blueprints" group headers were blank for institutional /
-- marketplace blueprints (whose ids live in public.blueprints and reach the
-- feed via timeline_steps.metadata.blueprint_id). Union both blueprint tables;
-- timeline_blueprints wins on the (extremely unlikely) id collision.

CREATE OR REPLACE FUNCTION public.get_blueprint_titles(p_ids uuid[])
 RETURNS TABLE(id uuid, title text, slug text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.id, b.title, b.slug
  FROM timeline_blueprints b
  WHERE b.id = ANY(p_ids)
  UNION
  SELECT b.id, b.title, b.slug
  FROM blueprints b
  WHERE b.id = ANY(p_ids)
    AND NOT EXISTS (
      SELECT 1 FROM timeline_blueprints t WHERE t.id = b.id
    );
$function$;
