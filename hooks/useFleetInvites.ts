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

export const FLEET_INVITES_QUERY_KEY = ['fleet-invites'] as const;

export function useFleetInvites() {
  return useQuery<FleetInvite[]>({
    queryKey: FLEET_INVITES_QUERY_KEY,
    queryFn: () => fleetService.getMyFleetInvites(),
  });
}
