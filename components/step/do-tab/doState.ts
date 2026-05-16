import type { StepActData } from '@/types/step-detail';

export type DoInteriorState = 'pre_activity' | 'live' | 'post_activity';

export function hasAnyDoCapture(act: StepActData | undefined | null): boolean {
  if (!act) return false;
  if (act.observations?.some((o) => o.text?.trim())) return true;
  if (act.media_uploads && act.media_uploads.length > 0) return true;
  if (act.media_links && act.media_links.length > 0) return true;
  if (act.notes?.trim()) return true;
  return false;
}

export function deriveDoInteriorState(input: {
  status?: string;
  act: StepActData | undefined | null;
  activityEndedAt?: string | null;
}): DoInteriorState {
  const { status, act, activityEndedAt } = input;

  if (activityEndedAt) {
    return 'post_activity';
  }

  if (status === 'in_progress' || act?.started_at) {
    return 'live';
  }

  if (hasAnyDoCapture(act)) {
    return 'live';
  }

  return 'pre_activity';
}
