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
  type OrgVerificationRequestScope,
  type AdminVerificationRequestRow,
  type OrgVerificationDecision,
} from '@/services/OrgVerificationService';

const ORG_VERIFICATION_REQUESTS_KEY_PREFIX = [
  'admin',
  'org-verification-requests',
] as const;

export function orgVerificationRequestsQueryKey(
  scope: OrgVerificationRequestScope = 'pending',
) {
  return [...ORG_VERIFICATION_REQUESTS_KEY_PREFIX, scope] as const;
}

export function useOrgVerificationRequests(scope: OrgVerificationRequestScope = 'pending') {
  const queryKey = orgVerificationRequestsQueryKey(scope);

  return useQuery<AdminVerificationRequestRow[]>({
    queryKey,
    queryFn: () => OrgVerificationService.listRequests(scope),
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
      queryClient.invalidateQueries({
        queryKey: ORG_VERIFICATION_REQUESTS_KEY_PREFIX,
      });
      // Approved requests flip the org — refresh discover too.
      queryClient.invalidateQueries({ queryKey: ['discover-orgs'] });
    },
  });
}
