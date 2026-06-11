/**
 * useRecordCompetencyEvidence — mutation hook around Codex's
 * record_competency_evidence SECURITY DEFINER RPC.
 *
 * Faculty / instructor / preceptor flow: while looking at a specific
 * student step, attest that the student demonstrated a competency.
 * Writes step_capability_evidence with confirmed=true,
 * org_competency_id set, confirmed_by_user_id=auth.uid(), and the
 * caller's optional notes — which is exactly what
 * admin_competency_evidence_counts (the Dean's heatmap RPC) counts.
 *
 * The RPC validates:
 *   * caller has has_org_role_in(owner/admin/manager/faculty/instructor/
 *     evaluator/preceptor/clinical_instructor) at the org the
 *     competency belongs to
 *   * step owner is an active member of that same org
 *   * the org_competency is active
 *
 * So the UI doesn't have to gate at affordance time; we surface a
 * typed error from the RPC if Patricia somehow taps an attest button
 * on a step she shouldn't.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface RecordCompetencyEvidenceInput {
  stepId: string;
  orgCompetencyId: string;
  notes?: string;
}

export interface RecordCompetencyEvidenceResult {
  evidenceId: string;
}

export async function recordCompetencyEvidence(
  input: RecordCompetencyEvidenceInput,
): Promise<RecordCompetencyEvidenceResult> {
  const { data, error } = await supabase.rpc('record_competency_evidence', {
    p_step_id: input.stepId,
    p_org_competency_id: input.orgCompetencyId,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(error.message || 'Failed to record competency evidence');
  if (!data || typeof data !== 'string') {
    throw new Error('record_competency_evidence returned no evidence id');
  }
  return { evidenceId: data };
}

export function useRecordCompetencyEvidence(stepId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<RecordCompetencyEvidenceInput, 'stepId'>) => {
      if (!stepId) throw new Error('stepId is required');
      return recordCompetencyEvidence({ stepId, ...input });
    },
    onSuccess: () => {
      // Bumps any consumer that reads evidence rows for this step or
      // the admin heatmap that aggregates across confirmed evidence.
      queryClient.invalidateQueries({
        queryKey: ['step-capability-evidence'],
      });
      queryClient.invalidateQueries({
        queryKey: ['admin-competency-evidence'],
      });
      queryClient.invalidateQueries({
        queryKey: ['viewer-org-competency-evidence'],
      });
    },
  });
}
