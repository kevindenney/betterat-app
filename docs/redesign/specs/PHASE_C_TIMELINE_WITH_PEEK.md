# Phase C Spec: Timeline-With-Peek Shell

## Goal

Build the canonical Practice timeline shell from `docs/redesign/PRACTICE_TIMELINE_CANONICAL.md`: a horizontally paged sequence of step cards where the current step is centered at roughly 75-80% screen width and adjacent steps appear as 8-12% edge peeks. Swiping pages between steps, tapping a peek pages to that step, tapping a phase tab switches `Plan / Do / Reflect`, and each step remembers its last visited phase tab.

Verified repo state: there is no `app/(tabs)/practice.tsx`. The Practice-like surface is implemented in `/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/races.tsx`; `lib/navigation-config.ts` describes learner users landing on `/(tabs)/races` while the display label varies by interest. This spec therefore wires Phase C behind a new flag in `app/(tabs)/races.tsx` and does not rename routes.

The current active-card path is `CardGrid` (`components/cards/CardGrid.native.tsx` and `.web.tsx`) rendering one `RaceSummaryCard` per step/event. It already has horizontal pan gestures, nearby-card virtualization, snap thresholds, and sticky tab memory in `RaceSummaryCard` via `window.localStorage` for timeline steps. It does not satisfy the canonical shell because its dimensions are currently based on `CARD_WIDTH_RATIO = 0.86`, content is visually race-card-first, and sticky phase memory is owned inside each card rather than the shell.

Verified data flow in `app/(tabs)/races.tsx`:

- `baseCardGridRaces` maps real regattas and `timeline_steps` into `CardRaceData`.
- `filteredCardGridRaces` is the array passed into the current `CardGrid` branch.
- `selectedRaceId` is the selected step/event id and is restored/saved as view state.
- `nextActionItem?.id` is already used as the “next/current” target in existing initial-card logic.
- `renderCardGridContent(...)` is the existing adapter that renders `RaceSummaryCard` with all management, upload, post-race interview, toolbar-scroll, and step-status handlers.

Phase C should reuse that data flow. Do not introduce a new query layer.

## Commit Boundaries

### Commit 1: Feature Flag and Shell Types

Files:

- `/Users/kdenney/Developer/BetterAt/betterat-app/lib/featureFlags.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/types.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/index.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/__tests__/timelineTypes.test.ts`

Add `PRACTICE_TIMELINE_PEEK`:

```ts
PRACTICE_TIMELINE_PEEK: readBooleanEnv('EXPO_PUBLIC_FF_PRACTICE_TIMELINE_PEEK', false),
```

Default OFF. This phase changes the primary timeline interaction model and must be visually verified before rollout.

Create explicit shell types instead of reusing `CardGridProps` directly:

```ts
import type { RacePhase } from '@/components/cards/types';

export interface PracticeTimelineItem {
  id: string;
  title: string;
  date?: string | null;
  status?: string | null;
  isCurrent?: boolean;
  raw: unknown;
}

export interface PracticeTimelinePhaseMemory {
  get(stepId: string): RacePhase | undefined;
  set(stepId: string, phase: RacePhase): void;
}

export interface PracticeTimelineShellProps {
  items: PracticeTimelineItem[];
  selectedItemId?: string | null;
  currentItemId?: string | null;
  topInset?: number;
  onSelectItem: (itemId: string, index: number) => void;
  renderCurrentCard: (item: PracticeTimelineItem, index: number) => React.ReactNode;
  phaseMemory?: PracticeTimelinePhaseMemory;
}
```

Tests prove `currentItemId` resolution prefers explicit current, then selected, then first item. No UI wiring yet.

Acceptance criteria:

- `PRACTICE_TIMELINE_PEEK` appears in `FEATURE_FLAGS` with env override `EXPO_PUBLIC_FF_PRACTICE_TIMELINE_PEEK`.
- `npm run typecheck` passes with no consumers yet.
- Tests cover empty items, selected-only items, explicit-current items, and missing current id falling back to the first item.

### Commit 2: Horizontal Pager Shell

Files:

- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/PracticeTimelineShell.tsx`
- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/__tests__/PracticeTimelineShell.test.tsx`

Build the shell using existing dependencies only: `react-native-gesture-handler` + `react-native-reanimated`. Do not add `react-native-pager-view` or carousel packages in v1. The repo already ships gesture-handler and reanimated, and `CardGrid.native.tsx` has proven patterns for `Gesture.Pan()`, `activeOffsetX([-10, 10])`, `failOffsetY([-10, 10])`, snap thresholds, `withSpring`, and `runOnJS`.

The shell should own:

- `currentIndex` shared value and JS state.
- `horizontalOffset` shared value.
- `goToIndex(index)` used by both swipe completion and peek taps.
- `onLayout` measurement to compute card width and snap interval.

Dimension rules:

```ts
const cardWidth = Math.round(containerWidth * 0.78);
const cardGap = 8;
const peekWidth = Math.round((containerWidth - cardWidth) / 2);
const snapInterval = cardWidth + cardGap;
```

Keep `cardWidth` in the canonical 75-80% range. On very narrow screens, clamp to `Math.min(containerWidth - 48, Math.max(280, computedWidth))`.

Render active card content only for `Math.abs(index - currentIndex) <= 1`. Non-active adjacent peeks render as silhouettes: rounded white cards with no inner content, `accessibilityRole="button"`, `accessibilityLabel={`Open ${item.title}`}`, and `onPress={() => goToIndex(index)}`. This prevents inactive card content from intercepting phase-tab taps and reduces render cost.

Recommended render model:

```tsx
<GestureHandlerRootView style={styles.root} onLayout={handleLayout}>
  <GestureDetector gesture={panGesture}>
    <Animated.View style={[styles.track, animatedTrackStyle]}>
      {items.map((item, index) => (
        <View key={item.id} style={[styles.slot, { left: index * snapInterval }]}>
          {index === currentIndex ? renderCurrentCard(item, index) : (
            <Pressable
              testID={index < currentIndex ? 'practice-timeline-peek-left' : 'practice-timeline-peek-right'}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}`}
              onPress={() => goToIndex(index)}
            >
              <View style={styles.peekSilhouette} />
            </Pressable>
          )}
        </View>
      ))}
    </Animated.View>
  </GestureDetector>
</GestureHandlerRootView>
```

Do not use `ScrollView` paging in this commit. The current card content contains vertical scrollable areas and pressable phase tabs; owning the horizontal gesture explicitly is safer than nesting a horizontal `ScrollView` around a vertically scrollable card.

Acceptance criteria:

- Swipe left/right changes `currentIndex` and calls `onSelectItem` exactly once per page change.
- Tapping a left/right peek calls `onSelectItem` and animates to the target.
- Empty item arrays render a non-crashing empty container.
- Only active and adjacent slots mount render content/silhouettes.

### Commit 3: Controlled Phase Memory

Files:

- `/Users/kdenney/Developer/BetterAt/betterat-app/components/cards/types.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/components/cards/content/RaceSummaryCard.tsx`
- `/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/races.tsx`
- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/usePracticeTimelinePhaseMemory.ts`
- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/__tests__/usePracticeTimelinePhaseMemory.test.ts`

`RaceSummaryCard` currently initializes `selectedPhase` from status-derived `currentPhase` and then persists `step_tab:${race.id}` to `window.localStorage` for timeline steps. Keep that behavior as the fallback, but add controlled props to `CardContentProps`:

```ts
activePhase?: RacePhase;
onActivePhaseChange?: (phase: RacePhase) => void;
```

In `RaceSummaryCard`, initialize from `activePhase ?? saved tab ?? currentPhase`. In `handlePhaseChange`, call both `setSelectedPhase(phase)` and `onActivePhaseChange?.(phase)`. If `activePhase` changes, sync local state to it. Do not remove local persistence because web and legacy CardGrid still rely on it.

Add `usePracticeTimelinePhaseMemory()` as a small hook backed by component state plus localStorage when available:

```ts
export function usePracticeTimelinePhaseMemory(): PracticeTimelinePhaseMemory {
  const [memory, setMemory] = useState<Record<string, RacePhase>>({});
  return {
    get: (stepId) => memory[stepId],
    set: (stepId, phase) => {
      setMemory((prev) => ({ ...prev, [stepId]: phase }));
      if (typeof window !== 'undefined') {
        window.localStorage?.setItem(`step_tab:${stepId}`, phase);
      }
    },
  };
}
```

This is the canonical “sticky per-step phase tab memory.” It centralizes the behavior for the new shell without breaking existing cards.

One repo-specific caveat: `RaceSummaryCard` currently has an effect at lines 1159-1162 that resets `selectedPhase` whenever `currentPhase` changes. Keep the status-derived reset when the user has not explicitly chosen a phase for the step. Once `activePhase` is provided by the shell, the controlled value wins. The implementation should avoid an effect loop where `activePhase` sets local state, local state calls `onActivePhaseChange`, and the shell re-sends the same value.

Acceptance criteria:

- Existing `CardGrid` still works without passing the new props.
- New shell can pass `activePhase` and receive `onActivePhaseChange`.
- Selecting `Reflect`, swiping away, and returning to the same step restores `Reflect`.
- Status-derived defaults still apply for first visits: planned/pending -> `Plan`, in progress -> `Do`, completed/overdue -> `Reflect`.

### Commit 4: Wire Shell Behind Flag

Files:

- `/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/races.tsx`
- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/PracticeTimelineShell.tsx`
- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/__tests__/PracticeTimelineShell.integration.test.tsx`

In the main cards branch of `app/(tabs)/races.tsx`, insert the new flag before `FEATURE_FLAGS.RACE_PREP_IOS_REGISTER`:

```tsx
) : FEATURE_FLAGS.PRACTICE_TIMELINE_PEEK ? (
  <PracticeTimelineShell
    items={practiceTimelineItems}
    selectedItemId={selectedRaceId}
    currentItemId={nextActionItem?.id ?? selectedRaceId}
    topInset={totalHeaderHeight}
    onSelectItem={(itemId) => {
      setHasManuallySelected(true);
      setSelectedRaceId(itemId);
    }}
    phaseMemory={phaseMemory}
    renderCurrentCard={(item, index) =>
      renderCardGridContent(
        item.raw as CardRaceData,
        'race_summary',
        true,
        canManagePracticeTimelineItem(item.raw),
        /* existing handlers */
      )
    }
  />
) : FEATURE_FLAGS.RACE_PREP_IOS_REGISTER ? (
```

The exact adapter should be built next to existing `filteredCardGridRaces` logic:

```ts
const practiceTimelineItems = useMemo(
  () => filteredCardGridRaces.map((race) => ({
    id: race.id,
    title: race.name,
    date: race.start_date ?? race.date,
    status: race.stepStatus ?? race.status,
    isCurrent: race.id === (nextActionItem?.id ?? selectedRaceId),
    raw: race,
  })),
  [filteredCardGridRaces, nextActionItem?.id, selectedRaceId],
);
```

Do not remove `CardGrid`; it remains the fallback when `PRACTICE_TIMELINE_PEEK=false`.

Because `renderCardGridContent` currently receives many handler arguments from `CardGrid`, create small local helpers rather than dropping behavior:

- `canManagePracticeTimelineItem(raw)` should match current `CardGrid.native.tsx` logic: user can manage when `raw.created_by === user.id` or the row is demo content.
- `handlePracticeTimelineUpload(itemId)` should call the existing `handleCardGridUploadDocument`.
- `handlePracticeTimelineOpenPostRaceInterview(item)` should preserve the existing selected-id update before `handleOpenPostRaceInterviewManually`.
- `handlePracticeTimelineDismissSample` should call `handleDismissSampleRace`.

If implementation complexity gets high, split this wiring commit into two commits: first wire read-only navigation behind the flag, then restore management/post-race/upload handlers. Do not ship a flag-on state that silently drops destructive-action guards.

Acceptance criteria:

- With `EXPO_PUBLIC_FF_PRACTICE_TIMELINE_PEEK=false`, the old `CardGrid` branch still renders.
- With the flag true, `PracticeTimelineShell` renders and receives `filteredCardGridRaces`-derived items.
- Selecting a peek updates `selectedRaceId` and preserves the selected detail path.
- No production code imports from `app/`.

### Commit 5: Polish and Visual Verification Hooks

Files:

- `/Users/kdenney/Developer/BetterAt/betterat-app/components/practice-timeline/PracticeTimelineShell.tsx`
- `/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/races.tsx`
- `/Users/kdenney/Developer/BetterAt/betterat-app/docs/redesign/IOS_STATUS.md`

Add `testID`s:

- `practice-timeline-shell`
- `practice-timeline-card-active`
- `practice-timeline-peek-left`
- `practice-timeline-peek-right`
- `practice-phase-tab-plan`
- `practice-phase-tab-do`
- `practice-phase-tab-reflect`

Add a short status note that Phase C is staged behind `EXPO_PUBLIC_FF_PRACTICE_TIMELINE_PEEK=false`, pending simulator verification.

The simulator verification checklist for this commit:

- Sail Racing with multiple races: centered card, both edge peeks visible when not at an endpoint.
- Nursing or another timeline-step interest: same shell works with `timeline_steps`, not just regattas.
- First card: right peek visible, no left peek.
- Last card: left peek visible, no right peek.
- Empty timeline: existing empty state remains reachable and does not render an empty gesture shell.
- Phase tab tap target: tapping `Plan / Do / Reflect` never advances the horizontal page.

## Library Options

Recommended v1: no new dependency. Reuse `react-native-gesture-handler` and `react-native-reanimated`, already present in `package.json`, because the current `CardGrid.native.tsx` proves the app can implement horizontal snapping without adding native install risk.

Acceptable alternative: `react-native-pager-view`. It gives native paging semantics but adds dependency and Expo compatibility work. Use only if the custom gesture shell produces scroll physics problems in simulator.

Not recommended: `react-native-snap-carousel`. It is an older carousel abstraction and would obscure gesture conflict handling.

## Gesture Handling

Horizontal page swipe lives on the shell. Phase tabs remain ordinary press targets inside the active card. Inactive peeks contain no inner content, so a tap on a peek cannot accidentally trigger a phase tab. Keep `activeOffsetX([-10, 10])` and `failOffsetY([-10, 10])` from `CardGrid.native.tsx` so vertical scrolling inside active phase content wins when movement is vertical.

## Test Approach

Run `npm run typecheck`. Add Jest tests for current-index resolution, peek tap selection, phase-memory get/set, and fallback rendering with the flag off. Manual simulator verification is required before flipping the flag on: first load centers current/next step, swipe left/right pages steps, tap peeks pages steps, phase tabs do not trigger page swipe, returning to a step restores its last phase.

Suggested test files:

- `components/practice-timeline/__tests__/timelineTypes.test.ts`
- `components/practice-timeline/__tests__/PracticeTimelineShell.test.tsx`
- `components/practice-timeline/__tests__/usePracticeTimelinePhaseMemory.test.ts`
- `app/__tests__/practice-timeline-peek-flag.contract.test.ts`

The contract test can read `app/(tabs)/races.tsx` as source text and assert the flag branch exists before the Race Prep branch. Keep it lightweight; the simulator remains the authority for gesture feel.

## Risks and Open Questions

- Current route naming still says `races`; canonical says Practice. This spec intentionally avoids route renames.
- `RaceSummaryCard` already resets selected phase when status-derived `currentPhase` changes. Controlled phase memory must not fight that effect.
- `renderCardGridContent` has many handler parameters. Commit 4 should preserve existing management, post-race interview, upload, and delete behavior rather than reimplementing it.
- Web behavior needs explicit review. `CardGrid.web.tsx` exists; the new shell should either support web with matching behavior or stay native-gated until web parity is built.
- The current `RaceSummaryCard` name is race-specific but it now renders generic timeline steps too. Do not rename it in Phase C; a naming cleanup is separate from the shell build.
- `RACE_PREP_IOS_REGISTER` is currently default false after the layout-regression review. Phase C should not depend on re-enabling it.

## Rollback Path

Flip `EXPO_PUBLIC_FF_PRACTICE_TIMELINE_PEEK=false` or revert the wiring commit. The type/shell commits are inert until the flag branch is active. If the shell ships visually wrong but type-safe, rollback should be an env flip, not code deletion.

## Commit Messages

Use these messages unless implementation discovers a smaller split:

```text
feat(practice): add timeline-with-peek flag and shell types
feat(practice): build timeline-with-peek pager shell
feat(practice): add controlled phase memory for timeline cards
feat(practice): wire timeline-with-peek shell behind flag
docs(redesign): mark Practice timeline peek shell staged
```
