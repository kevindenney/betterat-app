/**
 * useAuthorAreaCred — "raced here N×" credibility for local-knowledge
 * authors at one racing area (Phase V.4). Counts come from the
 * atlas_author_area_cred RPC, which only reads publicly-visible
 * completed race steps — evidence-based, no new privacy surface.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';

export const AUTHOR_AREA_CRED_KEY = 'author-area-cred';

export function useAuthorAreaCred({
  areaPoiId,
  authorIds,
  enabled = true,
}: {
  areaPoiId: string | null | undefined;
  authorIds: string[];
  enabled?: boolean;
}) {
  const idsKey = [...authorIds].sort().join(',');

  return useQuery({
    queryKey: [AUTHOR_AREA_CRED_KEY, areaPoiId, idsKey],
    enabled: Boolean(enabled && areaPoiId && authorIds.length > 0),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc('atlas_author_area_cred', {
        p_poi_id: areaPoiId,
        p_author_ids: authorIds,
      });
      if (error) throw error;
      const out: Record<string, number> = {};
      if (data && typeof data === 'object') {
        for (const [authorId, count] of Object.entries(data as Record<string, unknown>)) {
          if (typeof count === 'number') out[authorId] = count;
        }
      }
      return out;
    },
  });
}
