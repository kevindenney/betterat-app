/**
 * useFleetVenueStats — the viewer's fleet record at one racing area,
 * via the audience-gated atlas_fleet_venue_stats RPC (Phase V.3).
 *
 * Returns null (not an error) when the viewer has no active
 * class_fleet / practice_group affinity group — the sheet simply
 * omits the fleet band in that case.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export const FLEET_VENUE_STATS_KEY = 'fleet-venue-stats';

export interface FleetVenueStats {
  fleetName: string;
  fleetSize: number;
  /** Fleetmates with a planned race at this area (inside the window when given). */
  plannedInWindow: number;
  fleetmates: {
    userId: string;
    displayName: string;
    completedCount: number;
  }[];
}

type RpcShape = {
  fleet_name?: unknown;
  fleet_size?: unknown;
  planned_in_window?: unknown;
  fleetmates?: unknown;
};

function mapStats(raw: RpcShape | null): FleetVenueStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const fleetName = typeof raw.fleet_name === 'string' ? raw.fleet_name : null;
  if (!fleetName) return null;
  const fleetmates = Array.isArray(raw.fleetmates) ? raw.fleetmates : [];
  return {
    fleetName,
    fleetSize: typeof raw.fleet_size === 'number' ? raw.fleet_size : 0,
    plannedInWindow:
      typeof raw.planned_in_window === 'number' ? raw.planned_in_window : 0,
    fleetmates: fleetmates
      .map((m) => {
        const row = m as { user_id?: unknown; display_name?: unknown; completed_count?: unknown };
        if (typeof row.user_id !== 'string') return null;
        return {
          userId: row.user_id,
          displayName: typeof row.display_name === 'string' ? row.display_name : 'Fleetmate',
          completedCount: typeof row.completed_count === 'number' ? row.completed_count : 0,
        };
      })
      .filter((m): m is FleetVenueStats['fleetmates'][number] => m !== null),
  };
}

export function useFleetVenueStats({
  areaPoiId,
  eventWindow,
  enabled = true,
}: {
  areaPoiId: string | null | undefined;
  /** [startIso, endIso] race window; omit for all-time planned counts. */
  eventWindow?: { startIso: string; endIso: string } | null;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const windowKey = eventWindow ? `${eventWindow.startIso}|${eventWindow.endIso}` : 'all';

  return useQuery({
    queryKey: [FLEET_VENUE_STATS_KEY, user?.id, areaPoiId, windowKey],
    enabled: Boolean(enabled && user?.id && areaPoiId),
    staleTime: 60_000,
    queryFn: async (): Promise<FleetVenueStats | null> => {
      const { data, error } = await supabase.rpc('atlas_fleet_venue_stats', {
        p_poi_id: areaPoiId,
        p_event_window: eventWindow
          ? `["${eventWindow.startIso}","${eventWindow.endIso}")`
          : null,
      });
      if (error) throw error;
      return mapStats(data as RpcShape | null);
    },
  });
}
