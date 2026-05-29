/**
 * useOrgAdoptionRequests — visible adoption requests + decide mutation.
 *
 * RLS scopes the SELECT to {target-admin OR proposer OR platform-admin}.
 * The UI distinguishes "inbox" (target-admin pending) from "outbox"
 * (proposer pending) by comparing rows against the signed-in user id.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OrgAdoptionService,
  type AdoptionRequestRowWithOrgs,
  type OrgAdoptionDecision,
  type ProposeAdoptionInput,
} from '@/services/OrgAdoptionService';

const ADOPTION_PENDING_KEY = ['org-adoption-requests', 'pending'] as const;

export function useOrgAdoptionRequests() {
  return useQuery<AdoptionRequestRowWithOrgs[]>({
    queryKey: ADOPTION_PENDING_KEY,
    queryFn: () => OrgAdoptionService.listVisiblePending(),
    staleTime: 30 * 1000,
  });
}

export interface DecideAdoptionInput {
  requestId: string;
  decision: OrgAdoptionDecision;
  decisionNotes?: string;
}

export function useDecideAdoption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DecideAdoptionInput) =>
      OrgAdoptionService.decideAdoption(
        input.requestId,
        input.decision,
        input.decisionNotes,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ADOPTION_PENDING_KEY });
      // Accept flips the target org and stamps blueprints — refresh the
      // surfaces that read them.
      if (variables.decision === 'accepted') {
        queryClient.invalidateQueries({ queryKey: ['discover-orgs'] });
        queryClient.invalidateQueries({ queryKey: ['my-orgs'] });
        queryClient.invalidateQueries({ queryKey: ['blueprints'] });
      }
    },
  });
}

export function useProposeAdoption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ProposeAdoptionInput) =>
      OrgAdoptionService.proposeAdoption(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADOPTION_PENDING_KEY });
    },
  });
}
