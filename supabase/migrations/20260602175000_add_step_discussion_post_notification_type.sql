-- ALTER TYPE ADD VALUE cannot be used inside a transaction that also
-- references the new value, so this enum extension is split into its
-- own migration. The trigger that uses 'step_discussion_post' lands
-- in the next migration.
--
-- Applied to dev project via Supabase MCP.

ALTER TYPE public.social_notification_type ADD VALUE IF NOT EXISTS 'step_discussion_post';
