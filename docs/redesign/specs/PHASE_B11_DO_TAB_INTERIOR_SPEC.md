# Phase B.11 Spec: Do Tab Interior

## Goal

Replace the existing Practice step `Do` tab interior with the iOS-register canonical: pre-activity capture affordances, live reverse-chronological capture stream with coral `LIVE · IN PROGRESS` signal, post-activity auto-summary, `Move to Reflect` handoff, and optional evidence marking. This is a refactor of the current `ActTab` / `StepDrawContent` implementation, not a new activity feature. The flag-off path must preserve current production Do behavior.

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
}

export interface StepActData {
  started_at?: string;
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

This is sufficient for v1. The canonical capture stream can be derived from `observations`, `media_uploads`, and `media_links`. Capability evidence marking can be represented in v1 as presentation-layer selection and future handoff into Reflect’s `competency_assessment` path; do not add a new capture table in Phase B.11.

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
      flagged?: boolean;
      capabilityTags: string[];
    }
  | {
      kind: 'media';
      id: string;
      timestamp: string;
      uri: string;
      mediaType: 'photo' | 'video';
      caption?: string;
      capabilityTags: string[];
    }
  | {
      kind: 'link';
      id: string;
      timestamp: string;
      url: string;
      platform: MediaLinkPlatform;
      caption?: string;
      capabilityTags: string[];
    };

export function deriveDoActivityState(input: {
  status?: string;
  startedAt?: string;
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
- `post_activity` when status is `completed` or when the user explicitly ends the activity in the new UI.
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

- `Voice note` calls `onStartVoiceCapture`.
- `Photo or video` calls `onPickMedia`.
- `Quick note` focuses/opens a note composer.
- `Start Do` / first capture should preserve current behavior: write `metadata.act.started_at` and move pending step to `status: 'in_progress'`.

Do not invent new AI summary storage for the starting frame. It can be derived from Plan fields in v1.

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
- Bottom `Finish activity` / `Review captures` action that transitions to `post_activity`.

Current repo gap:

- `CaptureTimeline` sorts chronological today. The new model must reverse-sort for live mode while preserving legacy flag-off behavior.
- Current observations support `source: 'voice' | 'note'`, but no `flagged` or `capabilityTags` fields exist on the type. For v1, derive flagged state from text conventions only if already present, or expose a local UI flag without persisting it. Do not change `Observation` shape in this phase unless execution explicitly scopes a compatible optional field.

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
- When a voice note completes, append an `Observation`:

```ts
{
  id: voiceNote.id,
  text: voiceNote.transcription ?? 'Voice note recorded',
  timestamp: voiceNote.timestamp.toISOString(),
  source: 'voice',
}
```

- If transcription remains simulated or unavailable, the UI must label it as raw voice capture and allow manual edit of the text. Do not promise real transcription until a verified transcription service is wired.
- Do not reuse `VoiceNoteRecorder` wholesale if its race-day tactical insight UI conflicts with the canonical Do surface; wrap the service behind a small Do-specific button.

### Commit 5: Post-Activity Summary and Move to Reflect Handoff

Message:

```text
feat(practice): add Do post-activity summary and Reflect handoff
```

Files:

- `components/step/do-tab/DoPostActivitySummary.tsx`
- `components/step/do-tab/doSummaryModel.ts`
- `components/step/ActTab.tsx`
- Optional tests for `doSummaryModel.ts`.

Render Frame 3:

- Auto-summary card derived from captures.
- Compressed capture list.
- Evidence affordance visible on captures.
- Full-width `Move to Reflect` CTA.

V1 summary source:

- Use a deterministic local summary first: capture count, voice count, note count, media count, flagged count, and stickiest/latest capture.
- If an existing AI summarization function is verified during execution, it can enrich the summary, but this phase must not block on new AI infrastructure.

Handoff:

- Keep current `ActTab` `onNextTab` transition. `Move to Reflect` calls the same callback currently powering `Save & Reflect`.
- Before calling `onNextTab`, persist any pending act captures and, if summary text exists, write it into an agreed metadata location for B.10 to consume.
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

### Commit 6: Evidence Marking Modal

Message:

```text
feat(practice): add Do evidence marking sheet
```

Files:

- `components/step/do-tab/EvidenceMarkingSheet.tsx`
- `components/step/do-tab/evidenceMarkingModel.ts`
- Tests for suggested capability mapping.

Render Frame 4:

- Modal sheet listing captures with checkboxes.
- Auto-suggested capability chip per capture.
- User can select/deselect captures for evidence.

V1 scope:

- This is presentation-layer evidence marking. It should not create durable capability evidence records unless an existing API is verified.
- Selected evidence can be held in component state and optionally written into `metadata.act.evidence_marks` only if execution adds a type-compatible optional field and no schema migration is required.
- B.10 Reflect and Phase D own long-term capability evidence persistence.

If capability tagging proves too large, keep the modal as a flagged presentational stub and ship Frames 1-3 first. The spec prefers implementing Frame 4 in this phase, but it is the first scope cut if execution overruns.

### Commit 7: Wire into ActTab Behind Flag

Message:

```text
feat(practice): wire canonical Do tab behind flag
```

Files:

- `components/step/ActTab.tsx`
- `components/step/StepDrawContent.tsx`
- `components/step/do-tab/*`

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
- `types/step-detail.ts` only if execution adds optional type-only fields such as `summary` or `evidence_marks`.

## Files to NOT Change

- Do not add Supabase migrations.
- Do not replace voice/photo storage backends.
- Do not modify `components/ai/VoiceNoteRecorder.tsx` unless execution chooses to extract a reusable primitive; prefer wrapping `VoiceNoteService`.
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
- Evidence marking model selects and deselects capture IDs without mutating capture data.

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
5. Record a voice note if native module is available; verify a voice row appears. If transcription is simulated/unavailable, verify manual edit path exists.
6. Finish activity; verify Frame 3 post-activity summary and `Move to Reflect`.
7. Tap `Move to Reflect`; verify it uses the existing transition into Reflect.
8. Open evidence marking; verify Frame 4 sheet behavior if implemented.

Flag-off regression:

- With `EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER` unset/false, current `ActTab` / `StepDrawContent` behavior remains unchanged: sub-step progress, deviations, media upload, observation notes, resources, and `Save & Reflect` still work.

## Rollback Path

Set `EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER=false`. No schema changes are required, so rollback is a flag flip. Revert commits in reverse order if the component needs removal.

## Data Model Scope (Out of Scope for This Phase)

Phase B.11 refactors existing Act/Do metadata into the iOS register. It does not introduce a generalized capture table, evidence table, or voice-transcription pipeline.

V1 presentation layer:

- Capture stream from `metadata.act.observations`, `media_uploads`, and `media_links`.
- Live state from `metadata.act.started_at` and step `status`.
- Post-activity summary derived locally from capture data.
- Evidence marking as local/presentation state unless a compatible optional metadata field is added.

Deferred v2 data-model work:

- Durable per-capture IDs with evidence tags and capability links.
- Real transcription status and transcript provenance.
- AI-generated summary history.
- Persistent flagged-capture semantics.
- Capability evidence records consumed directly by Profile.

## Dependencies

B.11 is a blocker, not blocked. B.10 Reflect depends on B.11 for full end-to-end testing of the AI-drafted summary from Do captures. B.11 can execute against the existing `ActTab` / `StepDrawContent` without waiting for B.10 or Phase D.

If B.11 ships only Frames 1-3 and defers evidence marking, B.10 can still execute because Reflect’s required capture stream and Move-to-Reflect handoff are present.

## Risks and Open Questions

- Voice transcription: `VoiceNoteService` records audio but currently simulates transcription. Product must decide whether v1 accepts raw voice/manual transcript rows or requires real transcription before May 20.
- Activity-end detection: recommended v1 is explicit user action (`Finish activity` / `Move to Reflect`), not time-based heuristics.
- Capture flag semantics: canonical flagged captures likely mean “important for Reflect / carry forward.” V1 should not persist flags until product confirms whether flags feed Reflect, Profile evidence, or both.
- Evidence marking: Frame 4 depends on partial capability infrastructure. Recommended v1 is presentational selection with clear TODO, unless execution verifies a safe existing write path.
- Photo/video volume: current Supabase Storage upload path is per-step and public URL based. Large mobile capture sessions may create storage/cost pressure; do not increase video duration limits in this phase.
- Summary handoff: B.10 can derive from `actData`, but if product wants an explicit frozen auto-summary, a small optional metadata field should be added in a later commit.

