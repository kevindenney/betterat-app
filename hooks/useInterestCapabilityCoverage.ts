/**
 * useInterestCapabilityCoverage — framework-wide capability coverage for the
 * generic Atlas "Capabilities" segment (the non-nursing analogue of
 * `useNursingCompetencyCoverage`).
 *
 * Answers the same framework-first question for any interest: "how much of this
 * craft's capability framework have I evidenced, where, and what's still a gap?"
 * It rolls the user's `betterat_competency_attempts` up against the *full*
 * `betterat_competencies` framework for the active interest, so unevidenced
 * areas surface as honest gaps rather than vanishing.
 *
 * Sourcing rules (per product decision):
 *  - With an active interest → the interest's `betterat_competencies` is the
 *    framework. Org/blueprint-authored competencies already live in that table
 *    (interest-scoped, with `organization_id` set), so joining an org or
 *    subscribing a blueprint that adds competencies grows the denominator for
 *    free.
 *  - With no interest → a small built-in **general** capability set so the ring
 *    still renders.
 *  - Evidence grows as the user logs steps / links library concepts: every
 *    `betterat_competency_attempts` row (any `event_type`) counts, and located
 *    attempts resolve their `event_id` → step → POI for the "where evidenced"
 *    list.
 *
 * Real data only: before the first attempt, `evidencedTotal` is 0 and every
 * category reads as a gap — the truthful "am I ready?" state.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export const INTEREST_CAPABILITY_COVERAGE_KEY = 'interest-capability-coverage';

export interface CapabilityCompetency {
  id: string;
  title: string;
  evidenced: boolean;
}

export interface CapabilityCategoryCoverage {
  category: string;
  /** Competencies in this framework category. */
  total: number;
  /** Distinct competencies the user has evidenced in this category. */
  evidenced: number;
  /** Every competency id in this category (the framework rows). */
  competencyIds: string[];
  /** Competency ids in this category the user has NOT yet evidenced. */
  unevidencedCompetencyIds: string[];
  /** The individual competencies in this category, for the detail sheet. */
  competencies: CapabilityCompetency[];
}

export interface CapabilityEvidencedSite {
  poiId: string;
  name: string;
  /** Distinct competencies evidenced at this site. */
  competencies: number;
  /** Steps that produced evidence at this site. */
  steps: number;
}

export interface InterestCapabilityCoverage {
  /** Total competencies in the framework (the ring denominator). */
  frameworkTotal: number;
  /** Distinct competencies evidenced across all attempts (the ring numerator). */
  evidencedTotal: number;
  /** Total located steps that produced evidence. */
  stepsTotal: number;
  /** Per-category rollup, largest framework category first. */
  byCategory: CapabilityCategoryCoverage[];
  /** Sites where the user has evidenced anything, most-covered first. */
  sites: CapabilityEvidencedSite[];
  /** Categories with zero evidence, largest first — drives the gap card. */
  gaps: CapabilityCategoryCoverage[];
  /** True when the framework is the built-in general set (no interest). */
  isGeneralFramework: boolean;
}

/**
 * Cross-interest "general" capabilities — the honest denominator when no
 * interest is active. Deliberately small and craft-neutral: the meta-skills the
 * platform's plan → do → review loop builds regardless of domain.
 */
const GENERAL_FRAMEWORK: { category: string; titles: string[] }[] = [
  { category: 'Planning', titles: ['Set a clear goal', 'Break work into steps', 'Schedule practice'] },
  { category: 'Practice', titles: ['Log consistent reps', 'Work at the edge of ability', 'Build on prior steps'] },
  { category: 'Reflection', titles: ['Review what happened', 'Name what to change', 'Track progress over time'] },
  { category: 'Feedback', titles: ['Seek outside input', 'Apply a correction', 'Close the loop'] },
];

type CompetencyRow = { id: string; category: string | null; title: string | null };
type AttemptRow = { competency_id: string; event_id: string | null };
type StepRow = { id: string; metadata: unknown };
type PoiRow = { id: string; name: string | null };

function buildGeneralCoverage(): InterestCapabilityCoverage {
  const byCategory = GENERAL_FRAMEWORK.map((c) => ({
    category: c.category,
    total: c.titles.length,
    evidenced: 0,
    competencyIds: [],
    unevidencedCompetencyIds: [],
    competencies: c.titles.map((title, i) => ({
      id: `general:${c.category}:${i}`,
      title,
      evidenced: false,
    })),
  }));
  const frameworkTotal = byCategory.reduce((sum, c) => sum + c.total, 0);
  return {
    frameworkTotal,
    evidencedTotal: 0,
    stepsTotal: 0,
    byCategory,
    sites: [],
    gaps: [...byCategory].sort((a, b) => b.total - a.total),
    isGeneralFramework: true,
  };
}

function poiIdFromStepMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const plan = (metadata as { plan?: unknown }).plan;
  if (!plan || typeof plan !== 'object') return null;
  const where = (plan as { where_location?: unknown }).where_location;
  if (!where || typeof where !== 'object') return null;
  const poiId = (where as { poi_id?: unknown }).poi_id;
  return typeof poiId === 'string' && poiId.length > 0 ? poiId : null;
}

export function useInterestCapabilityCoverage(
  interestId: string | null,
  _slug?: string | null,
): { coverage: InterestCapabilityCoverage | null; isLoading: boolean } {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [INTEREST_CAPABILITY_COVERAGE_KEY, user?.id, interestId],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async (): Promise<InterestCapabilityCoverage | null> => {
      // No active interest → honest general framework.
      if (!interestId) return buildGeneralCoverage();

      // 1. Framework (denominator). Org/blueprint-authored competencies live in
      // the same interest-scoped table, so this already reflects a joined org.
      const { data: comps, error: compsErr } = await supabase
        .from('betterat_competencies')
        .select('id, category, title')
        .eq('interest_id', interestId);
      if (compsErr) return null;
      // Interest with no framework yet → fall back to the general set so the
      // surface still renders something honest instead of a blank screen.
      if (!comps || comps.length === 0) return buildGeneralCoverage();

      const categoryOfComp = new Map<string, string>();
      const categoryTotals = new Map<string, number>();
      const idsByCategory = new Map<string, string[]>();
      const titleOfComp = new Map<string, string>();
      for (const c of comps as CompetencyRow[]) {
        const cat = c.category ?? 'General';
        categoryOfComp.set(c.id, cat);
        titleOfComp.set(c.id, c.title ?? 'Capability');
        categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + 1);
        const ids = idsByCategory.get(cat);
        if (ids) ids.push(c.id);
        else idsByCategory.set(cat, [c.id]);
      }
      const frameworkTotal = comps.length;

      const orderedCategories = Array.from(categoryTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([category, total]) => ({ category, total }));

      // 2. Evidence (numerator + the site link). Any attempt counts — evidence
      // accrues as the user logs steps and links library concepts.
      const compIds = (comps as CompetencyRow[]).map((c) => c.id);
      const { data: attempts } = await supabase
        .from('betterat_competency_attempts')
        .select('competency_id, event_id')
        .eq('user_id', user!.id)
        .in('competency_id', compIds);

      const evidencedComps = new Set<string>();
      const evidencedByCategory = new Map<string, Set<string>>();
      const stepIds = new Set<string>();
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
        if (a.event_id) stepIds.add(a.event_id);
      }

      const byCategory: CapabilityCategoryCoverage[] = orderedCategories.map((c) => {
        const ids = idsByCategory.get(c.category) ?? [];
        const evidencedSet = evidencedByCategory.get(c.category);
        return {
          ...c,
          evidenced: evidencedSet?.size ?? 0,
          competencyIds: ids,
          unevidencedCompetencyIds: ids.filter((id) => !evidencedSet?.has(id)),
          competencies: ids.map((id) => ({
            id,
            title: titleOfComp.get(id) ?? 'Capability',
            evidenced: evidencedSet?.has(id) ?? false,
          })),
        };
      });

      // 3. Resolve located attempts → step → POI for the "where evidenced" list.
      let sites: CapabilityEvidencedSite[] = [];
      if (stepIds.size > 0) {
        const { data: steps } = await supabase
          .from('timeline_steps')
          .select('id, metadata')
          .in('id', Array.from(stepIds));
        const stepToPoi = new Map<string, string>();
        for (const s of (steps ?? []) as StepRow[]) {
          const poiId = poiIdFromStepMetadata(s.metadata);
          if (poiId) stepToPoi.set(s.id, poiId);
        }

        const perSite = new Map<string, { comps: Set<string>; steps: Set<string> }>();
        for (const a of (attempts ?? []) as AttemptRow[]) {
          const poi = a.event_id ? stepToPoi.get(a.event_id) : undefined;
          if (!poi) continue;
          let bucket = perSite.get(poi);
          if (!bucket) {
            bucket = { comps: new Set(), steps: new Set() };
            perSite.set(poi, bucket);
          }
          bucket.comps.add(a.competency_id);
          if (a.event_id) bucket.steps.add(a.event_id);
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
            name: nameOf.get(poiId) ?? 'Site',
            competencies: perSite.get(poiId)!.comps.size,
            steps: perSite.get(poiId)!.steps.size,
          }))
          .sort((a, b) => b.competencies - a.competencies);
      }

      const gaps = byCategory
        .filter((c) => c.evidenced === 0)
        .sort((a, b) => b.total - a.total);

      return {
        frameworkTotal,
        evidencedTotal: evidencedComps.size,
        stepsTotal: stepIds.size,
        byCategory,
        sites,
        gaps,
        isGeneralFramework: false,
      };
    },
  });

  return { coverage: query.data ?? null, isLoading: query.isLoading };
}
