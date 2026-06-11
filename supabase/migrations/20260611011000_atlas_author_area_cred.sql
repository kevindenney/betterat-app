-- Atlas venue mastery (Phase V.4) · evidence-based author credibility.
--
-- "raced here N×" badges for the public local-knowledge band. The count
-- is computed ONLY from completed race steps the author has made
-- publicly visible (step visibility 'public', or a step_location row
-- with a public audience and non-hidden precision) — anon-equivalent,
-- so the badge never leaks activity the viewer couldn't already see.
-- Evidence, not karma.

CREATE OR REPLACE FUNCTION public.atlas_author_area_cred(
  p_poi_id uuid,
  p_author_ids uuid[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_object_agg(t.user_id, t.cnt), '{}'::jsonb)
  FROM (
    SELECT ts.user_id, COUNT(*) AS cnt
    FROM public.timeline_steps ts
    WHERE ts.user_id = ANY (p_author_ids)
      AND ts.is_race = true
      AND ts.status = 'completed'
      AND ts.metadata -> 'race_plan' ->> 'area_id' = p_poi_id::text
      AND (
        ts.visibility = 'public'
        OR EXISTS (
          SELECT 1 FROM public.step_location sl
          WHERE sl.step_id = ts.id
            AND sl.location_audience = 'public'
            AND COALESCE(sl.location_precision, 'exact') <> 'hidden'
        )
      )
    GROUP BY ts.user_id
  ) t;
$$;

COMMENT ON FUNCTION public.atlas_author_area_cred IS
  'Map of author_id → publicly-visible completed race count at one racing area. Powers "raced here N×" credibility badges; public-only so it adds no privacy surface.';

REVOKE ALL ON FUNCTION public.atlas_author_area_cred(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atlas_author_area_cred(uuid, uuid[]) TO authenticated, service_role;
