# Phase B.11 Spec: Do Tab Interior

## Goal

Replace the existing Practice step `Do` tab interior with the iOS-register canonical: pre-activity capture affordances, live reverse-chronological capture stream with coral `LIVE · IN PROGRESS` signal, explicit End activity transition, post-activity auto-summary, and `Move to Reflect` handoff. This is a refactor of the current `ActTab` / `StepDrawContent` implementation, not a new activity feature. The flag-off path must preserve current production Do behavior.

Phase B.11 closes the Plan / Do / Reflect interior trilogy: B.5 Plan is shipped-verified, B.10 Reflect is specced, and Reflect’s AI-drafted summary depends on the Do capture stream this phase formalizes.

## Source Canonicals

- Visual canonical: `docs/redesign/ios-register/do-tab-interior-canonical.html`.
- Prose source: `docs/redesign/PRACTICE_TIMELINE_CANONICAL.md`, Frame 2 / Do-tab expansion.
- Companion specs: `docs/redesign/specs/PHASE_B5_PLAN_TAB_INTERIOR_SPEC.md`, `docs/redesign/specs/PHASE_B10_REFLECT_TAB_INTERIOR_SPEC.md`.
- Companion canonicals: `plan-tab-three-states-canonical.html`, `reflect-tab-interior-canonical.html`, `ai-coach-conversational-flow-canonical.html`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify current repo state:

```bash
test -f docs/redesign/ios-register/do-tab-interior-canonical.html
test -f components/step/ActTab.tsx
test -f components/step/StepDrawContent.tsx
test -f components/step/CaptureTimeline.tsx
test -f components/step/ObservationLog.tsx
test -f types/step-detail.ts
test -f services/ai/VoiceNoteService.ts
test -f components/ai/VoiceNoteRecorder.tsx
rg -n "activeTab === 'act'|<ActTab|onNextTab=\\{\\(\\) => handleNextTab\\('review'\\)\\}" components/step/StepDetailContent.tsx
rg -n "Save & Reflect|StepDrawContent|onNextTab" components/step/ActTab.tsx
rg -n "started_at|observations|media_uploads|media_links|sub_step_progress|conversation_id" types/step-detail.ts components/step/StepDrawContent.tsx
rg -n "handlePickMedia|ImagePicker|CaptureTimeline|ObservationLog|handleAddObservation|handleRemoveObservation" components/step/StepDrawContent.tsx
rg -n "VoiceNoteService|VoiceNoteRecorder|Audio\\.Recording|transcribeAudio" services components -g '*.{ts,tsx}'
rg -n "PRACTICE_DO_TAB_IOS_REGISTER|EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER" lib .env* app components
```

Verified at spec-write time:

- The current Do surface is `ActTab`, mounted by `StepDetailContent.tsx` when `activeTab === 'act'`.
- `ActTab` wraps `StepDrawContent` and renders the current `Save & Reflect` CTA through `onNextTab`.
- `StepDrawContent` auto-starts the step by writing `metadata.act.started_at` and setting pending steps to `status: 'in_progress'` when the Do tab mounts.
- Current capture data lives in `timeline_steps.metadata.act`, typed by `StepActData`.
- Typed notes are `Observation[]` entries in `metadata.act.observations`, mirrored into legacy `metadata.act.notes`.
- Photo/video capture is already wired through `expo-image-picker`, Supabase Storage bucket `step-media`, and `metadata.act.media_uploads`.
- Link-based media is stored in `metadata.act.media_links`.
- Voice recording infrastructure exists in `services/ai/VoiceNoteService.ts` and `components/ai/VoiceNoteRecorder.tsx`, but it is race-day oriented, uses simulated transcription in the service, and is not currently wired into `StepDrawContent`.

Stop and surface if `StepDrawContent` has been replaced, if media capture no longer writes `media_uploads`, or if voice recording has been removed entirely.

## Current Data Shape

The v1 iOS-register Do surface must read and write the existing `StepActData` shape:

```ts
export interface Observation {
  id: string;
  text: string;
  timestamp: string;
  source?: 'voice' | 'note';
  flagged?: boolean;
  capability_label?: string;
  audio_uri?: string;
  audio_duration_seconds?: number;
}

export interface StepActData {
  started_at?: string;
  activity_ended_at?: string;
  notes?: string;
  observations?: Observation[];
  media_uploads?: MediaUpload[];
  media_links?: MediaLink[];
  sub_step_progress?: Record<string, boolean>;
  sub_step_deviations?: Record<string, string>;
  sub_step_overrides?: Record<string, string>;
  conversation_id?: string;
  measurements?: StepMeasurements;
  nutrition?: StepNutrition;
}
```

This is sufficient for v1 with additive optional fields. The canonical capture stream can be derived from `observations`, `media_uploads`, and `media_links`. Phase B.11 adds `activity_ended_at`, `flagged`, `capability_label`, and voice-audio metadata as optional fields inside existing `metadata.act`; it does not add a new capture table or Supabase migration.

If media uploads or media links are treated as first-class capture entries in the implementation, add the same optional `flagged?: boolean` and `capability_label?: string` fields to `MediaUpload` and `MediaLink`. The user-facing rule is simple: every capture row can be flagged, and every flagged capture can optionally carry one capability label.

## Commit Boundaries

### Commit 1: Flag, Capture Model, and Presentational Shell

Message:

```text
feat(practice): add flagged Do tab interior shell
```

Files:

- `lib/featureFlags.ts`
- New `components/step/do-tab/doState.ts`
- New `components/step/do-tab/captureModel.ts`
- New `components/step/do-tab/DoTabInterior.tsx`
- New `components/step/do-tab/index.ts`
- New `components/step/do-tab/__tests__/captureModel.test.ts`

Add flag:

```ts
PRACTICE_DO_TAB_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER', false),
```

Model API:

```ts
export type DoActivityState = 'pre_activity' | 'live' | 'post_activity';

export type DoCaptureEntry =
  | {
      kind: 'observation';
      id: string;
      timestamp: string;
      text: string;
      source: 'voice' | 'note';
      flagged: boolean;
      capabilityLabel?: string;
      audioUri?: string;
      audioDurationSeconds?: number;
    }
  | {
      kind: 'media';
      id: string;
      timestamp: string;
      uri: string;
      mediaType: 'photo' | 'video';
      caption?: string;
      flagged: boolean;
      capabilityLabel?: string;
    }
  | {
      kind: 'link';
      id: string;
      timestamp: string;
      url: string;
      platform: MediaLinkPlatform;
      caption?: string;
      flagged: boolean;
      capabilityLabel?: string;
    };

export function deriveDoActivityState(input: {
  status?: string;
  startedAt?: string;
  activityEndedAt?: string;
  captureCount: number;
  readOnly?: boolean;
}): DoActivityState;

export function buildDoCaptureEntries(input: {
  observations: Observation[];
  mediaUploads: MediaUpload[];
  mediaLinks: MediaLink[];
}): DoCaptureEntry[];
```

Rules:

- `pre_activity` when no `started_at`, no captures, and status is `pending`.
- `live` when `started_at` exists or status is `in_progress`.
- `post_activity` when `activity_ended_at` is present or status is `completed`.
- Capture entries sort reverse-chronological for the live state.

`DoTabInterior` is presentational; it receives capture entries, plan context, callbacks, and state. It must not call Supabase directly.

### Commit 2: Pre-Activity Capture Affordances

Message:

```text
feat(practice): render canonical Do pre-activity state
```

Files:

- `components/step/do-tab/DoTabInterior.tsx`
- New `components/step/do-tab/DoCaptureActions.tsx`
- New `components/step/do-tab/PlanStartingFrameCard.tsx`
- Tests for presentational render behavior.

Render Frame 1:

- Starting-frame card summarizing `planData.what_will_you_do`, visible How sub-steps, and Why.
- Three primary capture buttons:
  - `Voice note`
  - `Photo or video`
  - `Quick note`
- Secondary affordance: `Auto-summarize my Plan as starting frame`.

Callback wiring:

- `Voice note` calls `onStartVoiceCapture`, records audio via the existing voice service, then prompts the user for a short manual title.
- `Photo or video` calls `onPickMedia`.
- `Quick note` focuses/opens a note composer.
- `Start Do` / first capture should preserve current behavior: write `metadata.act.started_at` and move pending step to `status: 'in_progress'`.

Do not invent new AI summary storage for the starting frame. It can be derived from Plan fields in v1.

Voice v1 decision:

- No live transcription and no generated transcript in v1.
- The user-typed title is the capture text.
- Audio is stored in Supabase Storage `step-media`, using the same storage boundary as photo/video.
- The resulting live-stream row reads `Voice — [title]` and can play the attached audio.
- Real transcription via Whisper or similar is deferred to a post-May-20 phase.

### Commit 3: Live Capture Stream and Coral LIVE State

Message:

```text
feat(practice): render canonical Do live capture stream
```

Files:

- `components/step/do-tab/DoLiveHeader.tsx`
- `components/step/do-tab/DoCaptureStream.tsx`
- `components/step/do-tab/DoCaptureEntryRow.tsx`
- `components/step/do-tab/DoTabInterior.tsx`
- Tests for entry ordering and labels.

Render Frame 2:

- Coral `LIVE · IN PROGRESS` indicator only while `deriveDoActivityState(...) === 'live'`.
- Reverse-chronological capture stream.
- Type-coded rows:
  - Blue accent for voice.
  - Gray accent for typed notes.
  - Coral accent for flagged moments.
  - Photo/video thumbnail rows for media.
- Floating mic affordance for quick voice capture.
- Persistent `End activity` or `I'm done capturing` button near the coral live header. This is the only transition from Frame 2 live capture into Frame 3 post-activity.
- Small flag toggle on each capture entry.
- Capability label chip on each capture entry. This is a simple label in v1, not a structured evidence-level workflow.

Current repo gap:

- `CaptureTimeline` sorts chronological today. The new model must reverse-sort for live mode while preserving legacy flag-off behavior.
- Current observations support `source: 'voice' | 'note'`, but no `flagged` or `capability_label` fields exist on the type. Phase B.11 adds those optional fields and persists them under `metadata.act.observations[]`.
- Flagged captures feed both downstream surfaces: B.10 Reflect uses them as suggested prompt inputs, and Profile capability evidence can count flagged captures once a capability label is present.

### Commit 4: Voice and Photo Capture Adapter

Message:

```text
feat(practice): adapt existing media and voice capture for Do tab
```

Files:

- `components/step/do-tab/useDoCaptureController.ts`
- `components/step/StepDrawContent.tsx`
- Optional `components/step/do-tab/DoVoiceCaptureButton.tsx`
- Tests for controller helpers where practical.

Photo/video:

- Reuse the current `StepDrawContent.handlePickMedia` logic: `expo-image-picker`, Supabase Storage bucket `step-media`, then append to `metadata.act.media_uploads`.
- Preserve max video duration and file-size behavior.

Quick note:

- Reuse `ObservationLog` semantics: append to `metadata.act.observations`, mirror into `metadata.act.notes` for Telegram compatibility.

Voice:

- Reuse `VoiceNoteService` only as the recording primitive if it can be adapted without pulling in race-specific tactical UI.
- When a voice note completes, prompt the user for a short title, upload/store the audio under `step-media`, then append an `Observation`:

```ts
{
  id: voiceNote.id,
  text: manualTitle,
  timestamp: voiceNote.timestamp.toISOString(),
  source: 'voice',
  audio_uri: publicAudioUrl,
  audio_duration_seconds: voiceNote.duration,
  flagged: false,
}
```

- The `text` field is the manual title, not a transcript.
- Do not call or display simulated transcription from `VoiceNoteService` in the Do v1 flow.
- When real transcription ships later, it must be additive: existing audio captures can be retroactively transcribed because audio URI and manual title are stored separately.
- Do not reuse `VoiceNoteRecorder` wholesale if its race-day tactical insight UI conflicts with the canonical Do surface; wrap the service behind a small Do-specific button.

### Commit 5: End Activity, Post-Activity Summary, Move to Reflect, and Wiring

Message:

```text
feat(practice): add Do post-activity summary and Reflect handoff
```

Files:

- `components/step/do-tab/DoPostActivitySummary.tsx`
- `components/step/do-tab/doSummaryModel.ts`
- `components/step/ActTab.tsx`
- `components/step/StepDrawContent.tsx`
- `components/step/do-tab/*`
- Optional tests for `doSummaryModel.ts`.

Render Frame 3:

- Auto-summary card derived from captures.
- Compressed capture list.
- Full-width `Move to Reflect` CTA.

End activity:

- Frame 2 transitions to Frame 3 only when the user taps `End activity` / `I'm done capturing`.
- Persist `metadata.act.activity_ended_at = new Date().toISOString()`.
- The existing `Save & Reflect` CTA maps to Frame 3's `Move to Reflect`, not to End activity.
- Flow: live capture -> End activity -> post-activity summary -> Move to Reflect -> Reflect tab.

V1 summary source:

- Use a deterministic local summary first: capture count, voice count, note count, media count, flagged count, and stickiest/latest capture.
- Without transcription, voice-only sessions depend on manual titles, capability labels, and flags. If the user records vague voice titles, the summary should be intentionally modest instead of inventing detail.
- If an existing AI summarization function is verified during execution, it can enrich the summary, but this phase must not block on new AI infrastructure.

Handoff:

- Keep current `ActTab` `onNextTab` transition. `Move to Reflect` calls the same callback currently powering `Save & Reflect`.
- Before calling `onNextTab`, persist any pending act captures and the deterministic summary if the execution chooses to store it.
- Recommended v1 location:

```ts
metadata.act.summary = {
  text: string;
  generated_at: string;
  source: 'local' | 'ai';
}
```

Because `StepActData` currently has no `summary` field, execution must either:

- Add an optional `summary?: StepActSummary` type-only field to `types/step-detail.ts`, or
- Keep the summary derived at render time and let B.10 derive its summary from `actData` directly.

Recommendation: use derived summary only for v1 unless B.10 execution proves a persisted handoff is necessary.

Implementation approach:

- Keep `ActTab` as the parent component mounted by `StepDetailContent`.
- Inside `ActTab`, branch on `FEATURE_FLAGS.PRACTICE_DO_TAB_IOS_REGISTER`.
- Flag off: render current conditions card, `StepFocusConcepts`, `StepDrawContent`, `Save & Reflect`, and footer exactly as today.
- Flag on: render the canonical `DoTabInterior` with callbacks adapted from existing `StepDrawContent` logic.

If extracting existing capture handlers from `StepDrawContent` is invasive, create `useDoCaptureController` that owns the shared read/write hooks and leave `StepDrawContent` as the legacy flag-off component.

## Files to Change

- `lib/featureFlags.ts`
- `components/step/ActTab.tsx`
- `components/step/StepDrawContent.tsx`
- New files under `components/step/do-tab/`
- Tests under `components/step/do-tab/__tests__/`
- `types/step-detail.ts` for additive optional metadata fields: `activity_ended_at`, `flagged`, `capability_label`, `audio_uri`, `audio_duration_seconds`, and optionally `summary`.

## Files to NOT Change

- Do not add Supabase migrations.
- Do not replace voice/photo storage backends.
- Do not modify `components/ai/VoiceNoteRecorder.tsx` unless execution chooses to extract a reusable primitive; prefer wrapping `VoiceNoteService`.
- Do not implement the Frame 4 evidence-marking modal in v1; it is explicitly deferred to v2.
- Do not change B.5 Plan or B.10 Reflect specs.
- Do not touch `app/(tabs)/races.tsx` unless execution discovers an unavoidable parent integration issue; if so, stop and rescope.
- Do not hardcode bottom-tab label text. A.10 remains in force.
- Do not import preview-route components from `app/`.

## Cutover Flag

Required, default OFF:

- Flag key: `PRACTICE_DO_TAB_IOS_REGISTER`
- Env override: `EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER`
- Default: `false`

This phase changes visible UX, capture control flow, media/voice actions, and phase transition behavior. It does not qualify for the mechanical-only flag exception.

## Test Approach

Unit tests:

- `deriveDoActivityState` returns pre/live/post correctly.
- `buildDoCaptureEntries` merges observations, media uploads, and media links.
- Live entries sort reverse-chronologically.
- Post-activity summary counts voice, typed, media, and flagged captures correctly.
- Flag and capability-label toggles persist on capture entries.
- Voice rows use manual titles and retain audio URI separately.

Run:

```bash
npm run typecheck
npx jest components/step/do-tab --runInBand
npx eslint components/step/ActTab.tsx components/step/StepDrawContent.tsx components/step/do-tab --ext .ts,.tsx --max-warnings 0
rg -n "PRACTICE_DO_TAB_IOS_REGISTER|EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER" lib components --glob '*.{ts,tsx}'
```

Simulator checks with flag ON:

1. Open `/practice`, choose a planned step, and tap the Do tab.
2. Verify Frame 1: Plan starting frame and Voice / Photo / Quick note affordances.
3. Add a quick note; verify Frame 2: coral `LIVE · IN PROGRESS`, newest capture at top.
4. Add photo/video; verify it uploads and appears in the stream.
5. Record a voice note if native module is available; verify the manual-title prompt appears, the audio stores, and a `Voice — [title]` row appears without transcript copy.
6. Toggle a capture flag and add a capability label; verify both persist on the capture entry.
7. Tap `End activity`; verify `activity_ended_at` is set and Frame 3 post-activity summary appears.
8. Verify `Move to Reflect` is visible only after End activity.
9. Tap `Move to Reflect`; verify it uses the existing transition into Reflect.

Flag-off regression:

- With `EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER` unset/false, current `ActTab` / `StepDrawContent` behavior remains unchanged: sub-step progress, deviations, media upload, observation notes, resources, and `Save & Reflect` still work.

## Rollback Path

Set `EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER=false`. No schema changes are required, so rollback is a flag flip. Revert commits in reverse order if the component needs removal.

## Data Model Scope (Out of Scope for This Phase)

Phase B.11 refactors existing Act/Do metadata into the iOS register. It does not introduce a generalized capture table, evidence table, or voice-transcription pipeline.

V1 data contract:

- Capture stream from `metadata.act.observations`, `media_uploads`, and `media_links`.
- Live state from `metadata.act.started_at` and step `status`.
- Post-activity state from persisted `metadata.act.activity_ended_at`.
- Voice captures store audio plus manual title: `audio_uri`, `audio_duration_seconds`, and `text` as the user-entered title.
- Capture flags persist as `flagged: boolean`.
- Capability label chips persist as a simple `capability_label?: string` on the capture entry.
- Post-activity summary derived locally from capture data.

Deferred v2 data-model work:

- Durable per-capture IDs with evidence tags and capability links.
- Real transcription via Whisper or similar, including transcript status and provenance.
- AI-generated summary history.
- Heuristic activity-end detection.
- Structured capability-evidence-with-level workflow, including the canonical Frame 4 modal.
- Capability evidence records consumed directly by Profile.

When voice transcription ships, existing audio captures can be retroactively transcribed because the v1 data model stores audio file and manual title separately. The future transcript field should be additive, not a replacement for the manual title.

## Dependencies

B.11 is a blocker, not blocked. B.10 Reflect depends on B.11 for full end-to-end testing of the AI-drafted summary from Do captures. B.11 can execute against the existing `ActTab` / `StepDrawContent` without waiting for B.10 or Phase D.

Cross-phase data contract: B.11 must add `flagged: boolean` on capture entries before B.10 executes. B.10 should read flagged captures as suggested prompt inputs for What worked / What to improve. The same flagged capture plus `capability_label` combination is the v1 handoff toward Profile capability evidence.

## Risks and Open Questions

- Photo/video volume: current Supabase Storage upload path is per-step and public URL based. Large mobile capture sessions may create storage/cost pressure; do not increase video duration limits in this phase.
- Without transcription, Reflect tab's AI-drafted summary depends on capture titles, capability labels, flagged state, and typed captures. If a user records only voice notes with vague manual titles, Reflect's summary will be thin.
- Summary handoff: B.10 can derive from `actData`, but if product wants an explicit frozen auto-summary, a small optional metadata field should be added in a later commit.
- Open question for post-May-20: when real voice transcription is wired, should existing audio captures be retroactively transcribed in a batch job, or should transcription apply only to captures created after the feature ships? This is a cost/value decision.
