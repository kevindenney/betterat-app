-- The Studio editor's SUB-TITLE field had no backing column, so typed
-- sub-titles were silently dropped on create/save.
ALTER TABLE public.blueprints ADD COLUMN IF NOT EXISTS subtitle text;
