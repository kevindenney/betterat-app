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
 *  - listRequests: platform admin sees all; requesters see their own rows via RLS
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
  reviewer?: {
    id: string;
    email: string | null;
    full_name: string | null;
  } | null;
}

export type OrgVerificationRequestScope = 'pending' | 'history' | 'all';

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
   * Request list for the review console. Platform admins can see all rows;
   * requesters can see their own rows via RLS. Scope controls whether the
   * caller wants the active queue, past decisions, or everything.
   */
  static async listRequests(
    scope: OrgVerificationRequestScope = 'pending',
  ): Promise<AdminVerificationRequestRow[]> {
    let query = supabase
      .from('org_verification_requests')
      .select(
        '*, organizations(id, name, slug, organization_type, creation_source, interest_slug)',
      );

    if (scope === 'pending') {
      query = query
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    } else if (scope === 'history') {
      query = query
        .neq('status', 'pending')
        .order('decided_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    } else {
      query = query
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query.limit(200);

    if (error) {
      logger.warn('listRequests failed', { scope, error });
      throw new Error(error.message || 'Could not load verification requests.');
    }

    const rows = (data || []) as AdminVerificationRequestRow[];
    const profileIds = Array.from(
      new Set(
        rows
          .flatMap((r) => [r.requested_by, r.reviewer_id])
          .filter(Boolean),
      ),
    );

    if (profileIds.length === 0) {
      return rows;
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', profileIds);

    if (profileError) {
      // Profile lookups are best-effort; log and return rows without them.
      logger.warn('listRequests profile join failed', { scope, error: profileError });
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
      reviewer: row.reviewer_id ? byId.get(row.reviewer_id) || null : null,
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
