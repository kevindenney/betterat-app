import type { MediaLink, MediaUpload, Observation, StepActData } from '@/types/step-detail';

export type DoCaptureKind = 'voice' | 'note' | 'photo' | 'video' | 'media_link' | 'flag';

export type DoCaptureSource =
  | 'act_observation'
  | 'media_upload'
  | 'media_link'
  | 'sub_step_deviation'
  | 'notes_legacy';

export interface DoCaptureItem {
  id: string;
  kind: DoCaptureKind;
  capturedAt: string | null;
  body: string;
  mediaUri?: string;
  capabilityIds: string[];
  capabilityLabels: string[];
  flaggedForDebrief: boolean;
  source: DoCaptureSource;
}

function observationToCapture(obs: Observation): DoCaptureItem {
  const kind: DoCaptureKind = obs.source === 'voice' ? 'voice' : 'note';
  return {
    id: `obs:${obs.id}`,
    kind,
    capturedAt: obs.timestamp ?? null,
    body: obs.text ?? '',
    capabilityIds: [],
    capabilityLabels: [],
    flaggedForDebrief: false,
    source: 'act_observation',
  };
}

function mediaUploadToCapture(media: MediaUpload): DoCaptureItem {
  return {
    id: `media:${media.id}`,
    kind: media.type,
    capturedAt: media.created_at ?? null,
    body: media.caption ?? '',
    mediaUri: media.uri,
    capabilityIds: [],
    capabilityLabels: [],
    flaggedForDebrief: false,
    source: 'media_upload',
  };
}

function mediaLinkToCapture(link: MediaLink): DoCaptureItem {
  return {
    id: `link:${link.id}`,
    kind: 'media_link',
    capturedAt: link.added_at ?? null,
    body: link.caption ?? link.url,
    mediaUri: link.url,
    capabilityIds: [],
    capabilityLabels: [],
    flaggedForDebrief: false,
    source: 'media_link',
  };
}

export function normalizeDoCaptures(act: StepActData | undefined | null): DoCaptureItem[] {
  if (!act) return [];

  const items: DoCaptureItem[] = [];

  for (const obs of act.observations ?? []) {
    if (!obs?.id) continue;
    items.push(observationToCapture(obs));
  }

  for (const media of act.media_uploads ?? []) {
    if (!media?.id) continue;
    items.push(mediaUploadToCapture(media));
  }

  for (const link of act.media_links ?? []) {
    if (!link?.id) continue;
    items.push(mediaLinkToCapture(link));
  }

  return items;
}

export function sortCapturesNewestFirst(items: DoCaptureItem[]): DoCaptureItem[] {
  return [...items].sort((a, b) => {
    const aTime = a.capturedAt ? Date.parse(a.capturedAt) : 0;
    const bTime = b.capturedAt ? Date.parse(b.capturedAt) : 0;
    return bTime - aTime;
  });
}
