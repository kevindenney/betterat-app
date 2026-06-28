/**
 * useAffinityGroupRoster — the active member list for a group, hydrated with
 * display name + avatar tint, for the avatar stack on the group page. Gated to
 * members server-side (returns [] for non-members), so this is only enabled
 * once the viewer is known to be a member.
 */

import { useQuery } from '@tanstack/react-query';
import {
  AffinityGroupService,
  type AffinityGroupRosterEntry,
} from '@/services/AffinityGroupService';

export function useAffinityGroupRoster(groupId: string | null | undefined, enabled: boolean) {
  return useQuery<AffinityGroupRosterEntry[]>({
    queryKey: ['affinity-group-roster', groupId],
    enabled: Boolean(groupId) && enabled,
    staleTime: 30_000,
    queryFn: () => AffinityGroupService.getRoster(groupId as string),
  });
}
