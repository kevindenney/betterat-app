/**
 * useCreateOrg — TanStack mutation wrapping OrgCreationService.createUserOrg.
 *
 * Invalidates Discover org queries on success so the new org surfaces in the
 * list immediately. Returns the created org row so the caller can navigate to
 * /discover/org/<slug>.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orgCreationService } from '@/services/OrgCreationService';
import type { CreatedOrganization, CreateUserOrgInput } from '@/types/organization';

export function useCreateOrg() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserOrgInput): Promise<CreatedOrganization> =>
      orgCreationService.createUserOrg(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discover-orgs'] });
      queryClient.invalidateQueries({ queryKey: ['organization-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['my-orgs'] });
    },
  });
}
