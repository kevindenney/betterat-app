-- Service-role-facing helper. seed-demo-personas needs to resolve an
-- existing auth.user by email when admin.createUser returns 422
-- "email_exists". GoTrue's admin/users list endpoint sometimes 500s
-- on this project, so this RPC is the reliable fallback.
--
-- Granted only to authenticated; the edge function uses the
-- service-role key which counts as authenticated. Not exposed to
-- client callers (no public role grant). Idempotent + side-effect free.
--
-- Applied to dev project via Supabase MCP.

CREATE OR REPLACE FUNCTION public.find_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_auth_user_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_auth_user_id_by_email(text) TO authenticated;

COMMENT ON FUNCTION public.find_auth_user_id_by_email(text) IS
  'Service-role helper for demo-persona seeding. Resolves an auth.users id by email when the GoTrue admin/users list endpoint is unavailable.';
