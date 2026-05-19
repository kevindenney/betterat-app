import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type { CaptureVisibility } from '@/types/sharing';
import type { Observation, MediaLink, MediaUpload, StepActData } from '@/types/step-detail';
import type { TimelineStepRecord } from '@/types/timeline-steps';

const logger = createLogger('FleetCaptureFeedService');

export interface FleetCaptureRow {
  id: string;
  stepId: string;
  authorUserId: string;
  authorName: string;
  authorInitials: string;
  authorIsMe: boolean;
  capturedAt: string;
  kind: 'voice' | 'note' | 'photo' | 'video' | 'media_link';
  body: string;
  visibility: CaptureVisibility;
  kindTag?: string;
  boatName?: string;
}

export interface FleetFeedSummary {
  boats: number;
  captures: number;
  yours: number;
  yourFinish?: string;
}

interface VisibilityAwareObservation extends Observation {
  visibility?: CaptureVisibility;
}
interface VisibilityAwareMedia extends MediaUpload {
  visibility?: CaptureVisibility;
}
interface VisibilityAwareMediaLink extends MediaLink {
  visibility?: CaptureVisibility;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'PR';
}

function isShareable(v: CaptureVisibility | undefined): boolean {
  return v === 'crew' || v === 'fleet';
}

function expandStep(
  step: TimelineStepRecord & { metadata?: Record<string, unknown> },
  authorName: string,
  authorIsMe: boolean,
  boatName?: string,
): FleetCaptureRow[] {
  const act = (step.metadata?.act as StepActData | undefined) ?? undefined;
  if (!act) return [];

  const rows: FleetCaptureRow[] = [];
  const initials = initialsOf(authorName);

  for (const o of (act.observations ?? []) as VisibilityAwareObservation[]) {
    if (!isShareable(o.visibility)) continue;
    rows.push({
      id: `obs:${step.id}:${o.id}`,
      stepId: step.id,
      authorUserId: step.user_id,
      authorName,
      authorInitials: initials,
      authorIsMe,
      capturedAt: o.timestamp ?? step.updated_at ?? step.created_at,
      kind: o.source === 'voice' ? 'voice' : 'note',
      body: o.text ?? '',
      visibility: o.visibility ?? 'private',
      kindTag: o.source === 'voice' ? 'voice' : 'note',
      boatName,
    });
  }

  for (const m of (act.media_uploads ?? []) as VisibilityAwareMedia[]) {
    if (!isShareable(m.visibility)) continue;
    rows.push({
      id: `media:${step.id}:${m.id}`,
      stepId: step.id,
      authorUserId: step.user_id,
      authorName,
      authorInitials: initials,
      authorIsMe,
      capturedAt: m.created_at ?? step.updated_at ?? step.created_at,
      kind: (m.type as FleetCaptureRow['kind']) ?? 'photo',
      body: m.caption ?? '',
      visibility: m.visibility ?? 'private',
      kindTag: m.type,
      boatName,
    });
  }

  for (const l of (act.media_links ?? []) as VisibilityAwareMediaLink[]) {
    if (!isShareable(l.visibility)) continue;
    rows.push({
      id: `link:${step.id}:${l.id}`,
      stepId: step.id,
      authorUserId: step.user_id,
      authorName,
      authorInitials: initials,
      authorIsMe,
      capturedAt: l.added_at ?? step.updated_at ?? step.created_at,
      kind: 'media_link',
      body: l.caption ?? l.url ?? '',
      visibility: l.visibility ?? 'private',
      kindTag: 'media_link',
      boatName,
    });
  }

  return rows;
}

export async function loadFleetCaptureFeed(input: {
  viewerUserId: string;
  stepId: string;
}): Promise<{ rows: FleetCaptureRow[]; summary: FleetFeedSummary; anchorStep: TimelineStepRecord | null }> {
  const { data: anchor, error: anchorErr } = await supabase
    .from('timeline_steps')
    .select('*')
    .eq('id', input.stepId)
    .single();
  if (anchorErr || !anchor) {
    logger.error('Failed to load anchor step for fleet feed', anchorErr);
    throw anchorErr ?? new Error('Anchor step not found');
  }
  const anchorStep = anchor as TimelineStepRecord;

  let query = supabase.from('timeline_steps').select('*');
  if (anchorStep.program_session_id) {
    query = query.eq('program_session_id', anchorStep.program_session_id);
  } else if (anchorStep.source_id && anchorStep.source_type) {
    query = query.eq('source_id', anchorStep.source_id).eq('source_type', anchorStep.source_type);
  } else {
    // No shared linkage; just return the anchor's own captures
    query = query.eq('id', anchorStep.id);
  }

  const { data: peerSteps, error: peerErr } = await query;
  if (peerErr) {
    logger.error('Failed to load peer steps for fleet feed', peerErr);
    throw peerErr;
  }

  const stepRows = (peerSteps ?? []) as TimelineStepRecord[];
  const userIds = Array.from(new Set(stepRows.map((s) => s.user_id)));

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);
  const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name as string | null]));

  const rows: FleetCaptureRow[] = [];
  for (const step of stepRows) {
    const name = nameMap.get(step.user_id) ?? 'Practitioner';
    const isMe = step.user_id === input.viewerUserId;
    rows.push(...expandStep(step, name, isMe));
  }

  rows.sort((a, b) => (a.capturedAt > b.capturedAt ? -1 : a.capturedAt < b.capturedAt ? 1 : 0));

  const summary: FleetFeedSummary = {
    boats: userIds.length,
    captures: rows.length,
    yours: rows.filter((r) => r.authorIsMe).length,
  };

  return { rows, summary, anchorStep };
}
