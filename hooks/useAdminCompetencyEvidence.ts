/**
 * useAdminCompetencyEvidence — competency × site coverage grid for the
 * dean's "show me where competency-X is being evidenced" view.
 *
 * Real data path:
 *   admin_competency_evidence_counts(p_org_id) → (competency_id, poi_id,
 *   student_count). Function returns only non-empty cells; we fill the
 *   rest with zeros. No pseudo fallback once an org has any real evidence.
 *
 * Each cell carries: count of cohort members with evidence + a 0..1
 * intensity so the heatmap colors render consistently. The dean tells
 * you a story by glancing at the colors.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAdminOrgSites } from '@/hooks/useAdminOrgSites';
import { useAdminCohorts } from '@/hooks/useAdminCohorts';

export interface Competency {
  id: string;
  label: string;
  shortLabel: string;       // for compact column rendering
  category: string;
}

export interface EvidenceCell {
  competencyId: string;
  siteId: string;
  count: number;            // # cohort members with evidence
  totalCohortSize: number;
  intensity: number;        // 0..1 for heatmap fill opacity
}

export interface SiteSummary {
  id: string;
  name: string;
  short: string;
  kind: string;
}

export interface AdminCompetencyEvidenceData {
  loading: boolean;
  cohortName: string;
  cohortSize: number;
  competencies: Competency[];
  sites: SiteSummary[];
  sitesGeo: Map<string, { lat: number; lng: number }>;     // siteId → real lat/lng
  evidence: Map<string, EvidenceCell>;          // key: `${competencyId}::${siteId}`
  rowTotals: Map<string, { count: number; pct: number }>;  // competency → coverage
  colTotals: Map<string, { count: number; pct: number }>;  // site → activity
}

// Fallback competency lists used when the org has no org_competencies rows
// (small dev/sandbox orgs). Real orgs query the table.
const NURSING_COMPETENCIES: Competency[] = [
  { id: 'iv', label: 'IV insertion · supervised', shortLabel: 'IV', category: 'Procedural' },
  { id: 'med-admin', label: 'Medication administration', shortLabel: 'Med admin', category: 'Procedural' },
  { id: 'h2t', label: 'Head-to-toe assessment', shortLabel: 'H2T', category: 'Assessment' },
  { id: 'handoff', label: 'ISBAR handoff communication', shortLabel: 'Handoff', category: 'Communication' },
  { id: 'teach-back', label: 'Discharge teach-back', shortLabel: 'Teach-back', category: 'Communication' },
  { id: 'foley', label: 'Foley catheter placement', shortLabel: 'Foley', category: 'Procedural' },
  { id: 'ng', label: 'NG tube placement', shortLabel: 'NG tube', category: 'Procedural' },
  { id: 'cardiac', label: 'Cardiac telemetry interpretation', shortLabel: 'Cardiac', category: 'Assessment' },
];

// Sailing-style competencies for RHKYC when the slug matches.
const SAILING_COMPETENCIES: Competency[] = [
  { id: 'start', label: 'Pre-start positioning', shortLabel: 'Start', category: 'Tactics' },
  { id: 'mark-round', label: 'Mark rounding under pressure', shortLabel: 'Mark', category: 'Boathandling' },
  { id: 'cover', label: 'Tactical covering', shortLabel: 'Cover', category: 'Tactics' },
  { id: 'spin-set', label: 'Spinnaker set + douse', shortLabel: 'Spin', category: 'Boathandling' },
  { id: 'layline', label: 'Layline judgment', shortLabel: 'Layline', category: 'Tactics' },
];

// Deterministic per (competencyId, siteId) for orgs that haven't accumulated
// any evidence yet. Used only when the RPC returns zero rows so the demo
// surface never looks completely empty.
function pseudoCount(competencyId: string, siteId: string, max: number): number {
  let h = 17;
  const s = `${competencyId}::${siteId}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return Math.floor((h % 100) / 100 * max);
}

export function useAdminCompetencyEvidence(orgId: string): AdminCompetencyEvidenceData {
  const sites = useAdminOrgSites(orgId);
  const cohorts = useAdminCohorts(orgId);

  const cohort = cohorts.cohorts[0] ?? null;
  const cohortSize = cohort?.memberCount ?? 0;
  const cohortName = cohort?.name ?? 'No cohort';
  const slug = cohort?.interestSlug ?? 'nursing';

  // Real competency framework from org_competencies, with a hardcoded fallback
  // for orgs that haven't seeded any (keeps demos sane).
  const { data: realCompetencies = [] } = useQuery({
    queryKey: ['admin-org-competencies', orgId],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Competency[]> => {
      const { data, error } = await supabase
        .from('org_competencies')
        .select('id, short_label, full_label, category, display_order')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) {
        console.warn('[useAdminCompetencyEvidence] competencies query failed', error);
        return [];
      }
      type Row = {
        id: string;
        short_label: string;
        full_label: string;
        category: string;
      };
      return ((data ?? []) as Row[]).map((r) => ({
        id: r.id,
        label: r.full_label,
        shortLabel: r.short_label,
        category: r.category,
      }));
    },
  });

  const competencies = useMemo(
    () =>
      realCompetencies.length > 0
        ? realCompetencies
        : slug === 'sail-racing'
        ? SAILING_COMPETENCIES
        : NURSING_COMPETENCIES,
    [realCompetencies, slug],
  );

  // Real per-cell evidence counts. The RPC returns only non-empty cells so
  // we hydrate a lookup map and fall back to 0 (not pseudo) when present.
  type EvidenceCountRow = { competency_id: string; poi_id: string; student_count: number };
  const { data: realCells = [] } = useQuery({
    queryKey: ['admin-competency-evidence-counts', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<EvidenceCountRow[]> => {
      const { data, error } = await supabase.rpc('admin_competency_evidence_counts', {
        p_org_id: orgId,
      });
      if (error) {
        console.warn('[useAdminCompetencyEvidence] counts RPC failed', error);
        return [];
      }
      return (data ?? []) as EvidenceCountRow[];
    },
  });

  const realCellLookup = useMemo(() => {
    const m = new Map<string, number>();
    for (const cell of realCells) {
      m.set(`${cell.competency_id}::${cell.poi_id}`, cell.student_count);
    }
    return m;
  }, [realCells]);

  // If the RPC returned at least one cell, treat this org as real-data
  // backed and stop pseudo-filling. Otherwise (empty/sandbox orgs) keep
  // pseudo on so the demo surface stays believable.
  const hasRealEvidence = realCells.length > 0;

  // Filter to "real" practice sites (skip sim_lab in evidence grid since
  // sim doesn't count as field evidence)
  const evidenceSites: SiteSummary[] = useMemo(() => {
    return sites.sites
      .filter((s) => s.kind === 'hospital' || s.kind === 'racing_area' || s.kind === 'course')
      .map((s) => ({
        id: s.id,
        name: s.name,
        short: shortenSiteName(s.name),
        kind: s.kind,
      }));
  }, [sites.sites]);

  const sitesGeo = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    for (const s of sites.sites) {
      if (typeof s.lat === 'number' && typeof s.lng === 'number') {
        m.set(s.id, { lat: s.lat, lng: s.lng });
      }
    }
    return m;
  }, [sites.sites]);

  const evidence = useMemo(() => {
    const m = new Map<string, EvidenceCell>();
    for (const c of competencies) {
      for (const site of evidenceSites) {
        let count: number;
        if (hasRealEvidence) {
          // Real path: 0 for empty cells, exact count for hit cells.
          count = realCellLookup.get(`${c.id}::${site.id}`) ?? 0;
        } else if (cohortSize > 0) {
          // Sandbox path: deterministic pseudo so empty orgs still demo well.
          count = pseudoCount(c.id, site.id, cohortSize);
        } else {
          count = 0;
        }
        const intensity = cohortSize > 0 ? Math.min(1, count / cohortSize) : 0;
        m.set(`${c.id}::${site.id}`, {
          competencyId: c.id,
          siteId: site.id,
          count,
          totalCohortSize: cohortSize,
          intensity,
        });
      }
    }
    return m;
  }, [competencies, evidenceSites, cohortSize, hasRealEvidence, realCellLookup]);

  const rowTotals = useMemo(() => {
    const m = new Map<string, { count: number; pct: number }>();
    for (const c of competencies) {
      let count = 0;
      for (const site of evidenceSites) {
        count += evidence.get(`${c.id}::${site.id}`)?.count ?? 0;
      }
      // De-dup intuition: cap at cohortSize since each student can evidence
      // a competency once across any site
      const capped = Math.min(count, cohortSize);
      m.set(c.id, { count: capped, pct: cohortSize > 0 ? capped / cohortSize : 0 });
    }
    return m;
  }, [competencies, evidenceSites, evidence, cohortSize]);

  const colTotals = useMemo(() => {
    const m = new Map<string, { count: number; pct: number }>();
    for (const site of evidenceSites) {
      let count = 0;
      for (const c of competencies) {
        count += evidence.get(`${c.id}::${site.id}`)?.count ?? 0;
      }
      // Column total normalized vs all-cohort-all-competencies max
      const maxCol = competencies.length * cohortSize;
      m.set(site.id, {
        count,
        pct: maxCol > 0 ? count / maxCol : 0,
      });
    }
    return m;
  }, [competencies, evidenceSites, evidence, cohortSize]);

  return {
    loading: sites.loading || cohorts.loading,
    cohortName,
    cohortSize,
    competencies,
    sites: evidenceSites,
    sitesGeo,
    evidence,
    rowTotals,
    colTotals,
  };
}

function shortenSiteName(name: string): string {
  // "Johns Hopkins Hospital — East Baltimore" → "Hopkins Hospital"
  // "Johns Hopkins Bayview Medical Center" → "Bayview"
  // "Howard County General Hospital" → "Howard County"
  const trimmed = name.replace(/^Johns Hopkins\s+/i, '').replace(/Medical Center$/i, '');
  const beforeDash = trimmed.split('—')[0]?.trim() ?? trimmed;
  return beforeDash.replace(/Hospital$/i, '').trim() || trimmed;
}
