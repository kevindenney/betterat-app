/**
 * HkdwFleetService — thin compat shim.
 *
 * The Phase 10 HKDW Worlds Fleet data layer has been generalized into
 * BlueprintFleetService. This module re-exports the same surface area
 * under the old names so existing call sites compile until they migrate.
 *
 * @deprecated Import from `@/services/BlueprintFleetService` instead.
 */

import {
  getBlueprintPeers,
  type BlueprintFleetPeer,
  type GetBlueprintPeersInput,
} from '@/services/BlueprintFleetService';

export type { BlueprintFleetPeer };

/**
 * Backwards-compatible signature: positional args instead of the new
 * options object. Forwards to BlueprintFleetService.getBlueprintPeers.
 */
export async function getBlueprintFleetPeers(
  blueprintId: string,
  viewerUserId: string,
): Promise<BlueprintFleetPeer[]> {
  const input: GetBlueprintPeersInput = { blueprintId, viewerUserId };
  return getBlueprintPeers(input);
}
