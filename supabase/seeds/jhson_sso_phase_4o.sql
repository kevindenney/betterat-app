-- JHSON SSO config + verified domains seed for the admin Security
-- surface. Upserts so it's safe to re-run.

INSERT INTO public.org_sso_config
  (org_id, enabled, idp_entity_id, acs_url, sp_entity_id, metadata_filename, metadata_size_bytes,
   metadata_uploaded_at, metadata_uploaded_by, last_metadata_exchange_at, attribute_mappings,
   auto_add_verified_domain, require_sso_for_verified_domain)
VALUES (
  '678e149e-2abb-422c-ac61-b76756a2150e',
  true,
  'http://www.okta.com/exk1j8h2k9aPfX0YQ357',
  'https://betterat.app/auth/saml/jhson/acs',
  'https://betterat.app/orgs/jhson',
  'okta-jh-edu-metadata.xml',
  4296,
  now() - interval '35 days',
  '1c016c81-32f7-4e94-a619-23ccf32bcb56',
  now() - interval '35 days',
  '[
    {"idp":"NameID","field":"email"},
    {"idp":"eduPersonAffiliation","field":"role"},
    {"idp":"department","field":"cohort_hint"},
    {"idp":"displayName","field":"name"}
  ]'::jsonb,
  true,
  true
)
ON CONFLICT (org_id) DO UPDATE SET
  enabled = excluded.enabled,
  idp_entity_id = excluded.idp_entity_id,
  acs_url = excluded.acs_url,
  sp_entity_id = excluded.sp_entity_id,
  metadata_filename = excluded.metadata_filename,
  metadata_size_bytes = excluded.metadata_size_bytes,
  metadata_uploaded_at = excluded.metadata_uploaded_at,
  metadata_uploaded_by = excluded.metadata_uploaded_by,
  last_metadata_exchange_at = excluded.last_metadata_exchange_at,
  attribute_mappings = excluded.attribute_mappings,
  auto_add_verified_domain = excluded.auto_add_verified_domain,
  require_sso_for_verified_domain = excluded.require_sso_for_verified_domain,
  updated_at = now();

INSERT INTO public.org_verified_domains
  (org_id, domain, txt_record, status, is_primary, is_alias, added_by, added_at, verified_at)
VALUES
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'jh.edu',  'betterat-verify=8c2f3a91d4b6', 'verified', true,  false, '1c016c81-32f7-4e94-a619-23ccf32bcb56', now() - interval '42 days', now() - interval '41 days'),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'jhmi.edu','betterat-verify=4a1d09e7c2b5', 'pending',  false, false, '1c016c81-32f7-4e94-a619-23ccf32bcb56', now() - interval '2 days',  NULL),
  ('678e149e-2abb-422c-ac61-b76756a2150e', 'jhu.edu', 'betterat-verify=b7e3f2a18d04', 'verified', false, true,  '1c016c81-32f7-4e94-a619-23ccf32bcb56', now() - interval '38 days', now() - interval '37 days')
ON CONFLICT (org_id, domain) DO NOTHING;
