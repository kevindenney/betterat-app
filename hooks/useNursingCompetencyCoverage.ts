/**
 * useNursingCompetencyCoverage — framework-wide coverage for the nursing Atlas
 * Coverage surface (N3, the "competency constellation").
 *
 * Where `useNursingSiteCoverage` answers "what have I evidenced *at this site*",
 * this answers the inverse, framework-first question a student actually asks
 * before graduation: "how much of the JHSON framework have I evidenced, where,
 * and what's still a gap?" It joins the same located attempts
 * (`betterat_competency_attempts` tagged `event_type='clinical_shift'`) to their
 * shift's `site_poi_id`, but rolls them up against the *full* competency
 * framework so unevidenced areas surface as honest gaps rather than vanishing.
 *
 * Real data only: the ring, per-category bars, and site list are computed from
 * the student's own logged shifts. Before the first shift, `evidencedTotal` is 0
 * and every category reads as a gap — which is the truthful "am I ready?" state,
 * not a fabricated one.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { CATEGORY_TO_CLUSTER, type CoverageCluster } from '@/hooks/useNursingSiteCoverage';

export const NURSING_COMPETENCY_COVERAGE_KEY = 'nursing-competency-coverage';

export interface CategoryCoverage {
  category: string;
  cluster: CoverageCluster;
  /** Competencies in this framework category. */
  total: number;
  /** Distinct competencies the student has evidenced here. */
  evidenced: number;
}

export interface EvidencedSite {
  poiId: string;
  name: string;
  /** Distinct competencies evidenced at this site. */
  competencies: number;
  /** Shifts logged at this site. */
  shifts: number;
}

export interface CompetencyCoverage {
  /** Total competencies in the framework (the ring denominator). */
  frameworkTotal: number;
  /** Distinct competencies evidenced across all sites (the ring numerator). */
  evidencedTotal: number;
  /** Total shifts logged. */
  shiftsTotal: number;
  /** Per-category rollup, framework order. */
  byCategory: CategoryCoverage[];
  /** Sites where the student has evidenced anything, most-covered first. */
  sites: EvidencedSite[];
  /** Categories with zero evidence, largest first — drives the gap card. */
  gaps: CategoryCoverage[];
}

const clusterOfCategory = (category: string | null): CoverageCluster =>
  (category && CATEGORY_TO_CLUSTER[category]) || 'general';

type CompetencyRow = { id: string; category: string | null };
type AttemptRow = { competency_id: string; event_id: string | null };
type ShiftRow = { id: string; site_poi_id: string | null };
type PoiRow = { id: string; name: string | null };

export function useNursingCompetencyCoverage(): {
  coverage: CompetencyCoverage | null;
  isLoading: boolean;
} {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [NURSING_COMPETENCY_COVERAGE_KEY, user?.id],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async (): Promise<CompetencyCoverage | null> => {
      // 1. The nursing framework — every competency, by category. This is the
      // denominator; it's fixed regardless of what the student has logged.
      const { data: nursing } = await supabase
        .from('interests')
        .select('id')
        .eq('slug', 'nursing')
        .maybeSingle();
      const nursingId = (nursing as { id: string } | null)?.id;
      if (!nursingId) return null;

      const { data: comps, error: compsErr } = await supabase
        .from('betterat_competencies')
        .select('id, category')
        .eq('interest_id', nursingId);
      if (compsErr || !comps || comps.length === 0) return null;

      const categoryOfComp = new Map<string, string>();
      const categoryTotals = new Map<string, number>();
      for (const c of comps as CompetencyRow[]) {
        const cat = c.category ?? 'General';
        categoryOfComp.set(c.id, cat);
        categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + 1);
      }
      const frameworkTotal = comps.length;

      // Framework-order categories (largest first reads as priority).
      const orderedCategories = Array.from(categoryTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([category, total]) => ({
          category,
          total,
          cluster: clusterOfCategory(category),
        }));

      // 2. The student's located attempts (the numerator + the site link).
      const { data: attempts } = await supabase
        .from('betterat_competency_attempts')
        .select('competency_id, event_id')
        .eq('user_id', user!.id)
        .eq('event_type', 'clinical_shift')
        .not('event_id', 'is', null);

      const evidencedComps = new Set<string>();
      const evidencedByCategory = new Map<string, Set<string>>();
      const shiftIds = new Set<string>();
      for (const a of (attempts ?? []) as AttemptRow[]) {
        evidencedComps.add(a.competency_id);
        const cat = categoryOfComp.get(a.competency_id);
        if (cat) {
          let set = evidencedByCategory.get(cat);
          if (!set) {
            set = new Set();
            evidencedByCategory.set(cat, set);
          }
          set.add(a.competency_id);
        }
        if (a.event_id) shiftIds.add(a.event_id);
      }

      const byCategory: CategoryCoverage[] = orderedCategories.map((c) => ({
        ...c,
        evidenced: evidencedByCategory.get(c.category)?.size ?? 0,
      }));

      // 3. Resolve shifts → site POI, then POI → name, for the site list.
      let sites: EvidencedSite[] = [];
      if (shiftIds.size > 0) {
        const { data: shifts } = await supabase
          .from('clinical_shifts')
          .select('id, site_poi_id')
          .in('id', Array.from(shiftIds))
          .not('site_poi_id', 'is', null);
        const shiftToPoi = new Map<string, string>();
        for (const s of (shifts ?? []) as ShiftRow[]) {
          if (s.site_poi_id) shiftToPoi.set(s.id, s.site_poi_id);
        }

        const perSite = new Map<string, { comps: Set<string>; shifts: Set<string> }>();
        for (const a of (attempts ?? []) as AttemptRow[]) {
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

        const poiIds = Array.from(perSite.keys());
        const nameOf = new Map<string, string>();
        if (poiIds.length > 0) {
          const { data: pois } = await supabase
            .from('atlas_pois')
            .select('id, name')
            .in('id', poiIds);
          for (const p of (pois ?? []) as PoiRow[]) {
            if (p.name) nameOf.set(p.id, p.name);
          }
        }

        sites = poiIds
          .map((poiId) => ({
            poiId,
            name: nameOf.get(poiId) ?? 'Clinical site',
            competencies: perSite.get(poiId)!.comps.size,
            shifts: perSite.get(poiId)!.shifts.size,
          }))
          .sort((a, b) => b.competencies - a.competencies);
      }

      const gaps = byCategory
        .filter((c) => c.evidenced === 0)
        .sort((a, b) => b.total - a.total);

      return {
        frameworkTotal,
        evidencedTotal: evidencedComps.size,
        shiftsTotal: shiftIds.size,
        byCategory,
        sites,
        gaps,
      };
    },
  });

  return { coverage: query.data ?? null, isLoading: query.isLoading };
}
