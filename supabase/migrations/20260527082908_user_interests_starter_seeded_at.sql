-- Adds a one-time marker so we know whether the client has already auto-
-- seeded a starter step for this (user, interest) pair. Once stamped, we
-- never seed again — even if the user deletes the starter step, the slot
-- stays claimed. Lets us replace the broken "Preview with sample data"
-- nursing-flavored preview with a real, persisted, interest-appropriate
-- starter step the user can edit, complete, or delete.

ALTER TABLE public.user_interests
  ADD COLUMN IF NOT EXISTS starter_seeded_at timestamptz;
