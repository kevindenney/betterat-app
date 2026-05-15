# iOS Register Staging Audit

> **Superseded 2026-05-15 mid-session.** This audit predates the discovery that Profile has the same preview-component-in-production leak as Race Log. Current truth lives in:
> - `SESSION_STATE.md` for the complete state-of-migration snapshot
> - `REFLECT_DATA_WIRING_WORK.md` for the resolution plan
> - `CONSISTENCY_AUDIT.md` for the cross-reference status
>
> This document is kept for historical reference only. Do not use it as current truth.

## Discrepancies

- Profile iOS is still pending in the current repo state: no `app/profile-ios.tsx`, no `PROFILE_IOS_REGISTER`, and no Profile component under `components/ios-register/`. Reflect cutover preconditions are therefore not met.
- Concept detail was staged in commit `a6c27c70` as `app/concept-variants-ios.tsx`, but the current working tree has a staged rename to `app/concept-detail-ios.tsx`. The audit uses the current working tree route.
- Trophy docs and comments say "4 state variants" while the current component and route expose five selectable states: `first`, `canonical`, `mid-career`, `named-absence`, and `empty`. Treat `empty` as a state variant during cutover planning unless design clarifies otherwise.
- `docs/redesign/IOS_SURFACE_INVENTORY.json` currently lists Concept detail variants as a separate surface-like entry. Inventory should track the Concept detail surface once, with variants attached to that surface.

## Verification Summary

| Check | Result |
|---|---|
| `npm run typecheck` | Passes against current working tree |
| Targeted ESLint | Passes with `--max-warnings 0` for staged surface files |
| Exact tab render-switch grep | Zero references to the five new flags or new iOS-register surface components in `app/(tabs)/*.tsx` |
| Presentational-only check | Built components under `components/ios-register/` have no router calls, data fetching, Supabase calls, React Query calls, or API client calls |
| Reflect cutover preconditions | Not met: Race Log is staged; Profile is not staged |

Exact render-switch grep covered:

```text
RACE_LOG_IOS_REGISTER
PROFILE_IOS_REGISTER
GET_INSPIRED_IOS_REGISTER
TROPHY_IOS_REGISTER
CONCEPT_IOS_REGISTER
RaceLogScreen
LoadingNarration
TrophyScreen
ConceptDetailScreen
```

The only broad grep hit in `app/(tabs)` was the legacy `PlaybookConceptDetailScreen` function name, not a new flag, import, or component render.

## Race Log iOS

Status: clean build-only.

- Components present: `components/ios-register/RaceLogScreen.tsx` at 746 lines, exported from `components/ios-register/index.ts`.
- Presentational-only: confirmed. No router ownership, data fetching, Supabase calls, React Query calls, or API clients inside `RaceLogScreen`.
- Feature flag: `FEATURE_FLAGS.RACE_LOG_IOS_REGISTER` in `lib/featureFlags.ts`, default `true`, env override `EXPO_PUBLIC_FF_RACE_LOG_IOS_REGISTER=false`.
- Naming convention: matches `<SURFACE>_IOS_REGISTER`.
- Preview route: `app/race-log-ios.tsx` at 225 lines, flat under `app/`, imports `RaceLogScreen`, reachable at `/race-log-ios`.
- Render switch absence: no references to `RACE_LOG_IOS_REGISTER` or `RaceLogScreen` in `app/(tabs)/*.tsx`.
- Lint status: targeted ESLint clean with `--max-warnings 0`.
- Commit reference: `316c5486` — `feat(redesign): stage Race Log iOS register surface (component + flag + preview)`.
- Pattern deviations: none.

## Profile iOS

Status: pending.

- Components present: none found under `components/ios-register/`.
- Feature flag: `PROFILE_IOS_REGISTER` is missing from `lib/featureFlags.ts`.
- Preview route: `app/profile-ios.tsx` is missing.
- Render switch absence: no references to `PROFILE_IOS_REGISTER` or a Profile iOS register component in `app/(tabs)/*.tsx`.
- Typecheck/lint status: not applicable to missing files.
- Commit reference: none found in current repo state.
- Pattern deviations: missing build-only staging. Reflect cutover cannot execute until this lands.

## Get Inspired iOS Running State

Status: clean build-only.

- Components present: `components/ios-register/LoadingNarration.tsx` at 315 lines, exported from `components/ios-register/index.ts`.
- Presentational-only: confirmed. `LoadingNarration` has no router ownership, data fetching, Supabase calls, React Query calls, or API clients.
- Feature flag: `FEATURE_FLAGS.GET_INSPIRED_IOS_REGISTER` in `lib/featureFlags.ts`, default `true`, env override `EXPO_PUBLIC_FF_GET_INSPIRED_IOS_REGISTER=false`.
- Naming convention: matches the surface-specific `<SURFACE>_IOS_REGISTER` pattern.
- Preview route: `app/get-inspired-ios-running.tsx` at 364 lines, flat under `app/`, imports `LoadingNarration`, reachable at `/get-inspired-ios-running`.
- Render switch absence: no references to `GET_INSPIRED_IOS_REGISTER` or `LoadingNarration` in `app/(tabs)/*.tsx`.
- Lint status: targeted ESLint clean with `--max-warnings 0`.
- Commit reference: `7c2dfeeb` — `feat(redesign): stage Get Inspired running state (canonical loading narration)`.
- Pattern deviations: route name includes the state (`get-inspired-ios-running`) because this build ships the running state only, not the full modal cutover.

## Trophy of Becoming iOS

Status: clean build-only, with one documented preview-route deviation.

- Components present: `components/ios-register/TrophyScreen.tsx` at 383 lines, exported from `components/ios-register/index.ts`.
- Presentational-only: confirmed. No router ownership, data fetching, Supabase calls, React Query calls, or API clients inside `TrophyScreen`.
- Feature flag: `FEATURE_FLAGS.TROPHY_IOS_REGISTER` in `lib/featureFlags.ts`, default `true`, env override `EXPO_PUBLIC_FF_TROPHY_IOS_REGISTER=false`.
- Naming convention: surface-specific and correctly scoped. It intentionally uses `TROPHY_IOS_REGISTER`, not `TROPHY_OF_BECOMING_IOS_REGISTER`.
- Preview route: `app/trophy-ios.tsx` at 224 lines, flat under `app/`, imports `TrophyScreen`, reachable at `/trophy-ios`.
- Render switch absence: no references to `TROPHY_IOS_REGISTER` or `TrophyScreen` in `app/(tabs)/*.tsx`.
- Lint status: targeted ESLint clean with `--max-warnings 0`.
- Commit reference: `496d2481` — `feat(redesign): stage Trophy of Becoming iOS variants (4 states)`.
- Pattern deviations: `496d2481` refactored the existing `app/trophy-ios.tsx` preview route rather than creating a new route. This is acceptable because the route remains preview-only; it does not wire a tab render switch.

## Concept Detail iOS

Status: clean build-only in the current working tree, with staged route rename and inventory cleanup needed.

- Components present: `components/ios-register/ConceptDetailScreen.tsx` at 789 lines, exported from `components/ios-register/index.ts`.
- Presentational-only: confirmed. No router ownership, data fetching, Supabase calls, React Query calls, or API clients inside `ConceptDetailScreen`.
- Feature flag: `FEATURE_FLAGS.CONCEPT_IOS_REGISTER` in `lib/featureFlags.ts`, default `true`, env override `EXPO_PUBLIC_FF_CONCEPT_IOS_REGISTER=false`.
- Naming convention: surface-specific and correctly scoped. It intentionally uses `CONCEPT_IOS_REGISTER` for Concept detail.
- Preview route: current working tree has `app/concept-detail-ios.tsx` at 258 lines, flat under `app/`, imports `ConceptDetailScreen`, reachable at `/concept-detail-ios`.
- Canonical data route: `app/concept-ios/[slug].tsx` remains separate and data-wired; it has not been switched to `ConceptDetailScreen`.
- Render switch absence: no references to `CONCEPT_IOS_REGISTER` or `ConceptDetailScreen` in `app/(tabs)/*.tsx`.
- Lint status: targeted ESLint clean with `--max-warnings 0`.
- Commit reference: component + flag + original preview landed in `a6c27c70` — `feat(redesign): stage Concept detail iOS variants (new / dormant / breakthrough)`.
- Pattern deviations: `a6c27c70` landed as `app/concept-variants-ios.tsx`; the current working tree has a staged rename to `app/concept-detail-ios.tsx`. That makes the final route naming align with the flat `app/<surface>-ios.tsx` pattern, but the commit history still shows the original route name.

## Commit References

| Surface | Build-only commit | Notes |
|---|---:|---|
| Race Log iOS | `316c5486` | Component + flag + preview route |
| Profile iOS | pending | No staged code in current repo state |
| Get Inspired iOS running state | `7c2dfeeb` | Component + flag + preview route; canonical Principle #1 reference |
| Trophy of Becoming iOS | `496d2481` | Component + flag + existing preview-route refactor |
| Concept detail iOS | `a6c27c70` | Component + flag + preview route; current working tree renames route to `app/concept-detail-ios.tsx` |

No explicit `--no-verify` use is recorded in these commit messages. Git history alone cannot prove whether a local hook was bypassed unless the committer recorded it.

## Status Summary

Four of five surfaces are clean build-only: Race Log, Get Inspired running, Trophy of Becoming, and Concept detail. One surface is still pending: Profile iOS.

Highest-priority remediation: land Profile iOS as a build-only commit with `components/ios-register/` component(s), `PROFILE_IOS_REGISTER`, and `app/profile-ios.tsx`. Until that lands, Reflect cutover preconditions are not met.
