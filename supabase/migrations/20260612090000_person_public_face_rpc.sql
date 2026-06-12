-- Person public face: real data for the concept / capabilities / circle
-- sections on the person calling card + public face.
--
-- 1. Formalize the descriptor columns that exist on the remote dev DB but
--    had no local migration (sailing_position et al — read on 3 surfaces).
-- 2. get_person_public_face(target_user_id): single SECURITY DEFINER round
--    trip returning JSON for the three sections, with privacy centralized.
--    The step-visibility predicate mirrors the dominant timeline_steps RLS
--    paths (owner, collaborator, follower-with-sharing). Narrower than full
--    RLS (no co-subscriber/faculty reach) — under-showing is privacy-safe.

-- ---------------------------------------------------------------------------
-- 1. Descriptor columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sailing_position TEXT,
  ADD COLUMN IF NOT EXISTS sailing_class TEXT,
  ADD COLUMN IF NOT EXISTS sailing_location TEXT,
  ADD COLUMN IF NOT EXISTS sailing_club TEXT,
  ADD COLUMN IF NOT EXISTS seasons_active INTEGER;

-- ---------------------------------------------------------------------------
-- 2. Step-visibility helper shared by the RPC's sub-sections
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.person_step_visible_to(
  p_viewer UUID,
  p_step_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.timeline_steps ts
    WHERE ts.id = p_step_id
      AND (
        ts.user_id = p_viewer
        OR p_viewer::text = ANY (COALESCE(ts.collaborator_user_ids, '{}'))
        OR (
          ts.visibility IN ('crew', 'fleet', 'public')
          AND EXISTS (
            SELECT 1 FROM public.user_follows uf
            WHERE uf.follower_id = p_viewer
              AND uf.following_id = ts.user_id
          )
          AND EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id = ts.user_id
              AND pr.allow_follower_sharing = true
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.person_step_visible_to(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.person_step_visible_to(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_person_public_face
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_person_public_face(
  target_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := (SELECT auth.uid());
  v_is_self BOOLEAN;
  v_concept JSONB;
  v_capabilities JSONB;
  v_circle JSONB;
BEGIN
  IF v_viewer IS NULL THEN
    RETURN jsonb_build_object('concept', NULL, 'capabilities', '[]'::jsonb, 'circle', NULL);
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
  -- Rollup buckets: settled (confirmed + strong), working (confirmed),
  -- emerging (unconfirmed) — strongest bucket wins per capability name.
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

  RETURN jsonb_build_object(
    'concept', v_concept,
    'capabilities', v_capabilities,
    'circle', v_circle
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_person_public_face(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_person_public_face(UUID) TO authenticated;
