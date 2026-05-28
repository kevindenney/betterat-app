-- Enable Supabase realtime broadcasts for step_discussions so the
-- Cohort tab subscription in StepDiscussionInline receives INSERT
-- events without polling.
--
-- Applied to dev project via Supabase MCP.

ALTER PUBLICATION supabase_realtime ADD TABLE public.step_discussions;
