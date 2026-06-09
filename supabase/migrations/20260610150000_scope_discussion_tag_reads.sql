-- Condition/topic tag rows were readable by everyone (USING true), leaking
-- tag metadata of fleet/org/blueprint/private posts to any direct querier.
-- Gate reads behind the parent discussion's visibility, same as comments.

DROP POLICY IF EXISTS "Condition tags are readable by all" ON venue_post_condition_tags;
CREATE POLICY "Condition tags readable with parent discussion"
  ON venue_post_condition_tags FOR SELECT
  USING (can_read_venue_discussion(discussion_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "Discussion tags are readable by all" ON venue_discussion_tags;
CREATE POLICY "Discussion tags readable with parent discussion"
  ON venue_discussion_tags FOR SELECT
  USING (can_read_venue_discussion(discussion_id, (SELECT auth.uid())));
