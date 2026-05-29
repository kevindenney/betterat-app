/**
 * OrgVerificationService — verification request submission + admin review.
 *
 * Slice 3 of the create-org flow (spec at
 * docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md). Modeled on
 * YachtClubClaimService — static class with named methods, one for the org
 * admin who wants verification, one for the platform admin who reviews.
 *
 * Auth model:
 *  - requestVerification: org admin (RLS gate in slice 1 migration)
 *  - listPendingRequests: platform admin only (RLS gate in slice 3 migration)
 *  - reviewRequest: calls SECURITY DEFINER RPC, double-gated
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type { OrgVerificationRequest } from '@/types/organization';

const logger = createLogger('OrgVerificationService');

export type OrgVerificationDecision = 'approved' | 'rejected' | 'needs_info';

export interface RequestVerificationInput {
  orgId: string;
  /**
   * Free-form proof — links to a website, photo upload references, etc.
   * Slice 3B will tighten this into a typed shape with Storage refs.
   */
  proof?: Record<string, unknown>;
}

export interface AdminVerificationRequestRow extends OrgVerificationRequest {
  organizations?: {
    id: string;
    name: string;
    slug: string | null;
    organization_type: string | null;
    creation_source: string | null;
    interest_slug: string | null;
  } | null;
  requester?: {
    id: string;
    email: string | null;
    full_name: string | null;
  } | null;
}

class OrgVerificationService {
  /**
   * Org admin submits a verification request. RLS requires the caller to be
   * an active owner/admin/manager of the org (see slice 1 migration).
   */
  static async requestVerification(
    input: RequestVerificationInput,
  ): Promise<OrgVerificationRequest> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const userId = authData?.user?.id;
    if (!userId) {
      throw new Error('Sign in required.');
    }

    const { data, error } = await supabase
      .from('org_verification_requests')
      .insert({
        organization_id: input.orgId,
        requested_by: userId,
        status: 'pending',
        proof: input.proof ?? {},
      })
      .select('*')
      .single();

    if (error) {
      logger.warn('requestVerification insert failed', error);
      throw new Error(error.message || 'Could not submit verification request.');
    }
    return data as OrgVerificationRequest;
  }

  /**
   * Platform-admin only. Returns pending requests with embedded org +
   * requester profile. RLS is the gate; non-admins get an empty array.
   */
  static async listPendingRequests(): Promise<AdminVerificationRequestRow[]> {
    const { data, error } = await supabase
      .from('org_verification_requests')
      .select(
        '*, organizations(id, name, slug, organization_type, creation_source, interest_slug)',
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      logger.warn('listPendingRequests failed', error);
      throw new Error(error.message || 'Could not load verification requests.');
    }

    const rows = (data || []) as AdminVerificationRequestRow[];
    const requesterIds = Array.from(
      new Set(rows.map((r) => r.requested_by).filter(Boolean)),
    );

    if (requesterIds.length === 0) {
      return rows;
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', requesterIds);

    if (profileError) {
      // Profile lookups are best-effort; log and return rows without them.
      logger.warn('listPendingRequests profile join failed', profileError);
      return rows;
    }

    const byId = new Map(
      (profiles || []).map((p: any) => [
        p.id as string,
        {
          id: p.id as string,
          email: (p.email as string) || null,
          full_name: (p.full_name as string) || null,
        },
      ]),
    );

    return rows.map((row) => ({
      ...row,
      requester: byId.get(row.requested_by) || null,
    }));
  }

  /**
   * Platform-admin review. Calls SECURITY DEFINER RPC; double-gated on
   * is_betterat_platform_admin() inside the function body.
   */
  static async reviewRequest(
    requestId: string,
    decision: OrgVerificationDecision,
    reviewerNotes?: string,
  ): Promise<OrgVerificationRequest> {
    const { data, error } = await supabase.rpc('review_org_verification_request', {
      p_request_id: requestId,
      p_decision: decision,
      p_review_note: reviewerNotes?.trim() || null,
    });

    if (error) {
      logger.warn('reviewRequest RPC failed', error);
      throw new Error(error.message || 'Could not update request.');
    }
    return data as OrgVerificationRequest;
  }
}

export { OrgVerificationService };
