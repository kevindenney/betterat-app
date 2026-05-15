# Reflect Data Wiring Commit 3 Spec: Production Reflect Wiring

## Files

Change:

- `app/(tabs)/reflect.tsx`
- `components/ios-register/RaceLogScreen.tsx`

Do not change preview routes:

- `app/race-log-ios.tsx`
- `app/profile-ios.tsx`

## RaceLogScreen Empty-State Prop

In `components/ios-register/RaceLogScreen.tsx`, add:

```ts
import type { Ionicons } from '@expo/vector-icons';

interface RaceLogEmptyState {
  glyph: keyof typeof Ionicons.glyphMap;
  headline: string;
  supportingText: string;
  primaryActionLabel: string;
  onPrimaryActionPress?: () => void;
}
```

Extend `Props`:

```ts
emptyState?: RaceLogEmptyState;
```

Inside `RaceLogScreen`, before `return`, add:

```ts
const emptyCopy = emptyState ?? {
  glyph: 'boat-outline' as const,
  headline: 'No races yet',
  supportingText: "Add a race to start your season arc. Logged races appear here once you've debriefed them.",
  primaryActionLabel: 'Add a race',
  onPrimaryActionPress: () => router.push('/(tabs)/races' as never),
};
```

Replace the hardcoded empty state:

```tsx
<IOSRegisterErrorState
  glyph={emptyCopy.glyph}
  headline={emptyCopy.headline}
  supportingText={emptyCopy.supportingText}
  primaryAction={{
    label: emptyCopy.primaryActionLabel,
    onPress: emptyCopy.onPrimaryActionPress ?? (() => router.push('/(tabs)/races' as never)),
  }}
/>
```

## Reflect Imports

In `app/(tabs)/reflect.tsx`, remove:

```ts
import { RaceLogIosPreview } from '@/app/race-log-ios';
import { ProfileIosPreview } from '@/app/profile-ios';
```

Add:

```ts
import { RaceLogScreen, ProfileScreen } from '@/components/ios-register';
import { IOSRegisterErrorState } from '@/components/ios-register/IOSRegisterErrorState';
import { useReflectLog } from '@/hooks/useReflectLog';
import { useReflectProfileScreenData } from '@/hooks/useReflectProfileScreenData';
```

## Reflect Hook Usage

Inside `ReflectScreen()` add:

```ts
const reflectLog = useReflectLog();
const reflectProfile = useReflectProfileScreenData();

const handleReflectLogEntryPress = useCallback((entry: { id: string }) => {
  if (reflectLog.sourceKind === 'sailing') {
    router.push(`/(tabs)/race/${entry.id}` as never);
    return;
  }
  router.push(`/(tabs)/race?selected=${entry.id}` as never);
}, [reflectLog.sourceKind]);
```

## Race/Shift Branch Diff

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
+            emptyState={{
+              ...reflectLog.emptyState,
+              onPrimaryActionPress: () => router.push('/(tabs)/races' as never),
+            }}
+            topInset={toolbarHeight}
+            onScroll={handleToolbarScroll}
+            onEntryPress={handleReflectLogEntryPress}
+          />
```

## Profile Branch Diff

```diff
-          <ProfileIosPreview
-            embedded
-            topInset={toolbarHeight}
-            onScroll={handleToolbarScroll}
-          />
+          reflectProfile.props ? (
+            <ProfileScreen
+              {...reflectProfile.props}
+              topInset={toolbarHeight}
+              onScroll={handleToolbarScroll}
+              onWindUnitChange={reflectProfile.handlers.setWindUnit}
+              onDistanceUnitChange={reflectProfile.handlers.setDistanceUnit}
+              onWeeklyDigestChange={reflectProfile.handlers.setWeeklyDigestOn}
+              onResurfaceOldCapturesChange={reflectProfile.handlers.setResurfaceOldCapturesOn}
+              onPrivateModeChange={reflectProfile.handlers.setPrivateModeOn}
+              onIdentityFieldPress={() => router.push('/account' as never)}
+              onManagePlanPress={() => router.push('/account' as never)}
+              onPrivacyPress={() => router.push('/settings/privacy' as never)}
+              onHelpPress={() => router.push('/support' as never)}
+            />
+          ) : (
+            <IOSRegisterErrorState
+              glyph="person-circle-outline"
+              headline={reflectProfile.error ? 'Profile unavailable' : 'Loading profile'}
+              supportingText={
+                reflectProfile.error
+                  ? 'We could not load your profile right now. Try again in a moment.'
+                  : 'Loading your account details.'
+              }
+              primaryAction={{
+                label: reflectProfile.error ? 'Try again' : 'Refresh',
+                onPress: reflectProfile.refresh,
+              }}
+            />
+          )
```

## Verification

- Sail Racing active: Race Log shows real races from the legacy Reflect/Race data source, not `SAMPLE_SEASONS`.
- Nursing active: segment label is `Shift Log`, rows come from `timeline_steps`, and no sailing fixture copy appears.
- Empty Nursing account: `No shifts yet` empty state renders.
- Profile active under Nursing: Profile hero uses current user profile data, not `Felix Brennan`.
- Preview routes `/race-log-ios` and `/profile-ios` still render fixtures for design review.
- `npm run typecheck` passes.

## Performance Assertion

Initial Reflect screen should not fetch both log and profile data unless both hooks are already mounted. If this becomes a measurable cost, move hook calls into child segment components so only the active segment fetches. Do not introduce per-row fetches.

## Commit Message

```text
fix(redesign): wire Reflect iOS register segments to real data

Replace preview-fixture mounts inside the production Reflect tab with
production-shaped iOS-register screens consuming real adapters.

- Race/Shift Log renders RaceLogScreen from useReflectLog
- Profile renders ProfileScreen from useReflectProfileScreenData
- preview routes remain fixture-backed for design review
- empty Shift Log renders canonical calm empty state
```

