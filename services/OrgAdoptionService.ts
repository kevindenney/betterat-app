/**
 * OrgAdoptionService — propose + decide adoption requests.
 *
 * Slice 4A of the create-org flow (spec at
 * docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md). Modeled on the verification
 * service from slice 3: SECURITY DEFINER RPCs do the real authorization +
 * mutation work, the service layer is a thin typed wrapper.
 *
 * Flow:
 *  1. Verified-parent admin calls proposeAdoption → row in
 *     org_adoption_requests with status='pending'.
 *  2. Target org admin sees it in their inbox (listMyPendingAdoptions).
 *  3. Target admin calls decideAdoption('accepted' | 'declined').
 *  4. On accepted, target.parent_org_id is set, target flips to verified,
 *     and every blueprint under target gets adopted_at stamped (the
 *     "Carried over" pill flag from the spec).
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type { OrgAdoptionRequest } from '@/types/organization';

const logger = createLogger('OrgAdoptionService');

export type OrgAdoptionDecision = 'accepted' | 'declined' | 'withdrawn';

export interface ProposeAdoptionInput {
  parentOrgId: string;
  targetOrgId: string;
  message?: string;
}

export interface AdoptionRequestRowWithOrgs extends OrgAdoptionRequest {
  proposedParent?: {
    id: string;
    name: string;
    slug: string | null;
    organization_type: string | null;
  } | null;
  target?: {
    id: string;
    name: string;
    slug: string | null;
    organization_type: string | null;
    creation_source: string | null;
  } | null;
  proposer?: {
    id: string;
    email: string | null;
    full_name: string | null;
  } | null;
}

class OrgAdoptionService {
  /**
   * Verified-parent admin opens an adoption request. RPC enforces:
   *  - parent.official = true
   *  - caller is admin/owner/manager of parent
   *  - target has no parent yet and isn't already verified+claimed.
   * Returns the pending request row.
   */
  static async proposeAdoption(
    input: ProposeAdoptionInput,
  ): Promise<OrgAdoptionRequest> {
    const { data, error } = await supabase.rpc('propose_org_adoption', {
      p_parent_org_id: input.parentOrgId,
      p_target_org_id: input.targetOrgId,
      p_message: input.message?.trim() || null,
    });

    if (error) {
      logger.warn('proposeAdoption RPC failed', error);
      throw new Error(error.message || 'Could not propose adoption.');
    }
    return data as OrgAdoptionRequest;
  }

  /**
   * List pending adoption requests visible to the caller via RLS:
   *  - target-admin policy → requests targeting orgs I admin
   *  - proposer policy → requests I proposed
   *  - platform-admin policy → all
   * Includes embedded parent + target org rows and best-effort proposer
   * profile lookup for the UI.
   */
  static async listVisiblePending(): Promise<AdoptionRequestRowWithOrgs[]> {
    const { data, error } = await supabase
      .from('org_adoption_requests')
      .select(
        `
          *,
          proposedParent:organizations!proposed_parent_org_id(id, name, slug, organization_type),
          target:organizations!target_org_id(id, name, slug, organization_type, creation_source)
        `,
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.warn('listVisiblePending failed', error);
      throw new Error(error.message || 'Could not load adoption requests.');
    }

    const rows = (data || []) as AdoptionRequestRowWithOrgs[];
    const proposerIds = Array.from(
      new Set(rows.map((r) => r.proposed_by).filter(Boolean)),
    );
    if (proposerIds.length === 0) {
      return rows;
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', proposerIds);

    if (profileError) {
      logger.warn('listVisiblePending profile join failed', profileError);
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
      proposer: byId.get(row.proposed_by) || null,
    }));
  }

  /**
   * Target admin (or proposer for 'withdrawn') decides. RPC enforces auth
   * and runs the side-effects (parent_org_id, flips, blueprint stamping).
   */
  static async decideAdoption(
    requestId: string,
    decision: OrgAdoptionDecision,
    decisionNotes?: string,
  ): Promise<OrgAdoptionRequest> {
    const { data, error } = await supabase.rpc('decide_org_adoption', {
      p_request_id: requestId,
      p_decision: decision,
      p_decision_notes: decisionNotes?.trim() || null,
    });

    if (error) {
      logger.warn('decideAdoption RPC failed', error);
      throw new Error(error.message || 'Could not update adoption request.');
    }
    return data as OrgAdoptionRequest;
  }
}

export { OrgAdoptionService };
