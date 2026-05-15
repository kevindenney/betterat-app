# Phase B.6 Spec: Add Step FAB

## Goal

Ship the canonical Practice-tab step creation affordance: one persistent bottom-right floating `+` button that opens a two-path iOS action sheet, `Build with AI Coach` and `From a Blueprint`. This replaces the current toolbar-plus-first interaction without removing existing creation handlers. The public route language is `/practice`; the short-term implementation still lives in `app/(tabs)/races.tsx`.

## Source Canonicals

- Design source: `docs/redesign/PRACTICE_TIMELINE_ADD_STEP_ZOOMED_OUT_SOCIAL_ADDENDUM.md`, Surface 1.
- Visual canonical: `docs/redesign/ios-register/add-step-flow-canonical.html`.
- Route convention: `docs/redesign/specs/PHASE_A8_PRACTICE_ROUTE_ALIAS_SPEC.md`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify:

```bash
test -f app/'(tabs)'/races.tsx
test -f components/races/AddStepSheet.tsx
rg -n "showAddStepSheet|setShowAddStepSheet|pendingNewStepIdRef|handleAddStep|handleShowAddRaceSheet|handleAddRaceNavigation" app/'(tabs)'/races.tsx
rg -n "AddStepSheetProps|suggestedNextSteps|onAddStep|onAddRace|onPublishBlueprint" components/races/AddStepSheet.tsx
rg -n "PRACTICE_ADD_STEP_FAB|EXPO_PUBLIC_FF_PRACTICE_ADD_STEP_FAB" lib/featureFlags.ts
```

Expected current state: `app/(tabs)/races.tsx` already owns `showAddStepSheet`, `AddStepSheet`, `pendingNewStepIdRef`, `handleAddStep`, sailing-specific `handleShowAddRaceSheet`, and blueprint publish wiring. `components/races/AddStepSheet.tsx` currently exposes a suggestion-heavy sheet titled `Add to Timeline` with `Suggested Next`, `Create Your Own`, `Add Step`, optional sailing `Add Race/Event`, and optional `Publish Blueprint`. If these names or props differ, stop and surface before editing.

Also inspect `docs/redesign/ios-register/add-step-flow-canonical.html` around the `Build with AI Coach`, `From a Blueprint`, and `Accept & add to timeline` labels. The canonical sheet has exactly two creation paths plus cancel. Do not preserve extra sheet options inside the flagged path unless they are below the flag-off legacy path.

## Commit Boundaries

### Commit 1: Flag and FAB Component

Files:

- `lib/featureFlags.ts`
- `components/practice/AddStepFab.tsx`
- `components/practice/index.ts`
- `components/practice/__tests__/AddStepFab.test.tsx`

Add:

```ts
PRACTICE_ADD_STEP_FAB: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_ADD_STEP_FAB', false),
```

Create a presentational `AddStepFab` component with:

- 56pt diameter.
- Absolute bottom-right positioning supplied by parent style, not hardcoded to a screen.
- iOS blue background `#007AFF`.
- White plus glyph.
- `accessibilityRole="button"`.
- `accessibilityLabel="Add a practice step"`.
- `accessibilityHint="Opens options to build with AI Coach or start from a blueprint."`

The component has no router calls and no data fetching.

Commit message:

```text
feat(practice): add flagged Add Step FAB component
```

### Commit 2: Canonical Two-Path Sheet

Files:

- `components/practice/AddStepActionSheet.tsx`
- `components/practice/index.ts`
- `components/practice/__tests__/AddStepActionSheet.test.tsx`

Create a new sheet instead of overloading `components/races/AddStepSheet.tsx`. The existing sheet is suggestion-driven and has too much legacy behavior for the canonical two-option flow.

Props:

```ts
interface AddStepActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onBuildWithCoach: () => void;
  onChooseBlueprint: () => void;
}
```

Render:

- Title: `Add a step`.
- Primary row: `Build with AI Coach`, subtitle `Describe what you want to practice. BetterAt drafts the plan.`, sparkle icon.
- Secondary row: `From a Blueprint`, subtitle `Start from a step in a blueprint you follow.`, book icon.
- Cancel button separated by an 8pt gap.

No extra suggestions, publish action, or sailing-specific `Add Race` row in the flagged canonical path.

Commit message:

```text
feat(practice): add canonical Add Step action sheet
```

### Commit 3: Wire FAB in Practice Implementation

Files:

- `app/(tabs)/races.tsx`

Behind `FEATURE_FLAGS.PRACTICE_ADD_STEP_FAB`, mount `AddStepFab` above the bottom tab bar in the `RacesScreen` root overlay. Keep existing `RacesFloatingHeader` `onAddPress` and legacy `AddStepSheet` behavior when the flag is off.

When the flag is on:

- FAB tap sets `showCanonicalAddStepSheet=true`.
- `Build with AI Coach` calls the existing `handleAddStep` path for v1. If an AI Coach route or component exists at execution time, stop and surface before choosing it; do not invent a route.
- `From a Blueprint` opens the existing `AddStepSheet` or a blueprint picker if one exists. Use existing `suggestedNextSteps`, `onAdoptSuggestion`, and `onDismissSuggestion`; do not add a new blueprint data layer in this phase.
- New step auto-scroll uses the existing `pendingNewStepIdRef` behavior. Do not change that mechanism.

If keyboard avoidance is needed, hide the FAB while a text input is focused as a follow-up; do not block v1 on it.

Commit message:

```text
feat(practice): wire Add Step FAB behind flag
```

## Files to Not Change

- Do not rename `app/(tabs)/races.tsx`.
- Do not remove `RacesFloatingHeader`.
- Do not remove `components/races/AddStepSheet.tsx`; it remains the legacy/suggestion sheet.
- Do not add AI Coach persistence or blueprint-picker data tables.
- Do not touch Phase C timeline shell files.

## Cutover Flag

Required, default OFF: `EXPO_PUBLIC_FF_PRACTICE_ADD_STEP_FAB=false`. This is a substantive visual and interaction change with new mounting behavior, so it does not qualify for the mechanical-only exception.

## Test Approach

Run:

```bash
npm run typecheck
npx jest components/practice/__tests__/AddStepFab.test.tsx components/practice/__tests__/AddStepActionSheet.test.tsx --runInBand
rg -n "PRACTICE_ADD_STEP_FAB|EXPO_PUBLIC_FF_PRACTICE_ADD_STEP_FAB" lib app components --glob '*.{ts,tsx}'
```

Simulator verification:

- Flag off: current toolbar `+` and existing add sheet still work.
- Flag on: one 56pt bottom-right FAB appears on `/practice`.
- FAB tap opens two-option sheet only.
- `Build with AI Coach` creates or starts a step through the existing creation path.
- `From a Blueprint` reaches existing blueprint/suggestion selection without losing current-interest scope.
- After creating a step, the timeline scrolls to the new step.

## Rollback Path

Set `EXPO_PUBLIC_FF_PRACTICE_ADD_STEP_FAB=false` for immediate rollback. Revert the three commits to remove the component and sheet.

## Risks and Open Questions

- The addendum says the current magic/sparkle button needs reconciliation. This spec does not remove it; if duplicate affordances feel noisy during visual verification, remove or relabel the toolbar sparkle in a follow-up.
- The canonical says `Build with AI Coach` opens a full conversational interface. Current repo paths show `handleAddStep` and `ConversationalCapture`, but no dedicated canonical Add Step coach route was verified. V1 should reuse existing creation flow and surface any mismatch.
- `From a Blueprint` may start from existing suggested steps rather than a full blueprint picker. If visual verification requires a complete picker, split that into a follow-up rather than expanding this phase.
