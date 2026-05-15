# Race Log + Shift Log Commit 3 Spec: Reflect Wiring

## Discrepancies

This commit intentionally contradicts the current Reflect cutover wiring from `3d8b45dc`: `RaceLogIosPreview` must be removed from the production Reflect path because it is fixture-backed.

## Files

Change:

- `app/(tabs)/reflect.tsx`
- `components/ios-register/RaceLogScreen.tsx` only if interest-aware empty-state props are needed.

Do not change:

- `app/race-log-ios.tsx`; the preview route remains fixture-backed.
- `app/profile-ios.tsx`; Profile real-data wiring is separate debt.

## Imports

Replace:

```tsx
import { RaceLogIosPreview } from '@/app/race-log-ios';
```

with:

```tsx
import { RaceLogScreen } from '@/components/ios-register';
import { useReflectLog } from '@/hooks/useReflectLog';
```

## Reflect Component Wiring

Inside `ReflectScreen()` add:

```tsx
const reflectLog = useReflectLog();
```

Add the entry handler:

```tsx
const handleReflectLogEntryPress = useCallback((entry: { id: string }) => {
  if (reflectLog.sourceKind === 'sailing') {
    router.push(`/race/ios/${entry.id}` as never);
    return;
  }
  router.push(`/(tabs)/race?selected=${entry.id}` as never);
}, [reflectLog.sourceKind]);
```

Replace the flag-on Race Log branch:

```diff
-          <RaceLogIosPreview
-            embedded
-            topInset={toolbarHeight}
-            onScroll={handleToolbarScroll}
-          />
+          <RaceLogScreen
+            showChrome={false}
+            activeSubTab="race-log"
+            filterChips={reflectLog.filterChips}
+            seasons={reflectLog.seasons}
+            feedFootHint={reflectLog.feedFootHint}
+            topInset={toolbarHeight}
+            onScroll={handleToolbarScroll}
+            onEntryPress={handleReflectLogEntryPress}
+          />
```

Keep the flag-off `RaceLogView` branch unchanged.

## Empty State Extension

If product requires nursing-specific empty copy in this commit, extend `RaceLogScreen` with:

```ts
emptyState?: {
  glyph?: React.ComponentProps<typeof IOSRegisterErrorState>['glyph'];
  headline: string;
  supportingText: string;
  primaryActionLabel: string;
  onPrimaryActionPress?: () => void;
};
```

and replace the hard-coded empty state with:

```tsx
const emptyCopy = emptyState ?? {
  glyph: 'boat-outline',
  headline: 'No races yet',
  supportingText: "Add a race to start your season arc. Logged races appear here once you've debriefed them.",
  primaryActionLabel: 'Add a race',
};

<IOSRegisterErrorState
  glyph={emptyCopy.glyph ?? 'calendar-outline'}
  headline={emptyCopy.headline}
  supportingText={emptyCopy.supportingText}
  primaryAction={{
    label: emptyCopy.primaryActionLabel,
    onPress: emptyCopy.onPrimaryActionPress ?? (() => router.push('/(tabs)/races' as never)),
  }}
/>
```

Then pass:

```tsx
emptyState={{
  ...reflectLog.emptyState,
  onPrimaryActionPress: () => router.push('/(tabs)/races' as never),
}}
```

If the team decides to preserve the sailing empty copy for v1, skip this extension and keep `RaceLogScreen` unchanged.

## Loading and Error Treatment

V1 is allowed to keep the calm empty-state surface while loading because `useReflectData` and `useMyTimeline` already power existing Reflect/Race screens without a separate loading skeleton here.

For non-loading errors, render `IOSRegisterErrorState` above the `RaceLogScreen` branch only if the existing Reflect tab has a local error pattern to match. Otherwise preserve existing behavior and let this be a follow-up.

## Profile Audit Note

Do not touch Profile in this commit, but leave a code comment near the Profile branch only if the team accepts inline debt markers:

```tsx
// TODO(redesign): ProfileIosPreview is fixture-backed. Replace with
// ProfileScreen + real account data in the Profile real-data wiring pass.
```

If the repo avoids TODO comments in production screens, do not add the comment. The debt is documented in `RACE_LOG_SHIFT_LOG_DATA_LAYER_WORK.md` and `IOS_MIGRATION_PLAN.md`.

## Verification

- Active interest = Nursing: Reflect segment label reads `Shift Log`; rows come from `timeline_steps`, not `SAMPLE_SEASONS`; no `Christmas Cup`, `Dragon · Hong Kong`, or other sailing fixture copy appears.
- Active interest = Sail racing: Reflect segment label reads `Race Log`; rows come from `useReflectData().data.raceLog`.
- Empty nursing account: empty state renders `No shifts yet` if the optional empty-state prop is implemented; otherwise the existing calm empty state renders without crashing.
- Preview route `/race-log-ios` still renders the Claude Design sample fixture.
- Profile segment still renders as before; its sample-data limitation remains documented.
- `npm run typecheck` passes.

## Performance Assertion

The Reflect Race/Shift segment must not introduce additional network calls beyond `useReflectLog()`. Specifically, no per-row fetches in `onEntryPress`, no row-level concept/capture lookups, and no search queries on initial render.

## Commit Message

```text
fix(redesign): wire Reflect Race Log to real interest data

Replace the fixture-backed RaceLogIosPreview in the canonical Reflect tab
with RaceLogScreen consuming useReflectLog.

- sailing maps existing race-domain Reflect data into iOS-register seasons
- nursing maps timeline_steps into Shift Log rows
- preview route remains fixture-backed for design review
- Profile's fixture-backed iOS path remains documented as separate follow-up
```

