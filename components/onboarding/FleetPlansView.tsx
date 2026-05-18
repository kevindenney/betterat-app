/**
 * FleetPlansView — thin compat shim.
 *
 * The Phase 10 FleetPlansView screen has been extracted into
 * FleetPlansScreen + PeerCard. This file re-exports the same surface
 * under the old names so the /debug/phase10 + /practice/blueprint/[id]/fleet
 * routes keep compiling.
 *
 * @deprecated Import from `@/components/fleets/FleetPlansScreen` instead.
 */

export {
  FleetPlansScreen as FleetPlansView,
} from '@/components/fleets/FleetPlansScreen';

export type {
  FleetPlansScreenProps as FleetPlansViewProps,
  FleetPeer,
  FleetPeerStatus,
} from '@/components/fleets/FleetPlansScreen';
