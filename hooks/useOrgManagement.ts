/**
 * useUpdateOrg + useArchiveOrg — TanStack mutations for the
 * EditOrgSheet and Archive CTA on /discover/org/[slug].
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  OrgManagementService,
  type UpdateOrgInput,
} from '@/services/OrgManagementService';

export function useUpdateOrg() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOrgInput) =>
      OrgManagementService.updateOrg(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['my-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['my-verified-admin-orgs'] });
    },
  });
}

export function useArchiveOrg() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orgId: string) => OrgManagementService.archiveOrg(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['my-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['my-verified-admin-orgs'] });
    },
  });
}
