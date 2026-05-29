/**
 * useOrgVerificationRequests — platform-admin queue read + review mutation.
 *
 * RLS gates the SELECT, so non-admin sessions get an empty array (not an
 * error). Review is a single mutation that calls the
 * review_org_verification_request RPC.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OrgVerificationService,
  type AdminVerificationRequestRow,
  type OrgVerificationDecision,
} from '@/services/OrgVerificationService';

const PENDING_KEY = ['admin', 'org-verification-requests', 'pending'] as const;

export function useOrgVerificationRequests() {
  return useQuery<AdminVerificationRequestRow[]>({
    queryKey: PENDING_KEY,
    queryFn: () => OrgVerificationService.listPendingRequests(),
    staleTime: 30 * 1000,
  });
}

export interface ReviewOrgVerificationRequestInput {
  requestId: string;
  decision: OrgVerificationDecision;
  reviewerNotes?: string;
}

export function useReviewOrgVerificationRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReviewOrgVerificationRequestInput) =>
      OrgVerificationService.reviewRequest(
        input.requestId,
        input.decision,
        input.reviewerNotes,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_KEY });
      // Approved requests flip the org — refresh discover too.
      queryClient.invalidateQueries({ queryKey: ['discover-orgs'] });
    },
  });
}
