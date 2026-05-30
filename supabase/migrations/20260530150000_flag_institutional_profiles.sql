-- Flag profile rows that are really institutions (their full_name matches an
-- organizations.name) as account_type='organization'. Atlas People search
-- filters these out via the account_type flag instead of relying solely on a
-- name heuristic. Matches by org name rather than a hardcoded id so it stays
-- reproducible across environments.
UPDATE public.profiles p
SET account_type = 'organization'
FROM public.organizations o
WHERE lower(trim(o.name)) = lower(trim(p.full_name))
  AND p.account_type IS DISTINCT FROM 'organization';
