-- Honor the per-section / per-interaction visibility flags in the public-face
-- read path, and fix the un-gated practice-circle leak.
--
-- Section flags this RPC owns: show_working_on_now (concept), show_capabilities,
-- show_practice_circle. The remaining section flags live at other read sites
-- (timeline + events in usePersonPublicSections; orgs + blueprints on /person)
-- and are honored there. Self-view (v_is_self) bypasses every section flag so
-- the owner always previews their full face.
--
-- Also restores the `interests` key, which a prior CREATE OR REPLACE
-- (20260616120000_capability_evidence_quote) dropped, and adds an `interactions`
-- key so the client can hide the Follow / Message / Suggest / Reflect CTAs.
--
-- See docs/redesign/specs/PUBLIC_FACE_VISIBILITY_CONTROLS_SPEC.md.

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
  -- Section / interaction flags (NOT NULL columns; COALESCE guards a missing
  -- profiles row by falling back to the table-level defaults).
  v_show_working_on_now BOOLEAN;
  v_show_capabilities BOOLEAN;
  v_show_practice_circle BOOLEAN;
  v_allow_follow BOOLEAN;
  v_allow_message BOOLEAN;
  v_allow_suggest_step BOOLEAN;
  v_allow_reflect BOOLEAN;
BEGIN
  IF v_viewer IS NULL THEN
    RETURN jsonb_build_object(
      'concept', NULL,
      'capabilities', '[]'::jsonb,
      'circle', NULL,
      'interests', '[]'::jsonb,
      'interactions', NULL
    );
  END IF;

  v_is_self := (v_viewer = target_user_id);

  SELECT
    COALESCE(pr.show_working_on_now, true),
    COALESCE(pr.show_capabilities, true),
    COALESCE(pr.show_practice_circle, false),
    COALESCE(pr.allow_follow, true),
    COALESCE(pr.allow_message, true),
    COALESCE(pr.allow_suggest_step, true),
    COALESCE(pr.allow_reflect, true)
  INTO
    v_show_working_on_now,
    v_show_capabilities,
    v_show_practice_circle,
    v_allow_follow,
    v_allow_message,
    v_allow_suggest_step,
    v_allow_reflect
  FROM public.profiles pr
  WHERE pr.id = target_user_id;

  -- A missing profiles row leaves the locals NULL; fall back to defaults.
  v_show_working_on_now := COALESCE(v_show_working_on_now, true);
  v_show_capabilities := COALESCE(v_show_capabilities, true);
  v_show_practice_circle := COALESCE(v_show_practice_circle, false);
  v_allow_follow := COALESCE(v_allow_follow, true);
  v_allow_message := COALESCE(v_allow_message, true);
  v_allow_suggest_step := COALESCE(v_allow_suggest_step, true);
  v_allow_reflect := COALESCE(v_allow_reflect, true);

  -- Concept: newest active (non-settled) personal concept. Gated by the
  -- show_working_on_now section flag, then by per-step visibility for peers.
  IF v_is_self OR v_show_working_on_now THEN
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
  END IF;

  -- Capabilities: aggregate evidence on the target's visible steps. Gated by
  -- the show_capabilities section flag (the inner WHERE drops every row when a
  -- peer is not allowed to see the section, so COALESCE yields '[]').
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
      'lastConfirmedAt', MAX(sce.confirmed_at),
      'evidence', (array_agg(sce.evidence_quote ORDER BY
        CASE sce.strength WHEN 'strong' THEN 0 WHEN 'material' THEN 1 ELSE 2 END,
        sce.created_at DESC) FILTER (WHERE NULLIF(TRIM(sce.evidence_quote), '') IS NOT NULL))[1],
      'provenance', (array_agg(sce.evidence_provenance ORDER BY
        CASE sce.strength WHEN 'strong' THEN 0 WHEN 'material' THEN 1 ELSE 2 END,
        sce.created_at DESC) FILTER (WHERE NULLIF(TRIM(sce.evidence_quote), '') IS NOT NULL))[1]
    ) AS cap
    FROM public.step_capability_evidence sce
    JOIN public.timeline_steps ts ON ts.id = sce.step_id
    WHERE ts.user_id = target_user_id
      AND (v_is_self OR v_show_capabilities)
      AND (v_is_self OR public.person_step_visible_to(v_viewer, ts.id))
    GROUP BY sce.capability_name
  ) caps;

  -- Circle: mutual follows + the target's active crew. Gated by
  -- show_practice_circle — this is *second-party* data (other people's
  -- identities), so it is opt-in and was previously returned with no gate.
  IF v_is_self OR v_show_practice_circle THEN
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
  END IF;

  -- Interests: the target's active, public-catalog interests, primary first
  -- then by the person's own ordering. RLS on user_interests only lets a person
  -- read their own rows, so this definer-rights RPC is the only path for peers.
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
    'interests', v_interests,
    'interactions', jsonb_build_object(
      'allowFollow', v_allow_follow,
      'allowMessage', v_allow_message,
      'allowSuggestStep', v_allow_suggest_step,
      'allowReflect', v_allow_reflect
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_person_public_face(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_person_public_face(UUID) TO authenticated;
