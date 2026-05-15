# Phase C.5 Spec: Zoomed-Out Timeline View

## Goal

Replace the current grid-style zoom-out mode with the canonical vertical Practice timeline overview: pinch out from the zoomed-in timeline shell, show sticky time sections, anchor the current step at NOW, render per-row Plan/Do/Reflect dots, support row tap back into the zoomed-in card, and preserve reorder/long-press actions. This spec depends on Phase C’s timeline-with-peek shell being implemented behind `PRACTICE_TIMELINE_PEEK`.

## Source Canonicals

- Design source: `docs/redesign/PRACTICE_TIMELINE_ADD_STEP_ZOOMED_OUT_SOCIAL_ADDENDUM.md`, Surface 2.
- Visual canonical: `docs/redesign/ios-register/zoomed-out-view-canonical.html`.
- Required predecessor: `docs/redesign/specs/PHASE_C_TIMELINE_WITH_PEEK.md`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify:

```bash
test -f app/'(tabs)'/races.tsx
test -f components/cards/TimelineGridView.tsx
test -f components/races/RacesFloatingHeader.tsx
test -f components/practice-timeline/PracticeTimelineShell.tsx
rg -n "PRACTICE_TIMELINE_PEEK|PracticeTimelineShell|usePracticeTimelinePhaseMemory" lib components app --glob '*.{ts,tsx}'
rg -n "isGridView|handleToggleGridView|TimelineGridView|onReorderRaces|pendingNewStepIdRef" app/'(tabs)'/races.tsx components/cards/TimelineGridView.tsx
rg -n "SectionList|stickySectionHeadersEnabled|Gesture\\.Pinch|PinchGestureHandler" app components --glob '*.{ts,tsx}'
```

Expected current state before Phase C.5 starts: Phase C files exist and are wired behind `PRACTICE_TIMELINE_PEEK`. If `PracticeTimelineShell.tsx` does not exist, stop; C.5 cannot execute before Phase C. Current legacy zoom-out is `components/cards/TimelineGridView.tsx`, a grid/list hybrid toggled by `isGridView` in `app/(tabs)/races.tsx`; it already has reorder mode, bulk actions, `pendingNewStepId`, and `onReorderRaces`.

Cross-check the HTML canonical for: `Upcoming`, `NOW`, `This week`, row phase dots, highlighted current row, search icon, pinch cues, and long-press menu.

## Commit Boundaries

### Commit 1: Flag, Types, and Section Adapter

Files:

- `lib/featureFlags.ts`
- `components/practice-timeline/zoomed-out/types.ts`
- `components/practice-timeline/zoomed-out/sectionAdapter.ts`
- `components/practice-timeline/zoomed-out/__tests__/sectionAdapter.test.ts`

Add:

```ts
PRACTICE_ZOOMED_OUT_TIMELINE: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_ZOOMED_OUT_TIMELINE', false),
```

Define:

```ts
export type PhaseDotState = 'empty' | 'half' | 'full';

export interface ZoomedOutTimelineRow {
  id: string;
  title: string;
  interestLabel: string;
  dateLabel: string;
  relativeLabel: string;
  isCurrent: boolean;
  isPast: boolean;
  glyph: string;
  phaseDots: { plan: PhaseDotState; do: PhaseDotState; reflect: PhaseDotState };
  raw: CardRaceData;
}

export interface ZoomedOutTimelineSection {
  key: 'upcoming' | 'now' | 'this_week' | 'last_week' | 'earlier';
  title: string;
  rows: ZoomedOutTimelineRow[];
}
```

Adapter rules:

- Use the same `filteredCardGridRaces` / `CardRaceData` array that Phase C uses.
- `current` is `nextActionItem?.id ?? selectedRaceId ?? first item`.
- Upcoming rows appear above NOW, nearest to NOW at the bottom of the upcoming section.
- Current row appears directly below the NOW divider.
- Past rows group into `This week`, `Last week`, then `Earlier`.
- Phase dot mapping for v1:
  - `Plan` full when `metadata.plan.what_will_you_do` or any `how_sub_steps` exist; half when only a title exists; empty otherwise.
  - `Do` full when `status === 'completed'`; half when `status === 'in_progress'`; empty otherwise.
  - `Reflect` full when `metadata.review` has sections/content or status completed with review data; half when completed but no structured review; empty otherwise.

Commit message:

```text
feat(practice): add zoomed-out timeline section adapter
```

### Commit 2: Zoomed-Out List Component

Files:

- `components/practice-timeline/zoomed-out/ZoomedOutTimelineView.tsx`
- `components/practice-timeline/zoomed-out/ZoomedOutTimelineRow.tsx`
- `components/practice-timeline/zoomed-out/index.ts`
- `components/practice-timeline/zoomed-out/__tests__/ZoomedOutTimelineView.test.tsx`

Use `SectionList` with `stickySectionHeadersEnabled`. Do not reuse `TimelineGridView` for the canonical path; keep it as flag-off legacy.

Props:

```ts
interface ZoomedOutTimelineViewProps {
  sections: ZoomedOutTimelineSection[];
  currentRowId?: string | null;
  topInset?: number;
  onSelectRow: (row: ZoomedOutTimelineRow) => void;
  onLongPressRow?: (row: ZoomedOutTimelineRow) => void;
  onSearchPress?: () => void;
  onAddStepPress?: () => void;
}
```

Render requirements:

- Header strip shows interest name, step count, date range, search icon, avatar slot if supplied later.
- NOW divider between upcoming and current/past content.
- Rows are 80-100pt tall, with title, interest/date metadata, glyph, and phase dots.
- Current row has subtle iOS-blue border/tint.
- Long press opens a contextual menu hook supplied by parent; do not implement destructive actions inside the row.
- Accessibility labels include title, date, and phase progress summary.

Commit message:

```text
feat(practice): build canonical zoomed-out timeline list
```

### Commit 3: Pinch Transition and Mode Wiring

Files:

- `components/practice-timeline/PracticeTimelineShell.tsx`
- `components/practice-timeline/zoomed-out/usePracticeZoomMode.ts`
- `app/(tabs)/races.tsx`
- `components/practice-timeline/zoomed-out/__tests__/usePracticeZoomMode.test.ts`

Behind both `PRACTICE_TIMELINE_PEEK` and `PRACTICE_ZOOMED_OUT_TIMELINE`, add a `zoomMode: 'zoomed_in' | 'zoomed_out'`.

Use existing gesture dependencies from Phase C. If Phase C used `react-native-gesture-handler` + Reanimated, add `Gesture.Pinch()` with a threshold:

- scale below `0.88` enters zoomed-out.
- scale above `1.08` exits zoomed-out.
- On exit, center the zoomed-in shell on the row most visible or the last selected row.

If simulator gesture support is unreliable, add a temporary dev-only toolbar action only under `__DEV__` and document it in the commit body. Do not ship a visible production toggle; canonical entry is pinch.

Commit message:

```text
feat(practice): wire pinch zoom between timeline modes
```

### Commit 4: Reorder and Long-Press Menu Parity

Files:

- `components/practice-timeline/zoomed-out/ZoomedOutTimelineView.tsx`
- `components/practice-timeline/zoomed-out/ZoomedOutRowMenu.tsx`
- `app/(tabs)/races.tsx`
- tests under `components/practice-timeline/zoomed-out/__tests__/`

Reuse existing handlers from `TimelineGridView` wiring:

- `onEditRace`
- `onDeleteRace`
- `onHideRace`
- `onMarkDone`
- `onMarkNotDone`
- `onReorderRaces`

For v1, preserve the existing tap-to-reorder behavior if drag-and-drop is not already available. The canonical calls for drag-and-drop, but `TimelineGridView` currently documents “tap-to-reorder is used on all platforms.” Do not introduce a new drag library in this phase without human approval.

Long-press menu options:

- Edit details.
- Move step / Reorder.
- Duplicate step: disabled unless an existing duplicate handler is found.
- Delete step.
- Set due date: disabled unless existing handler is found.
- Add to blueprint.
- Share step.
- Visibility settings: disabled unless existing handler is found.

Commit message:

```text
feat(practice): add zoomed-out row actions and reorder parity
```

### Commit 5: Polish, Empty State, and Verification

Files:

- `components/practice-timeline/zoomed-out/ZoomedOutTimelineView.tsx`
- `components/practice-timeline/zoomed-out/zoomedOutStyles.ts`
- `app/(tabs)/races.tsx`

Polish:

- Auto-scroll to current row when entering zoomed-out.
- Preserve `pendingNewStepIdRef` behavior: after creating a step, zoomed-out view scrolls to the new row.
- Empty state when no rows exist: `No practice steps yet` plus the flagged Phase B.6 Add Step FAB if available.
- Keep `TimelineGridView` reachable only when `PRACTICE_ZOOMED_OUT_TIMELINE=false`.

Commit message:

```text
chore(practice): polish zoomed-out timeline verification
```

## Files to Not Change

- Do not remove `components/cards/TimelineGridView.tsx`.
- Do not rename `app/(tabs)/races.tsx`.
- Do not add a new navigation route for zoomed-out view.
- Do not implement the Social Timeline Layer; that is Phase E.
- Do not implement Suggest Bar; that is Phase L.
- Do not add new data tables.

## Cutover Flag

Required, default OFF: `EXPO_PUBLIC_FF_PRACTICE_ZOOMED_OUT_TIMELINE=false`. This is a substantive interaction and layout change layered on top of Phase C.

## Test Approach

Run:

```bash
npm run typecheck
npx jest components/practice-timeline/zoomed-out --runInBand
rg -n "PRACTICE_ZOOMED_OUT_TIMELINE|EXPO_PUBLIC_FF_PRACTICE_ZOOMED_OUT_TIMELINE" lib app components --glob '*.{ts,tsx}'
```

Simulator verification:

- Flag off: existing grid zoom-out still works.
- Flag on: pinch out from `/practice` enters the vertical list.
- Current row is highlighted below NOW.
- Tap row returns to zoomed-in Phase C shell centered on that step.
- Long press opens row menu without accidental navigation.
- Reorder persists through existing `onReorderRaces`.
- Empty timeline renders without crashing.

## Rollback Path

Set `EXPO_PUBLIC_FF_PRACTICE_ZOOMED_OUT_TIMELINE=false`. The legacy `TimelineGridView` remains the fallback. Revert commits if the component should be removed.

## Risks and Open Questions

- This spec intentionally depends on Phase C. If Phase C chooses a different shell architecture or gesture library, update this spec before execution.
- Canonical drag-and-drop conflicts with the current tap-to-reorder implementation. Recommendation: ship tap-to-reorder parity first; only add true drag-and-drop after a dedicated gesture pass.
- Pinch gestures inside a scrollable screen can conflict with vertical scroll and phase-tab taps. Gesture thresholds must be verified on simulator, not just unit tests.
