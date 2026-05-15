# Race Prep Cutover Commit Templates

## Commit 1 — Prep artifacts

```text
docs(redesign): add Race Prep cutover prep artifacts

- add docs/redesign/RACE_PREP_CUTOVER_CHECKLIST.md with pre-cutover gates,
  rollout sequence, verification matrix, rollback triggers, and post-cutover
  doc updates
- add docs/redesign/RACE_PREP_CUTOVER_PRECHECK.md with GO / NOT GO checks
  against the current codebase for beat mapping, feature flag pattern, preview
  routes, and modification targets
- add docs/redesign/design-briefs/profile-ios.md for the missing Reflect →
  Profile handoff
- add docs/redesign/design-briefs/get-inspired-ios-running-state.md for the
  missing Get Inspired running-state handoff
- add docs/redesign/snippets/step-id-vs-race-ios-followup.md with the open
  architecture question about /step/[id] vs /race/ios/[stepId]
- add docs/redesign/snippets/race-prep-cutover-commits.md with cutover commit
  templates for the Race Prep cards rollout

Refs: data-layer follow-up #7 (per-interest beat name mapping)
```

## Commit 2 — Feature flag added

```text
feat(redesign): add RACE_PREP_IOS_REGISTER feature flag (default ON)

Add FEATURE_FLAGS.RACE_PREP_IOS_REGISTER as the rollout gate for the
Race Prep cards/detail cutover.

- mirrors PLAYBOOK_IOS_REGISTER naming and env override behavior
- defaults ON for the canonical iOS-register path
- supports single-toggle rollback via EXPO_PUBLIC_FF_RACE_PREP_IOS_REGISTER=false

No render-path changes in this commit; follow-up commits wire the flag into
Race summary and detail entry points.
```

## Commit 3 — `RaceCardsScreen` component built

```text
feat(redesign): add RaceCardsScreen iOS summary surface

Add RaceCardsScreen as the iOS-register summary surface for Race Prep cards,
using the Claude Design Race Prep cards iOS handoff as the visual source.

- implements the four-state card grammar (planned / in progress / debriefed /
  current)
- applies the earned-exception treatment to the current card only
- preserves the horizontal timeline-grid layout contract
- routes card tap-through to /race/ios/[stepId] so summary and detail stay in
  the same register family

This commit adds the new surface only; no canonical render switch yet.
```

## Commit 4 — Render switch in `races.tsx`

```text
feat(redesign): cut Race Prep cards over to iOS register (flag default ON)

Gate the Race Prep summary-surface cutover behind
FEATURE_FLAGS.RACE_PREP_IOS_REGISTER.

- flag ON: races.tsx renders RaceCardsScreen for the Race Prep card path
- flag OFF: races.tsx keeps the existing CardGrid path unchanged
- scope is intentionally narrower than the Playbook home cutover: this replaces
  CardGrid only, not the full Race tab body
- TimelineGridView, IOSRacesScreen, season pickers, and other race surfaces
  stay legacy in both flag states
- deep links and preview routes continue to resolve to /race/ios/[stepId]

Revert is a single flag flip if production regressions surface.
```

## Commit 5 — Migration plan updates

```text
docs(redesign): mark Race Prep cutover shipped + add /step/[id] follow-up

Update the migration artifacts after the Race Prep cards cutover lands.

- mark Race Prep cutover shipped in docs/redesign/IOS_MIGRATION_PLAN.json
- update docs/redesign/IOS_STATUS.md to show 2/12 surfaces cut over
- update docs/redesign/IOS_SURFACE_INVENTORY.json canonical status fields for
  the Race Prep surfaces
- remove Race Prep from the blocked-cutover list in the migration plan
- add the /step/[id] vs /race/ios/[stepId] detail-surface split as open
  architecture follow-up #11

The new follow-up captures the remaining question after cards cut over:
whether /step/[id] also migrates to a full iOS-register detail surface,
stays legacy as a power-user mode, or coexists until production usage clarifies
which path matters.
```
