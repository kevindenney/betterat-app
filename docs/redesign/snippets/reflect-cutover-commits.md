# Reflect Cutover Commit Templates

## Commit 1 — Render switch in `reflect.tsx`

```text
feat(redesign): cut Race Log iOS and Profile iOS over inside Reflect (flags default ON)

Gate the Reflect tab's Race Log and Profile segments behind
FEATURE_FLAGS.RACE_LOG_IOS_REGISTER and FEATURE_FLAGS.PROFILE_IOS_REGISTER.

- flag ON: reflect.tsx renders the embedded iOS-register Race Log surface
  for the Race Log segment and the embedded iOS-register Profile surface
  for the Profile segment
- flag OFF: reflect.tsx keeps the existing RaceLogView and ProfileView
  render paths unchanged
- scope is intentionally narrower than a full Reflect-home cutover: the
  Progress segment and the /reflect-ios preview route stay as-is in this
  commit
- preview routes continue to resolve independently of canonical flag state

Revert is a pair of env flag flips if production regressions surface.
```

## Commit 2 — Migration plan updates

```text
docs(redesign): mark Race Log/Profile Reflect cutover shipped + clear blockers

Update the migration artifacts after the Reflect cutover lands.

- mark the shared Reflect render-switch cutover shipped in docs/redesign/IOS_MIGRATION_PLAN.json
- update docs/redesign/IOS_STATUS.md to reflect the revised surface-counting
  rule; if reflect-home-ios stays parked, Race Log iOS + Profile iOS move the
  shipped count to 4/15
- update docs/redesign/IOS_SURFACE_INVENTORY.json canonical status fields for
  race-log-ios and profile-ios as the two first-class surfaces that shipped
  in this cutover, and update reflect-home-ios separately if that root
  surface also crosses the shipment bar
- strike Race Log iOS and Profile iOS from the blocked-handoff table in
  docs/redesign/IOS_MIGRATION_PLAN.md
- capture any remaining Reflect-specific follow-up, especially whether
  reflection-usage tracking remains open post-cutover

The cutover resolves the visual handoff blockers for the Race Log iOS and
Profile iOS surfaces. Any remaining work after this commit should be framed
as follow-up implementation or data wiring, not as missing canonical design.
```
