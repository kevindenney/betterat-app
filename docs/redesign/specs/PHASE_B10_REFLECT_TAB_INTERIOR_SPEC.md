# Phase B.10 Spec: Reflect Tab Interior

## Goal

Replace the existing Practice step `Reflect` tab interior with the iOS-register Reflect canonical: AI-drafted summary, prompt-driven refinement, capability evidence drilldown, and Carry forward. This is a refactor of the current `ReviewTab` / `StepCritiqueContent` stack, not a from-scratch Reflect feature. The flag-off path must preserve the current production review UI and data writes.

Phase ID note: Reflect was requested as B.8, but B.8 is already assigned to the Profile/settings dropdown. B.10 is the lowest free B-series ID after B.9, keeping Reflect sibling-adjacent to B.5 Plan and the eventual Do-tab interior work without renumbering existing specs.

## Source Canonicals

- Visual canonical: `docs/redesign/ios-register/reflect-tab-interior-canonical.html`.
- Companion canonicals: `docs/redesign/ios-register/plan-tab-three-states-canonical.html`, `docs/redesign/ios-register/do-tab-interior-canonical.html`, `docs/redesign/ios-register/ai-coach-conversational-flow-canonical.html`.
- Structural reference: `docs/redesign/specs/PHASE_B5_PLAN_TAB_INTERIOR_SPEC.md`.
- Current implementation references: `components/step/ReviewTab.tsx`, `components/step/StepCritiqueContent.tsx`, `components/step/ReviewPromptSection.tsx`, `components/step/ActTab.tsx`, `components/step/StepDetailContent.tsx`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify current repo state:

```bash
test -f docs/redesign/ios-register/reflect-tab-interior-canonical.html
test -f docs/redesign/ios-register/do-tab-interior-canonical.html
test -f docs/redesign/ios-register/ai-coach-conversational-flow-canonical.html
test -f components/step/ReviewTab.tsx
test -f components/step/StepCritiqueContent.tsx
test -f components/step/ReviewPromptSection.tsx
test -f components/step/ActTab.tsx
test -f components/step/StepDetailContent.tsx
test -f types/step-detail.ts
rg -n "activeTab === 'review'|<ReviewTab|onNextTab=\\{\\(\\) => handleNextTab\\('review'\\)\\}" components/step/StepDetailContent.tsx
rg -n "Save & Reflect|onNextTab" components/step/ActTab.tsx
rg -n "StepReviewData|StepReviewSection|capability_progress|competency_assessment|next_step_notes" types/step-detail.ts
rg -n "getReviewSections|REVIEW_PROMPTS|ReviewPromptSection" lib/step components/step -g '*.{ts,tsx}'
rg -n "generateCritiqueInsight|extractCompetencyAssessment|handleCreateNextStep|Complete & Save Review|Create Next Step" components/step/StepCritiqueContent.tsx
rg -n "PRACTICE_REFLECT_TAB_IOS_REGISTER|EXPO_PUBLIC_FF_PRACTICE_REFLECT_TAB_IOS_REGISTER" lib .env* app components
```

Verified at spec-write time:

- The current Reflect surface is `ReviewTab`, mounted by `StepDetailContent.tsx` when `activeTab === 'review'`.
- `ActTab` already exposes the Do-to-Reflect transition through the `Save & Reflect` CTA, passed from `StepDetailContent.tsx` as `onNextTab={() => handleNextTab('review')}`.
- Current review persistence lives in `timeline_steps.metadata.review`, typed as `StepReviewData` in `types/step-detail.ts`.
- The current canonical review read path is `getReviewSections(step.metadata, fallbackCapturedAt)`, which normalizes legacy flat fields into `metadata.review.sections[]`.
- `StepCritiqueContent` already has a review AI path via `generateCritiqueInsight`, one-shot extraction from completed train conversations, competency assessment extraction, review completion, share, and next-step creation.

Stop and surface if any of these symbols have moved or if a Reflect-tab flag already exists under a different name.

## Current Data Shape

The v1 iOS-register Reflect surface must read and write the existing metadata shape:

```ts
interface StepReviewData {
  overall_rating?: number;
  worked_to_plan?: boolean;
  deviation_reason?: string;      // deprecated legacy flat field
  what_learned?: string;          // deprecated legacy flat field
  capability_progress?: Record<string, number>;
  next_step_notes?: string;       // deprecated legacy flat field
  instructor_assessment?: Record<string, InstructorCompetencyAssessment>;
  instructor_suggested_next?: string;
  instructor_review_status?: InstructorReviewStatus;
  instructor_review_note?: string;
  instructor_review_at?: string;
  competency_assessment?: StepCompetencyAssessment;
  sections?: StepReviewSection[];
  composed_via?: StepReviewSection['source'];
  composed_at?: string;
}
```

`sections[]` is the post-Step-Arch-E source of truth for prompt content. The new UI should persist prompt answers by upserting `source: 'in_app'` sections, matching the existing `debouncedSaveSection` behavior. Do not introduce a new review table in Phase B.10.

## Commit Boundaries

### Commit 1: Flag, Selectors, and Presentational Shell

Message:

```text
feat(practice): add flagged Reflect tab interior shell
```

Files:

- `lib/featureFlags.ts`
- New `components/step/reflect-tab/reflectState.ts`
- New `components/step/reflect-tab/ReflectTabInterior.tsx`
- New `components/step/reflect-tab/index.ts`
- New `components/step/reflect-tab/__tests__/reflectState.test.ts`

Add flag:

```ts
PRACTICE_REFLECT_TAB_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_REFLECT_TAB_IOS_REGISTER', false),
```

Selector API:

```ts
export type ReflectPromptKind = 'what_worked' | 'what_to_improve';
export type ReflectCompletionState = 'empty' | 'needs_worked' | 'needs_improve' | 'ready' | 'complete';

export interface ReflectPromptAnswer {
  id: string;
  kind: ReflectPromptKind;
  prompt: string;
  answer: string;
  source: 'ai_draft' | 'in_app' | 'do_capture' | 'legacy';
  capabilityTags: string[];
}

export function deriveReflectState(input: {
  review: StepReviewData;
  normalizedSections: NormalizedReviewSection[];
  status?: string;
}): ReflectCompletionState;
```

Rules:

- `complete` when `status === 'completed'`.
- `ready` when at least one What worked answer and one What to improve answer are non-empty.
- `needs_worked` when only What to improve is answered.
- `needs_improve` when only What worked is answered.
- `empty` when neither group has an answer.

Mapping rules:

- Existing `what_did_you_learn` and `what_worked` sections can feed What worked candidates.
- Existing `what_didnt` sections feed What to improve candidates.
- Existing `anything_else` feeds Carry forward, not the primary prompt groups.

`ReflectTabInterior` must be presentational: it receives normalized data, draft text, prompt answers, capability evidence, carry-forward text, and callbacks. It must not call Supabase directly.

### Commit 2: AI-Drafted Summary and Prompt Groups

Message:

```text
feat(practice): render canonical Reflect summary and prompt groups
```

Files:

- `components/step/reflect-tab/ReflectTabInterior.tsx`
- New `components/step/reflect-tab/ReflectSummaryCard.tsx`
- New `components/step/reflect-tab/ReflectPromptGroup.tsx`
- New `components/step/reflect-tab/__tests__/ReflectTabInterior.test.tsx`

Render Frame 1 and Frame 2 from the canonical:

- Top AI-drafted summary card.
- What worked group with green left rail and upward-arrow treatment.
- What to improve group with purple left rail and tool/wrench treatment.
- CTA copy: `Mark Reflect complete`.
- Disabled hint when not ready:
  - No answers: `Answer at least one What worked and one What to improve to activate.`
  - Only What worked answered: `One more answer in What to improve activates this.`
  - Only What to improve answered: `One more answer in What worked activates this.`

Data source:

- Use existing `generateCritiqueInsight` output as the summary source when available.
- If no AI insight exists yet, summarize locally from `actData.notes`, `actData.observations`, completed sub-steps, and normalized review sections with neutral fallback copy such as `No Reflect summary yet. Add a note or ask AI to analyze this step.`
- Do not add a new AI endpoint in this phase.

Prompt groups:

- Use existing `ReviewPromptSection` logic as a reference, but the new surface should own its canonical visual layout.
- Persist edits through the same `metadata.review.sections[]` upsert semantics as `StepCritiqueContent.debouncedSaveSection`.
- Keep bot/voice-captured sections visible as source-tagged context, but prioritize the user's in-app answer visually.

### Commit 3: Capability Evidence Drilldown

Message:

```text
feat(practice): add Reflect capability evidence drilldown
```

Files:

- `components/step/reflect-tab/CapabilityEvidenceCard.tsx`
- `components/step/reflect-tab/CapabilityEvidenceSheet.tsx`
- `components/step/reflect-tab/reflectCapabilityModel.ts`
- `components/step/reflect-tab/__tests__/reflectCapabilityModel.test.ts`

Frame 3 v1 behavior:

- Render evidence from `reviewData.competency_assessment.planned_competency_results` and `additional_competencies_found` when present.
- Fall back to `reviewData.capability_progress` plus `planData.capability_goals` / `planData.competency_ids` when competency assessment is absent.
- The drilldown is a presentation layer over existing review metadata. Do not write `betterat_competency_progress` or create new evidence rows from this sheet in Phase B.10.

Level mapping:

Canonical levels are `emerging`, `developing`, `competent`, `fluent`, `expert`. Current repo levels are `initial_exposure`, `developing`, `proficient`, and `not_demonstrated`.

Recommended v1 mapping:

```ts
export type CanonicalCapabilityLevel = 'emerging' | 'developing' | 'competent' | 'fluent' | 'expert';

export function mapCompetencyEvidenceLevel(level: CompetencyEvidenceItem['demonstrated_level']): CanonicalCapabilityLevel | null {
  switch (level) {
    case 'initial_exposure':
      return 'emerging';
    case 'developing':
      return 'developing';
    case 'proficient':
      return 'competent';
    case 'not_demonstrated':
      return null;
  }
}
```

`fluent` and `expert` are not assigned by current step-level evidence. They remain Profile/capability-map levels for Phase D unless product explicitly decides otherwise.

### Commit 4: Carry Forward Card and Next-Step Bridge

Message:

```text
feat(practice): add Reflect carry-forward card
```

Files:

- `components/step/reflect-tab/CarryForwardCard.tsx`
- `components/step/StepCritiqueContent.tsx`
- Optional `components/step/reflect-tab/carryForwardModel.ts`
- Optional tests for `carryForwardModel.ts`

Current repo already has partial Carry forward infrastructure:

- `metadata.review.next_step_notes` is deprecated but still normalized into `sections[]` as `anything_else`.
- `StepCritiqueContent.handleCreateNextStep` creates a new step from `anything_else` / `next_step_notes`.
- `BrainDumpData.source_step_id` and `source_review_notes` preserve provenance.

V1 behavior:

- Render the canonical Carry forward card after Reflect is complete or ready.
- Text source priority:
  1. `getReviewSectionContent(normalizedReview.sections, 'anything_else')`
  2. `reviewData.next_step_notes`
  3. AI suggestion from `generateCritiqueInsight`
  4. Empty prompt copy: `What should the next Plan carry forward?`
- Primary action: `Create next Plan`.
- Action calls the existing next-step creation path from `StepCritiqueContent.handleCreateNextStep`.
- If a next step was created, show `Next Plan created` and keep the created ID available to parent callback.

Do not auto-populate an existing next step in Phase B.10. Auto-population semantics are product-sensitive and should be deferred unless Kevin explicitly decides otherwise.

### Commit 5: Wire into ReviewTab Behind Flag

Message:

```text
feat(practice): wire canonical Reflect tab behind flag
```

Files:

- `components/step/ReviewTab.tsx`
- `components/step/StepCritiqueContent.tsx`
- `components/step/reflect-tab/*`

Implementation approach:

- Keep `ReviewTab` as the parent component mounted by `StepDetailContent`.
- Inside `ReviewTab`, branch on `FEATURE_FLAGS.PRACTICE_REFLECT_TAB_IOS_REGISTER`.
- Flag off: render the existing `InstructorFeedbackCard`, `StepFocusConcepts`, `StepCritiqueContent`, and footer exactly as today.
- Flag on: render `ReflectTabInterior`, passing data and callbacks adapted from `StepCritiqueContent`.

If extracting handlers from `StepCritiqueContent` becomes too invasive, create a thin `ReflectTabController` under `components/step/reflect-tab/` that reuses the same hooks (`useStepDetail`, `useUpdateStepMetadata`, `useUpdateStep`, `useInterest`, `useAuth`) and copies only the minimal persistence logic required for v1. Do not remove the legacy component in the same commit.

### Commit 6: Mark Complete Polish and Visual Verification Hooks

Message:

```text
feat(practice): polish Reflect completion state
```

Files:

- `components/step/reflect-tab/ReflectTabInterior.tsx`
- `components/step/reflect-tab/reflectState.ts`
- Tests updated as needed.

Implement final activation and completion behavior:

- `Mark Reflect complete` enabled only in `ready`.
- On press, persist any pending prompt sections, run existing completion side effects, then set step status to `completed`.
- Preserve current completion side effects from `StepCritiqueContent.handleSaveReview`: Playbook debrief ingest, lesson completion, skill-goal sync, and competency-attempt logging.
- Complete state shows the canonical compact summary, evidence count, flagged improvement count, and Carry forward card.

If preserving all side effects requires a large refactor, stop and split a pre-commit into a `useStepReviewController` extraction rather than duplicating side effects in two places.

## Files to Change

- `lib/featureFlags.ts`
- `components/step/ReviewTab.tsx`
- `components/step/StepCritiqueContent.tsx`
- New files under `components/step/reflect-tab/`
- Tests under `components/step/reflect-tab/__tests__/`

## Files to NOT Change

- Do not change Supabase schema or add review/capability tables.
- Do not alter `types/step-detail.ts` unless execution discovers the existing type is inaccurate; the v1 data shape is sufficient.
- Do not remove legacy `StepCritiqueContent`.
- Do not touch `app/(tabs)/races.tsx` unless execution discovers a parent-level integration blocker; if so, stop and rescope.
- Do not hardcode bottom-tab label text. A.10 remains in force: tab identity is the Practice engine, visible label is interest-specific.
- Do not import preview-route components from `app/`.

## Cutover Flag

Required, default OFF:

- Flag key: `PRACTICE_REFLECT_TAB_IOS_REGISTER`
- Env override: `EXPO_PUBLIC_FF_PRACTICE_REFLECT_TAB_IOS_REGISTER`
- Default: `false`

This phase is a substantive visual, control-flow, and completion-side-effect refactor. It does not qualify for the mechanical-only flag exception.

## Test Approach

Unit tests:

- `deriveReflectState` returns `empty`, `needs_worked`, `needs_improve`, `ready`, and `complete` correctly.
- `mapCompetencyEvidenceLevel` maps current repo levels into canonical display levels.
- Carry-forward model prioritizes `sections[].anything_else` over deprecated `next_step_notes`.
- Prompt upsert preserves non-`in_app` captured sections.

Run:

```bash
npm run typecheck
npx jest components/step/reflect-tab --runInBand
npx eslint components/step/ReviewTab.tsx components/step/StepCritiqueContent.tsx components/step/reflect-tab --ext .ts,.tsx --max-warnings 0
rg -n "PRACTICE_REFLECT_TAB_IOS_REGISTER|EXPO_PUBLIC_FF_PRACTICE_REFLECT_TAB_IOS_REGISTER" lib components --glob '*.{ts,tsx}'
```

Simulator checks with flag ON:

1. Open `/practice`, choose a step with Do capture content, tap `Save & Reflect`.
2. Verify Frame 1: AI summary card plus What worked / What to improve prompt groups; completion CTA disabled until both groups have answers.
3. Answer one What worked prompt; verify Frame 2: summary condenses, evidence bar appears, CTA still disabled if no improvement answer exists.
4. Tap capability evidence; verify Frame 3 drilldown shows evidence basis and mapped level.
5. Answer one What to improve prompt; tap `Mark Reflect complete`; verify Frame 4 complete summary and Carry forward card.
6. Tap `Create next Plan`; verify existing next-step creation behavior still works and source provenance is preserved.

Flag-off regression:

- With `EXPO_PUBLIC_FF_PRACTICE_REFLECT_TAB_IOS_REGISTER` unset/false, the current `ReviewTab` / `StepCritiqueContent` UI renders unchanged, review prompts still autosave, `Complete & Save Review` still completes the step, and `Create Next Step` still works for completed reviews.

## Rollback Path

Set `EXPO_PUBLIC_FF_PRACTICE_REFLECT_TAB_IOS_REGISTER=false`. Because no schema changes are introduced, rollback is a flag flip. If component code needs removal, revert commits in reverse order.

## Data Model Scope (Out of Scope for This Phase)

Phase B.10 refactors the existing review data model into the iOS register. It does not generalize or replace review storage.

The v1 source of truth remains `timeline_steps.metadata.review.sections[]`, normalized through `getReviewSections`. Deprecated flat fields (`what_learned`, `deviation_reason`, `next_step_notes`) remain compatibility inputs but should not be the preferred write target for new UI. Capability display reads existing `competency_assessment` and `capability_progress` fields. Carry forward reads `anything_else` / `next_step_notes` and can create a new step through the existing `createStep` path.

The v1/v2 boundary is:

- V1: canonical Reflect UI, existing metadata storage, display-level mapping of current capability evidence, and user-triggered Create next Plan.
- V2: generalized capability levels, persistent evidence records tied to Profile, automatic next-step Plan population, AI regeneration history, and richer Carry forward semantics.

## Dependencies

- Phase B.5 Plan is shipped-verified and should be treated as the interaction baseline.
- Do Tab Interior is a functional prerequisite for full end-to-end testing of AI-drafted Reflect summaries from Do captures. Current backlog does not assign Do Tab Interior to B.7; B.7 is Interest Switcher. Before executing B.10, confirm the actual Do-tab phase ID/status and whether the current `ActTab` / `StepDrawContent` implementation is sufficient for v1 testing.
- Phase D capability data model is not required for v1, but it owns canonical long-term capability-map persistence.

## Risks and Open Questions

- Capability level mapping: canonical uses `emerging / developing / competent / fluent / expert`, while repo step evidence uses `initial_exposure / developing / proficient / not_demonstrated`. Recommended v1 maps only through `competent` and leaves `fluent` / `expert` to Phase D.
- Carry forward behavior: v1 should create a new next Plan only when the user taps the action. Auto-populating an existing next step needs product confirmation.
- AI-drafted summary regeneration: current repo has `generateCritiqueInsight` as an on-demand insight, not a canonical draft-regeneration history. Treat regeneration as one-shot/on-demand in v1.
- Completion side effects are already broad: Playbook ingest, lesson completion, skill-goal sync, and competency attempt logging. The new UI must preserve them, not bypass them.
- Current Reflect code calls the phase “Review” internally (`ReviewTab`, `StepCritiqueContent`). Do not rename files broadly in this phase; user-facing copy should say Reflect, while internal names can remain for compatibility.

