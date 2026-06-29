-- Studio · Subscriber threads for the signed-in author.
--
-- Creator Studio surfaces "threads awaiting you" — subscriber conversation on
-- the steps of blueprints this author owns. Those live in step_discussions at
-- the blueprint_step scope (the shared cohort thread; private step_id notes are
-- owner-only and never author-visible).
--
-- Reading them through RLS requires the author to be a plan member of their own
-- blueprint, which isn't guaranteed. This SECURITY DEFINER RPC sidesteps that:
-- it keys off auth.uid() = blueprints.author_user_id, so an author always sees
-- conversation on what they wrote, and never anyone else's.
--
-- One row per blueprint_step thread that has at least one subscriber (non-author)
-- post. `awaiting` = the most recent post is from a subscriber, i.e. the author
-- hasn't replied yet.
--
-- Note: blueprint_steps.blueprint_id references the legacy timeline_blueprints,
-- whose ids are a shared-PK subset of public.blueprints, so the join to
-- public.blueprints (where author_user_id lives) is valid.

CREATE OR REPLACE FUNCTION public.studio_author_threads(p_limit int DEFAULT 20)
RETURNS TABLE (
  blueprint_step_id uuid,
  blueprint_id uuid,
  blueprint_title text,
  step_title text,
  last_post_id uuid,
  last_post_body text,
  last_poster_id uuid,
  last_poster_name text,
  last_post_at timestamptz,
  awaiting boolean,
  post_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_steps AS (
    SELECT bs.id AS blueprint_step_id, bs.blueprint_id, bs.step_id
      FROM public.blueprint_steps bs
      JOIN public.blueprints bp ON bp.id = bs.blueprint_id
     WHERE bp.author_user_id = auth.uid()
  ),
  thread_posts AS (
    SELECT d.id, d.blueprint_step_id, d.user_id, d.body, d.created_at,
           ms.blueprint_id, ms.step_id
      FROM public.step_discussions d
      JOIN my_steps ms ON ms.blueprint_step_id = d.blueprint_step_id
     WHERE d.blueprint_step_id IS NOT NULL
  ),
  subscriber_threads AS (
    SELECT blueprint_step_id
      FROM thread_posts
     WHERE user_id <> auth.uid()
     GROUP BY blueprint_step_id
  ),
  ranked AS (
    SELECT tp.*,
           row_number() OVER (
             PARTITION BY tp.blueprint_step_id ORDER BY tp.created_at DESC
           ) AS rn,
           count(*) OVER (PARTITION BY tp.blueprint_step_id) AS post_count
      FROM thread_posts tp
     WHERE tp.blueprint_step_id IN (SELECT blueprint_step_id FROM subscriber_threads)
  )
  SELECT
    r.blueprint_step_id,
    r.blueprint_id,
    bp.title AS blueprint_title,
    ts.title AS step_title,
    r.id AS last_post_id,
    r.body AS last_post_body,
    r.user_id AS last_poster_id,
    pp.full_name AS last_poster_name,
    r.created_at AS last_post_at,
    (r.user_id <> auth.uid()) AS awaiting,
    r.post_count::int
  FROM ranked r
  JOIN public.blueprints bp ON bp.id = r.blueprint_id
  LEFT JOIN public.timeline_steps ts ON ts.id = r.step_id
  LEFT JOIN public.profiles pp ON pp.id = r.user_id
  WHERE r.rn = 1
  ORDER BY r.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.studio_author_threads(int) TO authenticated;
