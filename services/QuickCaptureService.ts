/**
 * QuickCaptureService — Phase 2 universal `+` sheet.
 *
 * Encapsulates the three write paths exposed by the sheet:
 *   1. createDraftStep(...)  → timeline_steps row (status='pending', metadata.draft=true)
 *   2. dropInsight(...)      → playbook_insights row (raw inbox for Phase 6 refinement)
 *   3. (voice transcription is handled in QuickCaptureComposer via VoiceNoteService)
 *
 * No UI here. Callers (the composer + sheet's secondary rows) invoke these and
 * surface their own toasts. Errors bubble; the sheet catches them and shows
 * a toast.
 */

import { supabase } from './supabase';
import { logger } from '@/lib/logger';
import { createStep } from './TimelineStepService';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type {
  MediaUpload,
  RacePlan,
  StepLocation,
  StepPlanData,
  SubStep,
} from '@/types/step-detail';

export type QuickCaptureKind = 'text' | 'voice';

export interface QuickCapturePayload {
  kind: QuickCaptureKind;
  /** The WHAT — becomes the step title. Optional fields below are separate. */
  content: string;
  audioUri?: string;
  /** Structured place from the composer's WHERE picker, when set. */
  location?: StepLocation;
  /** Optional WHY — maps to plan.why_reasoning. */
  why?: string;
  /** Optional HOW — newline-split into plan.how_sub_steps. */
  how?: string;
  /** Optional WHEN — free text, stored as the step description. */
  when?: string;
  /** Optional scheduled datetime from structured composer controls. */
  scheduledAt?: string;
  /**
   * Sailing only — flags the new step a Race, which gives it the ⛵ Atlas pin
   * inside its race-area polygon plus the course/marks/conditions cockpit.
   * Defaults to a plain step.
   */
  isRace?: boolean;
  /**
   * Sailing only — the race-area + course choice authored in the composer's
   * inline "Race area & course" reveal. Persisted to metadata.race_plan; the
   * area centroid backfills location when no WHERE is set so the race pins
   * inside its racing-area polygon. Ignored unless isRace is true.
   */
  racePlan?: RacePlan;
  /**
   * Local device URI for a photo picked in the composer (native only). Uploaded
   * to the `step-media` bucket on save and attached as metadata.act.media_uploads
   * so it surfaces in the step's Do tab.
   */
  imageUri?: string;
}

/**
 * Maps a QuickCapturePayload to the structured columns + plan schema a step
 * expects. Shared by createDraftStep and the optimistic step in
 * UniversalPlusProvider so the two never drift on field placement.
 *
 * Title = WHAT only. Why/How/Where land in metadata.plan; When in description.
 */
export interface QuickCaptureStepFields {
  title: string;
  description: string | null;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
  startsAt: string | null;
  plan: StepPlanData | null;
}

function splitSubSteps(how: string): SubStep[] {
  const base = Date.now();
  return how
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `sub-${base}-${index}`,
      text,
      sort_order: index,
      completed: false,
    }));
}

export function buildQuickCaptureStepFields(
  payload: QuickCapturePayload,
): QuickCaptureStepFields {
  const title = payload.content.trim();
  const why = payload.why?.trim();
  const how = payload.how?.trim();
  const when = payload.when?.trim();
  const location = payload.location;
  const hasLocationName = Boolean(location?.name?.trim());

  // When a race has no explicit WHERE, anchor it to the chosen racing area so
  // its ⛵ Atlas pin lands inside the area polygon rather than nowhere.
  const racePlan = payload.isRace ? payload.racePlan : undefined;
  const raceCenter = racePlan?.center;
  const raceAreaName = racePlan?.area_name?.trim();

  const plan: StepPlanData = {};
  if (title) plan.what_will_you_do = title;
  if (why) plan.why_reasoning = why;
  if (how) plan.how_sub_steps = splitSubSteps(how);
  if (hasLocationName) {
    plan.where_location = { ...location!, name: location!.name.trim() };
  }

  const fallbackToRaceArea = !hasLocationName && Boolean(raceCenter);

  return {
    title,
    description: when || null,
    locationName: hasLocationName
      ? location!.name.trim()
      : fallbackToRaceArea
        ? raceAreaName ?? null
        : null,
    locationLat: hasLocationName ? location?.lat ?? null : raceCenter?.lat ?? null,
    locationLng: hasLocationName ? location?.lng ?? null : raceCenter?.lng ?? null,
    startsAt: payload.scheduledAt ?? null,
    plan: Object.keys(plan).length > 0 ? plan : null,
  };
}

/**
 * Builds the race-specific metadata for a flagged race: the canonical
 * `race_plan` plus the display-only `atlas.race_course_context` chips the
 * timeline card + Atlas pin read. Returns an empty object when there's no
 * race plan so it spreads cleanly into a plain step's metadata.
 */
export function buildRaceMetadata(
  racePlan?: RacePlan,
): { race_plan?: RacePlan; atlas?: { race_course_context: { scrub_title?: string; scrub_label?: string } } } {
  if (!racePlan || (!racePlan.area_id && !racePlan.course_type)) return {};

  const lapSuffix =
    racePlan.course_label && racePlan.laps ? ` · ${racePlan.laps} laps` : '';
  const scrubLabel = racePlan.course_label
    ? `${racePlan.course_label}${lapSuffix}`
    : undefined;

  return {
    race_plan: racePlan,
    atlas: {
      race_course_context: {
        ...(racePlan.area_name ? { scrub_title: racePlan.area_name } : {}),
        ...(scrubLabel ? { scrub_label: scrubLabel } : {}),
      },
    },
  };
}

export interface CreateDraftStepArgs {
  userId: string;
  interestId: string;
  payload: QuickCapturePayload;
}

/**
 * Uploads a composer-picked photo to the `step-media` bucket and returns the
 * MediaUpload record to stash on the new step. Mirrors the Do-tab upload path
 * (useStepActCaptureController.pickPhotoOrVideoNative) so both surfaces store
 * identically-shaped rows. Throws on failure; the caller decides whether to
 * abort the whole save or proceed without the image.
 */
async function uploadQuickCaptureImage(
  userId: string,
  localUri: string,
): Promise<MediaUpload> {
  const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
  const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fileName = `${userId}/quick-capture/${fileId}.${ext}`;

  const response = await fetch(localUri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('step-media')
    .upload(fileName, arrayBuffer, {
      contentType: blob.type || `image/${ext}`,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('step-media').getPublicUrl(fileName);

  return {
    id: fileId,
    uri: publicUrl,
    type: 'photo',
    created_at: new Date().toISOString(),
  };
}

async function getOrderedTimelineSteps(
  userId: string,
  interestId: string,
): Promise<TimelineStepRecord[]> {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('*')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .in('status', ['pending', 'in_progress', 'completed', 'settled'])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to load ordered timeline steps for quick capture', error);
    throw error;
  }

  return (data ?? []) as TimelineStepRecord[];
}

// New captures append to the end of the sequence. Inserting them right
// after the current step (the old behavior) wedged fresh steps into the
// middle of the timeline, which read as misplacement on this
// sequence-first surface. "Unscheduled" (starts_at null) keeps the step
// ordered purely by sort_order rather than pinned to today's date bucket.
async function resolveQuickCapturePlacement(userId: string, interestId: string) {
  const steps = await getOrderedTimelineSteps(userId, interestId);
  // Index-based append, not `last.sort_order + 1`. The timeline is
  // contiguous-by-design (project_timeline_steps_sort_order_degenerate), so a
  // single poisoned/degenerate sort_order must not propagate: deriving the next
  // value from the max would inherit a huge outlier and strand every future
  // step at the bottom past a giant gap. Positional length stays bounded.
  return {
    sortOrder: steps.length,
    startsAt: null as string | null,
  };
}

export async function createDraftStep({
  userId,
  interestId,
  payload,
}: CreateDraftStepArgs): Promise<TimelineStepRecord> {
  const fields = buildQuickCaptureStepFields(payload);
  if (!fields.title) {
    throw new Error('Quick-capture content is empty.');
  }

  const placement = await resolveQuickCapturePlacement(userId, interestId);

  // A flagged race carries its area/course choice as the canonical race_plan,
  // plus the display-only race_course_context chips the timeline + Atlas read.
  const racePlan = payload.isRace ? payload.racePlan : undefined;
  const raceMeta = buildRaceMetadata(racePlan);

  // Upload the composer photo (if any) before creating the row so the step
  // lands with its media already attached. A failed upload shouldn't sink the
  // whole step — log and continue without the image.
  let mediaUpload: MediaUpload | null = null;
  if (payload.imageUri) {
    try {
      mediaUpload = await uploadQuickCaptureImage(userId, payload.imageUri);
    } catch (err) {
      logger.error('Quick-capture photo upload failed; saving step without it', err);
    }
  }

  return createStep({
    user_id: userId,
    interest_id: interestId,
    title: fields.title,
    description: fields.description,
    status: 'pending',
    starts_at: fields.startsAt ?? placement.startsAt,
    sort_order: placement.sortOrder,
    visibility: 'private',
    is_race: payload.isRace ?? false,
    // Denormalized columns power Atlas pins + map feeds; the RPC reads
    // these straight off p_input.
    location_name: fields.locationName,
    location_lat: fields.locationLat,
    location_lng: fields.locationLng,
    metadata: {
      draft: true,
      capture_source: 'universal_plus_sheet',
      capture_kind: payload.kind,
      audio_uri: payload.audioUri ?? null,
      // Canonical source the Plan tab + timeline adapter read for WHAT/WHY/HOW/WHERE.
      ...(fields.plan ? { plan: fields.plan } : {}),
      // Race area/course choice + derived Atlas course-context chips.
      ...raceMeta,
      // Composer photo lands under act.media_uploads so the Do tab renders it.
      ...(mediaUpload ? { act: { media_uploads: [mediaUpload] } } : {}),
    },
  });
}

export interface DropInsightArgs {
  userId: string;
  interestId: string | null;
  payload: QuickCapturePayload;
}

export interface PlaybookInsightRecord {
  id: string;
  user_id: string;
  interest_id: string | null;
  kind: QuickCaptureKind;
  content: string;
  audio_uri: string | null;
  refined_to_concept_id: string | null;
  created_at: string;
}

export async function dropInsight({
  userId,
  interestId,
  payload,
}: DropInsightArgs): Promise<PlaybookInsightRecord> {
  const trimmed = payload.content.trim();
  if (!trimmed) {
    throw new Error('Insight content is empty.');
  }

  const { data, error } = await supabase
    .from('playbook_insights')
    .insert({
      user_id: userId,
      interest_id: interestId,
      kind: payload.kind,
      content: trimmed,
      audio_uri: payload.audioUri ?? null,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to drop insight to playbook_insights', error);
    throw error;
  }
  if (!data) throw new Error('Insight insert returned no row');

  return data as PlaybookInsightRecord;
}

export async function listRecentDrafts({
  userId,
  interestId,
  limit = 5,
}: {
  userId: string;
  interestId: string;
  limit?: number;
}): Promise<TimelineStepRecord[]> {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('*')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .eq('status', 'pending')
    .contains('metadata', { draft: true })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to list draft timeline steps', error);
    throw error;
  }
  return (data ?? []) as TimelineStepRecord[];
}
