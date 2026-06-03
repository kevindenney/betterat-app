/**
 * useNursingSiteCoverage — REAL per-site competency coverage for the nursing
 * Atlas Sites surface (N2/N3).
 *
 * The N1 Sites cards shipped with demo coverage because attempts weren't
 * located. N2's Log-a-shift loop fixes that: a logged shift writes
 * `betterat_competency_attempts` rows tagged `event_type='clinical_shift',
 * event_id=<clinical_shifts.id>`. That row's shift carries `site_poi_id`, so
 * an attempt is now locatable to a site. This hook joins the two (no FK exists
 * for a supabase embed — the link is polymorphic — so we do two reads) and
 * returns distinct evidenced competencies per site POI, bucketed into the five
 * visual clusters the Sites cards already render.
 *
 * Returns an empty map until the student logs their first shift; the Sites
 * surface falls back to its labeled demo coverage in that case, so coverage is
 * never fabricated and never blank-looking.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export const NURSING_SITE_COVERAGE_KEY = 'nursing-site-coverage';

// Visual clusters used by the Sites coverage bar. The AACN framework stores 15
// text categories; collapse them to the five hues the cards already use so a
// logged competency lands in a colored segment. Categories not listed map to
// 'general'.
export type CoverageCluster = 'cardiac' | 'resp' | 'med' | 'general' | 'assess';

export const CATEGORY_TO_CLUSTER: Record<string, CoverageCluster> = {
  'Assessment Skills': 'assess',
  'Critical Thinking': 'assess',
  'Person-Centered Care': 'assess',
  'Patient Care': 'assess',
  'Medication Administration': 'med',
  'Clinical Procedures': 'general',
  'Quality and Safety': 'general',
  'Systems-Based Practice': 'general',
};

export interface SiteCoverage {
  /** Distinct competencies evidenced at this site via logged shifts. */
  evidenced: number;
  /** Per-cluster distinct-competency counts (drives the colored bar). */
  byCluster: Record<CoverageCluster, number>;
  /** Total shifts logged at this site. */
  shifts: number;
}

export type NursingSiteCoverageMap = Record<string, SiteCoverage>;

type AttemptRow = { competency_id: string; event_id: string | null };
type ShiftRow = { id: string; site_poi_id: string | null };
type CompetencyRow = { id: string; category: string | null };

export function useNursingSiteCoverage(): {
  coverage: NursingSiteCoverageMap;
  isLoading: boolean;
} {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [NURSING_SITE_COVERAGE_KEY, user?.id],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async (): Promise<NursingSiteCoverageMap> => {
      // 1. The student's shift-located competency attempts.
      const { data: attempts, error: attemptsErr } = await supabase
        .from('betterat_competency_attempts')
        .select('competency_id, event_id')
        .eq('user_id', user!.id)
        .eq('event_type', 'clinical_shift')
        .not('event_id', 'is', null);
      if (attemptsErr || !attempts || attempts.length === 0) return {};

      const shiftIds = Array.from(
        new Set((attempts as AttemptRow[]).map((a) => a.event_id).filter((v): v is string => Boolean(v))),
      );
      const competencyIds = Array.from(
        new Set((attempts as AttemptRow[]).map((a) => a.competency_id)),
      );
      if (shiftIds.length === 0) return {};

      // 2. Resolve each shift to its site POI (the location link).
      const { data: shifts, error: shiftsErr } = await supabase
        .from('clinical_shifts')
        .select('id, site_poi_id')
        .in('id', shiftIds)
        .not('site_poi_id', 'is', null);
      if (shiftsErr || !shifts) return {};
      const shiftToPoi = new Map<string, string>();
      for (const s of shifts as ShiftRow[]) {
        if (s.site_poi_id) shiftToPoi.set(s.id, s.site_poi_id);
      }

      // 3. Category lookup → cluster bucket.
      const { data: comps } = await supabase
        .from('betterat_competencies')
        .select('id, category')
        .in('id', competencyIds);
      const clusterOf = new Map<string, CoverageCluster>();
      for (const c of (comps ?? []) as CompetencyRow[]) {
        clusterOf.set(c.id, (c.category && CATEGORY_TO_CLUSTER[c.category]) || 'general');
      }

      // 4. Aggregate distinct competencies per site POI.
      const perSite = new Map<string, { comps: Set<string>; shifts: Set<string> }>();
      for (const a of attempts as AttemptRow[]) {
        const poi = a.event_id ? shiftToPoi.get(a.event_id) : undefined;
        if (!poi) continue;
        let bucket = perSite.get(poi);
        if (!bucket) {
          bucket = { comps: new Set(), shifts: new Set() };
          perSite.set(poi, bucket);
        }
        bucket.comps.add(a.competency_id);
        if (a.event_id) bucket.shifts.add(a.event_id);
      }

      const result: NursingSiteCoverageMap = {};
      for (const [poi, bucket] of perSite) {
        const byCluster: Record<CoverageCluster, number> = {
          cardiac: 0,
          resp: 0,
          med: 0,
          general: 0,
          assess: 0,
        };
        for (const compId of bucket.comps) {
          byCluster[clusterOf.get(compId) ?? 'general'] += 1;
        }
        result[poi] = {
          evidenced: bucket.comps.size,
          byCluster,
          shifts: bucket.shifts.size,
        };
      }
      return result;
    },
  });

  return { coverage: query.data ?? {}, isLoading: query.isLoading };
}
