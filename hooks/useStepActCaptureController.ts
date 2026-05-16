/**
 * useStepActCaptureController — Phase B.7 wire-in controller.
 *
 * Bridges the existing StepDrawContent capture infrastructure
 * (metadata.act observations / media_uploads / media_links, Supabase
 * step-media bucket, useUpdateStepMetadata) to the new presentational
 * DoTabInterior surface. Persistence path is unchanged — the hook writes
 * the same metadata.act shape StepDrawContent does, just via a fresh
 * call site. Flag-off ActTab continues to mount StepDrawContent and
 * write through that path; flag-on ActTab mounts DoTabInterior +
 * MarkAsEvidenceSheet driven by this controller.
 *
 * Scope limits (per PHASE_B7_DO_TAB_INTERIOR_SPEC.md):
 * - Activity-ended timestamp is local hook state only (not persisted).
 *   Spec defers `metadata.act.ended_at` to Kevin verification.
 * - Voice capture routes to the quick-note modal — no native voice
 *   recording exists for Practice Do today (audit § Voice/audio).
 * - Web photo capture is a no-op in this controller; the flag-off
 *   ActTab path still uses StepDrawContent's web file upload.
 * - Refine summary / auto-summarise plan are no-ops; no AI endpoint.
 * - Evidence persistence is local-only — selections vanish on dismiss
 *   until the capability evidence model lands.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useUpdateStep } from '@/hooks/useTimelineSteps';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
// Import runtime helpers from their own files (not the do-tab barrel) so
// jest doesn't pull every component-level `@expo/vector-icons` import into
// the controller hook's transitive graph.
import {
  normalizeDoCaptures,
  sortCapturesNewestFirst,
  type DoCaptureItem,
} from '@/components/step/do-tab/doCaptureModel';
import { deriveDoInteriorState, type DoInteriorState } from '@/components/step/do-tab/doState';
import type { DoTabInteriorProps } from '@/components/step/do-tab/DoTabInterior';
import type {
  MediaUpload,
  Observation,
  StepActData,
  StepMetadata,
  StepPlanData,
} from '@/types/step-detail';

const IMAGE_QUALITY = 0.6;
const IS_NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';

export interface UseStepActCaptureControllerInput {
  /** Step the controller is bound to. */
  stepId: string;
  /** Suppress all mutating callbacks. */
  readOnly?: boolean;
  /** Called when the user taps Move to Reflect (Frame 3). */
  onMoveToReflect?: () => void;
  /**
   * Optional clock injection — tests pass a fixed `now` for deterministic
   * elapsed-ms / relative-ago labels. Defaults to {@link Date.now}.
   */
  now?: () => number;
}

export interface StepActCaptureControllerView {
  /** Live DoInteriorState — derived from metadata.act + locally-tracked end. */
  state: DoInteriorState;
  /** Locally-tracked activity-end ISO string (null when still live / pre). */
  activityEndedAt: string | null;
  /** Currently-marking capture id (null when sheet closed). */
  markingCaptureId: string | null;
  /** Quick-note modal visibility — also opened by the voice affordance v1. */
  quickNoteVisible: boolean;
  /** Normalized + sorted captures fed to DoTabInterior. */
  captures: DoCaptureItem[];
  /** Plan data ready for DoTabInterior (used by Frame 1 starting-frame row). */
  planData: StepPlanData;
  /** Resolved step title for the Frame 2 / 3 context strip. */
  stepTitle: string;
  /**
   * Props bag — spread directly into <DoTabInterior />. Excludes the
   * `footer` slot so the caller can append a flag-off-style footer when
   * needed.
   */
  doTabInteriorProps: Omit<DoTabInteriorProps, 'footer'>;
  /** Capture currently being promoted to evidence (null when sheet closed). */
  markingCapture: DoCaptureItem | null;
  /** Close the Mark-as-evidence sheet without saving. */
  closeMarkAsEvidence: () => void;
  /** Close the quick-note modal without saving. */
  closeQuickNoteModal: () => void;
  /** Submit a quick-note string — writes through to metadata.act.observations[]. */
  submitQuickNote: (text: string) => void;
}

/**
 * Hook implementation.
 *
 * Returns the controller view + bound DoTabInterior props. Mount
 * MarkAsEvidenceSheet and DoQuickNoteModal alongside DoTabInterior in
 * the caller using `markingCapture`, `quickNoteVisible`, and the
 * matching close/submit callbacks.
 */
export function useStepActCaptureController({
  stepId,
  readOnly,
  onMoveToReflect,
  now = Date.now,
}: UseStepActCaptureControllerInput): StepActCaptureControllerView {
  const { data: step } = useStepDetail(stepId);
  const updateMetadata = useUpdateStepMetadata(stepId);
  const updateStep = useUpdateStep();
  const { user } = useAuth();

  const metadata = (step?.metadata ?? {}) as StepMetadata;
  const planData: StepPlanData = metadata.plan ?? {};
  // Wrap in useMemo so the object identity is stable across renders when
  // metadata.act hasn't changed — keeps downstream useMemo deps honest.
  const actData = useMemo<StepActData>(() => metadata.act ?? {}, [metadata.act]);

  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const [activityEndedAt, setActivityEndedAt] = useState<string | null>(null);
  const [markingCaptureId, setMarkingCaptureId] = useState<string | null>(null);
  const [quickNoteVisible, setQuickNoteVisible] = useState(false);

  // Per-step timing gate: when the flag is on AND this step is not flagged
  // is_timed, the Do tab is a passive capture surface — no auto-stamp, no
  // implicit pending→in_progress transition, no live timer. Only stopwatch
  // steps (race-day, starting drills, interval workouts) opt in.
  const isTimed = FEATURE_FLAGS.PRACTICE_DO_TAB_PER_STEP_TIMING
    ? Boolean(step?.is_timed)
    : true;

  // Auto-stamp started_at + transition pending → in_progress when the
  // owner first opens Do. Mirrors StepDrawContent's auto-start behaviour
  // so the flag-on path doesn't silently regress activity initialization.
  // Skipped entirely for untimed steps when per-step timing is enabled.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!step || autoStartedRef.current || readOnly || !isTimed) return;
    const status = step.status;
    const startedAt = actData.started_at;
    if (status === 'pending' || (!startedAt && status !== 'completed')) {
      autoStartedRef.current = true;
      updateMetadata.mutate({
        act: { ...(metadata.act ?? {}), started_at: new Date().toISOString() },
      });
      if (status === 'pending') {
        updateStep.mutate({ stepId, input: { status: 'in_progress' } });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isTimed]);

  const captures = useMemo(
    () => sortCapturesNewestFirst(normalizeDoCaptures(actData)),
    [actData],
  );

  const state = useMemo(
    () =>
      deriveDoInteriorState({
        status: step?.status,
        act: actData,
        activityEndedAt,
        isTimed,
      }),
    [step?.status, actData, activityEndedAt, isTimed],
  );

  const startedAtMs = actData.started_at ? Date.parse(actData.started_at) : NaN;
  const elapsedMs = (() => {
    if (!Number.isFinite(startedAtMs)) return 0;
    const endMs = activityEndedAt ? Date.parse(activityEndedAt) : now();
    if (!Number.isFinite(endMs)) return 0;
    return Math.max(0, endMs - startedAtMs);
  })();

  const stepTitle = step?.title ?? '';
  const markingCapture = useMemo(
    () => captures.find((c) => c.id === markingCaptureId) ?? null,
    [captures, markingCaptureId],
  );

  // ─── Mutations ────────────────────────────────────────────────────────────

  const saveAct = useCallback(
    (partial: Partial<StepActData>) => {
      const current = metadataRef.current;
      updateMetadata.mutate({ act: { ...(current.act ?? {}), ...partial } });
    },
    [updateMetadata],
  );

  const addObservation = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const obs: Observation = {
        id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        timestamp: new Date().toISOString(),
        source: 'note',
      };
      const currentObs = metadataRef.current.act?.observations ?? [];
      const existingNotes = metadataRef.current.act?.notes ?? '';
      const stamp = new Date(obs.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const formatted = `[${stamp}] ${obs.text}`;
      const updatedNotes = existingNotes ? `${existingNotes}\n${formatted}` : formatted;
      saveAct({ observations: [...currentObs, obs], notes: updatedNotes });
    },
    [saveAct],
  );

  const pickPhotoOrVideoNative = useCallback(async () => {
    if (!user?.id) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: IMAGE_QUALITY,
      videoMaxDuration: 30,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const ext = asset.uri.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fileName = `${user.id}/${stepId}/${fileId}.${ext}`;
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('step-media')
        .upload(fileName, arrayBuffer, {
          contentType: blob.type || (isVideo ? `video/${ext}` : `image/${ext}`),
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('step-media').getPublicUrl(fileName);
      const newUpload: MediaUpload = {
        id: fileId,
        uri: publicUrl,
        type: isVideo ? 'video' : 'photo',
        caption: undefined,
        created_at: new Date().toISOString(),
      };
      const currentUploads = metadataRef.current.act?.media_uploads ?? [];
      saveAct({ media_uploads: [...currentUploads, newUpload] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showAlert('Upload failed', message);
    }
  }, [user?.id, stepId, saveAct]);

  const removeCapture = useCallback(
    (captureId: string) => {
      // DoCaptureItem ids are prefixed by the normalizer: `obs:` / `media:` / `link:`.
      const [prefix, rawId] = captureId.split(':', 2);
      if (!rawId) return;
      const act = metadataRef.current.act ?? {};
      if (prefix === 'obs') {
        const currentObs = act.observations ?? [];
        saveAct({ observations: currentObs.filter((o) => o.id !== rawId) });
        return;
      }
      if (prefix === 'media') {
        const currentUploads = act.media_uploads ?? [];
        const upload = currentUploads.find((u) => u.id === rawId);
        if (upload && user?.id) {
          const pathMatch = upload.uri.match(/step-media\/(.+?)(\?|$)/);
          if (pathMatch?.[1]) {
            supabase.storage
              .from('step-media')
              .remove([decodeURIComponent(pathMatch[1])])
              .catch(() => {});
          }
        }
        saveAct({ media_uploads: currentUploads.filter((u) => u.id !== rawId) });
        return;
      }
      if (prefix === 'link') {
        const currentLinks = act.media_links ?? [];
        saveAct({ media_links: currentLinks.filter((l) => l.id !== rawId) });
      }
    },
    [saveAct, user?.id],
  );

  // ─── Callbacks for DoTabInterior ──────────────────────────────────────────

  const handleQuickNote = useCallback(() => {
    if (readOnly) return;
    setQuickNoteVisible(true);
  }, [readOnly]);

  const handleVoiceNote = useCallback(() => {
    if (readOnly) return;
    // v1 — no native voice; route through the quick-note modal so the
    // composer's mic affordance still produces a saved capture.
    setQuickNoteVisible(true);
  }, [readOnly]);

  const handlePhotoOrVideo = useCallback(() => {
    if (readOnly) return;
    if (!IS_NATIVE) {
      showAlert('Photo upload', 'Photo capture is available on iOS and Android.');
      return;
    }
    void pickPhotoOrVideoNative();
  }, [readOnly, pickPhotoOrVideoNative]);

  const handleStopCapturing = useCallback(() => {
    if (readOnly) return;
    setActivityEndedAt(new Date().toISOString());
  }, [readOnly]);

  const handleAddAnotherCapture = useCallback(() => {
    if (readOnly) return;
    setActivityEndedAt(null);
  }, [readOnly]);

  const handleDiscardActivity = useCallback(() => {
    if (readOnly) return;
    showConfirm(
      'Discard activity?',
      'This will clear all captures, notes, and the start time from this step.',
      () => {
        setActivityEndedAt(null);
        saveAct({
          observations: [],
          media_uploads: [],
          media_links: [],
          notes: '',
          started_at: undefined,
        });
      },
      { destructive: true, confirmText: 'Discard' },
    );
  }, [readOnly, saveAct]);

  const handleMarkAsEvidence = useCallback(
    (captureId: string) => {
      if (readOnly) return;
      setMarkingCaptureId(captureId);
    },
    [readOnly],
  );

  const handleDeleteCapture = useCallback(
    (captureId: string) => {
      if (readOnly) return;
      removeCapture(captureId);
    },
    [readOnly, removeCapture],
  );

  const handleMoveToReflect = useCallback(() => {
    if (readOnly) return;
    onMoveToReflect?.();
  }, [readOnly, onMoveToReflect]);

  const closeMarkAsEvidence = useCallback(() => setMarkingCaptureId(null), []);
  const closeQuickNoteModal = useCallback(() => setQuickNoteVisible(false), []);
  const submitQuickNote = useCallback(
    (text: string) => {
      addObservation(text);
      setQuickNoteVisible(false);
    },
    [addObservation],
  );

  // Local-only summary text — short deterministic synthesis, no AI.
  const summaryText = useMemo(() => {
    if (state !== 'post_activity') return undefined;
    const nonMarker = captures.filter((c) => c.kind !== 'time_marker').length;
    if (nonMarker === 0) return 'No captures from this activity yet.';
    const noun = nonMarker === 1 ? 'capture' : 'captures';
    return `${nonMarker} ${noun} logged. Review them below or refine before moving to Reflect.`;
  }, [state, captures]);

  const summaryStepChipLabel = stepTitle || undefined;

  const doTabInteriorProps: Omit<DoTabInteriorProps, 'footer'> = {
    state,
    planData,
    captures,
    readOnly,
    summaryText,
    summaryStepChipLabel,
    stepTitle,
    elapsedMs,
    nowMs: now(),
    isTimed,
    onVoiceNote: handleVoiceNote,
    onPhotoOrVideo: handlePhotoOrVideo,
    onQuickNote: handleQuickNote,
    onStopCapturing: handleStopCapturing,
    onMoveToReflect: handleMoveToReflect,
    onAddAnotherCapture: handleAddAnotherCapture,
    onDiscardActivity: handleDiscardActivity,
    onDeleteCapture: handleDeleteCapture,
    onMarkAsEvidence: handleMarkAsEvidence,
  };

  return {
    state,
    activityEndedAt,
    markingCaptureId,
    quickNoteVisible,
    captures,
    planData,
    stepTitle,
    doTabInteriorProps,
    markingCapture,
    closeMarkAsEvidence,
    closeQuickNoteModal,
    submitQuickNote,
  };
}
