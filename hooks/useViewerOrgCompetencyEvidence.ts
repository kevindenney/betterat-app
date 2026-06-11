/**
 * useViewerOrgCompetencyEvidence — the viewer's confirmed evidence
 * standing against org-framework competencies, all-time.
 *
 * Powers the VISION edit sheet's competency picker: each row shows how
 * much confirmed evidence the viewer already has for that competency
 * (so anchoring a vision reads as "pick the gaps"), and tapping a row
 * drills into the steps where that evidence landed.
 *
 * Distinct from the arc-scoped visionEvidenceByCompetency in the
 * timeline adapter — a brand-new arc would show all-zero there, which
 * defeats the picker's purpose.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface OrgCompetencyEvidenceStep {
  stepId: string;
  stepTitle: string;
  /** Best display date — confirmed_at, else the step's starts_at. */
  whenISO: string | null;
}

export interface ViewerOrgCompetencyEvidence {
  countByCompetency: Record<string, number>;
  stepsByCompetency: Record<string, OrgCompetencyEvidenceStep[]>;
}

const STALE_MS = 60_000;

export function useViewerOrgCompetencyEvidence() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['viewer-org-competency-evidence', user?.id],
    enabled: Boolean(user?.id),
    staleTime: STALE_MS,
    queryFn: async (): Promise<ViewerOrgCompetencyEvidence> => {
      const { data, error } = await supabase
        .from('step_capability_evidence')
        .select(
          'org_competency_id, confirmed_at, timeline_steps!inner(id, title, starts_at, user_id)',
        )
        .eq('confirmed', true)
        .not('org_competency_id', 'is', null)
        .eq('timeline_steps.user_id', user!.id);
      if (error) throw error;

      const countByCompetency: Record<string, number> = {};
      const stepsByCompetency: Record<string, OrgCompetencyEvidenceStep[]> = {};
      // step_id → timeline_steps is many-to-one, so the embed is an
      // object at runtime; the generated types guess an array.
      for (const row of (data ?? []) as unknown as {
        org_competency_id: string;
        confirmed_at: string | null;
        timeline_steps: { id: string; title: string | null; starts_at: string | null };
      }[]) {
        const cid = row.org_competency_id;
        const step = row.timeline_steps;
        countByCompetency[cid] = (countByCompetency[cid] ?? 0) + 1;
        (stepsByCompetency[cid] ??= []).push({
          stepId: step.id,
          stepTitle: step.title?.trim() || 'Untitled step',
          whenISO: row.confirmed_at ?? step.starts_at,
        });
      }
      for (const list of Object.values(stepsByCompetency)) {
        list.sort(
          (a, b) => Date.parse(b.whenISO ?? '0') - Date.parse(a.whenISO ?? '0'),
        );
      }
      return { countByCompetency, stepsByCompetency };
    },
  });
}
