/**
 * useStepCompleteCelebration — resolve all the data needed to render the
 * Phase 10 PR-4 step-complete moment for a subscribed-blueprint step.
 *
 * Returns:
 *   - sessionCount: from act.observations + media counts
 *   - fleetPosition: { ahead, sameStep, behind } among fleet peers
 *   - nextStep: { blueprintStepId, sourceStepId, stepNumber, title } or null
 *     when this is the last step in the blueprint
 *   - alreadyAdopted: true if the next step is already in the viewer's timeline
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { StepActData } from '@/types/step-detail';

export interface StepCompleteCelebrationData {
  sessionCount: number;
  fleet: {
    ahead: number;
    sameStep: number;
    behind: number;
  };
  next: {
    sourceStepId: string;
    stepNumber: number;
    totalSteps: number;
    title: string;
    alreadyAdoptedStepId: string | null;
  } | null;
}

interface UseStepCompleteCelebrationInput {
  stepId: string | null | undefined;
  blueprintId: string | null | undefined;
  sourceStepId: string | null | undefined;
}

export function useStepCompleteCelebration({
  stepId,
  blueprintId,
  sourceStepId,
}: UseStepCompleteCelebrationInput) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  return useQuery<StepCompleteCelebrationData | null>({
    // sourceStepId MUST be in the key — without it, an initial render where
    // the step hasn't loaded (sourceStepId=null) caches a "no next step"
    // result that never refetches when the source id arrives.
    queryKey: [
      'step-complete-celebration',
      stepId,
      blueprintId,
      sourceStepId,
      viewerId,
    ],
    queryFn: async () => {
      try {
        if (!stepId || !blueprintId || !viewerId) return null;

        // 1. Session count from step metadata
        const { data: stepRow } = await supabase
          .from('timeline_steps')
          .select('metadata')
          .eq('id', stepId)
          .maybeSingle();
        const act =
          ((stepRow as { metadata?: { act?: StepActData } } | null)?.metadata?.act) ??
          undefined;
        const sessionCount = countSessions(act);

        // 2. Blueprint step list (for fleet math + next step)
        const { data: bpStepsRows } = await supabase
          .from('blueprint_steps')
          .select('id, step_id, sort_order')
          .eq('blueprint_id', blueprintId)
          .order('sort_order', { ascending: true });
        const bpSteps =
          (bpStepsRows as { id: string; step_id: string; sort_order: number }[] | null) ?? [];
        const totalSteps = bpSteps.length;
        const currentIdx = sourceStepId
          ? bpSteps.findIndex((r) => r.step_id === sourceStepId)
          : -1;

        // 3. Fleet position — count peers ahead / same / behind
        const fleet = await computeFleetPosition(
          blueprintId,
          viewerId,
          currentIdx,
          bpSteps,
        );

        // 4. Next step lookup
        let next: StepCompleteCelebrationData['next'] = null;
        if (currentIdx >= 0 && currentIdx < bpSteps.length - 1) {
          const nextRow = bpSteps[currentIdx + 1];
          const { data: nextStepRow } = await supabase
            .from('timeline_steps')
            .select('id, title')
            .eq('id', nextRow.step_id)
            .maybeSingle();
          const title =
            ((nextStepRow as { title?: string } | null)?.title) ?? 'Next step';

          // Has the viewer already adopted this next step?
          const { data: existingAdoption } = await supabase
            .from('timeline_steps')
            .select('id')
            .eq('user_id', viewerId)
            .eq('source_id', nextRow.step_id)
            .maybeSingle();
          const alreadyAdoptedStepId =
            ((existingAdoption as { id?: string } | null)?.id) ?? null;

          next = {
            sourceStepId: nextRow.step_id,
            stepNumber: currentIdx + 2, // 1-indexed display
            totalSteps,
            title,
            alreadyAdoptedStepId,
          };
        }

        return {
          sessionCount,
          fleet,
          next,
        };
      } catch {
        return null;
      }
    },
    // Require sourceStepId so we don't fire with currentIdx=-1 → next=null
    // before the step loads, which renders the "blueprint complete" branch
    // even on a mid-blueprint step.
    enabled: Boolean(stepId && blueprintId && viewerId && sourceStepId),
    staleTime: 60 * 1000,
  });
}

function countSessions(act: StepActData | undefined): number {
  if (!act) return 0;
  // Sessions ≈ distinct observation entries + media uploads + linked media.
  // Time markers don't count as their own session.
  const observations = (act.observations ?? []).filter((o) => o.text?.trim()).length;
  const uploads = act.media_uploads?.length ?? 0;
  const links = act.media_links?.length ?? 0;
  return observations + uploads + links;
}

async function computeFleetPosition(
  blueprintId: string,
  viewerId: string,
  viewerCurrentIdx: number,
  bpSteps: { id: string; step_id: string; sort_order: number }[],
): Promise<{ ahead: number; sameStep: number; behind: number }> {
  if (viewerCurrentIdx < 0 || bpSteps.length === 0) {
    return { ahead: 0, sameStep: 0, behind: 0 };
  }

  // Pull all subscribers' step_user_progress for this blueprint.
  const { data: subs } = await supabase
    .from('blueprint_subscriptions')
    .select('subscriber_id')
    .eq('blueprint_id', blueprintId);
  const subscriberIds = ((subs as { subscriber_id: string }[] | null) ?? [])
    .map((s) => s.subscriber_id)
    .filter((id) => id !== viewerId);

  if (subscriberIds.length === 0) {
    return { ahead: 0, sameStep: 0, behind: 0 };
  }

  // Each peer's furthest done step = their position; pending steps don't
  // advance position. step_user_progress.blueprint_step_id references the
  // blueprint_steps row id, so match on that — not the timeline step_id.
  const blueprintStepIds = bpSteps.map((s) => s.id);
  const { data: progress } = await supabase
    .from('step_user_progress')
    .select('user_id, blueprint_step_id, status')
    .in('user_id', subscriberIds)
    .in('blueprint_step_id', blueprintStepIds)
    .eq('status', 'done');

  // Determine each peer's farthest-completed sort_order
  const peerMaxIdx = new Map<string, number>();
  for (const row of (progress as { user_id: string; blueprint_step_id: string }[] | null) ?? []) {
    const idx = bpSteps.findIndex((s) => s.id === row.blueprint_step_id);
    if (idx < 0) continue;
    const prev = peerMaxIdx.get(row.user_id) ?? -1;
    if (idx > prev) peerMaxIdx.set(row.user_id, idx);
  }

  let ahead = 0;
  let sameStep = 0;
  let behind = 0;
  for (const peerId of subscriberIds) {
    const peerIdx = peerMaxIdx.get(peerId) ?? -1;
    if (peerIdx > viewerCurrentIdx) ahead += 1;
    else if (peerIdx === viewerCurrentIdx) sameStep += 1;
    else behind += 1;
  }
  return { ahead, sameStep, behind };
}
