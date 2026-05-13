/**
 * useVenueActivityStats
 *
 * Fetches aggregated post count and last-active timestamp per venue
 * via the `get_venue_activity_stats` Supabase RPC. Returns a Map keyed
 * by venue ID for O(1) lookups in the venue directory list.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';

export interface VenueActivityStat {
  postCount: number;
  lastActiveAt: string | null;
}

export function useVenueActivityStats() {
  const [stats, setStats] = useState<Map<string, VenueActivityStat>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const { data, error } = await supabase.rpc('get_venue_activity_stats');
        if (error || !data || cancelled) return;

        const map = new Map<string, VenueActivityStat>();
        for (const row of data as { venue_id: string; post_count: number; last_active_at: string | null }[]) {
          if (row.post_count > 0) {
            map.set(row.venue_id, {
              postCount: Number(row.post_count),
              lastActiveAt: row.last_active_at,
            });
          }
        }
        if (!cancelled) setStats(map);
      } catch {
        // silent
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { stats, isLoading };
}
