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
import { router } from 'expo-router';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useUpdateStep } from '@/hooks/useTimelineSteps';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import { supabase } from '@/services/supabase';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { dropInsight } from '@/services/QuickCaptureService';
// Import runtime helpers from their own files (not the do-tab barrel) so
// jest doesn't pull every component-level `@expo/vector-icons` import into
// the controller hook's transitive graph.
import {
  normalizeDoCaptures,
  sortCapturesNewestFirst,
  type DoCaptureItem,
} from '@/components/step/do-tab/doCaptureModel';
import { deriveDoInteriorState, type DoInteriorState } from '@/components/step/do-tab/doState';
import { normalizeHowSubSteps } from '@/lib/step/normalizeHowSubSteps';
import type { DoTabInteriorProps } from '@/components/step/do-tab/DoTabInterior';
import type { SubStepCaptureKind } from '@/components/step/do-tab/PlanStartingFrameRow';
import type {
  MediaLink,
  MediaUpload,
  Observation,
  StepActData,
  StepMetadata,
  StepPlanData,
} from '@/types/step-detail';
import type { ExtractedMeasurement } from '@/types/measurements';
import type { MeasurementInput } from '@/components/step/do-tab/MeasurementCaptureModal';

const IMAGE_QUALITY = 0.6;
const IS_NATIVE = Platform.OS === 'ios' || Platform.OS === 'android';

export interface UseStepActCaptureControllerInput {
  /** Step the controller is bound to. */
  stepId: string;
  /** Suppress all mutating callbacks. */
  readOnly?: boolean;
  interestId?: string;
  interestName?: string;
  interestSlug?: string;
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
  /** Pre-fill text for the quick-note modal — populated when editing a note. */
  quickNoteInitialText: string;
  /** Title override for the quick-note modal — "Edit note" while editing. */
  quickNoteTitle: string | undefined;
  /** Interest slug — drives per-interest measurement presets. */
  interestSlug: string | undefined;
  /** Photo-source chooser (Take Photo vs Choose from Library) visibility. */
  photoSourceVisible: boolean;
  closePhotoSource: () => void;
  onTakePhoto: () => void;
  onChooseFromLibrary: () => void;
  /** In-app video recorder visibility. */
  videoCaptureVisible: boolean;
  closeVideoCapture: () => void;
  onVideoCaptured: (uri: string) => void;
  /** Barcode / QR scanner visibility. */
  scanCaptureVisible: boolean;
  closeScanCapture: () => void;
  onBarcodeScanned: (data: string) => void;
  /** Manual measurement form visibility. */
  measurementVisible: boolean;
  closeMeasurement: () => void;
  onMeasurementSubmit: (input: MeasurementInput) => void;
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
  interestId,
  interestName,
  interestSlug,
  onMoveToReflect,
  now = Date.now,
}: UseStepActCaptureControllerInput): StepActCaptureControllerView {
  const { data: step } = useStepDetail(stepId);
  const updateMetadata = useUpdateStepMetadata(stepId);
  const updateStep = useUpdateStep();
  const { user } = useAuth();
  const toast = useToast();

  const metadata = (step?.metadata ?? {}) as StepMetadata;
  const basePlan: StepPlanData = metadata.plan ?? {};
  const planData: StepPlanData = basePlan.how_sub_steps?.length
    ? { ...basePlan, how_sub_steps: normalizeHowSubSteps(basePlan.how_sub_steps) }
    : basePlan;
  // Wrap in useMemo so the object identity is stable across renders when
  // metadata.act hasn't changed — keeps downstream useMemo deps honest.
  const actData = useMemo<StepActData>(() => metadata.act ?? {}, [metadata.act]);

  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const [activityEndedAt, setActivityEndedAt] = useState<string | null>(null);
  const [markingCaptureId, setMarkingCaptureId] = useState<string | null>(null);
  const [quickNoteVisible, setQuickNoteVisible] = useState(false);
  // When set, the quick-note modal is in edit mode for this capture id.
  const [editingCaptureId, setEditingCaptureId] = useState<string | null>(null);
  // When the quick-note modal was opened from a specific How sub-step, the new
  // observation is anchored to it (sub_step_id). Transient — cleared on submit.
  const captureSubStepIdRef = useRef<string | null>(null);

  // Capture-type modal visibility. The photo-source chooser, in-app video
  // recorder, barcode scanner, and measurement form all mount in the shell.
  const [photoSourceVisible, setPhotoSourceVisible] = useState(false);
  const [videoCaptureVisible, setVideoCaptureVisible] = useState(false);
  const [scanCaptureVisible, setScanCaptureVisible] = useState(false);
  const [measurementVisible, setMeasurementVisible] = useState(false);
  // Sub-step a photo-source pick is anchored to (null for whole-step capture).
  const photoSubStepIdRef = useRef<string | null>(null);

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
    (text: string, subStepId?: string | null) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const obs: Observation = {
        id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        timestamp: new Date().toISOString(),
        source: 'note',
        ...(subStepId ? { sub_step_id: subStepId } : {}),
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

  const editObservation = useCallback(
    (captureId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const [prefix, rawId] = captureId.split(':', 2);
      if (prefix !== 'obs' || !rawId) return;
      const currentObs = metadataRef.current.act?.observations ?? [];
      saveAct({
        observations: currentObs.map((o) =>
          o.id === rawId ? { ...o, text: trimmed } : o,
        ),
      });
    },
    [saveAct],
  );

  // Shared upload path for camera capture, library picks, and in-app video
  // recording — all three resolve a local uri then write a media_upload.
  const uploadStepMedia = useCallback(
    async ({
      uri,
      isVideo,
      subStepId,
    }: {
      uri: string;
      isVideo: boolean;
      subStepId?: string | null;
    }) => {
      if (!user?.id) {
        showAlert('Sign in required', 'Sign in to save photos and videos to this step.');
        return;
      }
      const ext = uri.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const fileName = `${user.id}/${stepId}/${fileId}.${ext}`;
      try {
        const response = await fetch(uri);
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
          ...(subStepId ? { sub_step_id: subStepId } : {}),
        };
        const currentUploads = metadataRef.current.act?.media_uploads ?? [];
        saveAct({ media_uploads: [...currentUploads, newUpload] });
        toast.show(isVideo ? 'Video added' : 'Photo added', 'success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showAlert('Upload failed', message);
      }
    },
    [user?.id, stepId, saveAct, toast],
  );

  const takePhoto = useCallback(
    async (subStepId?: string | null) => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Camera access needed', 'Enable camera access in Settings to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: IMAGE_QUALITY,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await uploadStepMedia({ uri: result.assets[0].uri, isVideo: false, subStepId });
    },
    [uploadStepMedia],
  );

  const chooseFromLibrary = useCallback(
    async (subStepId?: string | null) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: IMAGE_QUALITY,
        videoMaxDuration: 30,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await uploadStepMedia({ uri: asset.uri, isVideo: asset.type === 'video', subStepId });
    },
    [uploadStepMedia],
  );

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

  const handleVoiceNote = useCallback(() => {
    if (readOnly) return;
    captureSubStepIdRef.current = null;
    // v1 — no native voice; route through the quick-note modal so the
    // composer's mic affordance still produces a saved capture.
    setQuickNoteVisible(true);
  }, [readOnly]);

  // Per-How-row capture: anchors the new observation/photo to a sub-step id.
  // Note/voice route through the quick-note modal (no native voice in v1);
  // photo goes straight to the native picker. Web photo is a no-op alert.
  const handleSubStepCapture = useCallback(
    (subStepId: string, kind: SubStepCaptureKind) => {
      if (readOnly) return;
      if (kind === 'photo') {
        if (!IS_NATIVE) {
          showAlert('Photo upload', 'Photo capture is available on iOS and Android.');
          return;
        }
        photoSubStepIdRef.current = subStepId;
        setPhotoSourceVisible(true);
        return;
      }
      captureSubStepIdRef.current = subStepId;
      setQuickNoteVisible(true);
    },
    [readOnly],
  );

  // Inline note path for beats + How rows — writes the observation anchored to
  // the row directly, no modal. Photo/voice still route through
  // handleSubStepCapture (native picker / quick-note modal for voice).
  const handleSubStepNoteSubmit = useCallback(
    (subStepId: string, text: string) => {
      if (readOnly || !text.trim()) return;
      addObservation(text, subStepId);
      toast.show('Note added', 'success');
    },
    [readOnly, addObservation, toast],
  );

  const handlePhotoOrVideo = useCallback(() => {
    if (readOnly) return;
    if (!IS_NATIVE) {
      showAlert('Photo upload', 'Photo capture is available on iOS and Android.');
      return;
    }
    photoSubStepIdRef.current = null;
    setPhotoSourceVisible(true);
  }, [readOnly]);

  // ─── Photo-source chooser (Take Photo vs Choose from Library) ─────────────
  const closePhotoSource = useCallback(() => setPhotoSourceVisible(false), []);

  const handleTakePhoto = useCallback(() => {
    setPhotoSourceVisible(false);
    void takePhoto(photoSubStepIdRef.current);
  }, [takePhoto]);

  const handleChooseFromLibrary = useCallback(() => {
    setPhotoSourceVisible(false);
    void chooseFromLibrary(photoSubStepIdRef.current);
  }, [chooseFromLibrary]);

  // ─── Video recording ──────────────────────────────────────────────────────
  const handleSelectVideo = useCallback(() => {
    if (readOnly) return;
    setVideoCaptureVisible(true);
  }, [readOnly]);

  const closeVideoCapture = useCallback(() => setVideoCaptureVisible(false), []);

  const handleVideoCaptured = useCallback(
    (uri: string) => {
      setVideoCaptureVisible(false);
      void uploadStepMedia({ uri, isVideo: true });
    },
    [uploadStepMedia],
  );

  // ─── Barcode / QR scan ────────────────────────────────────────────────────
  const handleSelectScan = useCallback(() => {
    if (readOnly) return;
    setScanCaptureVisible(true);
  }, [readOnly]);

  const closeScanCapture = useCallback(() => setScanCaptureVisible(false), []);

  const handleBarcodeScanned = useCallback(
    (data: string) => {
      setScanCaptureVisible(false);
      const trimmed = data.trim();
      if (!trimmed) return;
      if (/^https?:\/\//i.test(trimmed)) {
        const link: MediaLink = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          url: trimmed,
          caption: 'Scanned code',
          platform: 'other',
          added_at: new Date().toISOString(),
        };
        const currentLinks = metadataRef.current.act?.media_links ?? [];
        saveAct({ media_links: [...currentLinks, link] });
        toast.show('Link added', 'success');
        return;
      }
      addObservation(`Scanned: ${trimmed}`);
      toast.show('Code saved', 'success');
    },
    [saveAct, addObservation, toast],
  );

  // ─── Manual measurement ───────────────────────────────────────────────────
  const handleSelectMeasurement = useCallback(() => {
    if (readOnly) return;
    setMeasurementVisible(true);
  }, [readOnly]);

  const closeMeasurement = useCallback(() => setMeasurementVisible(false), []);

  const handleMeasurementSubmit = useCallback(
    ({ label, value, unit, note }: MeasurementInput) => {
      setMeasurementVisible(false);
      const nowIso = new Date().toISOString();
      const entry: ExtractedMeasurement = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        measurement: {
          category: 'performance',
          metric_name: label,
          value,
          unit: unit || undefined,
          notes: note || undefined,
        },
        confidence: 1,
        source: 'manual_edit',
        verified: true,
        timestamp: nowIso,
      };
      const prev = metadataRef.current.act?.measurements;
      saveAct({
        measurements: {
          ...prev,
          extracted: [...(prev?.extracted ?? []), entry],
          last_extracted_at: nowIso,
        },
      });
      toast.show('Measurement added', 'success');
    },
    [saveAct, toast],
  );

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

  const handleMarkAsConceptSeed = useCallback(
    async (captureId: string) => {
      if (readOnly || !user?.id) return;
      const capture = captures.find((row) => row.id === captureId);
      const content = capture?.body?.trim();
      if (!content) {
        showAlert('No text to save', 'This capture does not have concept-seed text yet.');
        return;
      }
      const kind = capture?.kind === 'voice' ? 'voice' : 'text';
      try {
        await dropInsight({
          userId: user.id,
          interestId: interestId ?? step?.interest_id ?? null,
          payload: {
            kind,
            content,
          },
        });
        showAlert('Saved to Playbook', 'Concept seed added to Recent insights.');
        router.push('/(tabs)/library' as any);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not save concept seed.';
        showAlert('Save failed', message);
      }
    },
    [captures, interestId, readOnly, step?.interest_id, user?.id],
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

  const handleToggleSubStep = useCallback(
    (subStepId: string, completed: boolean) => {
      if (readOnly) return;
      const currentPlan = (metadataRef.current.plan ?? {}) as StepPlanData;
      // Same id fill as the rendered planData, so legacy id-less rows match
      // and the generated ids persist on first toggle.
      const subs = normalizeHowSubSteps(currentPlan.how_sub_steps);
      const next = subs.map((s) => (s.id === subStepId ? { ...s, completed } : s));
      updateMetadata.mutate({ plan: { ...currentPlan, how_sub_steps: next } });
    },
    [readOnly, updateMetadata],
  );

  const handleEditCapture = useCallback(
    (captureId: string) => {
      if (readOnly) return;
      // Only obs-backed text notes are editable through the quick-note modal.
      if (!captureId.startsWith('obs:')) return;
      setEditingCaptureId(captureId);
      setQuickNoteVisible(true);
    },
    [readOnly],
  );

  const closeMarkAsEvidence = useCallback(() => setMarkingCaptureId(null), []);
  const closeQuickNoteModal = useCallback(() => {
    setQuickNoteVisible(false);
    setEditingCaptureId(null);
  }, []);
  const submitQuickNote = useCallback(
    (text: string) => {
      if (!text.trim()) {
        captureSubStepIdRef.current = null;
        setQuickNoteVisible(false);
        setEditingCaptureId(null);
        return;
      }
      if (editingCaptureId) {
        editObservation(editingCaptureId, text);
        toast.show('Note updated', 'success');
      } else {
        addObservation(text, captureSubStepIdRef.current);
        toast.show('Note added', 'success');
      }
      captureSubStepIdRef.current = null;
      setQuickNoteVisible(false);
      setEditingCaptureId(null);
    },
    [editingCaptureId, editObservation, addObservation, toast],
  );

  const quickNoteInitialText = useMemo(() => {
    if (!editingCaptureId) return '';
    return captures.find((c) => c.id === editingCaptureId)?.body ?? '';
  }, [editingCaptureId, captures]);

  // Local-only summary text — short deterministic synthesis, no AI.
  const summaryText = useMemo(() => {
    if (state !== 'post_activity') return undefined;
    const nonMarker = captures.filter((c) => c.kind !== 'time_marker').length;
    if (nonMarker === 0) return 'No captures from this activity yet.';
    const noun = nonMarker === 1 ? 'capture' : 'captures';
    return `${nonMarker} ${noun} logged. Review them below or refine before moving to Reflect.`;
  }, [state, captures]);

  const summaryStepChipLabel = stepTitle || undefined;

  // Group captures anchored to each How sub-step (sub_step_id), newest-first, so
  // the row can render its saved annotations inline. Spans obs, uploads, links.
  const subStepCaptures = useMemo(() => {
    const grouped: Record<string, DoCaptureItem[]> = {};
    for (const c of captures) {
      if (!c.subStepId) continue;
      (grouped[c.subStepId] ??= []).push(c);
    }
    return grouped;
  }, [captures]);

  const doTabInteriorProps: Omit<DoTabInteriorProps, 'footer'> = {
    state,
    stepId,
    planData,
    captures,
    readOnly,
    interestId: interestId ?? step?.interest_id,
    interestName,
    interestSlug,
    summaryText,
    summaryStepChipLabel,
    stepTitle,
    elapsedMs,
    nowMs: now(),
    isTimed,
    onVoiceNote: handleVoiceNote,
    onPhotoOrVideo: handlePhotoOrVideo,
    onQuickNoteSubmit: submitQuickNote,
    onStopCapturing: handleStopCapturing,
    onMoveToReflect: handleMoveToReflect,
    onAddAnotherCapture: handleAddAnotherCapture,
    onDiscardActivity: handleDiscardActivity,
    onDeleteCapture: handleDeleteCapture,
    onEditCapture: handleEditCapture,
    onTagCapture: handleMarkAsConceptSeed,
    onMarkAsEvidence: handleMarkAsEvidence,
    onToggleSubStep: handleToggleSubStep,
    onSubStepCapture: handleSubStepCapture,
    onSubStepNoteSubmit: handleSubStepNoteSubmit,
    onSelectVideo: handleSelectVideo,
    onSelectScan: handleSelectScan,
    onSelectMeasurement: handleSelectMeasurement,
    subStepCaptures,
  };

  return {
    state,
    activityEndedAt,
    markingCaptureId,
    quickNoteVisible,
    captures,
    planData,
    stepTitle,
    interestSlug,
    doTabInteriorProps,
    markingCapture,
    closeMarkAsEvidence,
    closeQuickNoteModal,
    submitQuickNote,
    quickNoteInitialText,
    quickNoteTitle: editingCaptureId ? 'Edit note' : undefined,
    // Capture-type modals (mounted in DoTabIOSRegisterShell)
    photoSourceVisible,
    closePhotoSource,
    onTakePhoto: handleTakePhoto,
    onChooseFromLibrary: handleChooseFromLibrary,
    videoCaptureVisible,
    closeVideoCapture,
    onVideoCaptured: handleVideoCaptured,
    scanCaptureVisible,
    closeScanCapture,
    onBarcodeScanned: handleBarcodeScanned,
    measurementVisible,
    closeMeasurement,
    onMeasurementSubmit: handleMeasurementSubmit,
  };
}
