-- Fix GoTrue "Database error finding user" — known compatibility issue
-- where newer GoTrue Go-side struct tags expect NOT NULL strings on
-- auth.users token/change columns, but historical rows have NULL.
-- Symptom: admin/generate_link, admin/users list, and password-reset
-- flows return 500 with
--   "sql: Scan error on column index 3, name \"confirmation_token\":
--    converting NULL to string is unsupported"
--
-- Convert NULL → '' on every nullable token/change column so GoTrue
-- can scan them as strings. Idempotent.
--
-- Applied to dev project via Supabase MCP. Run again whenever a new
-- GoTrue version changes its scan expectations — it's a no-op when
-- everything is already non-null.

UPDATE auth.users
SET confirmation_token        = COALESCE(confirmation_token, ''),
    email_change_token_new    = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    recovery_token            = COALESCE(recovery_token, ''),
    phone_change_token        = COALESCE(phone_change_token, ''),
    reauthentication_token    = COALESCE(reauthentication_token, ''),
    email_change              = COALESCE(email_change, ''),
    phone_change              = COALESCE(phone_change, '')
WHERE confirmation_token IS NULL
   OR email_change_token_new IS NULL
   OR email_change_token_current IS NULL
   OR recovery_token IS NULL
   OR phone_change_token IS NULL
   OR reauthentication_token IS NULL
   OR email_change IS NULL
   OR phone_change IS NULL;
