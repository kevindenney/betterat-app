-- Add `interests` to the public-face RPC.
--
-- The public Person face needs the viewed person's interests to render an
-- identity layer for non-sailing personas (sailors get sailing_* columns;
-- everyone else had a blank hero + no "where" block). RLS on user_interests
-- only lets a person read their OWN rows, so the client cannot fetch a peer's
-- interests directly. This SECURITY DEFINER RPC is the established gateway for
-- everything publicly visible about a person, so the interest list belongs
-- here. Only active, public-catalog interests are exposed (user-proposed /
-- private interests are withheld).

CREATE OR REPLACE FUNCTION public.get_person_public_face(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_viewer UUID := (SELECT auth.uid());
  v_is_self BOOLEAN;
  v_concept JSONB;
  v_capabilities JSONB;
  v_circle JSONB;
  v_interests JSONB;
BEGIN
  IF v_viewer IS NULL THEN
    RETURN jsonb_build_object('concept', NULL, 'capabilities', '[]'::jsonb, 'circle', NULL, 'interests', '[]'::jsonb);
  END IF;

  v_is_self := (v_viewer = target_user_id);

  -- Concept: newest active (non-settled) personal concept. Shown to other
  -- viewers only when at least one linked step is visible to them.
  SELECT jsonb_build_object(
    'id', pc.id,
    'title', pc.title,
    'body', LEFT(COALESCE(NULLIF(TRIM(pc.body), ''), pc.body_md), 600),
    'state', pc.state,
    'createdAt', pc.created_at,
    'weekTail', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (now() - pc.created_at)) / 604800)::int),
    'linkedStepCount', (
      SELECT COUNT(*) FROM public.step_concept_links scl WHERE scl.concept_id = pc.id
    ),
    'settledCount', (
      SELECT COUNT(*) FROM public.playbook_concepts s
      WHERE s.user_id = target_user_id AND s.state = 'settled'
    )
  )
  INTO v_concept
  FROM public.playbook_concepts pc
  WHERE pc.user_id = target_user_id
    AND pc.state IN ('forming', 'testing')
    AND (
      v_is_self
      OR EXISTS (
        SELECT 1
        FROM public.step_concept_links scl
        WHERE scl.concept_id = pc.id
          AND public.person_step_visible_to(v_viewer, scl.step_id)
      )
    )
  ORDER BY pc.created_at DESC
  LIMIT 1;

  -- Capabilities: aggregate evidence on the target's visible steps.
  SELECT COALESCE(jsonb_agg(cap ORDER BY
      CASE cap->>'standing' WHEN 'settled' THEN 0 WHEN 'working' THEN 1 ELSE 2 END,
      (cap->>'evidenceCount')::int DESC), '[]'::jsonb)
  INTO v_capabilities
  FROM (
    SELECT jsonb_build_object(
      'name', sce.capability_name,
      'standing', CASE
        WHEN bool_or(sce.confirmed AND sce.strength = 'strong') THEN 'settled'
        WHEN bool_or(sce.confirmed) THEN 'working'
        ELSE 'emerging'
      END,
      'evidenceCount', COUNT(*),
      'pipLevel', MAX(sce.pip_level),
      'lastConfirmedAt', MAX(sce.confirmed_at)
    ) AS cap
    FROM public.step_capability_evidence sce
    JOIN public.timeline_steps ts ON ts.id = sce.step_id
    WHERE ts.user_id = target_user_id
      AND (v_is_self OR public.person_step_visible_to(v_viewer, ts.id))
    GROUP BY sce.capability_name
  ) caps;

  -- Circle: mutual follows + the target's active crew.
  SELECT jsonb_build_object(
    'mutuals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'userId', m.id,
        'name', m.display_name,
        'avatarUrl', m.avatar_url
      ))
      FROM (
        SELECT p.id,
               COALESCE(NULLIF(TRIM(p.full_name), ''), 'Sailor') AS display_name,
               u.avatar_url
        FROM public.user_follows f1
        JOIN public.user_follows f2
          ON f2.follower_id = f1.following_id
         AND f2.following_id = target_user_id
        JOIN public.profiles p ON p.id = f1.following_id
        LEFT JOIN public.users u ON u.id = p.id
        WHERE f1.follower_id = target_user_id
        ORDER BY p.full_name
        LIMIT 12
      ) m
    ), '[]'::jsonb),
    'mutualCount', (
      SELECT COUNT(*)
      FROM public.user_follows f1
      JOIN public.user_follows f2
        ON f2.follower_id = f1.following_id
       AND f2.following_id = target_user_id
      WHERE f1.follower_id = target_user_id
    ),
    'crew', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'userId', c.user_id,
        'name', c.display_name,
        'avatarUrl', c.avatar_url,
        'role', c.role,
        'isPrimary', c.is_primary
      ))
      FROM (
        SELECT cm.user_id,
               COALESCE(NULLIF(TRIM(p.full_name), ''), NULLIF(TRIM(cm.name), ''), 'Crew') AS display_name,
               u.avatar_url,
               cm.role,
               COALESCE(cm.is_primary, false) AS is_primary
        FROM public.crew_members cm
        LEFT JOIN public.profiles p ON p.id = cm.user_id
        LEFT JOIN public.users u ON u.id = cm.user_id
        WHERE cm.sailor_id = target_user_id
          AND cm.status = 'active'
        ORDER BY cm.is_primary DESC NULLS LAST, cm.name
        LIMIT 12
      ) c
    ), '[]'::jsonb),
    'crewCount', (
      SELECT COUNT(*) FROM public.crew_members cm
      WHERE cm.sailor_id = target_user_id AND cm.status = 'active'
    )
  )
  INTO v_circle;

  -- Interests: the target's active, public-catalog interests, primary first
  -- then by the person's own ordering. The viewer's own RLS cannot read
  -- another person's user_interests, so we surface them here (definer rights)
  -- and withhold inactive / non-public / user-proposed interests.
  SELECT COALESCE(
    jsonb_agg(elem.obj ORDER BY elem.is_primary DESC, elem.sort_order ASC, elem.name ASC),
    '[]'::jsonb
  )
  INTO v_interests
  FROM (
    SELECT jsonb_build_object('name', i.name, 'slug', i.slug) AS obj,
           COALESCE(ui.is_primary, false) AS is_primary,
           COALESCE(ui.sort_order, 2147483647) AS sort_order,
           i.name AS name
    FROM public.user_interests ui
    JOIN public.interests i ON i.id = ui.interest_id
    WHERE ui.user_id = target_user_id
      AND COALESCE(ui.is_active, true) = true
      AND i.status = 'active'
      AND i.visibility = 'public'
  ) elem;

  RETURN jsonb_build_object(
    'concept', v_concept,
    'capabilities', v_capabilities,
    'circle', v_circle,
    'interests', v_interests
  );
END;
$function$;
