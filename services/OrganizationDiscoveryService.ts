import { supabase } from '@/services/supabase';
import { isUuid } from '@/utils/uuid';
import { isMissingRelationError, isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';

export type OrganizationJoinMode = 'invite_only' | 'request_to_join' | 'open_join';

export type DiscoverableOrganization = {
  id: string;
  name: string;
  slug: string | null;
  join_mode: OrganizationJoinMode;
  allowed_email_domains: string[];
  organization_type?: string | null;
  status?: string | null;
  official?: boolean | null;
  claim_status?: string | null;
  source?: string | null;
  // True when the org has an active owner/admin/manager who can action a
  // join request. request_to_join orgs without one (e.g. seeded directory
  // clubs) are not actually joinable and should render as passive listings.
  has_approver?: boolean;
};

type SearchOrganizationsInput = {
  query: string;
  limit?: number;
};

type RequestJoinInput = {
  orgId: string;
  mode: OrganizationJoinMode;
  requestedBlueprintId?: string;
};

export type RequestJoinResult = {
  status: 'active' | 'pending' | 'blocked' | 'existing';
  membershipStatus: 'active' | 'pending' | 'rejected' | null;
  message: string;
};

export function isRequestJoinActive(result: RequestJoinResult): boolean {
  return (
    result.status === 'active' ||
    (result.status === 'existing' && result.membershipStatus === 'active')
  );
}

export function isRequestJoinPending(result: RequestJoinResult): boolean {
  return result.status === 'pending' || result.membershipStatus === 'pending';
}

const DEFAULT_LIMIT = 12;

function normalizeJoinMode(value: unknown): OrganizationJoinMode {
  if (value === 'open_join' || value === 'request_to_join' || value === 'invite_only') {
    return value;
  }
  return 'invite_only';
}

function normalizeAllowedEmailDomains(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .map((entry) => String(entry || '').trim().toLowerCase().replace(/^@/, ''))
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(normalized));
}

export function isEmailAllowed(input: {email: string | null | undefined; allowedDomains: string[]}): boolean {
  const allowedDomains = normalizeAllowedEmailDomains(input.allowedDomains);
  if (allowedDomains.length === 0) {
    return true;
  }
  const email = String(input.email || '').trim().toLowerCase();
  const atIndex = email.lastIndexOf('@');
  if (atIndex <= 0 || atIndex >= email.length - 1) {
    return false;
  }
  const domain = email.slice(atIndex + 1);
  return allowedDomains.includes(domain);
}

function normalizeMembershipStatus(value: unknown): 'active' | 'pending' | 'rejected' | null {
  if (value === 'active' || value === 'pending' || value === 'rejected') {
    return value;
  }
  return null;
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, '');
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && (error as {code?: string}).code === '23505';
}

class OrganizationDiscoveryService {
  async searchOrganizations(input: SearchOrganizationsInput): Promise<DiscoverableOrganization[]> {
    const limit = Math.max(1, Math.min(input.limit || DEFAULT_LIMIT, 50));
    const queryText = String(input.query || '').trim();
    if (!queryText) {
      return [];
    }
    const q = escapeLike(queryText);
    if (!q) {
      return [];
    }

    const applyCommonFilters = <T,>(query: T): T => {
      let request: any = query;
      request = request.eq('is_active', true).order('name', {ascending: true}).limit(limit);
      return request as T;
    };

    const nameQuery = applyCommonFilters(
      supabase.from('organizations').select('id,name,slug,join_mode,allowed_email_domains,organization_type,status,official,claim_status,source').ilike('name', `%${q}%`)
    );
    const slugQuery = applyCommonFilters(
      supabase.from('organizations').select('id,name,slug,join_mode,allowed_email_domains,organization_type,status,official,claim_status,source').ilike('slug', `%${q}%`)
    );
    const aliasQuery = supabase
      .from('organization_aliases')
      .select('organizations(id,name,slug,join_mode,allowed_email_domains,organization_type,status,official,claim_status,source)')
      .ilike('alias', `%${q}%`)
      .limit(limit);
    let [nameResult, slugResult, aliasResult] = await Promise.all([nameQuery, slugQuery, aliasQuery]);
    let aliasRows = (aliasResult.data || [])
      .map((row: any) => (Array.isArray(row.organizations) ? row.organizations[0] : row.organizations))
      .filter(Boolean);
    let data = [...(nameResult.data || []), ...(slugResult.data || []), ...aliasRows];
    let error = nameResult.error || slugResult.error || aliasResult.error;
    if (aliasResult.error && isMissingRelationError(aliasResult.error)) {
      data = [...(nameResult.data || []), ...(slugResult.data || [])];
      error = nameResult.error || slugResult.error;
    }

    if (
      error
      && (
        isMissingSupabaseColumn(error, 'organizations.join_mode')
        || isMissingSupabaseColumn(error, 'organizations.allowed_email_domains')
        || isMissingSupabaseColumn(error, 'organizations.status')
        || isMissingSupabaseColumn(error, 'organizations.official')
        || isMissingSupabaseColumn(error, 'organizations.claim_status')
        || isMissingSupabaseColumn(error, 'organizations.source')
      )
    ) {
      const fallbackNameWithJoinModeQuery = applyCommonFilters(
        supabase.from('organizations').select('id,name,slug,join_mode').ilike('name', `%${q}%`)
      );
      const fallbackSlugWithJoinModeQuery = applyCommonFilters(
        supabase.from('organizations').select('id,name,slug,join_mode').ilike('slug', `%${q}%`)
      );
      const [fallbackNameWithJoinModeResult, fallbackSlugWithJoinModeResult] = await Promise.all([
        fallbackNameWithJoinModeQuery,
        fallbackSlugWithJoinModeQuery,
      ]);
      data = [...(fallbackNameWithJoinModeResult.data || []), ...(fallbackSlugWithJoinModeResult.data || [])] as any[];
      error = fallbackNameWithJoinModeResult.error || fallbackSlugWithJoinModeResult.error;
    }

    if (error && isMissingSupabaseColumn(error, 'organizations.join_mode')) {
      const fallbackNameQuery = applyCommonFilters(
        supabase.from('organizations').select('id,name,slug').ilike('name', `%${q}%`)
      );
      const fallbackSlugQuery = applyCommonFilters(
        supabase.from('organizations').select('id,name,slug').ilike('slug', `%${q}%`)
      );
      const [fallbackNameResult, fallbackSlugResult] = await Promise.all([fallbackNameQuery, fallbackSlugQuery]);
      data = [...(fallbackNameResult.data || []), ...(fallbackSlugResult.data || [])] as any[];
      error = fallbackNameResult.error || fallbackSlugResult.error;
    }

    if (error) throw error;

    const deduped = new Map<string, DiscoverableOrganization>();
    for (const row of (data || []) as any[]) {
      if (!isUuid(row?.id)) continue;
      const mapped: DiscoverableOrganization = {
        id: row.id,
        name: String(row.name || ''),
        slug: row.slug || null,
        join_mode: normalizeJoinMode(row.join_mode),
        allowed_email_domains: normalizeAllowedEmailDomains(row.allowed_email_domains),
        organization_type: row.organization_type ? String(row.organization_type) : null,
        status: row.status ? String(row.status) : null,
        official: typeof row.official === 'boolean' ? row.official : null,
        claim_status: row.claim_status ? String(row.claim_status) : null,
        source: row.source ? String(row.source) : null,
      };
      if (!mapped.name) continue;
      if (!deduped.has(mapped.id)) {
        deduped.set(mapped.id, mapped);
      }
    }

    const results = Array.from(deduped.values()).slice(0, limit);

    const approverIds = await this.getOrgsWithApprover(results.map((o) => o.id));
    for (const org of results) {
      org.has_approver = approverIds.has(org.id);
    }

    return results;
  }

  /**
   * Returns the subset of the given org ids that have at least one active
   * owner/admin/manager able to approve a join request. Backed by the
   * orgs_with_approver SECURITY DEFINER RPC because organization_memberships
   * RLS is owner-only (a prospective joiner can't count approvers directly).
   * Fails open (treats orgs as having an approver) if the RPC errors, so a
   * transient failure never hides a genuinely joinable org.
   */
  async getOrgsWithApprover(orgIds: string[]): Promise<Set<string>> {
    const ids = orgIds.filter((id) => isUuid(id));
    if (ids.length === 0) return new Set();
    const {data, error} = await supabase.rpc('orgs_with_approver', {p_org_ids: ids});
    if (error || !data) {
      return new Set(ids);
    }
    return new Set((data as {organization_id: string}[]).map((r) => r.organization_id));
  }

  async requestJoin(input: RequestJoinInput): Promise<RequestJoinResult> {
    if (!isUuid(input.orgId)) {
      return {
        status: 'blocked',
        membershipStatus: null,
        message: 'Invalid organization id.',
      };
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const userId = authData?.user?.id || null;
    const userEmail = authData?.user?.email || null;
    if (!userId || !isUuid(userId)) {
      return {
        status: 'blocked',
        membershipStatus: null,
        message: 'Sign in required.',
      };
    }

    let orgRow: any = null;
    {
      let orgResult = await supabase
        .from('organizations')
        .select('id,join_mode,allowed_email_domains')
        .eq('id', input.orgId)
        .eq('is_active', true)
        .maybeSingle();
      if (orgResult.error && isMissingSupabaseColumn(orgResult.error, 'organizations.is_active')) {
        orgResult = await supabase
          .from('organizations')
          .select('id,join_mode,allowed_email_domains')
          .eq('id', input.orgId)
          .maybeSingle();
      }
      if (
        orgResult.error
        && (
          isMissingSupabaseColumn(orgResult.error, 'organizations.join_mode')
          || isMissingSupabaseColumn(orgResult.error, 'organizations.allowed_email_domains')
        )
      ) {
        orgResult = await supabase
          .from('organizations')
          .select('id,join_mode')
          .eq('id', input.orgId)
          .maybeSingle();
      }
      if (orgResult.error && isMissingSupabaseColumn(orgResult.error, 'organizations.join_mode')) {
        orgResult = await supabase
          .from('organizations')
          .select('id')
          .eq('id', input.orgId)
          .maybeSingle();
      }
      if (orgResult.error) {
        throw orgResult.error;
      }
      orgRow = orgResult.data;
    }

    if (!orgRow?.id) {
      return {
        status: 'blocked',
        membershipStatus: null,
        message: 'Organization not found.',
      };
    }

    const resolvedMode = normalizeJoinMode(orgRow.join_mode ?? input.mode);
    const allowedDomains = normalizeAllowedEmailDomains(orgRow.allowed_email_domains);

    if (resolvedMode === 'invite_only') {
      return {
        status: 'blocked',
        membershipStatus: null,
        message: 'Invite required.',
      };
    }

    if (
      resolvedMode === 'open_join'
      && allowedDomains.length > 0
      && !isEmailAllowed({email: userEmail, allowedDomains})
    ) {
      throw new Error('This organization is restricted to approved email domains.');
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('organization_memberships')
      .select('id,status,membership_status')
      .eq('organization_id', input.orgId)
      .eq('user_id', userId)
      .order('created_at', {ascending: false})
      .limit(1);

    if (existingError) throw existingError;

    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    const existingStatus = String(existing?.status || '').toLowerCase();
    const existingMembershipStatus = normalizeMembershipStatus(existing?.membership_status);

    if (existing) {
      if (existingStatus === 'active' || existingMembershipStatus === 'active') {
        return {
          status: 'existing',
          membershipStatus: 'active',
          message: 'Already a member.',
        };
      }
      if (existingStatus === 'pending' || existingMembershipStatus === 'pending' || existingStatus === 'invited') {
        return {
          status: 'existing',
          membershipStatus: 'pending',
          message: 'Request already pending.',
        };
      }
      if (existingMembershipStatus === 'rejected' || existingStatus === 'rejected') {
        let reRequestPayload: Record<string, any> = {
          status: 'pending',
          membership_status: 'pending',
          is_verified: false,
          verified_at: null,
          joined_at: null,
          verification_source: 'self_join',
        };

        const missingColumnFallbacks: [string, string][] = [
          ['membership_status', 'organization_memberships.membership_status'],
          ['is_verified', 'organization_memberships.is_verified'],
          ['verified_at', 'organization_memberships.verified_at'],
          ['joined_at', 'organization_memberships.joined_at'],
          ['verification_source', 'organization_memberships.verification_source'],
        ];

        while (true) {
          const { data: updatedRows, error: updateError } = await supabase
            .from('organization_memberships')
            .update(reRequestPayload)
            .select('id')
            .eq('id', existing.id)
            .eq('organization_id', input.orgId)
            .eq('user_id', userId);

          if (!updateError) {
            if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
              return {
                status: 'blocked',
                membershipStatus: existingMembershipStatus,
                message: 'Request could not be submitted. Please try again.',
              };
            }
            return {
              status: 'pending',
              membershipStatus: 'pending',
              message: 'Request sent.',
            };
          }

          const missing = missingColumnFallbacks.find(([key, qualified]) =>
            reRequestPayload[key] !== undefined && isMissingSupabaseColumn(updateError, qualified)
          );
          if (!missing) {
            throw updateError;
          }

          const [missingKey] = missing;
          const nextPayload = { ...reRequestPayload };
          delete nextPayload[missingKey];
          reRequestPayload = nextPayload;
        }
      }
    }

    const nextStatus = resolvedMode === 'open_join' ? 'active' : 'pending';
    const nextMembershipStatus = resolvedMode === 'open_join' ? 'active' : 'pending';
    const verificationSource = 'self_join';

    const insertPayload: Record<string, any> = {
      organization_id: input.orgId,
      user_id: userId,
      role: 'member',
      status: nextStatus,
      membership_status: nextMembershipStatus,
      is_verified: nextStatus === 'active',
      verification_source: verificationSource,
      joined_at: nextStatus === 'active' ? new Date().toISOString() : null,
    };
    if (input.requestedBlueprintId) {
      insertPayload.metadata = { requested_blueprint_id: input.requestedBlueprintId };
    }

    const { error: insertError } = await supabase
      .from('organization_memberships')
      .insert(insertPayload);

    if (insertError) {
      if (!isUniqueViolation(insertError)) throw insertError;

      const {data: racedRows, error: racedError} = await supabase
        .from('organization_memberships')
        .select('status,membership_status')
        .eq('organization_id', input.orgId)
        .eq('user_id', userId)
        .order('created_at', {ascending: false})
        .limit(1);
      if (racedError) throw racedError;

      const raced = Array.isArray(racedRows) ? racedRows[0] : null;
      const racedStatus = String(raced?.status || '').toLowerCase();
      const racedMembershipStatus = normalizeMembershipStatus(raced?.membership_status);
      if (racedStatus === 'active' || racedMembershipStatus === 'active') {
        return {
          status: 'existing',
          membershipStatus: 'active',
          message: 'Already a member.',
        };
      }
      if (racedStatus === 'pending' || racedMembershipStatus === 'pending' || racedStatus === 'invited') {
        return {
          status: 'existing',
          membershipStatus: 'pending',
          message: 'Request already pending.',
        };
      }
      return {
        status: 'blocked',
        membershipStatus: racedMembershipStatus,
        message: 'Request could not be submitted. Please try again.',
      };
    }

    return {
      status: nextStatus,
      membershipStatus: nextMembershipStatus,
      message: nextStatus === 'active' ? 'Joined organization.' : 'Request sent.',
    };
  }
}

export const organizationDiscoveryService = new OrganizationDiscoveryService();
