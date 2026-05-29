-- Fix: get_member_portfolio_full referenced user_interests.added_at, which
-- does not exist (the column is joined_at). The function raised
-- "column added_at does not exist" at runtime, which PortfolioService
-- misclassified as PortfolioRpcUnavailableError — so the /p/[userId] hero
-- portfolio rendered "backend not deployed" even though the RPC was deployed.
-- Only the interests aggregation was affected; everything else is unchanged.

CREATE OR REPLACE FUNCTION public.get_member_portfolio_full(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_public boolean;
  v_opt_in boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign in to view member portfolio' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT COALESCE(p.profile_public, false), COALESCE(p.portfolio_public_opt_in, false)
    INTO v_public, v_opt_in FROM public.profiles p WHERE p.id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_caller <> target_user_id AND NOT (v_public AND v_opt_in) THEN
    RAISE EXCEPTION 'Full portfolio is not public' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'scope', 'full', 'target_user_id', target_user_id,
    'profile', (SELECT jsonb_build_object('id', p.id, 'email', p.email,
        'full_name', COALESCE(NULLIF(trim(p.full_name), ''), u.full_name, u.email),
        'avatar_url', COALESCE(p.avatar_url, u.avatar_url),
        'profile_public', COALESCE(p.profile_public, false),
        'portfolio_public_opt_in', COALESCE(p.portfolio_public_opt_in, false))
      FROM public.profiles p LEFT JOIN public.users u ON u.id = p.id WHERE p.id = target_user_id),
    'interests', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'slug', i.slug, 'name', i.name, 'added_at', ui.joined_at) ORDER BY ui.joined_at DESC)
      FROM public.user_interests ui JOIN public.interests i ON i.id = ui.interest_id WHERE ui.user_id = target_user_id), '[]'::jsonb),
    'organizations', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'slug', o.slug,
        'interest_slug', o.interest_slug, 'role', om.role) ORDER BY o.name)
      FROM public.organization_memberships om JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = target_user_id AND COALESCE(om.membership_status, om.status) = 'active'), '[]'::jsonb),
    'plans', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'vision_statement', p.vision_statement,
        'status', p.status, 'started_at', p.started_at, 'ended_at', p.ended_at,
        'interest_id', p.interest_id, 'interest_slug', i.slug) ORDER BY p.started_at DESC)
      FROM public.plans p LEFT JOIN public.interests i ON i.id = p.interest_id WHERE p.user_id = target_user_id), '[]'::jsonb),
    'recent_activity', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ts.id, 'title', ts.title, 'status', ts.status,
        'updated_at', ts.updated_at, 'interest_id', ts.interest_id, 'interest_slug', i.slug) ORDER BY ts.updated_at DESC)
      FROM (SELECT * FROM public.timeline_steps WHERE user_id = target_user_id ORDER BY updated_at DESC LIMIT 30) ts
      LEFT JOIN public.interests i ON i.id = ts.interest_id), '[]'::jsonb)
  );
END;
$function$;
