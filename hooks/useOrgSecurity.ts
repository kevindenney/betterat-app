/**
 * useOrgSecurity — read + write the org admin Security surface (SSO &
 * domain). Pulls org_sso_config + org_verified_domains, exposes
 * mutations the surface needs: update config, toggle auto-add /
 * require-sso, add/remove domains, edit attribute mappings.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { logAuditEvent } from '@/services/auditLog';

export interface AttributeMapping {
  idp: string;
  field: string;
}

export interface SsoConfig {
  enabled: boolean;
  idpEntityId: string | null;
  acsUrl: string | null;
  spEntityId: string | null;
  metadataFilename: string | null;
  metadataSizeBytes: number | null;
  metadataUploadedAt: string | null;
  metadataUploadedByName: string | null;
  lastMetadataExchangeAt: string | null;
  attributeMappings: AttributeMapping[];
  autoAddVerifiedDomain: boolean;
  requireSsoForVerifiedDomain: boolean;
  defaultCohortId: string | null;
}

export interface VerifiedDomain {
  id: string;
  domain: string;
  txtRecord: string;
  status: 'pending' | 'verified' | 'failed';
  isPrimary: boolean;
  isAlias: boolean;
  addedAt: string;
  verifiedAt: string | null;
  badgeText: string;
}

interface SsoRow {
  enabled: boolean;
  idp_entity_id: string | null;
  acs_url: string | null;
  sp_entity_id: string | null;
  metadata_filename: string | null;
  metadata_size_bytes: number | null;
  metadata_uploaded_at: string | null;
  metadata_uploaded_by: string | null;
  last_metadata_exchange_at: string | null;
  attribute_mappings: AttributeMapping[];
  auto_add_verified_domain: boolean;
  require_sso_for_verified_domain: boolean;
  default_cohort_id: string | null;
}

interface DomainRow {
  id: string;
  domain: string;
  txt_record: string;
  status: 'pending' | 'verified' | 'failed';
  is_primary: boolean;
  is_alias: boolean;
  added_at: string;
  verified_at: string | null;
}

function relativeDayLabel(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 1) return 'added today';
  if (days < 2) return 'added yesterday';
  if (days < 7) return `added ${d.toLocaleDateString(undefined, { weekday: 'short' })}`;
  return `added ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function randomHex(n: number): string {
  const bytes = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function useOrgSecurity(orgId: string) {
  const queryClient = useQueryClient();

  const configKey = ['org-sso-config', orgId];
  const domainsKey = ['org-verified-domains', orgId];

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: configKey,
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: async (): Promise<SsoConfig | null> => {
      const { data: row, error } = await supabase
        .from('org_sso_config')
        .select(
          `enabled, idp_entity_id, acs_url, sp_entity_id, metadata_filename, metadata_size_bytes,
           metadata_uploaded_at, metadata_uploaded_by, last_metadata_exchange_at, attribute_mappings,
           auto_add_verified_domain, require_sso_for_verified_domain, default_cohort_id`,
        )
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) {
        console.warn('[useOrgSecurity] config query failed', error);
        return null;
      }
      if (!row) return null;
      const r = row as unknown as SsoRow;
      let uploadedByName: string | null = null;
      if (r.metadata_uploaded_by) {
        const { data: u } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', r.metadata_uploaded_by)
          .maybeSingle();
        const trimmed = (u?.full_name ?? '').trim();
        uploadedByName = trimmed || u?.email || null;
      }
      return {
        enabled: r.enabled,
        idpEntityId: r.idp_entity_id,
        acsUrl: r.acs_url,
        spEntityId: r.sp_entity_id,
        metadataFilename: r.metadata_filename,
        metadataSizeBytes: r.metadata_size_bytes,
        metadataUploadedAt: r.metadata_uploaded_at,
        metadataUploadedByName: uploadedByName,
        lastMetadataExchangeAt: r.last_metadata_exchange_at,
        attributeMappings: Array.isArray(r.attribute_mappings) ? r.attribute_mappings : [],
        autoAddVerifiedDomain: r.auto_add_verified_domain,
        requireSsoForVerifiedDomain: r.require_sso_for_verified_domain,
        defaultCohortId: r.default_cohort_id,
      };
    },
  });

  const { data: domains = [], isLoading: domainsLoading } = useQuery({
    queryKey: domainsKey,
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: async (): Promise<VerifiedDomain[]> => {
      const { data, error } = await supabase
        .from('org_verified_domains')
        .select('id, domain, txt_record, status, is_primary, is_alias, added_at, verified_at')
        .eq('org_id', orgId)
        .order('is_primary', { ascending: false })
        .order('added_at', { ascending: true });
      if (error) {
        console.warn('[useOrgSecurity] domains query failed', error);
        return [];
      }
      return ((data ?? []) as DomainRow[]).map((r) => ({
        id: r.id,
        domain: r.domain,
        txtRecord: r.txt_record,
        status: r.status,
        isPrimary: r.is_primary,
        isAlias: r.is_alias,
        addedAt: r.added_at,
        verifiedAt: r.verified_at,
        badgeText: r.is_primary ? 'primary' : r.is_alias ? 'alias' : relativeDayLabel(r.added_at),
      }));
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (patch: Partial<SsoConfig>) => {
      const payload: Record<string, unknown> = { org_id: orgId };
      if (patch.enabled !== undefined) payload.enabled = patch.enabled;
      if (patch.idpEntityId !== undefined) payload.idp_entity_id = patch.idpEntityId;
      if (patch.acsUrl !== undefined) payload.acs_url = patch.acsUrl;
      if (patch.spEntityId !== undefined) payload.sp_entity_id = patch.spEntityId;
      if (patch.attributeMappings !== undefined)
        payload.attribute_mappings = patch.attributeMappings;
      if (patch.autoAddVerifiedDomain !== undefined)
        payload.auto_add_verified_domain = patch.autoAddVerifiedDomain;
      if (patch.requireSsoForVerifiedDomain !== undefined)
        payload.require_sso_for_verified_domain = patch.requireSsoForVerifiedDomain;
      if (patch.defaultCohortId !== undefined) payload.default_cohort_id = patch.defaultCohortId;
      payload.updated_at = new Date().toISOString();
      const { error } = await supabase
        .from('org_sso_config')
        .upsert(payload, { onConflict: 'org_id' });
      if (error) throw error;
      return { patch };
    },
    onSuccess: ({ patch }) => {
      queryClient.invalidateQueries({ queryKey: configKey });
      // Audit
      const keys = Object.keys(patch);
      if (keys.length > 0) {
        void logAuditEvent({
          orgId,
          verb: 'sso_config',
          verbLabel: 'SSO config',
          description: `Updated ${keys[0].replace(/([A-Z])/g, ' $1').toLowerCase().trim()}.`,
          payload: patch as Record<string, unknown>,
        });
      }
    },
  });

  const addDomain = useMutation({
    mutationFn: async (input: { domain: string }) => {
      const clean = input.domain.trim().toLowerCase().replace(/^@/, '');
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
        throw new Error('Invalid domain');
      }
      const txt = `betterat-verify=${randomHex(6)}`;
      const { error } = await supabase
        .from('org_verified_domains')
        .insert({
          org_id: orgId,
          domain: clean,
          txt_record: txt,
          status: 'pending',
        });
      if (error) throw error;
      return { domain: clean };
    },
    onSuccess: ({ domain }) => {
      queryClient.invalidateQueries({ queryKey: domainsKey });
      void logAuditEvent({
        orgId,
        verb: 'sso_config',
        verbLabel: 'Added domain',
        description: `Added ${domain} to verified domains.`,
        payload: { domain },
      });
    },
  });

  const removeDomain = useMutation({
    mutationFn: async (domainId: string) => {
      const row = domains.find((d) => d.id === domainId);
      const { data, error } = await supabase
        .from('org_verified_domains')
        .delete()
        .eq('id', domainId)
        .eq('org_id', orgId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error('Domain not found or you do not have access to remove it.');
      }
      return { domainId, domain: row?.domain ?? null };
    },
    onSuccess: ({ domain }) => {
      queryClient.invalidateQueries({ queryKey: domainsKey });
      if (domain) {
        void logAuditEvent({
          orgId,
          verb: 'sso_config',
          verbLabel: 'Removed domain',
          description: `Removed ${domain}.`,
          payload: { domain },
        });
      }
    },
  });

  return {
    config: config ?? null,
    domains,
    loading: configLoading || domainsLoading,
    updateConfig,
    addDomain,
    removeDomain,
  };
}
