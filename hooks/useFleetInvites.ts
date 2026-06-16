/**
 * useFleetInvites — pending fleet invites addressed to the current user.
 *
 * Backs the "Fleet invites" group in the Act panel of /(tabs)/inbox and
 * feeds useInboxCount so the bottom tab badge reflects them. Reads through
 * the get_my_fleet_invites SECURITY DEFINER RPC (fleets SELECT RLS is
 * creator/public-only, so a private fleet's name only resolves via the RPC).
 */

import { useQuery } from '@tanstack/react-query';
import { fleetService, type FleetInvite } from '@/services/fleetService';
import { useAuth } from '@/providers/AuthProvider';

export const FLEET_INVITES_QUERY_KEY = ['fleet-invites'] as const;

export function useFleetInvites() {
  const { user } = useAuth();
  return useQuery<FleetInvite[]>({
    queryKey: FLEET_INVITES_QUERY_KEY,
    queryFn: () => fleetService.getMyFleetInvites(),
    // get_my_fleet_invites relies on auth.uid(); running it signed-out throws
    // and surfaces a "[FleetService] Error loading fleet invites" toast on the
    // welcome screen.
    enabled: Boolean(user?.id),
  });
}
