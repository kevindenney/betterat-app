/**
 * useNursingCuratedSites — the curated JHU partner layer for the nursing Atlas
 * (N4). Partnership-gated.
 *
 * Where the Sites surface's rotation grouping is a demo overlay, this is the
 * REAL, authoritative network: the official clinical-placement hospitals and
 * simulation suites a partner institution curates for its students. It is
 * "partnership-gated" — the curated set only surfaces for a student who is an
 * active member of an institution org for the nursing interest (e.g. Johns
 * Hopkins School of Nursing). A student with no such partnership gets an empty
 * set and the surface shows nothing extra, rather than a fabricated network.
 *
 * The link already exists in data: the partner org claims its sites as
 * `atlas_pois` with `claimed_by_org_id = <org>` and `source = 'institution'`.
 * So the curated layer is derived, not invented — including the simulation
 * suites (kind `sim_lab`), which the hospital-only `useAtlasPois` filter drops.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { fetchOrgMembershipRows, type OrgMembershipEmbeddedOrg } from '@/hooks/orgMembershipsQuery';

export const NURSING_CURATED_SITES_KEY = 'nursing-curated-sites';

export type CuratedSiteRole = 'placement' | 'simulation';

export interface CuratedSite {
  poiId: string;
  /** Canonical POI name (what evidence is matched on — never mutated). */
  name: string;
  /** Display label — a curated label (e.g. "Pinkard Sim Suite") when set, else name. */
  label: string;
  role: CuratedSiteRole;
  lat: number | null;
  lng: number | null;
}

export interface PartnerInstitution {
  id: string;
  name: string;
  slug: string | null;
}

export interface NursingCuratedLayer {
  /** The student's partner institution, or null when not in a partnership. */
  partner: PartnerInstitution | null;
  /** Curated sites the partner publishes, simulation last. Empty when ungated. */
  sites: CuratedSite[];
}

const firstOrg = (
  org: OrgMembershipEmbeddedOrg | OrgMembershipEmbeddedOrg[] | null,
): OrgMembershipEmbeddedOrg | null => (Array.isArray(org) ? (org[0] ?? null) : org);

type CuratedPoiRow = {
  id: string;
  name: string;
  kind: string;
  lat: number | null;
  lng: number | null;
  metadata: Record<string, unknown> | null;
};

const labelOf = (row: CuratedPoiRow): string => {
  const curated = row.metadata?.['curated_label'];
  return typeof curated === 'string' && curated.length > 0 ? curated : row.name;
};

export function useNursingCuratedSites(): {
  partner: PartnerInstitution | null;
  sites: CuratedSite[];
  isLoading: boolean;
} {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [NURSING_CURATED_SITES_KEY, user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async (): Promise<NursingCuratedLayer> => {
      // 1. The partnership gate: an active membership in an institution org for
      // the nursing interest. No such membership → no curated layer.
      const memberships = await fetchOrgMembershipRows(user!.id);
      const partnerRow = memberships.find((m) => {
        const org = firstOrg(m.organization);
        const active = m.status === 'active' || m.membership_status === 'active';
        return (
          active &&
          org?.organization_type === 'institution' &&
          org?.interest_slug === 'nursing'
        );
      });
      const partnerOrg = partnerRow ? firstOrg(partnerRow.organization) : null;
      if (!partnerOrg) return { partner: null, sites: [] };

      // 2. The curated network — every site the partner institution claims.
      const { data: rows } = await supabase
        .from('atlas_pois')
        .select('id, name, kind, lat, lng, metadata')
        .eq('claimed_by_org_id', partnerOrg.id)
        .eq('source', 'institution')
        .eq('is_healthcare_site', true)
        .order('kind', { ascending: true })
        .order('name', { ascending: true });

      const sites: CuratedSite[] = ((rows ?? []) as CuratedPoiRow[]).map((r) => ({
        poiId: r.id,
        name: r.name,
        label: labelOf(r),
        role: r.kind === 'sim_lab' ? 'simulation' : 'placement',
        lat: r.lat,
        lng: r.lng,
      }));
      // Placements first, simulation suites last — the order a student reads
      // their network in (real wards, then the lab).
      sites.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'placement' ? -1 : 1;
        return a.label.localeCompare(b.label);
      });

      return {
        partner: { id: partnerOrg.id, name: partnerOrg.name, slug: partnerOrg.slug },
        sites,
      };
    },
  });

  return {
    partner: query.data?.partner ?? null,
    sites: query.data?.sites ?? [],
    isLoading: query.isLoading,
  };
}
