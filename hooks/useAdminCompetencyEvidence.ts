/**
 * useAdminCompetencyEvidence — competency × site coverage grid for the
 * dean's "show me where competency-X is being evidenced" view.
 *
 * STUBBED today — the real query joins competencies × step_reflections ×
 * step_location.poi_id when those tables converge. The shape mirrors what
 * the real query will return so the page is rendered against the final
 * data contract.
 *
 * Each cell carries: count of cohort members with evidence + a 0..1
 * intensity so the heatmap colors render consistently. The dean tells
 * you a story by glancing at the colors.
 */

import { useMemo } from 'react';
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

// Demo competency list for the MSN program.
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

// Deterministic per (competencyId, siteId) so the view doesn't reshuffle
// on every render. Hash combines both to give a stable pseudo-distribution.
function pseudoCount(competencyId: string, siteId: string, max: number): number {
  let h = 17;
  const s = `${competencyId}::${siteId}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  // Skew toward higher coverage for procedural at primary sites
  return Math.floor((h % 100) / 100 * max);
}

export function useAdminCompetencyEvidence(orgId: string): AdminCompetencyEvidenceData {
  const sites = useAdminOrgSites(orgId);
  const cohorts = useAdminCohorts(orgId);

  const cohort = cohorts.cohorts[0] ?? null;
  const cohortSize = cohort?.memberCount ?? 0;
  const cohortName = cohort?.name ?? 'No cohort';
  const slug = cohort?.interestSlug ?? 'nursing';

  const competencies = useMemo(
    () => (slug === 'sail-racing' ? SAILING_COMPETENCIES : NURSING_COMPETENCIES),
    [slug],
  );

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
        const count = cohortSize > 0 ? pseudoCount(c.id, site.id, cohortSize) : 0;
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
  }, [competencies, evidenceSites, cohortSize]);

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
