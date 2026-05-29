/**
 * OrgManagementService — admin-side edit + archive for orgs the caller owns.
 *
 * Slice 5B of the create-org flow (spec at
 * docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md). Pairs with the EditOrgSheet
 * and the Edit/Archive CTAs on /discover/org/[slug].
 *
 * Auth model: the existing organizations_manage_by_owner_or_admin RLS
 * policy gates UPDATE on (created_by = auth.uid()) OR has_org_role(...).
 * No new DB work needed.
 *
 * Archive (vs. delete): per spec section "Abandonment / cleanup", we never
 * hard-delete. Archive flips status='archived', archived_at=now(),
 * is_active=false. The row stays for recovery (RHKYC adopts a dormant fleet
 * in year three → unarchive). Discover hides archived orgs via the
 * is_active filter on organizations_public_read.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type {
  OrganizationJoinMode,
  SelfServeOrgKind,
} from '@/types/organization';

const logger = createLogger('OrgManagementService');

export interface UpdateOrgInput {
  orgId: string;
  name?: string;
  kind?: SelfServeOrgKind;
  joinMode?: OrganizationJoinMode;
  description?: string | null;
}

export interface UpdatedOrganization {
  id: string;
  name: string;
  slug: string;
  organization_type: string;
  join_mode: OrganizationJoinMode;
  metadata: Record<string, unknown> | null;
}

class OrgManagementService {
  static async updateOrg(input: UpdateOrgInput): Promise<UpdatedOrganization> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof input.name === 'string') {
      const trimmed = input.name.trim();
      if (trimmed.length < 2) {
        throw new Error('Name must be at least 2 characters.');
      }
      patch.name = trimmed;
    }
    if (input.kind) {
      patch.organization_type = input.kind;
    }
    if (input.joinMode) {
      patch.join_mode = input.joinMode;
    }
    if (input.description !== undefined) {
      // Description lives in metadata.description (matches CreateOrgSheet).
      // Read-modify-write the metadata blob so we don't clobber other keys.
      const { data: current, error: readError } = await supabase
        .from('organizations')
        .select('metadata')
        .eq('id', input.orgId)
        .maybeSingle();
      if (readError) {
        logger.warn('updateOrg metadata read failed', readError);
        throw new Error(readError.message || 'Could not load org.');
      }
      const nextMetadata = {
        ...((current?.metadata as Record<string, unknown> | null) ?? {}),
      };
      const trimmedDesc = input.description?.trim() || '';
      if (trimmedDesc) {
        nextMetadata.description = trimmedDesc;
      } else {
        delete nextMetadata.description;
      }
      patch.metadata = nextMetadata;
    }

    const { data, error } = await supabase
      .from('organizations')
      .update(patch)
      .eq('id', input.orgId)
      .select(
        'id, name, slug, organization_type, join_mode, metadata',
      )
      .single();

    if (error) {
      logger.warn('updateOrg failed', error);
      throw new Error(error.message || 'Could not update org.');
    }
    return data as UpdatedOrganization;
  }

  /**
   * Soft-archive. Hidden from Discover (is_active=false) but recoverable.
   * A later verified-parent adoption can unarchive.
   */
  static async archiveOrg(orgId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('organizations')
      .update({
        status: 'archived',
        archived_at: nowIso,
        is_active: false,
        updated_at: nowIso,
      })
      .eq('id', orgId);

    if (error) {
      logger.warn('archiveOrg failed', error);
      throw new Error(error.message || 'Could not archive org.');
    }
  }
}

export { OrgManagementService };
