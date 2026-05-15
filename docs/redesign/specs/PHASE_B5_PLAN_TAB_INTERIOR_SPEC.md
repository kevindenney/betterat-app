# Phase B.5 Spec: Plan Tab Interior

## Goal

Rebuild the Practice step `Plan` tab interior around the May 15 canonical: AI Coach as the primary path, manual What/How/Why as the secondary path, optional add-ons collapsed under `More options`, and three visual states: empty, partially planned, fully planned/locked. This is a component-level redesign of the existing `components/step/PlanTab.tsx`; it does not change the `/practice` route or the step metadata contract.

## Source Canonicals

- Design source: `docs/redesign/PRACTICE_TIMELINE_CANONICAL_PLAN_TAB_ADDENDUM.md`.
- Visual canonical: `docs/redesign/ios-register/plan-tab-three-states-canonical.html`.
- Depends on Phase B copy normalization to `Plan / Do / Reflect`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify:

```bash
test -f components/step/PlanTab.tsx
test -f components/step/PlanQuestionCard.tsx
test -f components/step/SubStepEditor.tsx
test -f components/step/ConversationalCapture.tsx
test -f types/step-detail.ts
rg -n "what_will_you_do|how_sub_steps|why_reasoning|competency_ids|collaborators|where_location|conversation_id" types/step-detail.ts components/step/PlanTab.tsx
rg -n "structureBrainDump|generate.*plan|BrainDumpPlanResult|capability_goals" services/ai/StepPlanAIService.ts
rg -n "PlanTab\\(" app components --glob '*.{ts,tsx}'
```

Expected current state: `StepPlanData` already has the canonical fields `what_will_you_do`, `how_sub_steps`, `why_reasoning`, `competency_ids`, `collaborators`, `where_location`, and `conversation_id`. `PlanTab.tsx` currently renders a legacy question-card stack: optional `ConversationalCapture`, optional `BrainDumpEntry`, then separate cards titled lowercase `what`, `how`, `why`, `who`, `where`, and `building toward`. If these names or fields differ, stop and surface before editing.

Cross-check `docs/redesign/ios-register/plan-tab-three-states-canonical.html` for the `Build with AI Coach`, `or fill in manually`, and `Plan ready` treatments. The canonical makes AI Coach prominent only when the plan is empty; partially planned plans shrink the coach entry.

## Commit Boundaries

### Commit 1: Presentational Shell and State Selectors

Files:

- `lib/featureFlags.ts`
- `components/step/plan-tab/planState.ts`
- `components/step/plan-tab/PlanTabInterior.tsx`
- `components/step/plan-tab/index.ts`
- `components/step/plan-tab/__tests__/planState.test.ts`

Add:

```ts
PRACTICE_PLAN_TAB_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_PLAN_TAB_IOS_REGISTER', false),
```

Create selectors:

```ts
export type PlanInteriorState = 'empty' | 'partial' | 'ready' | 'locked';

export function getPlanInteriorState(input: {
  planData: StepPlanData;
  readOnly?: boolean;
  doStarted?: boolean;
}): PlanInteriorState;
```

Rules:

- `locked` when `readOnly === true` or `doStarted === true`.
- `empty` when What, at least one non-empty How sub-step, and Why are all absent.
- `ready` when What, at least one non-empty How sub-step, and Why are all present.
- Otherwise `partial`.

`PlanTabInterior` is presentational and accepts callbacks; no Supabase, router, or AI calls.

Commit message:

```text
feat(practice): add flagged Plan tab interior shell
```

### Commit 2: Manual What/How/Why Layout

Files:

- `components/step/plan-tab/PlanTabInterior.tsx`
- `components/step/plan-tab/PlanFieldCard.tsx`
- `components/step/plan-tab/PlanCoachCard.tsx`
- `components/step/plan-tab/__tests__/PlanTabInterior.test.tsx`

Implement the canonical manual path:

- Top AI Coach card:
  - Empty: `Build with AI Coach`.
  - Partial/ready: `Continue with AI Coach`.
  - Locked: read-only summary; no primary coach CTA.
- Secondary toggle: `or fill in manually`.
- Field labels exactly:
  - `WHAT WILL YOU DO?`
  - `HOW WILL YOU DO IT?`
  - `WHY IS THIS NEXT?`
- Reuse `SubStepEditor` for How.
- Preserve existing autosave behavior through `onUpdate`; no explicit Save button in v1.
- Show `Plan ready` indicator when `getPlanInteriorState(...) === 'ready'`.

This commit should not move Who/Where/Capabilities yet.

Commit message:

```text
feat(practice): implement canonical What How Why Plan layout
```

### Commit 3: Optional Add-Ons and Capability Chips

Files:

- `components/step/plan-tab/PlanOptionalAddOns.tsx`
- `components/step/plan-tab/CapabilityChipEditor.tsx`
- `components/step/PlanTab.tsx`
- `components/step/plan-tab/__tests__/PlanOptionalAddOns.test.tsx`

Move existing optional sections behind a collapsed `More options` region:

- `WITH WHOM (optional)` maps to existing `collaborators` and `who_collaborators`.
- `WHERE (optional)` maps to existing `where_location`.
- `ALSO RELEVANT FOR` wraps the existing `CrossInterestSuggestions` behavior.
- `CAPABILITIES THIS DEVELOPS` maps to existing `competency_ids` when competencies exist.

Do not add new capability tables. The canonical’s hybrid tagging model is represented in v1 by existing `betterat_competencies` data plus `StepPlanData.competency_ids`. If `useCompetenciesForInterest(interestId)` returns no competencies, render the canonical empty chip note: `No capabilities inferred — tap + to tag`.

Commit message:

```text
feat(practice): group Plan add-ons under canonical More options
```

### Commit 4: Wire into Existing PlanTab Behind Flag

Files:

- `components/step/PlanTab.tsx`
- `components/cards/content/RaceSummaryCard.tsx` only if needed to pass `doStarted`.

At the top of `PlanTab`, branch:

```tsx
if (FEATURE_FLAGS.PRACTICE_PLAN_TAB_IOS_REGISTER) {
  return <PlanTabInterior ...existingPropsMapped />;
}
```

The flag-off path must preserve current `PlanTab` behavior byte-for-byte except for imports. Do not remove `BrainDumpEntry`, `PlanQuestionCard`, or legacy sections in this commit.

If `doStarted` cannot be derived without invasive changes, use `readOnly` as the only locked signal in v1 and record `Do-started lock detection` as a follow-up in the commit body.

Commit message:

```text
feat(practice): wire canonical Plan tab behind flag
```

## Files to Change

- `lib/featureFlags.ts`
- `components/step/PlanTab.tsx`
- New files under `components/step/plan-tab/`
- Tests under `components/step/plan-tab/__tests__/`
- `components/cards/content/RaceSummaryCard.tsx` only if a small prop pass-through is needed for lock state.

## Files to Not Change

- Do not change `types/step-detail.ts` in Phase B.5; existing fields are sufficient for v1.
- Do not add migrations or capability tables; Phase D owns the full capability data model.
- Do not change `app/(tabs)/races.tsx` except indirectly through existing `PlanTab` consumers.
- Do not alter Do or Reflect tab interiors.
- Do not import preview-route components from `app/`.

## Cutover Flag

Required, default OFF: `EXPO_PUBLIC_FF_PRACTICE_PLAN_TAB_IOS_REGISTER=false`. This is a substantive visual and component-structure change, so it must be gated and visually verified before rollout.

## Test Approach

Run:

```bash
npm run typecheck
npx jest components/step/plan-tab --runInBand
rg -n "PRACTICE_PLAN_TAB_IOS_REGISTER|EXPO_PUBLIC_FF_PRACTICE_PLAN_TAB_IOS_REGISTER" lib components --glob '*.{ts,tsx}'
```

Simulator checks:

- Flag off: current Plan tab remains unchanged.
- Flag on, empty step: AI Coach card prominent, manual toggle visible, What/How/Why empty.
- Flag on, partial step: filled fields persist, coach card shrinks to `Continue with AI Coach`.
- Flag on, ready step: `Plan ready` indicator appears.
- Read-only step: content is readable, editing controls are suppressed.
- Capabilities, people, location, Playbook links, and cross-interest suggestions still write to the same `StepPlanData` fields.

## Rollback Path

Set `EXPO_PUBLIC_FF_PRACTICE_PLAN_TAB_IOS_REGISTER=false`. Revert commits if the component needs removal. No data migration rollback is required.

## Risks and Open Questions

- AI Coach is not a fully designed standalone surface. B.5 should reuse existing `ConversationalCapture` / brain-dump structuring where possible and not invent a new AI service.
- The canonical says capability tagging is automatic and always present. Current repo can display and edit `competency_ids`, but automatic inference is not guaranteed. Treat inference as a follow-up unless an existing service can be safely reused.
- Locking after Do starts may require a reliable status signal from `RaceSummaryCard` or step metadata. If not available cleanly, ship read-only lock only and document the Do-started lock follow-up.
