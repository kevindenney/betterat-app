import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { PIIScrubBlocked, scrubPII } from '@/services/PIIRedactionService';
import type { CaptureVisibility } from '@/types/sharing';
import type { StepActData, Observation, MediaUpload, MediaLink } from '@/types/step-detail';

const logger = createLogger('CaptureVisibilityService');

export interface CaptureVisibilityResult {
  stepId: string;
  captureRef: string;
  visibility: CaptureVisibility;
  redactedBody?: string;
  piiHits?: number;
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

function parseRef(captureRef: string): { kind: 'obs' | 'media' | 'link'; id: string } {
  if (captureRef.startsWith('obs:')) return { kind: 'obs', id: captureRef.slice(4) };
  if (captureRef.startsWith('media:')) return { kind: 'media', id: captureRef.slice(6) };
  if (captureRef.startsWith('link:')) return { kind: 'link', id: captureRef.slice(5) };
  throw new Error(`Unrecognised capture ref: ${captureRef}`);
}

export async function setCaptureVisibility(input: {
  stepId: string;
  captureRef: string;
  visibility: CaptureVisibility;
  isNursing: boolean;
}): Promise<CaptureVisibilityResult> {
  const { data: step, error } = await supabase
    .from('timeline_steps')
    .select('id, metadata')
    .eq('id', input.stepId)
    .single();
  if (error || !step) {
    logger.error('Failed to load step for visibility update', error);
    throw error ?? new Error('Step not found');
  }

  const metadata = ((step.metadata as Record<string, unknown>) ?? {}) as { act?: StepActData };
  const act: StepActData = metadata.act ?? {};
  const ref = parseRef(input.captureRef);

  let redactedBody: string | undefined;
  let piiHits = 0;

  const mutateBody = (body: string | null | undefined): string => {
    if (!input.isNursing || input.visibility === 'private' || !body) {
      return body ?? '';
    }
    const result = scrubPII(body);
    redactedBody = result.redacted;
    piiHits = result.totalHits;
    if (result.highRiskBlocked) {
      throw new PIIScrubBlocked();
    }
    return result.redacted;
  };

  if (ref.kind === 'obs') {
    const obs = (act.observations ?? []) as VisibilityAwareObservation[];
    const target = obs.find((o) => o.id === ref.id);
    if (!target) throw new Error(`Observation ${ref.id} not found on step ${input.stepId}`);
    target.text = mutateBody(target.text);
    target.visibility = input.visibility;
    act.observations = obs;
  } else if (ref.kind === 'media') {
    const media = (act.media_uploads ?? []) as VisibilityAwareMedia[];
    const target = media.find((m) => m.id === ref.id);
    if (!target) throw new Error(`Media ${ref.id} not found on step ${input.stepId}`);
    target.caption = mutateBody(target.caption ?? null);
    target.visibility = input.visibility;
    act.media_uploads = media;
  } else {
    const links = (act.media_links ?? []) as VisibilityAwareMediaLink[];
    const target = links.find((l) => l.id === ref.id);
    if (!target) throw new Error(`Media link ${ref.id} not found on step ${input.stepId}`);
    target.caption = mutateBody(target.caption ?? null);
    target.visibility = input.visibility;
    act.media_links = links;
  }

  const nextMetadata = { ...metadata, act };

  const { error: updateError } = await supabase
    .from('timeline_steps')
    .update({ metadata: nextMetadata })
    .eq('id', input.stepId);
  if (updateError) {
    logger.error('Failed to persist visibility update', updateError);
    throw updateError;
  }

  return {
    stepId: input.stepId,
    captureRef: input.captureRef,
    visibility: input.visibility,
    redactedBody,
    piiHits,
  };
}

export function getCaptureVisibility(
  act: StepActData | undefined,
  captureRef: string,
): CaptureVisibility {
  if (!act) return 'private';
  const ref = parseRef(captureRef);
  if (ref.kind === 'obs') {
    const obs = (act.observations ?? []) as VisibilityAwareObservation[];
    return obs.find((o) => o.id === ref.id)?.visibility ?? 'private';
  }
  if (ref.kind === 'media') {
    const media = (act.media_uploads ?? []) as VisibilityAwareMedia[];
    return media.find((m) => m.id === ref.id)?.visibility ?? 'private';
  }
  const links = (act.media_links ?? []) as VisibilityAwareMediaLink[];
  return links.find((l) => l.id === ref.id)?.visibility ?? 'private';
}
