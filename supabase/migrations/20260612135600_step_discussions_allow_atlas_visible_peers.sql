-- Allow comments on peer-owned personal steps that are already visible/openable
-- through Atlas. Previously can_access_step_discussion only allowed the owner
-- and explicit collaborators, so a follower/fleet peer could open a shared
-- Atlas step but posting in Discuss failed with RLS 42501.
--
-- The Atlas RPC is the existing authority for "this viewer may see this step
-- location"; discussion access now reuses that for the current authenticated
-- viewer. The owner + explicit collaborator paths remain unchanged.

CREATE OR REPLACE FUNCTION public.can_access_step_discussion(p_step_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.timeline_steps ts
     WHERE ts.id = p_step_id
       AND (ts.user_id = p_user_id OR p_user_id::text = ANY(ts.collaborator_user_ids))
  )
  OR EXISTS (
    SELECT 1
      FROM public.step_collaborators sc
     WHERE sc.step_id = p_step_id
       AND sc.user_id = p_user_id
  )
  OR (
    p_user_id = (SELECT auth.uid())
    AND public.atlas_can_view_step_location(p_step_id)
  );
$function$;

-- Notify the step owner and explicit platform collaborators when someone posts
-- on a personal step. This intentionally does not notify every public/follower
-- viewer, only the people attached to the step plus the owner.
CREATE OR REPLACE FUNCTION public.notify_collaborators_on_personal_step_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id    uuid;
  v_step_title  text;
  v_author_name text;
  rec RECORD;
BEGIN
  IF NEW.step_id IS NULL OR NEW.blueprint_step_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT ts.user_id, ts.title
  INTO v_owner_id, v_step_title
  FROM public.timeline_steps ts
  WHERE ts.id = NEW.step_id;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_author_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  v_author_name := COALESCE(NULLIF(TRIM(v_author_name), ''), 'Someone');

  FOR rec IN
    SELECT DISTINCT recipient_user_id
    FROM (
      SELECT v_owner_id AS recipient_user_id
      UNION
      SELECT sc.user_id AS recipient_user_id
        FROM public.step_collaborators sc
       WHERE sc.step_id = NEW.step_id
      UNION
      SELECT (c->>'user_id')::uuid AS recipient_user_id
        FROM public.timeline_steps ts,
             jsonb_array_elements(
               COALESCE(ts.metadata->'plan'->'collaborators', '[]'::jsonb)
             ) AS c
       WHERE ts.id = NEW.step_id
         AND c->>'type' = 'platform'
         AND c->>'user_id' IS NOT NULL
         AND c->>'user_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) AS recipients
    WHERE recipient_user_id IS NOT NULL
      AND recipient_user_id <> NEW.user_id
  LOOP
    INSERT INTO public.social_notifications
      (user_id, type, actor_id, title, body, data, is_read, created_at)
    VALUES (
      rec.recipient_user_id,
      'step_discussion_post',
      NEW.user_id,
      v_author_name || ' posted on a shared step',
      COALESCE(NULLIF(TRIM(v_step_title), ''), 'Shared step'),
      jsonb_build_object(
        'step_discussion_id', NEW.id,
        'step_id',            NEW.step_id
      ),
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_collaborators_on_personal_step_post ON public.step_discussions;

CREATE TRIGGER trg_notify_collaborators_on_personal_step_post
  AFTER INSERT ON public.step_discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_collaborators_on_personal_step_post();

NOTIFY pgrst, 'reload schema';
