-- Add soft-delete marker to public.users.
--
-- app/settings/delete-account.tsx anonymizes the row and sets `deleted_at`
-- so a server-side job can run the full auth-user removal + cascade within
-- 30 days (the client has no service role to call auth.admin.deleteUser).
-- The column never existed, so the UPDATE was failing with 42703 and account
-- deletion was completely broken. This backfills the column the client writes.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial index so the eventual cleanup job can scan pending deletions cheaply.
CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON public.users (deleted_at)
  WHERE deleted_at IS NOT NULL;
