-- Close the shared-step enumeration + raw-metadata leak (audit #5b / P1).
--
-- The policy "Anyone can view publicly shared steps" granted SELECT on every row
-- where share_enabled = true, with no binding to the token. Any holder of the anon
-- key could `select * from timeline_steps where share_enabled` and pull every
-- shared step of every user — full metadata (brain_dump, private review sections,
-- plan.where_location coordinates, collaborator user_ids) plus the share tokens
-- themselves. The token was never a secret gate.
--
-- Replace it with a token-keyed SECURITY DEFINER RPC that returns only the
-- sanitized fields the public page renders, for a single valid token. Callers must
-- know the token; there is no way to enumerate.

CREATE OR REPLACE FUNCTION public.get_shared_step(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'title',        s.title,
    'status',       s.status,
    'category',     s.category,
    'starts_at',    s.starts_at,
    'ends_at',      s.ends_at,
    'completed_at', s.completed_at,
    'created_at',   s.created_at,
    'shared_at',    s.public_shared_at,
    'creator_name', p.full_name,
    'interest_name', i.name,
    -- Only plan/act/review are surfaced, and plan is stripped of collaborator
    -- user_ids, precise coordinates, and the private brain-dump before leaving
    -- the database. The public page renders nothing else.
    'metadata', jsonb_build_object(
      'plan',
        ((COALESCE(s.metadata->'plan', '{}'::jsonb) - 'collaborators' - 'where_location' - 'brain_dump')
          || jsonb_build_object(
               'collaborators',
               (SELECT COALESCE(jsonb_agg(jsonb_build_object('display_name', c->>'display_name')), '[]'::jsonb)
                  FROM jsonb_array_elements(COALESCE(s.metadata->'plan'->'collaborators', '[]'::jsonb)) c)
             )),
      'act',    COALESCE(s.metadata->'act', '{}'::jsonb),
      'review', COALESCE(s.metadata->'review', '{}'::jsonb)
    )
  )
  FROM public.timeline_steps s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.interests i ON i.id = s.interest_id
  WHERE s.share_token = p_token
    AND s.share_enabled = true
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_shared_step(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_step(text) TO anon, authenticated;

-- Remove the enumeration hole now that the public page reads via the RPC.
DROP POLICY IF EXISTS "Anyone can view publicly shared steps" ON public.timeline_steps;
