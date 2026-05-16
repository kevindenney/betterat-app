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
  /**
   * Whether the step opted into the timed (stopwatch) model. Defaults true for
   * backwards compatibility. When false, status === 'in_progress' and a stamped
   * started_at are ignored as live signals — they may be stale from the
   * pre-timing auto-start bug, and an untimed step has no meaningful "running"
   * state. Captures still drive the live (capture-stream) view.
   */
  isTimed?: boolean;
}): DoInteriorState {
  const { status, act, activityEndedAt, isTimed = true } = input;

  if (activityEndedAt) {
    return 'post_activity';
  }

  if (isTimed && (status === 'in_progress' || act?.started_at)) {
    return 'live';
  }

  if (hasAnyDoCapture(act)) {
    return 'live';
  }

  return 'pre_activity';
}
