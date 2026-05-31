-- library_items_for_interest — interest-scoped variant of
-- library_items_for_picker.
--
-- The picker RPC returns ALL of a user's items (ranking this-interest +
-- untagged first) because the "attach from library" picker must let you
-- pull in any item. The Library landing surfaces (resources preview, the
-- count pill, and the "See all" zone) want the opposite: a hard filter so
-- a nursing resource never surfaces atop a Lac Craft Business library.
--
-- Rule: items tagged for this interest OR completely untagged. A NULL
-- interest (no active interest) returns everything, matching prior behaviour.
CREATE OR REPLACE FUNCTION public.library_items_for_interest(p_interest_id uuid DEFAULT NULL)
RETURNS SETOF public.library_items
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT li.*
  FROM public.library_items li
  WHERE li.user_id = (SELECT auth.uid())
    AND (
      p_interest_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.library_item_interests lii
        WHERE lii.item_id = li.id AND lii.interest_id = p_interest_id
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.library_item_interests lii
        WHERE lii.item_id = li.id
      )
    )
  ORDER BY li.captured_at DESC
  LIMIT 200;
$function$;
