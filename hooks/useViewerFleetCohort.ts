/**
 * useViewerFleetCohort — fetches every user who shares a fleet with
 * the viewer, keyed by user_id → list of shared fleets.
 *
 * Powers the FLEET section's per-fleet grouping on L3. Returns empty
 * when the viewer belongs to no fleets, or when those fleets have no
 * other active members — the chart then falls through to its flat
 * "everyone in Other" render with no subheaders.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface FleetRef {
  id: string;
  name: string;
}

export interface ViewerFleetCohort {
  /** Fleets the viewer is an active member of. */
  fleets: FleetRef[];
  /** Map of peer user_id → list of fleets they share with the viewer. */
  peerToFleets: Map<string, FleetRef[]>;
}

const STALE_MS = 60_000;

export function useViewerFleetCohort() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['viewer-fleet-cohort', user?.id],
    enabled: Boolean(user?.id),
    staleTime: STALE_MS,
    queryFn: async (): Promise<ViewerFleetCohort> => {
      const empty: ViewerFleetCohort = { fleets: [], peerToFleets: new Map() };
      if (!user?.id) return empty;

      // 1. Viewer's active fleet memberships.
      const { data: ownerships } = await supabase
        .from('fleet_members')
        .select('fleet_id')
        .eq('user_id', user.id)
        .eq('status', 'active');
      const viewerFleetIds = Array.from(
        new Set(
          ((ownerships ?? []) as { fleet_id: string }[]).map((r) => r.fleet_id),
        ),
      );
      if (viewerFleetIds.length === 0) return empty;

      // 2. Display names for those fleets.
      const { data: fleetRows } = await supabase
        .from('fleets')
        .select('id, name')
        .in('id', viewerFleetIds);
      const fleets: FleetRef[] = ((fleetRows ?? []) as { id: string; name: string }[]).map(
        (r) => ({ id: r.id, name: r.name }),
      );
      const fleetById = new Map(fleets.map((f) => [f.id, f]));

      // 3. Every other active member of those fleets — that's the
      //    set of peers the FLEET section can possibly group under.
      const { data: cohort } = await supabase
        .from('fleet_members')
        .select('fleet_id, user_id')
        .in('fleet_id', viewerFleetIds)
        .eq('status', 'active')
        .neq('user_id', user.id);

      const peerToFleets = new Map<string, FleetRef[]>();
      for (const row of (cohort ?? []) as { fleet_id: string; user_id: string }[]) {
        const f = fleetById.get(row.fleet_id);
        if (!f) continue;
        const list = peerToFleets.get(row.user_id) ?? [];
        if (!list.find((x) => x.id === f.id)) list.push(f);
        peerToFleets.set(row.user_id, list);
      }

      return { fleets, peerToFleets };
    },
  });
}
