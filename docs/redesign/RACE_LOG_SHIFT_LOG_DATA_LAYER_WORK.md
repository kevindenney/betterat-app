# Race Log + Shift Log Real-Data Wiring Work Plan

## Discrepancies

- Reflect cutover `3d8b45dc` shipped the visual Race Log/Profile render switch, but the flag-on Reflect path still mounts `RaceLogIosPreview` and `ProfileIosPreview`. Those preview wrappers use Claude Design sample fixtures, not live account data.
- The layout fix in `6b3fe596` was valid but incomplete as a product fix. It made the embedded `RaceLogScreen` visible; it did not replace the sample-data adapter.
- `DATA_LAYER_DEPENDENCIES.md` previously treated Race Log/Profile as data-ready. That is true at the schema/source level, but false at the Reflect iOS-register wiring level: the shipped flag-on path does not consume those sources yet.

## Decisions

- Race Log and Shift Log use one adapter hook: `useReflectLog()`. It returns the same `RaceLogScreen` prop shape for sailing and non-sailing interests.
- Sailing reads existing race-domain data through `useReflectData()` and maps `RaceLogEntry[]` into `RaceLogSeason[]`.
- Nursing and other non-sailing interests read existing `timeline_steps` through `useMyTimeline(currentInterest.id)` and map steps into the same archive shape. The surface label comes from the interest config (`Shift Log`, `Activity Log`, `Workout Log`); the component remains `RaceLogScreen` until the visual kit gets a generic name.
- Preview routes remain fixture-backed by design. Production Reflect must not import `RaceLogIosPreview` after this work lands.
- Profile has the same sample-preview leak. `ProfileIosPreview` renders Felix sailing fixtures and does not consume `useReflectProfile`. That is a separate Profile real-data wiring commit, not part of the Race/Shift adapter.

## Specs

- Commit 1: `docs/redesign/specs/RACE_LOG_SHIFT_LOG_COMMIT_1_MAPPERS.md`
- Commit 2: `docs/redesign/specs/RACE_LOG_SHIFT_LOG_COMMIT_2_DATA_HOOK.md`
- Commit 3: `docs/redesign/specs/RACE_LOG_SHIFT_LOG_COMMIT_3_REFLECT_WIRING.md`

## Public Contract

The production Reflect path calls:

```ts
const {
  seasons,
  filterChips,
  feedFootHint,
  emptyState,
  loading,
  error,
  refresh,
} = useReflectLog();
```

and renders:

```tsx
<RaceLogScreen
  showChrome={false}
  activeSubTab="race-log"
  filterChips={filterChips}
  seasons={seasons}
  feedFootHint={feedFootHint}
  topInset={toolbarHeight}
  onScroll={handleToolbarScroll}
  onEntryPress={handleEntryPress}
/>
```

## Data Sources

| Interest family | Source | Current state | Adapter responsibility |
|---|---|---|---|
| Sailing / `sail-racing` | `hooks/useReflectData.ts` over `regattas`, `race_participants`, `race_timer_sessions` | Exists, but current hook only fetches current-year regattas | Reuse in v1, group client-side, map statuses conservatively; follow-up expands archive range |
| Nursing / `nursing` | `useMyTimeline(currentInterest.id)` over `timeline_steps` | Exists and already powers the Race tab's clinical shift list | Map timeline steps to shift entries and group by season |
| Other non-sailing interests | `useMyTimeline(currentInterest.id)` | Exists for generic event cards | Same as nursing, with generic labels from `InterestEventConfig` |

## Mapping Rules

### Sailing `RaceLogEntry` to `RaceLogEntryItem`

- `id`: `entry.id`
- `num`: two-digit ordinal within the season, oldest-to-newest inside each season group
- `name`: `entry.name`
- `dateLabel`: compact month/day from `entry.date`, or `Today` / `Saturday` for near dates
- `conditionsLabel`: wind direction/speed when present, else `venueName`, else `venueLocation`, else undefined
- `status`: `upcoming` maps to `planned`; past races with participant/result data map to `debriefed`; current-day upcoming maps to `current`; no v1 state maps to `in_progress` unless metadata explicitly says the debrief is pending
- `trailing`: captures count is unavailable in the current race-domain hook, so omit for v1; use `notStarted` for planned rows
- `conceptDots`: empty in v1; concept linkage remains a follow-up

### Timeline Step to Shift/Activity Entry

- `id`: `step.id`
- `num`: two-digit ordinal within the season group
- `name`: `step.title || "<Event noun>"`
- `dateLabel`: compact month/day from `starts_at`, `due_at`, `completed_at`, or `created_at`
- `conditionsLabel`: `location_name`, else `category`, else `metadata.plan.where_location`, else undefined
- `status`: `completed` -> `debriefed`, `in_progress` -> `current`, `pending` -> `planned`, `skipped` -> `planned`
- `trailing`: `completed` uses `captures` only if capture count is discoverable in metadata; `in_progress` uses `plan` copy from plan metadata when present; `pending`/`skipped` use `notStarted`
- `conceptDots`: empty in v1; concept linkage remains a follow-up

## Interest-Aware Filter Chips

The hook returns controlled chip objects but v1 filtering is local and simple:

- `all`: active by default, all mapped entries.
- `this-year`: filters entries whose source date falls in the current calendar year.
- `scope`: label is interest-aware. Sailing uses `"<boat class> · <venue/location>"` when available, else `Sail racing`. Nursing uses `Clinical · Nursing`. Other interests use `eventConfig.eventNoun`.
- `season-picker`: visible as a picker chip, initially non-interactive except for accessibility; a proper picker is a follow-up.

## Empty State

Use the already-designed empty state in `RaceLogScreen`: when `seasons.length === 0`, the component renders `IOSRegisterErrorState` with calm-pause chrome.

Copy needs to become interest-aware in Commit 3:

- Sailing: `No races yet` / `Add a race to start your season arc...`
- Nursing: `No shifts yet` / `Add a shift to start your clinical archive...`
- Generic: `No activities yet` / `Add an activity to start your archive...`

If interest-aware empty copy requires a component prop addition, Commit 3 owns that small presentational prop extension.

## ProfileIosPreview Audit

Profile has the same class of bug.

- `app/(tabs)/reflect.tsx` mounts `ProfileIosPreview` when `PROFILE_IOS_REGISTER` is on.
- `app/profile-ios.tsx` passes `SAMPLE_HERO`, `SAMPLE_INTERESTS`, `SAMPLE_IDENTITY`, `SAMPLE_PLAN`, and local preference toggles into `ProfileScreen`.
- `hooks/useReflectProfile.ts` exists and fetches real `profiles`, `sailor_profiles`, stats, boats, venues, and related account data, but the iOS-register Profile path does not consume it.

Decision: do not bundle Profile into the Race/Shift adapter commit. File a separate Profile real-data wiring work plan/spec set. Until then, Reflect Profile can render wrong persona/interest data the same way Race Log rendered sailing data while Nursing was active.

## Ship Sequence

1. Commit 1 — mappers: add pure Race/Shift mapping utilities and tests using `docs/redesign/specs/RACE_LOG_SHIFT_LOG_COMMIT_1_MAPPERS.md`.
2. Commit 2 — hook: add `useReflectLog()` to choose sailing race-domain data or timeline-step data by active interest using `docs/redesign/specs/RACE_LOG_SHIFT_LOG_COMMIT_2_DATA_HOOK.md`.
3. Commit 3 — Reflect wiring: replace `RaceLogIosPreview` in `app/(tabs)/reflect.tsx` with `RaceLogScreen` + `useReflectLog()` using `docs/redesign/specs/RACE_LOG_SHIFT_LOG_COMMIT_3_REFLECT_WIRING.md`.
4. Follow-up — Profile real-data wiring: replace `ProfileIosPreview` with `ProfileScreen` consuming real profile/account data. This is parallel debt identified by the audit, not required for the Race/Shift Log fix.

## Cutover Bar

Reflect Race/Shift Log is not complete until Commit 3 lands. The shipped visual cutover is considered a known limitation because it is sample-data-backed under the iOS-register flag.

