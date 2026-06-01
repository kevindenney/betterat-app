/**
 * orgMembershipsQuery
 *
 * Single shared read of the signed-in user's organization memberships.
 * Both OrganizationProvider and useProfileMenuData consume this one
 * TanStack-cached query (key ['profile-menu-orgs', userId]) instead of
 * issuing two independent reads of organization_memberships.
 *
 * The embed is the UNION of every column either consumer needs, the join
 * is LEFT (null-org rows survive — callers null-guard), and there is NO
 * status filter — each caller applies its own client-side status filter.
 */

import { supabase } from '@/services/supabase';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';

export const orgMembershipsQueryKey = (userId: string | null | undefined) =>
  ['profile-menu-orgs', userId] as const;

export interface OrgMembershipEmbeddedOrg {
  id: string;
  name: string;
  slug: string | null;
  interest_slug: string | null;
  organization_type: string;
  verification_mode: string | null;
  allowed_email_domains: string[] | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
}

export interface OrgMembershipRawRow {
  id: string;
  organization_id: string;
  role: string | null;
  status: string | null;
  membership_status?: string | null;
  is_verified: boolean | null;
  verification_source: string | null;
  joined_at: string | null;
  created_at: string | null;
  organization: OrgMembershipEmbeddedOrg | OrgMembershipEmbeddedOrg[] | null;
}

const ORG_EMBED =
  'organization:organizations(id, name, slug, interest_slug, organization_type, verification_mode, allowed_email_domains, metadata, is_active)';
const MEMBERSHIP_COLUMNS = `id, organization_id, role, status, membership_status, is_verified, verification_source, joined_at, created_at, ${ORG_EMBED}`;
const MEMBERSHIP_COLUMNS_LEGACY = `id, organization_id, role, status, is_verified, verification_source, joined_at, created_at, ${ORG_EMBED}`;

export async function fetchOrgMembershipRows(userId: string): Promise<OrgMembershipRawRow[]> {
  const run = (columns: string) =>
    supabase.from('organization_memberships').select(columns).eq('user_id', userId);

  let { data, error } = await run(MEMBERSHIP_COLUMNS);
  if (error && isMissingSupabaseColumn(error, 'organization_memberships.membership_status')) {
    const legacy = await run(MEMBERSHIP_COLUMNS_LEGACY);
    data = legacy.data as any;
    error = legacy.error as any;
  }
  if (error) throw error;
  return (data ?? []) as unknown as OrgMembershipRawRow[];
}
