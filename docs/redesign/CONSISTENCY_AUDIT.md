# iOS Register Consistency Audit

Snapshot: 2026-05-15, HEAD `a6031f1e`.

Scope: cutover plans, work plans, spec docs, inventory entries, migration/status docs, and git history references. This is an audit only; proposed reconciliations are listed but not applied here unless another task explicitly requests them.

## Summary

| Category | Count |
|---|---:|
| Inventory surfaces checked | 24 |
| Commit references spot-checked in active docs | 29 |
| Missing git commits among active references | 0 |
| Direct plan/spec/work-plan cross-references checked | 43 |
| High-priority inconsistencies | 4 |
| Medium-priority inconsistencies | 5 |
| Low-priority / intentional export-target references | 2 |

## High-Priority Inconsistencies

### 1. `STAGING_AUDIT.md` is stale about Profile iOS

Finding: `docs/redesign/STAGING_AUDIT.md` says Profile iOS is pending and Reflect preconditions are not met. Git history now has `505de4e3`, and Reflect visual cutover `3d8b45dc` shipped Profile iOS behind `PROFILE_IOS_REGISTER`.

Evidence:

- `505de4e3` exists: `feat(redesign): stage Profile iOS register surface (component + flag + preview)`.
- `IOS_SURFACE_INVENTORY.json` lists `profile-ios` as `canonical_status: "shipped-with-known-limitation"`.
- `REFLECT_DATA_WIRING_WORK.md` correctly says Profile has the same preview-wrapper bug as Race Log.

Proposed reconciliation: update or supersede `STAGING_AUDIT.md` with a "superseded by SESSION_STATE.md" note, or produce a new staging audit revision. Do not use its Profile section as current truth.

### 2. `DATA_LAYER_DEPENDENCIES.md` still contains stale Profile wording

Finding: the top discrepancy says Profile was pending in current repo state and build-only hash was pending. That was true when written, but is false now.

Evidence:

- Current git has `505de4e3`.
- Inventory has Profile staged and visually cut over.
- `REFLECT_DATA_WIRING_WORK.md` has the current and correct Profile assessment.

Proposed reconciliation: update `DATA_LAYER_DEPENDENCIES.md` Profile discrepancy block to say Profile is staged/cut over visually but blocked on real-data wiring.

### 3. Race Log segment-key fix is uncommitted but has been discussed as fixed

Finding: `configs/sailing.ts` has an uncommitted change from `race_log` to `racelog`. There is no commit hash for this fix in git history.

Evidence:

- `git diff -- configs/sailing.ts` shows only this change.
- `git log -- configs/sailing.ts` does not show a 2026-05-15 Race Log segment-key fix commit.

Proposed reconciliation: either commit this as a narrow fix or roll it into Reflect data-wiring Commit 3 if the spec allows. Until then, docs should call it a working-tree fix, not shipped.

### 4. Reflect visual status conflicts with real-data readiness unless wording is precise

Finding: inventory correctly says Race Log/Profile are `shipped-with-known-limitation`, but older docs and status language can be read as "shipped" without qualification.

Evidence:

- `IOS_SURFACE_INVENTORY.json` has the correct `shipped-with-known-limitation` status.
- `IOS_STATUS.md` before this audit said "4/15 surfaces cut over" and then listed Race Log/Profile without dashboard-level limitation severity.
- `REFLECT_DATA_WIRING_WORK.md` is the correct remediation source.

Proposed reconciliation: status dashboards should say "visual cutover shipped; real-data wiring pending." Do not mark Race Log/Profile fully shipped until Reflect data-wiring Commit 4 lands.

## Medium-Priority Inconsistencies

### 5. Duplicate Reflect/Race Log data-wiring spec families

Finding: both `RACE_LOG_SHIFT_LOG_*` specs and `REFLECT_DATA_WIRING_*` specs exist. The Reflect set is newer and includes Profile; the Race Log/Shift Log set appears superseded.

Evidence:

- `docs/redesign/RACE_LOG_SHIFT_LOG_DATA_LAYER_WORK.md`
- `docs/redesign/specs/RACE_LOG_SHIFT_LOG_COMMIT_1_MAPPERS.md`
- `docs/redesign/specs/RACE_LOG_SHIFT_LOG_COMMIT_2_DATA_HOOK.md`
- `docs/redesign/specs/RACE_LOG_SHIFT_LOG_COMMIT_3_REFLECT_WIRING.md`
- `docs/redesign/REFLECT_DATA_WIRING_WORK.md`
- `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_1_LOG_ADAPTER.md` through `_4_STATUS_DOCS.md`

Proposed reconciliation: mark the Race Log/Shift Log set superseded by Reflect data wiring, or archive it after Reflect Commits 2-4 land.

### 6. Concept detail data-layer plan does not mention Commit 1 is already executed

Finding: `CONCEPT_DETAIL_DATA_LAYER_WORK.md` still lists Commit 1 as a ship-sequence item, but git has `f02b2e0e`.

Evidence:

- `f02b2e0e` exists and created `supabase/migrations/20260515120000_create_playbook_concept_user_state.sql`.
- The work plan still says "Commit 1 — migration: create..." without "done".

Proposed reconciliation: update the work plan to mark Commit 1 done and make Commit 2 the next action.

### 7. Reflect data-wiring work plan does not mention Commit 1 is already executed

Finding: `REFLECT_DATA_WIRING_WORK.md` lists Commit 1 as pending, but HEAD is `a6031f1e`.

Evidence:

- `a6031f1e` created `hooks/useReflectLog.ts`, `services/ReflectLogService.ts`, `lib/reflect/mapReflectLog.ts`, and tests.

Proposed reconciliation: update the ship sequence to mark Commit 1 done and Commit 2 next. This should happen in Reflect data-wiring Commit 4 or a small status-doc pass.

### 8. `IOS_SURFACE_INVENTORY.json` omits `preview_route` on Race Log

Finding: Race Log has route `/race-log-ios` and preview-status shipped, but unlike Profile it has no explicit `preview_route` field.

Evidence:

- `profile-ios` has `"preview_route": "/profile-ios"`.
- `race-log-ios` has `"route": "/race-log-ios"` but no `preview_route`.

Proposed reconciliation: add `"preview_route": "/race-log-ios"` for consistency.

### 9. Trophy variant count differs across docs

Finding: prompts and some docs say four Trophy variants; inventory and component state include five, including `empty`.

Evidence:

- `IOS_SURFACE_INVENTORY.json` lists `first`, `canonical`, `mid-career`, `named-absence`, `empty`.
- `STAGING_AUDIT.md` already flags the mismatch.

Proposed reconciliation: standardize on "4 trophy states plus empty" or "5 variants including empty" across cutover docs.

## Low-Priority / Intentional References

### 10. `EXPORT_MANIFEST.json` points to missing `docs/redesign/ios-register/*` paths

Finding: those directories do not exist.

Interpretation: intentional. The manifest is an export plan, and the task explicitly said not to create `docs/redesign/ios-register/`.

No reconciliation needed unless exports begin.

### 11. Wildcard references are not resolvable by simple link checks

Finding: docs include references such as `docs/redesign/specs/DISCOVER_*_BUILD_SPEC.md` and `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_*.md`.

Interpretation: acceptable shorthand. The matching files exist.

No reconciliation needed.

## Surface-by-Surface Cross-Check

| Surface | Inventory status | Plan/work-plan verdict | Git reference check | Cross-reference result |
|---|---|---|---|---|
| Playbook home iOS | `shipped` | Shipped precedent in `CUTOVER_PATTERN.md` | `ae0334fd` exists | Clean |
| Race Prep cards iOS | `shipped` | Shipped in migration plan | `01c6af34`, `6a86f4e8` exist | Clean |
| Race Prep detail iOS | `routed-from-cards` / preview shipped | Detail surface remains separate from cards | Historical preview commits exist | Clean enough; not a current cutover target |
| Race Log iOS | `shipped-with-known-limitation` | Reflect data-wiring plan says blocked until preview wrapper removed | `316c5486`, `3d8b45dc`, `a6031f1e` exist | Needs status wording precision |
| Profile iOS | `shipped-with-known-limitation` | Reflect data-wiring plan says same bug as Race Log | `505de4e3`, `3d8b45dc` exist | Clean in current docs except stale audits |
| Get Inspired iOS | `staged` | Cutover plan says specs ready, no data blocker | `7c2dfeeb`, `5c3ab6a4` exist | Clean |
| Trophy of Becoming iOS | `staged` | Plan/data deps say blocked first-ship | `496d2481` exists | Variant-count wording needs standardization |
| Concept detail iOS | `staged` | Data work plan says ready after Commits 1-3; Commit 1 now done | `a6c27c70`, `06df3e87`, `f02b2e0e` exist | Needs "Commit 1 done" update |
| Reflect home iOS | `parked` | Migration plan says root Reflect preview remains parked | Historical preview commit exists | Clean |
| Discover home shell | `designed` | Architecture says atomic tab cutover after graph adapter and leaf builds | docs/specs exist | Clean |
| Discover Orgs list | `designed` | Build spec exists; graph adapter dependency exists | no build commit expected yet | Clean |
| Discover People list | `designed` | Build spec exists; graph adapter dependency exists | no build commit expected yet | Clean |
| Discover Forums list | `designed` | Build spec exists; graph adapter dependency exists | no build commit expected yet | Clean |
| Discover Org detail | `designed` | Build spec exists; graph adapter dependency exists | no build commit expected yet | Clean |
| Discover Person detail | `designed` | Build spec exists; graph adapter dependency exists | no build commit expected yet | Clean |
| Discover Topic detail | `designed` | Build spec exists; graph adapter dependency exists | no build commit expected yet | Clean |
| Error state iOS | `infrastructure` | Cross-cutting Principle #2 canonical component | `5c3ab6a4` exists | Clean |
| On the Water iOS | `pending` | Historical preview; not current cutover plan | historical preview commit exists | Clean for current scope |
| Debrief iOS | `pending` | Historical preview; not current cutover plan | historical preview commit exists | Clean for current scope |
| Discover Paths iOS | `parked` | Predecessor surface, not the six-surface Discover cutover | historical preview commit exists | Clean |
| Step transition hinge iOS | `pending` | Historical preview; not current cutover plan | historical preview commit exists | Clean |
| Auth Welcome iOS | `pending` | Historical preview; not current cutover plan | historical preview commit exists | Clean |
| Competency Assessment iOS | `pending` | Faculty surface precedent; not current cutover plan | `c9e9bfef` exists | Clean |

## Highest-Priority Reconciliation

Finish Reflect data wiring before any broad status cleanup. The highest operational inconsistency is not just documentation: production Reflect visually shipped while still consuming preview fixtures. The docs now acknowledge it, but the user-visible behavior remains wrong until `REFLECT_DATA_WIRING_COMMIT_2_PROFILE_ADAPTER.md`, `_3_REFLECT_WIRING.md`, and `_4_STATUS_DOCS.md` land.
