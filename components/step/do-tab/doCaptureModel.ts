import type { MediaLink, MediaUpload, Observation, StepActData } from '@/types/step-detail';
import type { ExtractedMeasurement, Measurement } from '@/types/measurements';

export type DoCaptureKind =
  | 'voice'
  | 'note'
  | 'photo'
  | 'video'
  | 'media_link'
  | 'measurement'
  | 'flag'
  | 'time_marker';

export type DoCaptureSource =
  | 'act_observation'
  | 'media_upload'
  | 'media_link'
  | 'measurement'
  | 'sub_step_deviation'
  | 'notes_legacy'
  | 'time_marker';

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
  /** How sub-step this capture was anchored to, when captured from a checklist row. */
  subStepId?: string;
  /** Pill chip rendered top-right of a capture (e.g. "Weather", "Boat tune"). */
  chipLabel?: string;
  /** When true the chip renders coral-filled with a pulsing white dot. */
  chipLive?: boolean;
  /** Normalised waveform peaks in 0..1; first {@link WAVEFORM_BAR_COUNT} drive the inline player. */
  voicePeaks?: number[];
  /** Voice clip duration in seconds; rendered as m:ss. */
  voiceDurationSec?: number;
  /** Race/activity-phase label rendered in the meta row (e.g. "beat 2", "pre-start"). */
  beatLabel?: string;
  /** Optional trailing meta string (e.g. "Auto-transcribed"). */
  metaSubtitle?: string;
  /** Heading for time_marker rows (e.g. "Beat 2 begins"). */
  markerLabel?: string;
}

/** Total bars the inline voice waveform renders. Canonical spec — D · WAVEFORM. */
export const WAVEFORM_BAR_COUNT = 18;
/** Final bars rendered at reduced opacity to indicate un-played tail. */
export const WAVEFORM_TAIL_QUIET = 4;
/** Max bar height in pixels (canonical: 22 px tall waveform area). */
export const WAVEFORM_MAX_HEIGHT = 22;
/** Min bar height in pixels so all bars stay visible. */
export const WAVEFORM_MIN_HEIGHT = 4;

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
    subStepId: obs.sub_step_id,
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
    subStepId: media.sub_step_id,
  };
}

function measurementBody(m: Measurement): string {
  if (m.category === 'exercise') {
    const parts = [m.exercise_name];
    if (m.weight_value != null) parts.push(`${m.weight_value}${m.weight_unit ?? ''}`);
    if (m.reps != null) parts.push(`${m.reps} reps`);
    return parts.join(' · ');
  }
  const name = m.category === 'health' ? (m.metric_name ?? m.metric_type) : m.metric_name;
  const unit = m.unit ? ` ${m.unit}` : '';
  return `${name}: ${m.value}${unit}`;
}

function measurementToCapture(em: ExtractedMeasurement): DoCaptureItem {
  return {
    id: `measure:${em.id}`,
    kind: 'measurement',
    capturedAt: em.timestamp ?? null,
    body: measurementBody(em.measurement),
    capabilityIds: [],
    capabilityLabels: [],
    flaggedForDebrief: false,
    source: 'measurement',
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
    subStepId: link.sub_step_id,
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

  for (const em of act.measurements?.extracted ?? []) {
    if (!em?.id) continue;
    items.push(measurementToCapture(em));
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

/**
 * Returns the "HH:MM" clock label for a capture timestamp.
 * Empty string when the timestamp is missing or unparseable so callers can skip the slot.
 */
export function formatClockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Returns a short "ago" label rounded down — canonical examples: "12 s ago", "3m", "29m", "2h".
 * Falls back to empty string when input is missing/invalid or in the future.
 */
export function formatRelativeAgo(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const deltaSec = Math.floor((nowMs - ms) / 1000);
  if (deltaSec < 0) return '';
  if (deltaSec < 60) return `${deltaSec} s ago`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h`;
  const deltaDay = Math.floor(deltaHr / 24);
  return `${deltaDay}d`;
}

/**
 * Formats elapsed milliseconds as m:ss for the live header stats.
 * Canonical spec — B · STATS: "mm:ss only, even past an hour".
 */
export function formatElapsedMmSs(elapsedMs: number): string {
  const safe = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats a voice clip duration in seconds as m:ss for the waveform tail label.
 */
export function formatVoiceDuration(seconds: number | undefined): string {
  if (!seconds || seconds < 0 || !Number.isFinite(seconds)) return '';
  const safe = Math.floor(seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface DoCaptureBreakdown {
  voice: number;
  note: number;
  photo: number;
  marker: number;
}

/**
 * Counts captures by display kind for the Frame 3 auto-summary breakdown row.
 * voice = voice; note = note + media_link + flag (typed-ish content);
 * photo = photo + video (visual capture); marker = time_marker.
 */
export function summarizeCaptureBreakdown(items: DoCaptureItem[]): DoCaptureBreakdown {
  const out: DoCaptureBreakdown = { voice: 0, note: 0, photo: 0, marker: 0 };
  for (const c of items) {
    switch (c.kind) {
      case 'voice':
        out.voice += 1;
        break;
      case 'note':
      case 'media_link':
      case 'measurement':
      case 'flag':
        out.note += 1;
        break;
      case 'photo':
      case 'video':
        out.photo += 1;
        break;
      case 'time_marker':
        out.marker += 1;
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Normalises a peaks array to exactly {@link WAVEFORM_BAR_COUNT} entries in pixel heights.
 * Inputs may be 0..1 normalised or already-pixel; values clamp into the bar height range.
 * Missing/short arrays are zero-padded so the layout grid stays stable.
 */
export function buildWaveformHeights(peaks: number[] | undefined): number[] {
  const out: number[] = [];
  for (let i = 0; i < WAVEFORM_BAR_COUNT; i += 1) {
    const raw = peaks?.[i];
    if (raw == null || !Number.isFinite(raw) || raw <= 0) {
      out.push(WAVEFORM_MIN_HEIGHT);
      continue;
    }
    const px = raw <= 1 ? raw * WAVEFORM_MAX_HEIGHT : raw;
    const clamped = Math.min(WAVEFORM_MAX_HEIGHT, Math.max(WAVEFORM_MIN_HEIGHT, px));
    out.push(clamped);
  }
  return out;
}
