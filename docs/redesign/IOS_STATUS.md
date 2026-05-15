# iOS Register Migration — Status

Last updated: 2026-05-15, Get Inspired status-docs handoff.

## Dashboard

| Area | Status |
|---|---|
| Fully shipped cutovers | 5 surfaces: Playbook home, Race Prep cards, Race Log iOS, Profile iOS, Get Inspired running state |
| Previously known limitation | Resolved: Reflect production no longer mounts preview fixtures |
| Staged but not fully cut over | 2: Concept detail, Trophy |
| Designed but not staged | 7 Discover entries: parent shell + 6 leaf surfaces |
| Active top priority | Concept detail Commit 2 |

## Shipped

- Playbook home iOS — `ae0334fd`; banner follow-up `da8c4270`.
- Race Prep cards iOS — prep `b0a6e23b`, flag `da9e92a9`, components `a84c8b50`, render switch `01c6af34`, docs `6a86f4e8`.
- Canonical error state infrastructure — `5c3ab6a4`.
- Reflect Race Log/Profile real-data wiring — log adapter `a6031f1e`, Profile adapter `fed19b1a`, production wiring `50b9e9fc`.
- Get Inspired running state — staged `7c2dfeeb`, Playbook CTA `1e0c331b`, render switch `9580a317`, abort semantics `95c9a4aa`.

## Resolved Limitation

- Race Log iOS — staged `316c5486`, visual Reflect cutover `3d8b45dc`, layout fix `6b3fe596`.
- Profile iOS — staged `505de4e3`, visual Reflect cutover `3d8b45dc`.
- Original limitation: production Reflect mounted `RaceLogIosPreview` and `ProfileIosPreview`, so flag-on branches could show sample fixtures instead of real account/interest data.
- Resolution: production Reflect now mounts `RaceLogScreen` and `ProfileScreen` with real-data adapters. Preview routes remain fixture-backed for design review only.
- Follow-ups: filter persistence, season picker interactivity, Profile preference writeback, billing source, and richer non-sailing profile stat labels.

## Staged / Pending Cutover

- Concept detail — visual staging `a6c27c70`, route rename `06df3e87`, data migration `f02b2e0e`; read-path and variant-routing specs remain.
- Trophy of Becoming — `496d2481`; blocked as first-ship product/data work, not a render-switch migration.

## Designed / Not Staged

- Discover home shell.
- Discover Orgs list.
- Discover People list.
- Discover Forums list.
- Discover Org detail.
- Discover Person detail.
- Discover Topic detail.

Discover is blocked on the shared graph adapter before production cutover. Specs exist in `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_*.md` and six `DISCOVER_*_BUILD_SPEC.md` files.

## Next Action

Execute `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_2_READ_PATH.md`.

## Watch Items

- Race Log segment-key fix is shipped at `847e7855`.
- `STAGING_AUDIT.md` is stale about Profile pending; rely on `SESSION_STATE.md` and `CONSISTENCY_AUDIT.md` for current status.
- Do not mount `app/*-ios.tsx` preview wrappers in production tab screens.
