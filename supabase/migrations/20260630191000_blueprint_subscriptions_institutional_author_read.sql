-- The existing author-read policy only recognizes a blueprint owner via
-- timeline_blueprints. Institutional / marketplace blueprints live in
-- public.blueprints, so their author could not read subscriber rows directly
-- (Studio Home counts via a plain .from('blueprint_subscriptions') query that
-- is subject to RLS) and saw 0 subscribers. Let the public.blueprints author
-- read the relationship rows for their own non-timeline blueprints.
CREATE POLICY "Institutional author can view subscriptions"
  ON public.blueprint_subscriptions
  FOR SELECT
  USING (
    blueprint_system <> 'timeline'
    AND blueprint_id IN (
      SELECT id FROM public.blueprints
      WHERE author_user_id = (SELECT auth.uid())
    )
  );
