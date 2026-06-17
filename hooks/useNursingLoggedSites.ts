/**
 * useNursingLoggedSites — the REAL "Your shifts" list for the nursing Atlas
 * Sites surface. One entry per site the student has actually logged a clinical
 * shift at, most-recently-active first.
 *
 * This is the honest replacement for the old hardcoded rotation fixture: where
 * `useNursingSiteCoverage` answers "how much have I evidenced per site" (counts
 * only), this joins those counts to the shift records that produced them so the
 * Sites cards can render real name + unit + shift count + last-active date with
 * no fabricated rotation/cohort shape. Returns `[]` until the first shift is
 * logged, which drives the guided empty state.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { useAtlasPois } from '@/hooks/useAtlasPois';
import {
  useNursingSiteCoverage,
  type CoverageCluster,
} from '@/hooks/useNursingSiteCoverage';

export const NURSING_LOGGED_SITES_KEY = 'nursing-logged-sites';

export interface LoggedSite {
  poiId: string;
  name: string;
  /** Unit/specialty from the most recent shift at this site. */
  unit: string | null;
  /** Total shifts logged at this site. */
  shifts: number;
  /** Distinct competencies evidenced here (from located attempts). */
  evidenced: number;
  /** Per-cluster distinct-competency counts (drives the colored bar). */
  byCluster: Record<CoverageCluster, number>;
  /** ISO timestamp of the most recent shift at this site. */
  lastShiftAt: string | null;
}

type ShiftDetailRow = {
  site_poi_id: string | null;
  unit: string | null;
  specialty: string | null;
  shift_start: string | null;
};

export function useNursingLoggedSites(): {
  sites: LoggedSite[];
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { coverage, isLoading: coverageLoading } = useNursingSiteCoverage();
  const { pois, loading: poisLoading } = useAtlasPois();

  const detail = useQuery({
    queryKey: [NURSING_LOGGED_SITES_KEY, user?.id],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, { unit: string | null; lastShiftAt: string | null }>> => {
      const { data, error } = await supabase
        .from('clinical_shifts')
        .select('site_poi_id, unit, specialty, shift_start')
        .eq('student_id', user!.id)
        .not('site_poi_id', 'is', null)
        .order('shift_start', { ascending: false });
      if (error || !data) return {};

      // First row per POI wins (query is newest-first), giving the latest unit.
      const byPoi: Record<string, { unit: string | null; lastShiftAt: string | null }> = {};
      for (const r of data as ShiftDetailRow[]) {
        const poi = r.site_poi_id;
        if (!poi || byPoi[poi]) continue;
        byPoi[poi] = { unit: r.unit ?? r.specialty ?? null, lastShiftAt: r.shift_start ?? null };
      }
      return byPoi;
    },
  });

  const sites = useMemo<LoggedSite[]>(() => {
    const detailByPoi = detail.data ?? {};
    const nameByPoi = new Map(pois.map((p) => [p.id, p.name]));

    return Object.entries(coverage)
      .map(([poiId, cov]) => ({
        poiId,
        name: nameByPoi.get(poiId) ?? 'Clinical site',
        unit: detailByPoi[poiId]?.unit ?? null,
        shifts: cov.shifts,
        evidenced: cov.evidenced,
        byCluster: cov.byCluster,
        lastShiftAt: detailByPoi[poiId]?.lastShiftAt ?? null,
      }))
      .sort((a, b) => {
        const at = a.lastShiftAt ? Date.parse(a.lastShiftAt) : 0;
        const bt = b.lastShiftAt ? Date.parse(b.lastShiftAt) : 0;
        if (bt !== at) return bt - at;
        return b.evidenced - a.evidenced;
      });
  }, [coverage, pois, detail.data]);

  return {
    sites,
    isLoading: coverageLoading || poisLoading || detail.isLoading,
  };
}
