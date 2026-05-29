/**
 * OrgCreationService — self-serve org creation.
 *
 * Slice 2 of the create-org flow (spec at
 * docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md).
 *
 * Inserts an organization with creation_source='user', official=false,
 * claim_status='unclaimed', and immediately creates an owner membership for
 * the caller. The user-created → verified handoff (adoption) is a separate
 * service that ships in slice 4.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type {
  CreatedOrganization,
  CreateUserOrgInput,
  OrganizationCreationSource,
} from '@/types/organization';

const logger = createLogger('OrgCreationService');

export interface SimilarOrgMatch {
  id: string;
  name: string;
  slug: string | null;
  organization_type: string | null;
  creation_source: string | null;
  official: boolean | null;
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, '');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function randomSuffix(length = 4): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

class OrgCreationService {
  /**
   * Create a self-serve organization on behalf of the signed-in user. The
   * caller becomes owner with active membership; the org is unclaimed and
   * unofficial (creation_source='user'). Returns the inserted row so the UI
   * can redirect to its detail page.
   *
   * Idempotency: name collisions get a random slug suffix. Fuzzy-match
   * deduplication happens at the form layer (slice 2B), not here.
   */
  async createUserOrg(input: CreateUserOrgInput): Promise<CreatedOrganization> {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Name is required.');
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const userId = authData?.user?.id;
    if (!userId) {
      throw new Error('Sign in required.');
    }

    const baseSlug = slugify(name) || 'org';
    const slug = `${baseSlug}-${randomSuffix()}`;

    const interestSlug = input.interestSlug?.trim() || 'general';

    const creationSource: OrganizationCreationSource = 'user';

    const orgPayload: Record<string, unknown> = {
      name,
      slug,
      organization_type: input.kind,
      join_mode: input.joinMode,
      interest_slug: interestSlug,
      creation_source: creationSource,
      official: false,
      claim_status: 'unclaimed',
      status: 'active',
      is_active: true,
      verification_mode: 'none',
      created_by: userId,
      parent_org_id: input.parentOrgId || null,
      metadata: input.description?.trim()
        ? { description: input.description.trim() }
        : {},
    };

    const { data: orgRow, error: orgError } = await supabase
      .from('organizations')
      .insert(orgPayload)
      .select(
        'id, name, slug, organization_type, join_mode, creation_source, interest_slug, status, official, claim_status, parent_org_id',
      )
      .single();

    if (orgError) {
      logger.warn('createUserOrg insert failed', orgError);
      throw new Error(orgError.message || 'Could not create organization.');
    }

    const nowIso = new Date().toISOString();
    const { error: membershipError } = await supabase
      .from('organization_memberships')
      .insert({
        organization_id: orgRow.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
        membership_status: 'active',
        is_verified: true,
        // Allowed values: invite | email_domain | sso | admin | self_join.
        // Self-serve creator is semantically a self_join — they're not
        // invited or domain-matched, they created the org and joined it.
        verification_source: 'self_join',
        verified_at: nowIso,
        joined_at: nowIso,
      });

    if (membershipError) {
      logger.warn('createUserOrg membership insert failed', membershipError);
      throw new Error(
        membershipError.message || 'Created org, but could not assign you as owner.',
      );
    }

    return orgRow as CreatedOrganization;
  }

  /**
   * Fuzzy name match for the *"Did you mean…?"* dedup prompt in the create
   * sheet. Plain ilike against name + slug; pg_trgm isn't installed so this
   * stays cheap and predictable. Returns up to 5 candidates.
   */
  async findSimilarOrgs(name: string): Promise<SimilarOrgMatch[]> {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      return [];
    }
    const q = escapeLike(trimmed);
    if (!q) {
      return [];
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, organization_type, creation_source, official')
      .or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
      .eq('is_active', true)
      .order('official', { ascending: false })
      .order('name', { ascending: true })
      .limit(5);

    if (error) {
      logger.warn('findSimilarOrgs failed', error);
      return [];
    }
    return (data || []) as SimilarOrgMatch[];
  }
}

export const orgCreationService = new OrgCreationService();
