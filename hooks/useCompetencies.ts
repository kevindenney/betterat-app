/**
 * useCompetenciesForInterest — Fetches competency definitions for a given interest.
 */

import { useQuery } from '@tanstack/react-query';
import { getCompetencies } from '@/services/competencyService';
import { fetchOwnerOrgCompetencies } from '@/services/CapabilityEvidenceService';
import type { OrgCompetencyOption } from '@/services/CapabilityTagService';
import type { Competency } from '@/types/competency';

export function useCompetenciesForInterest(interestId: string | undefined) {
  return useQuery<Competency[], Error>({
    queryKey: ['competencies', interestId],
    queryFn: () => getCompetencies(interestId!),
    enabled: Boolean(interestId),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

/**
 * useOwnerOrgCompetencies — the org competency framework (org_competencies) the
 * step owner's active org publishes for this interest. This is the same set the
 * admin rollup tracks, so surfacing it in the capability picker lets the student
 * tag against the framework their program actually grades.
 */
export function useOwnerOrgCompetencies(
  userId: string | null | undefined,
  interestId: string | null | undefined,
) {
  return useQuery<OrgCompetencyOption[], Error>({
    queryKey: ['owner-org-competencies', userId, interestId],
    queryFn: () => fetchOwnerOrgCompetencies(userId, interestId),
    enabled: Boolean(userId && interestId),
    staleTime: 5 * 60 * 1000,
  });
}
