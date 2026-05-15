# Reflect Data Wiring Work Plan

## Discrepancies

- Reflect visual cutover `3d8b45dc` shipped with production `app/(tabs)/reflect.tsx` mounting preview-route wrappers: `RaceLogIosPreview` and `ProfileIosPreview`.
- `RaceLogIosPreview` contains hardcoded sailing fixture data: `Christmas Cup`, `Boxing Day Trophy`, `Lipton Trophy`, `Spring Opener`, `Around Lamma`, and filter chip `Dragon · Hong Kong`.
- `ProfileIosPreview` contains hardcoded Felix sailing fixture data: `SAMPLE_HERO`, `SAMPLE_INTERESTS`, `SAMPLE_IDENTITY`, and `SAMPLE_PLAN`.
- Nursing data is not absent. The repo has `timeline_steps`, RLS, indexes, and `useMyTimeline(currentInterest.id)`; the Race tab already maps non-sailing timeline steps for nursing-like interests.
- Profile real data is not absent. `useReflectProfile()` reads `profiles`, `sailor_profiles`, follow counts, sailing stats, boats, achievements, goals, and related profile data. The iOS-register Profile branch simply does not consume it.

## What This Work Is

This work replaces preview-fixture mounts inside production Reflect with production-shaped iOS-register screens consuming real data.

The structural mistake was treating a preview wrapper as a production adapter. Preview routes are allowed to own sample fixtures, preview banners, and close buttons. Production tab mounts must instead import presentational screens from `components/ios-register/` and pass real props from hooks/adapters.

## Decision 1: Interest-Aware Data Shape

Choice: **(a) per-interest data shapes, mapped to one render shape.**

`RaceLogScreen` remains the universal archive renderer. Sailing maps regattas and race participants into `RaceLogSeason[]`; nursing maps `timeline_steps` into the same grouped-entry shape as Shift Log. This is the smallest correct fix because the screen's visual grammar is already generic enough: grouped chronological entries with status, date, title, secondary metadata, and filter chips.

Reversal note: reverse by introducing `ShiftLogScreen` and changing `useReflectLog()` to dispatch to separate screen components instead of mapping into `RaceLogScreen` props.

## Decision 2: Adapter Location

Choice: **new hook + mapper modules.**

Production data adaptation lives in `hooks/useReflectLog.ts`, `hooks/useReflectProfileScreenData.ts`, and pure mapper modules under `lib/reflect/`. `RaceLogScreen` and `ProfileScreen` stay presentational. `app/(tabs)/reflect.tsx` owns the feature-flag branch and passes props, but does not contain data-shaping logic.

Reversal note: collapse the hook into `app/(tabs)/reflect.tsx` if this remains the only consumer and the adapter becomes too thin.

## Decision 3: Nursing Data Model Status

Choice: **nursing data exists.**

Nursing does not have a separate `shifts` table, but `timeline_steps` is the production event model for non-sailing interests. The schema includes `interest_id`, `status`, `starts_at`, `ends_at`, `completed_at`, `due_at`, `location_name`, `category`, and `metadata`. Nursing config labels the Reflect segment as `Shift Log`, and `useMyTimeline(currentInterest.id)` already scopes steps by active interest.

This makes Shift Log a mapping/read-path task, not a first-ship data-model task.

Reversal note: if product later requires clinical-specific shift records, keep `RaceLogScreen` props stable and replace only the nursing branch inside `useReflectLog()`.

## Decision 4: Profile Audit Outcome

Profile has the same bug as Race Log and is in scope.

Production Reflect mounts `ProfileIosPreview` when `PROFILE_IOS_REGISTER` is on. That wrapper passes sample Felix sailing profile content into `ProfileScreen`. The real legacy `ProfileView` uses `useReflectProfile()`, so the data source exists; the missing piece is an iOS-register Profile adapter that maps `ReflectProfileData` and active-interest context into `ProfileScreen` props.

Reversal note: if Profile must remain sample-backed for visual review, flip `PROFILE_IOS_REGISTER=false` until real-data wiring lands. Do not keep the preview wrapper in production behind a default-on flag.

## Decision 5: Severity and Ship Sequence

Choice: **planned migration, next priority.**

This is not an external-user hotfix because BetterAt is still in internal testing. It also should not be deferred behind unrelated cutovers because the visual Reflect cutover is already live and visibly contradicts the active-interest selector: Nursing shows a Shift Log label but sailing race fixtures in the body. The right path is to ship the data adapters correctly for Race Log/Shift Log and Profile, not to add an interest-aware flag duct tape.

Reversal note: if a demo requires immediate containment before the adapter lands, set `EXPO_PUBLIC_FF_RACE_LOG_IOS_REGISTER=false` and `EXPO_PUBLIC_FF_PROFILE_IOS_REGISTER=false` for that environment. That is rollback, not the product fix.

## Data Dependencies By Interest

| Area | Data needed | Current repo state | Blocking status |
|---|---|---|---|
| Sailing Race Log | `regattas`, `race_participants`, optional `race_timer_sessions` | Exists; legacy `RaceLogView` consumes `useReflectData()` | Not blocked |
| Nursing Shift Log | `timeline_steps` scoped by `currentInterest.id` | Exists; `useMyTimeline()` and Race tab already consume it | Not blocked |
| Generic activity log | `timeline_steps` scoped by `currentInterest.id` | Exists for all non-sailing interests | Not blocked |
| Profile identity | `profiles`, auth user metadata | Exists through `useReflectProfile()` | Not blocked |
| Profile interests | `userInterests` from `InterestProvider` | Exists | Not blocked |
| Profile sailing stats | sailing tables through `useReflectProfile()` | Exists but sailing-specific | Follow-up for non-sailing stat labels, not a blocker for identity/settings profile |
| Profile preferences | currently local defaults in preview | No full writeback source in iOS Profile path | Follow-up |

## Adapter API

```ts
export function useReflectLog(): {
  seasons: RaceLogSeason[];
  filterChips: RaceLogFilterChip[];
  feedFootHint?: string;
  emptyState: ReflectLogEmptyStateCopy;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  sourceKind: 'sailing' | 'timeline';
}

export function useReflectProfileScreenData(): {
  props: ProfileScreenData | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
```

## Internal Mapping

### Sailing

- Fetch owned and participated regattas, plus participant status/result rows.
- Group by season: Winter / Spring / Summer / Autumn.
- Map past races to `debriefed`, future races to `planned`, same-day race to `current`.
- Infer filter scope from boat class and venue/location when available.

### Nursing / Non-Sailing

- Fetch `timeline_steps` through `getUserTimeline(userId, currentInterest.id)`.
- Group by the same season buckets.
- Map `completed` to `debriefed`, `in_progress` to `current`, `pending` and `skipped` to `planned`.
- Use `location_name`, plan metadata, or category as secondary row metadata.
- Use active-interest config for segment/empty copy; nursing gets `No shifts yet`.

### Profile

- Map `ReflectProfileData.profile` to `ProfileHero` and `ProfileIdentityFields`.
- Map `InterestProvider.userInterests` to `ProfileInterest[]`; `currentInterest` is `kind: 'primary'`.
- Use v1 local preference state for `windUnit`, `distanceUnit`, `weeklyDigest`, `resurfaceOldCaptures`, and `privateMode`, matching the preview behavior but without sample identity data.
- Use a conservative `ProfilePlan`: `Free` / `Current plan` until billing source is wired.

## Empty State Behavior

`RaceLogScreen` already renders the canonical calm empty state when `seasons.length === 0`. The adapter supplies interest-aware copy in Commit 3 by adding an optional `emptyState` prop to `RaceLogScreen`.

If an account has no nursing shifts, it should show a Shift Log empty state, not sailing races and not a loading spinner.

## Ship Sequence

1. Commit 1 — Reflect Log adapter: add pure mappers, `ReflectLogService`, `useReflectLog()`, and tests. Spec: `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_1_LOG_ADAPTER.md`.
2. Commit 2 — Profile adapter: add `mapReflectProfileToProfileScreen`, `useReflectProfileScreenData()`, and tests. Spec: `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_2_PROFILE_ADAPTER.md`.
3. Commit 3 — Reflect production wiring: replace `RaceLogIosPreview` and `ProfileIosPreview` in `app/(tabs)/reflect.tsx` with `RaceLogScreen` and `ProfileScreen` consuming the new hooks. Spec: `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_3_REFLECT_WIRING.md`.
4. Commit 4 — Status docs: mark Race Log/Profile as shipped-with-real-data and record follow-ups. Spec: `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_4_STATUS_DOCS.md`.

## Reversibility

One environment toggle reverts the production branch today:

```sh
EXPO_PUBLIC_FF_RACE_LOG_IOS_REGISTER=false
EXPO_PUBLIC_FF_PROFILE_IOS_REGISTER=false
```

After Commit 3, the code-level revert is also narrow: restore the two preview wrapper imports and the two flag-on branches in `app/(tabs)/reflect.tsx`. The adapters are additive and can remain unused until fixed.

