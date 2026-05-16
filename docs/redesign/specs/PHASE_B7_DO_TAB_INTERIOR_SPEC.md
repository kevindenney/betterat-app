# Phase B.7 Spec: Do Tab Interior

## Goal

Replace the existing Practice step `Do` tab interior with the iOS-register Do canonical: pre-activity capture affordances, a live reverse-chronological capture stream, post-activity auto-summary, and capability evidence marking. This is a refactor of the current `ActTab` / `StepDrawContent` stack, not a from-scratch capture system. The flag-off path must preserve the current production Do UI and data writes.

## Pre-Execution Reality Check Findings

Verified at spec-write time:

- Source canonical exists at `docs/redesign/ios-register/do-tab-interior-canonical.html`.
- Companion specs are `docs/redesign/specs/PHASE_B5_PLAN_TAB_INTERIOR_SPEC.md` and `docs/redesign/specs/PHASE_B10_REFLECT_TAB_INTERIOR_SPEC.md`.
- The current Do surface is internally named `ActTab`, mounted by `StepDetailContent.tsx` when `activeTab === 'act'`.
- `ActTab` wraps `StepDrawContent`, `StepFocusConcepts`, optional `DateEnrichmentCard`, and the current `Save & Reflect` CTA.
- `StepDrawContent` already owns the capture layer: timestamped observations, photo/video upload, media links, sub-step progress, deviations, Train AI chat, and the plan summary.
- `StepDrawContent` auto-starts Do when opened by setting `metadata.act.started_at` and, when the step was pending, `timeline_steps.status = 'in_progress'`.
- Current text notes are stored in `metadata.act.notes`; timestamped typed/voice-compatible entries are stored in `metadata.act.observations[]`.
- Current photo/video uploads are stored in `metadata.act.media_uploads[]`, with files uploaded to Supabase Storage bucket `step-media`.
- Current pasted media links are stored in `metadata.act.media_links[]`.
- Current capture rendering is `CaptureTimeline`, which merges `observations` and `media_uploads`, but sorts oldest-first today. The canonical requires newest-first in the live stream.
- `ObservationLog` already creates typed note captures with `source: 'note'`.
- The `Observation.source` type allows `voice | note`; comments say voice can come through bot/Coach flows, but there is no direct native hold-to-record voice implementation visible in `StepDrawContent`.
- The existing live/in-progress state is `timeline_steps.status = 'in_progress'` plus `metadata.act.started_at`.
- A separate “activity finished but step not fully completed/reflected” state is not clearly modeled. `timeline_steps.completed_at` is tied to `status = 'completed'`, which is currently set by Reflect completion paths and the header Mark Done toggle. Needs verification from Kevin before treating `status = 'completed'` as Do complete.
- The primary data table is `timeline_steps`; the Do data model lives in `timeline_steps.metadata.act` JSONB, typed as `StepActData` in `types/step-detail.ts`.

Before editing, Claude Code must re-run:

```bash
test -f docs/redesign/ios-register/do-tab-interior-canonical.html
test -f components/step/ActTab.tsx
test -f components/step/StepDrawContent.tsx
test -f components/step/CaptureTimeline.tsx
test -f components/step/ObservationLog.tsx
test -f components/step/StepDetailContent.tsx
test -f types/step-detail.ts
rg -n "activeTab === 'act'|<ActTab|onNextTab=\\{\\(\\) => handleNextTab\\('review'\\)\\}" components/step/StepDetailContent.tsx
rg -n "started_at|observations|media_uploads|media_links|sub_step_progress|sub_step_deviations|conversation_id" types/step-detail.ts components/step/StepDrawContent.tsx
rg -n "CaptureTimeline|ObservationLog|TrainChatPanel|Save & Reflect" components/step -g '*.{ts,tsx}'
rg -n "PRACTICE_DO_TAB_IOS_REGISTER|EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER" lib app components
```

Stop and surface if any of these symbols have moved, if a Do-tab flag already exists under a different name, or if another branch has already introduced a distinct Do-complete timestamp.

## Cutover Flag Name + Default Off Rationale

Required, default OFF:

- Flag key: `PRACTICE_DO_TAB_IOS_REGISTER`
- Env override: `EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER`
- Default: `false`

This phase changes the main capture workflow, live-state signaling, capture ordering, and the Do-to-Reflect handoff. It is not a mechanical restyle and must be gated for simulator and on-water-style capture testing before rollout.

## Data Model Changes

No Supabase migration is required for v1.

Use the existing source of truth:

```ts
interface StepActData {
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

The canonical capture stream should normalize existing data into a display model:

```ts
export type DoCaptureKind = 'voice' | 'note' | 'photo' | 'video' | 'media_link' | 'flag';

export interface DoCaptureItem {
  id: string;
  kind: DoCaptureKind;
  capturedAt: string | null;
  body: string;
  mediaUri?: string;
  capabilityIds: string[];
  capabilityLabels: string[];
  flaggedForDebrief: boolean;
  source: 'act_observation' | 'media_upload' | 'media_link' | 'sub_step_deviation' | 'notes_legacy';
}
```

Recommended v1 persistence:

- Observations continue to write `metadata.act.observations[]`.
- Photos/videos continue to write `metadata.act.media_uploads[]` and Supabase Storage `step-media`.
- Media links continue to write `metadata.act.media_links[]`.
- The legacy `metadata.act.notes` string remains a compatibility append target for bot/Telegram-style flows.
- Capability tags for captures should be stored only if a small metadata extension is unavoidable, for example on `Observation` / `MediaUpload` objects as optional `capability_ids?: string[]` and `flagged_for_debrief?: boolean`. Do not create a new evidence table in Phase B.7.
- Durable capability evidence records tied to Profile / trophies are out of scope for v1. The evidence marking sheet may annotate current act metadata and hand evidence candidates to Reflect, but Phase D owns long-term capability evidence persistence.

Needs verification from Kevin:

- Whether tapping “Move to Reflect” should stamp a new `metadata.act.ended_at` field, set `timeline_steps.ends_at`, or only switch tabs in v1.
- Whether “Mark capability evidence” should persist optional capture-level metadata now or remain a display-only preparation step until the capability data model lands.

## Frame-by-Frame Implementation Order With Commit Boundaries

### Commit 1: Flag, Selectors, and Presentational Shell

Message:

```text
feat(practice): add flagged Do tab interior shell
```

Files:

- `lib/featureFlags.ts`
- New `components/step/do-tab/doState.ts`
- New `components/step/do-tab/doCaptureModel.ts`
- New `components/step/do-tab/DoTabInterior.tsx`
- New `components/step/do-tab/index.ts`
- New `components/step/do-tab/__tests__/doState.test.ts`
- New `components/step/do-tab/__tests__/doCaptureModel.test.ts`

Add flag:

```ts
PRACTICE_DO_TAB_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER', false),
```

Selector API:

```ts
export type DoInteriorState = 'pre_activity' | 'live' | 'post_activity';

export function deriveDoInteriorState(input: {
  status?: string;
  act: StepActData;
  hasAnyCapture: boolean;
  activityEndedAt?: string | null;
}): DoInteriorState;
```

Initial rules:

- `post_activity` when `activityEndedAt` exists.
- `live` when `status === 'in_progress'` or `act.started_at` exists.
- `pre_activity` when there is no `started_at` and no capture content.
- If the only signal is existing capture content with no `started_at`, treat as `live` for display but preserve the missing timestamp. Needs verification from Kevin if this should backfill `started_at`.

`DoTabInterior` must be presentational. It receives plan summary, normalized capture items, state, summary text, evidence selections, and callbacks. It must not call Supabase or `ImagePicker` directly.

### Commit 2: Frame 1 Pre-Activity Capture Affordances

Message:

```text
feat(practice): render canonical Do pre-activity state
```

Files:

- `components/step/do-tab/DoTabInterior.tsx`
- New `components/step/do-tab/DoStartCard.tsx`
- New `components/step/do-tab/PlanStartingFrameRow.tsx`
- Tests updated as needed.

Implement Frame 1:

- Header/body copy:
  - `Start capturing`
  - `Voice, photo, or quick notes - capture as you go.`
  - `Captures will appear here as you go.`
- Three large affordances:
  - `Voice note`
  - `Photo or video`
  - `Quick note`
- Reuse existing capture handlers from `StepDrawContent`:
  - photo/video opens existing `handlePickMedia`.
  - quick note opens the existing typed observation input path.
  - voice note should route to existing Train chat / voice-compatible capture if available. If no native voice capture exists, ship the affordance disabled or as a quick-note focus and mark native voice capture as needs verification from Kevin. Do not invent audio storage in this phase.
- Render `Auto-summarize my Plan as a starting frame` as a bottom row. In v1 this can create or display local starting context from `plan.what_will_you_do`, `how_sub_steps`, and `why_reasoning`; do not add a new AI endpoint.

Verification for Frame 1:

- Flag off: existing `ActTab` / `StepDrawContent` renders unchanged.
- Flag on, no `metadata.act.started_at` and no captures: the start card is the only primary content.
- Tapping `Photo or video` uses the existing upload path.
- Tapping `Quick note` creates an `Observation` with `source: 'note'`.
- Opening Do still sets `metadata.act.started_at` and `status = 'in_progress'` only through existing owner-safe behavior.

### Commit 3: Frame 2 Live Reverse-Chronological Capture Stream

Message:

```text
feat(practice): add live Do capture stream
```

Files:

- `components/step/do-tab/DoCaptureStream.tsx`
- `components/step/do-tab/DoFloatingMicButton.tsx`
- `components/step/do-tab/doCaptureModel.ts`
- Tests updated as needed.

Implement Frame 2:

- Live eyebrow: `Captured during the activity · {n} entries`.
- Coral `LIVE · IN PROGRESS` treatment appears only when `deriveDoInteriorState(...) === 'live'`.
- Sort normalized captures reverse-chronologically by `capturedAt`, newest first.
- Render row accents:
  - voice: blue accent, italic transcript/body.
  - typed note: gray accent, plain body.
  - flag: coral accent and `Flagged` pill.
  - photo/video: neutral media icon/thumbnail.
- Preserve existing delete/edit behavior where it already exists for observations and media.
- Keep a persistent floating mic button once captures exist. If direct voice recording is not implemented, wire it to the existing Train chat focus and mark direct hold-to-record as a follow-up.
- `Tag` opens the evidence sheet from Commit 5.

Verification for Frame 2:

- Add three notes quickly and verify newest appears at top.
- Existing uploaded media appears in the same stream with correct timestamp.
- Existing bot/voice observations with `source: 'voice'` render as voice rows.
- Coral is limited to live status indicators, flagged pills, and flag accents.
- Read-only users can view captures but cannot add/remove/edit them.

### Commit 4: Frame 3 Post-Activity Summary and Reflect Handoff

Message:

```text
feat(practice): add Do post-activity summary handoff
```

Files:

- `components/step/do-tab/DoSummaryCard.tsx`
- `components/step/do-tab/DoCompressedCaptureList.tsx`
- Optional `components/step/do-tab/doSummaryModel.ts`
- Tests updated as needed.

Implement Frame 3:

- Eyebrow: `Captured · {n} entries` plus optional voice-duration text only if existing data provides duration. Do not fake duration.
- Auto-summary card with `Auto-summary`, narrative text, and `Refine summary`.
- Summary source priority:
  1. Existing generated training/review insight if already available in metadata.
  2. Local deterministic summary from observations, media captions, sub-step progress, and deviations.
  3. Fallback copy: `No Do summary yet. Add a capture or move to Reflect to review this step.`
- Compressed list shows all captures in reverse chronological order with timestamp, icon, body, and capability chip when available.
- Primary CTA copy: `Move to Reflect`.
- Pressing `Move to Reflect` must preserve the current `onNextTab={() => handleNextTab('review')}` behavior.
- Needs verification from Kevin before adding `metadata.act.ended_at` or writing `timeline_steps.ends_at`. If approved, stamp the end signal before switching tabs.

Verification for Frame 3:

- With a verified activity-ended signal, the live coral treatment disappears.
- Summary appears above the compressed capture list.
- `Move to Reflect` switches to the existing Reflect tab without marking the whole step completed.
- Flag off still shows the current `Save & Reflect` CTA and existing layout.

### Commit 5: Frame 4 Evidence Marking Sheet

Message:

```text
feat(practice): add Do evidence marking sheet
```

Files:

- `components/step/do-tab/DoEvidenceSheet.tsx`
- `components/step/do-tab/doEvidenceModel.ts`
- Tests updated as needed.

Implement Frame 4:

- Modal sheet title: `Mark capability evidence`.
- Body copy: `Which captures show your capability developing? Mark them and they'll attach to your Capability Trophies.`
- Rows show checkbox, timestamp, capture body, and suggested capability chip.
- Suggestions should read from existing `plan.competency_ids`, `plan.capability_goals`, and any capability labels already inferred by Reflect/competency assessment data. Do not build new inference infrastructure in this phase.
- Footer actions:
  - `Cancel`
  - `Mark {n} capture(s) as evidence`
- If Kevin confirms v1 persistence, write optional capture-level metadata back into `metadata.act` without a migration. Otherwise keep selections local and pass selected candidates to Reflect when moving tabs. Mark unconfirmed behavior as needs verification from Kevin in the implementation PR.

Verification for Frame 4:

- Sheet opens from `Tag` in live state and `Evidence` in post-activity state.
- Selecting rows updates the footer count.
- Cancel closes without mutation.
- Confirm either writes only approved metadata fields or passes candidates to Reflect, depending on Kevin’s decision.
- No new Supabase tables or migrations are added.

### Commit 6: Wire Into Existing ActTab Behind Flag

Message:

```text
feat(practice): wire canonical Do tab behind flag
```

Files:

- `components/step/ActTab.tsx`
- `components/step/StepDrawContent.tsx`
- `components/step/do-tab/*`

Implementation approach:

- Keep `ActTab` as the parent mounted by `StepDetailContent`.
- Branch inside `ActTab` on `FEATURE_FLAGS.PRACTICE_DO_TAB_IOS_REGISTER`.
- Flag off: render existing `DateEnrichmentCard`, `StepFocusConcepts`, `StepDrawContent`, `Save & Reflect`, and footer exactly as today.
- Flag on: render a controller that adapts existing `StepDrawContent` capture handlers and metadata reads into `DoTabInterior`.
- Prefer extracting reusable capture operations from `StepDrawContent` into a local hook such as `useStepActCaptureController` if needed. Do not duplicate storage/upload logic in multiple places.
- Do not remove `StepDrawContent`, `CaptureTimeline`, or `ObservationLog` in this phase.

## Verification Steps Per Frame

Run after implementation:

```bash
npm run typecheck
npx jest components/step/do-tab --runInBand
npx eslint components/step/ActTab.tsx components/step/StepDrawContent.tsx components/step/do-tab --ext .ts,.tsx --max-warnings 0
rg -n "PRACTICE_DO_TAB_IOS_REGISTER|EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER" lib components --glob '*.{ts,tsx}'
```

Simulator checks with flag ON:

1. Frame 1: open a planned step with no Do captures; verify the start trio and Plan starting-frame row.
2. Frame 1 capture paths: create a quick note and upload a photo/video; verify they persist in `metadata.act`.
3. Frame 2: verify live coral state, newest-first stream ordering, row type styling, and persistent floating mic.
4. Frame 2 read-only: open another user/blueprint step and verify controls are suppressed.
5. Frame 3: use the approved Do-ended signal; verify auto-summary, compressed capture list, no live coral, and `Move to Reflect`.
6. Frame 4: open evidence sheet, select captures, cancel, reopen, confirm selection behavior, and verify only approved metadata changes occur.
7. Flag-off regression: unset the flag and verify current `ActTab` / `StepDrawContent` behavior, capture writes, media upload, Train chat, sub-step progress, and `Save & Reflect` still work.

## Constraints

- Stay behind `EXPO_PUBLIC_FF_PRACTICE_DO_TAB_IOS_REGISTER=false` until visual and capture-flow QA is complete.
- Reuse existing capture infrastructure in `StepDrawContent`; do not build a new audio/photo/text capture stack.
- Do not add Supabase migrations in Phase B.7.
- Do not create capability evidence tables or Profile trophy persistence.
- Do not treat `timeline_steps.status = 'completed'` as Do complete without Kevin verification; today it is tied to whole-step completion.
- Do not rename internal `ActTab` / `act` broadly in this phase. User-facing copy should say Do; internal names can remain for compatibility.
- Do not alter Plan or Reflect tab interiors except for the existing `onNextTab` bridge.
- Do not import preview-route components from `app/`.
- Do not run visual screenshot work in this spec branch; another session owns screenshots.

## Estimated Time

- Commit 1: 2-3 hours for flag, selectors, capture normalization, and tests.
- Commit 2: 3-4 hours for pre-activity UI and existing handler adaptation.
- Commit 3: 4-6 hours for live stream, reverse ordering, row variants, and floating mic behavior.
- Commit 4: 3-5 hours for post-activity summary and Reflect handoff, depending on the Do-ended signal decision.
- Commit 5: 3-5 hours for evidence sheet and capability-tag metadata decision.
- Commit 6: 2-4 hours for wiring, flag-off regression cleanup, and simulator QA.

Total: 17-27 engineering hours, plus product decision time for activity-ended and evidence persistence semantics.
