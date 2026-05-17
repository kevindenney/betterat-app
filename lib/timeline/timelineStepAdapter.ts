import type { CardRaceData } from '@/components/cards';
import type { TimelineStepRecord, TimelineStepStatus } from '@/types/timeline-steps';

const STATUS_MAP: Record<TimelineStepStatus, string> = {
  pending: 'scheduled',
  in_progress: 'in_progress',
  completed: 'completed',
  settled: 'completed',
  skipped: 'abandoned',
};

export function timelineStepToCardRaceData(step: TimelineStepRecord): CardRaceData {
  return {
    id: step.id,
    name: step.title,
    interest_id: step.interest_id,
    venue: step.location_name ?? '',
    // Surface the due date as `date` so cards can display it. Dates are
    // metadata only — positioning on the timeline is driven by status +
    // sort_order (see lib/races/timelineCompare.ts), not by date.
    date: step.due_at || undefined,
    status: STATUS_MAP[step.status] ?? 'scheduled',
    created_by: step.user_id,
    user_id: step.user_id,
    collaborator_user_ids: step.collaborator_user_ids ?? [],
    isTimelineStep: true,
    stepStatus: step.status,
    sort_order: step.sort_order,
    category: step.category,
    description: step.description,
    due_at: step.due_at,
    completed_at: step.completed_at,
    source_type: step.source_type,
    source_blueprint_id: step.source_blueprint_id ?? null,
    copied_from_user_id: step.copied_from_user_id ?? null,
    isPinned: Boolean((step as any)._pinned),
    metadata: {
      ...(step.metadata ?? {}),
      timeline_step_id: step.id,
    },
  };
}

export function timelineStepsToCardRaceData(steps: TimelineStepRecord[]): CardRaceData[] {
  return steps.map(timelineStepToCardRaceData);
}
