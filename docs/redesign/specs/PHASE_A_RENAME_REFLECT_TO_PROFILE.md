# Phase A Spec: Rename Bottom Reflect Tab to Profile

## Goal

Rename the bottom navigation destination currently labeled **Reflect** to **Profile**, matching `docs/redesign/PRACTICE_TIMELINE_CANONICAL.md`. This is a label/icon rename only. The existing route file remains `app/(tabs)/reflect.tsx`, and the screen continues to render the existing Reflect/Profile/Race Log content until the later Profile capability-map work lands.

Verified canonical source: `docs/redesign/PRACTICE_TIMELINE_CANONICAL.md` landed on `origin/main` in `41f324c5`.

## Verified Current State

- Route exists: `app/(tabs)/reflect.tsx`.
- Tab route name is `reflect`, configured in `app/(tabs)/_layout.tsx`.
- Sailor tab config lives in `lib/navigation-config.ts`.
- Current bottom-tab label source: `lib/navigation-config.ts` has `{ name: 'reflect', title: 'Reflect', icon: 'stats-chart-outline', iconFocused: 'stats-chart' }` in both sailor branches.
- Current drawer/sidebar item: `SAILOR_NAV_ITEMS` has `{ key: 'reflect', label: 'Reflect', route: '/(tabs)/reflect', icon: 'stats-chart-outline' }`.
- Current tab-sweep metadata: `app/(tabs)/_layout.tsx` has `reflect: { label: 'Reflect', icon: 'stats-chart-outline' }` and copy describing race history/progress.
- Current tab fallback title/icon: `app/(tabs)/_layout.tsx` uses fallback strings/icons `Reflect`, `stats-chart-outline`, and `stats-chart`.
- Grep found no explicit `reflect_tab` analytics event name. The `reflect` route key appears in onboarding/tab-sweep state and routing, not analytics.

## Files To Change

1. `lib/navigation-config.ts`
2. `app/(tabs)/_layout.tsx`

## Files Not To Change

- Do not rename `app/(tabs)/reflect.tsx`.
- Do not rename the `reflect` route key, `Tabs.Screen name="reflect"`, or route path `/(tabs)/reflect`.
- Do not modify `app/(tabs)/reflect.tsx` screen content or sub-segments.
- Do not rename `hooks/useReflectData`, `hooks/useReflectProfile`, `hooks/useReflectLog`, `lib/reflect/*`, or tests under `lib/reflect/__tests__/`; those names describe implementation/data domains, not the bottom tab label.
- Do not update `components/ios-register/ProfileScreen.tsx` section labels in this phase.

## Step-By-Step Changes

In `lib/navigation-config.ts`:

- In both sailor tab arrays, change `title: 'Reflect'` to `title: 'Profile'` for the tab whose `name` is `reflect`.
- Change that tab's icon fields from chart language to the selected Profile icon:
  - current: `icon: 'stats-chart-outline'`, `iconFocused: 'stats-chart'`
  - proposed selected option pending human choice below.
- In `SAILOR_NAV_ITEMS`, change `label: 'Reflect'` to `label: 'Profile'` for `key: 'reflect'`, preserving `route: '/(tabs)/reflect'`.
- Update the `SAILOR_NAV_ITEMS` icon to match the selected bottom-tab icon.

In `app/(tabs)/_layout.tsx`:

- Change `TAB_SWEEP_META.reflect.label` from `Reflect` to `Profile`.
- Change `TAB_SWEEP_META.reflect.icon` from `stats-chart-outline` to the selected Profile icon.
- Update `TAB_SWEEP_CONTEXT_COPY.reflect.description` from progress/race-history copy to Profile copy, e.g. `View your capability map, evidence, and shareable record.`
- Update `TAB_SWEEP_CONTEXT_COPY.reflect.emptyHint` from race-history copy to Profile copy, e.g. `Your Profile fills in as Practice steps produce evidence.`
- Keep `TAB_SWEEP_REQUIRED_TABS = ['discover', 'reflect']`; this is a route-key list, not a displayed label list.
- Keep `TAB_SWEEP_ROUTE_MAP.reflect = '/reflect'`.
- Update the `Tabs.Screen name="reflect"` fallback title from `Reflect` to `Profile`.
- Update icon fallbacks from `stats-chart-outline` / `stats-chart` to the selected Profile icon pair.
- Update nearby comments from `Tab 5: Reflect (Progress/Stats)` to `Tab 5: Profile (capability record)` or equivalent.

## Icon Options

Pick one before execution:

- `person-circle-outline` / `person-circle`: strongest match for a Profile destination; familiar iOS metaphor; slightly generic.
- `ribbon-outline` / `ribbon`: emphasizes credential/capability record; better aligned with the canonical's "outward credential" framing; less obviously "profile" at first glance.
- `id-card-outline` / `id-card`: strongest credential metaphor if available in the installed Ionicons glyph set; execution must verify glyph availability before use.

Recommendation: use `person-circle-outline` / `person-circle` for v1 because it is legible in a bottom tab and less likely to be mistaken for achievements.

## Test Impact Assessment

Grep found no tab-label tests referencing `Reflect`. Existing tests under `lib/reflect/__tests__/` are mapper tests for Reflect data adapters and should not change. If snapshot tests exist in CI outside the grep scope, expected updates are text/icon snapshots only.

Suggested verification:

- `npx eslint lib/navigation-config.ts 'app/(tabs)/_layout.tsx' --max-warnings 0`
- `npm run typecheck`
- Simulator: bottom tab still navigates to the same screen, now labeled `Profile`.

## Analytics Impact Assessment

No `reflect_tab` analytics event names were found. Keep route keys and historical event/dataset names as `reflect` if any downstream analytics are discovered during execution; alias new display copy only. Do not backfill or rename historical analytics streams in this phase.

## Rollback Path

Revert the commit. No data migration, route rename, or feature flag is involved.

## Cutover Flag

No cutover flag is recommended. This phase is a mechanical label/icon rename with no behavioral change and no alternate render path.
