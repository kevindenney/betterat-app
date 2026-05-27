/**
 * useStepCapabilityEvidence — fetches confirmed step_capability_evidence
 * rows for a set of step IDs and returns them grouped by step_id.
 *
 * Used by the timeline-zoom CapabilityMix chart to render the "proven"
 * (solid fill) layer alongside the "planned" (ghost outline) layer
 * derived from each step's metadata.plan.capability_goals.
 *
 * Only confirmed=true rows count — pending/unconfirmed evidence
 * shouldn't poke through the planned ghost. The hook is keyed on a
 * stable hash of the sorted step IDs so React Query reuses the same
 * cache slot even when the array reference changes.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface StepCapabilityEvidenceRow {
  stepId: string;
  capabilityId: string | null;
  capabilityName: string;
  strength: number | null;
  pipLevel: string | null;
  evidenceCount: number | null;
}

const STALE_MS = 30_000;

export function useStepCapabilityEvidence(stepIds: string[]) {
  const key = useMemo(() => {
    if (!stepIds || stepIds.length === 0) return 'empty';
    return [...stepIds].sort().join(',');
  }, [stepIds]);

  return useQuery({
    queryKey: ['step-capability-evidence', key],
    enabled: stepIds.length > 0,
    staleTime: STALE_MS,
    queryFn: async (): Promise<Map<string, StepCapabilityEvidenceRow[]>> => {
      if (stepIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from('step_capability_evidence')
        .select('step_id, capability_id, capability_name, strength, pip_level, evidence_count')
        .eq('confirmed', true)
        .in('step_id', stepIds);
      if (error) throw error;
      const map = new Map<string, StepCapabilityEvidenceRow[]>();
      for (const row of data ?? []) {
        const stepId = row.step_id as string;
        const entry: StepCapabilityEvidenceRow = {
          stepId,
          capabilityId: (row.capability_id as string | null) ?? null,
          capabilityName: String(row.capability_name ?? ''),
          strength: (row.strength as number | null) ?? null,
          pipLevel: (row.pip_level as string | null) ?? null,
          evidenceCount: (row.evidence_count as number | null) ?? null,
        };
        const existing = map.get(stepId);
        if (existing) existing.push(entry);
        else map.set(stepId, [entry]);
      }
      return map;
    },
  });
}
