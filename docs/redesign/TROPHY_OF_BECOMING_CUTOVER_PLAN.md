# Trophy of Becoming iOS First-Ship Plan

## Pre-cutover gates

- [ ] `app/trophy-ios.tsx` exists and is visually verified in simulator at `/trophy-ios`
- [ ] `FEATURE_FLAGS.TROPHY_IOS_REGISTER` exists in `lib/featureFlags.ts`
- [ ] `TrophyScreen` is exported from `components/ios-register/index.ts`
- [ ] Path-completion trophy data source exists
- [ ] Trophy query/API/hook exists and returns the fields needed by `TrophyScreen`
- [ ] Canonical production entry point is chosen; no production route currently renders Trophy of Becoming
- [ ] Current repo-state checks remain clean:
  `npm run typecheck` and targeted ESLint on `app/trophy-ios.tsx`, `components/ios-register/TrophyScreen.tsx`, `lib/featureFlags.ts`, and the eventual mounting file

## Cutover sequence

- [ ] Treat this as a first ship, not a register migration
- [ ] Use `FEATURE_FLAGS.TROPHY_IOS_REGISTER` as the gate
- [ ] Flag ON:
  render `TrophyScreen` from real path-completion trophy data
- [ ] Flag OFF:
  hide or omit the new Trophy entry point; there is no previous Trophy of Becoming production render path to restore
- [ ] Keep `/trophy-ios` preview behavior intact, including `?variant=` review controls if the route remains preview-only

## Earned-register exception analysis

Decision source in `IOS_MIGRATION_PLAN.md`: the earned exception rule says to size up only when `(a)` the action is irreversible-or-near-irreversible without re-entry and `(b)` the surface's primary purpose is that decision. It also says not to size up to draw attention; size up to acknowledge stakes.

Repo-state interaction model:

- `TrophyScreen` carries no mutating action.
- Trophy-confer happens upstream in reflection/path-completion synthesis, not inside this surface.
- Variant-specific offers are not present as commit-time actions in `TrophyScreen`.
- The screen is a read-only artifact display: quote, attribution, coral rule, capability/context, optional carousel navigation, or empty state.

Recommendation: confirmed standard density. No new earned-register weight-up should be applied for the Trophy cutover.

The existing italic title remains the canonical Trophy register's already-baked exception because it renders literal user voice, not interactive chrome. That is not a new variant-specific weight-up.

## Variant routing

Current preview variants:

- `first`: first trophy ever; above-title first-trophy eyebrow
- `canonical`: standard earned trophy with capability and context
- `mid-career`: earned trophy with carousel context and previous affordance
- `named-absence`: earned stop/absence trophy with "What you stopped doing" capability label
- `empty`: no earned trophy yet

Data-layer routing proposal:

- `hasTrophy === false` or missing trophy record → `empty`
- `trophy.sequence_index === 1` → `first`
- `trophy.kind === "named_absence"` or equivalent stop/absence classifier → `named-absence`
- `trophy.series_total > 1 && trophy.sequence_index > 1` → `mid-career`
- otherwise → `canonical`

Fallback:

- Missing or unexpected state should render `canonical` only when a filled trophy record has quote/capability/context data.
- Missing filled-trophy data should render `empty` rather than an incomplete commemorative artifact.

## Mounting screen

Confirmed preview route: `app/trophy-ios.tsx`.

Canonical mounting screen is not confidently identifiable from current repo state. `IOS_MIGRATION_PLAN.md` describes Trophy as a fresh-build path-completion synthesis artifact at `/trophy-ios`, but grep found no production tab route or existing path-completion screen that mounts it. The current route appears preview-only and listed from `/dev/ios-previews`.

Pattern deviation: Trophy refactored an existing `app/trophy-ios.tsx` route rather than creating a new file. This does not violate build-only discipline as long as `/trophy-ios` is not production traffic.

## Canonical mount (resolved)

Resolution: blocked on data, and the eventual cutover is a first ship.

Repo investigation found no production Trophy of Becoming render path. Matches for "Trophy of Becoming" and `TrophyScreen` are limited to redesign docs, `app/trophy-ios.tsx`, `/dev/ios-previews`, `components/ios-register/TrophyScreen.tsx`, and feature-flag comments. Other "trophy" matches are unrelated achievement badges, race result icons, club scoring, or sailor-profile trophy cases.

Repo investigation also found no `trophy_of_becoming` table, type, service, hook, query, or API endpoint. The only product-level data reference is prose: `IOS_MIGRATION_PLAN.md` calls Trophy a fresh-build placeholder with "path-completion synthesis service deferred", and `app/trophy-ios.tsx` says real data would come from a service that does not exist yet.

Cutover implication:

- This is not a register migration because there is no old production Trophy of Becoming surface to replace.
- The surface cannot ship as production UI until the path-completion trophy data layer exists.
- The future ship commit should create or expose the production entry point for the first time, gated by `TROPHY_IOS_REGISTER`.

## Verification matrix

- [ ] `/trophy-ios?variant=first` renders first-trophy state
- [ ] `/trophy-ios?variant=canonical` renders canonical state
- [ ] `/trophy-ios?variant=mid-career` renders carousel context
- [ ] `/trophy-ios?variant=named-absence` renders stop/absence copy
- [ ] `/trophy-ios?variant=empty` renders empty state
- [ ] Unknown `?variant=` falls back to `canonical` in preview mode
- [ ] Production data with missing filled-trophy content falls back to `empty`
- [ ] Flag OFF hides or omits the new Trophy entry point
- [ ] No preview-only variant chips or close-X chrome leak into a canonical mount

## Rollback triggers

- [ ] Roll back immediately if the new Trophy entry point appears without real trophy data
- [ ] Roll back immediately if incomplete trophy data renders as a broken filled artifact
- [ ] Roll back immediately if preview controls appear in a canonical surface
- [ ] Roll back immediately if the flag cannot hide or omit the new production entry point

## Post-cutover documentation updates

- [ ] Update `docs/redesign/IOS_MIGRATION_PLAN.md` to mark Trophy of Becoming cutover shipped and reference the render-switch commit
- [ ] Update `docs/redesign/IOS_SURFACE_INVENTORY.json` so `trophy-of-becoming-ios` flips from `canonical_status: "staged"` to `canonical_status: "shipped"`
- [ ] Update cross-cutting compliance if the synthesis-loading or synthesis-error paths are designed or explicitly deferred as data-layer follow-ups
- [ ] Capture any path-completion synthesis service follow-up separately from the visual cutover

## Open questions for human review

- Confirm the first production entry point for Trophy once path-completion synthesis exists.
- Confirm whether `empty` is considered a fifth state variant or an out-of-band absence state. Current code treats it as a selectable variant.
- Confirm the final trophy data model field names for sequence index, series total, named-absence classification, quote, attribution, capability label, and context spans.
