# iOS Register Migration — Session State

Snapshot taken mid-session on 2026-05-15 after commit `a6031f1e`.

This is a working-state document, not an end-of-day recap. It is intended to let a human or another agent pick up the next three hours without replaying the full chat.

## Current Headline

The migration is in a high-throughput but high-complexity state:

- Playbook home and Race Prep cards are fully cut over.
- Reflect visually cut over Race Log and Profile, but both flag-on branches shipped with preview-fixture wrappers. That is a known limitation, not hidden debt.
- Reflect data-wiring Commit 1 has now landed: the real-data log adapter exists and is not yet consumed.
- Five major spec sets are ready enough to execute: Concept detail, Get Inspired, Discover graph adapter, Reflect data wiring, and Discover leaf build-only handoffs.
- Trophy of Becoming is intentionally off the executable cutover path until product/data work exists.
- The repo has unrelated dirty working-tree changes, including the Race Log segment-key fix in `configs/sailing.ts`; that fix is not committed at this snapshot.

## What Shipped This Session

### Playbook home iOS

- `ae0334fd` — `feat(redesign): cut Playbook home over to iOS register (flag default ON)`
- Files touched: `app/(tabs)/playbook/index.tsx`, `app/playbook-ios.tsx`, `lib/featureFlags.ts`.
- Size: 3 files, 58 insertions / 15 deletions.
- Verification status: shipped and used as the first canonical single-surface cutover precedent.
- Follow-up: `da8c4270` hid the "Preview:" banner on the canonical Playbook tab path (`app/playbook-ios.tsx`, 1 insertion / 1 deletion).

### Race Prep cards iOS cutover

Race Prep expanded the canonical cutover pattern into five commits.

| Commit | Purpose | Files touched / size | Verification status |
|---|---|---|---|
| `b0a6e23b` | Prep artifacts, checklist, precheck, inventory, design briefs | 8 docs/design files, 1,017 insertions | Git-verified. Documentation-only prep. |
| `da9e92a9` | `RACE_PREP_IOS_REGISTER` feature flag, default ON with env override | `lib/featureFlags.ts`, 12 insertions | Git-verified. |
| `a84c8b50` | `StepCard` + `RaceCardsScreen` presentational surface | 3 files, 1,022 insertions | Git-verified. Presentational component build. |
| `01c6af34` | Race tab render switch | `app/(tabs)/races.tsx`, 88 insertions | Git-verified. Canonical Race Prep cards cutover commit. |
| `6a86f4e8` | Migration plan/status/inventory shipped update and follow-ups #11/#12 | 4 docs/json files, 103 insertions / 37 deletions | Git-verified. |

Additional Race Prep follow-up:

- `eb992cda` — per-interest beat name mapping follow-up #7.
- Files: `app/race/ios/[stepId].tsx`, `docs/redesign/IOS_MIGRATION_PLAN.md`, `lib/per-interest-beats.ts`.
- Size: 3 files, 91 insertions / 15 deletions.
- Verification status: git-verified data-layer follow-up after Race Prep visual cutover.

### Reflect visual cutover

- `3d8b45dc` — `feat(redesign): cut Race Log iOS and Profile iOS over inside Reflect (flags default ON)`.
- Files touched: `app/(tabs)/reflect.tsx`, `app/profile-ios.tsx`, `app/race-log-ios.tsx`, `components/ios-register/ProfileScreen.tsx`, `components/ios-register/RaceLogScreen.tsx`.
- Size: 5 files, 95 insertions / 24 deletions.
- Verification status: shipped visually, then simulator verification found the preview-fixture leak. This commit is now classified as shipped-with-known-limitation.

- `fd2ec3d3` — `docs(redesign): mark Race Log/Profile Reflect cutover shipped + clear blockers`.
- Files touched: `IOS_MIGRATION_PLAN.json`, `IOS_MIGRATION_PLAN.md`, `IOS_STATUS.md`, `IOS_SURFACE_INVENTORY.json`.
- Size: 4 files, 51 insertions / 38 deletions.
- Verification status: docs update shipped before the preview-fixture limitation was fully understood.

### Reflect bug fixes and infrastructure

- `6b3fe596` — fixed Race Log embedded body collapse by adding flex treatment to `RaceLogScreen`.
- Files touched: `components/ios-register/RaceLogScreen.tsx`.
- Size: 1 file, 48 insertions / 13 deletions.
- Verification status: fixed a real layout bug, but did not fix the sample-data leak. The later simulator check showed Race Log body visible but still rendering sailing fixtures under Nursing.

- Race Log segment-key fix in `configs/sailing.ts`.
- Current repo state: uncommitted working-tree edit changes segment value from `race_log` to `racelog`.
- Verification status: not shipped as a commit in current git history. Treat as local pending work, not a shipped fix.

- `a6031f1e` — `feat(redesign): add Reflect log real-data adapter`.
- Files touched: `hooks/useReflectLog.ts`, `services/ReflectLogService.ts`, `lib/reflect/mapReflectLog.ts`, `lib/reflect/__tests__/mapReflectLog.test.ts`.
- Size: 4 files, 467 insertions.
- Verification status: `npm run typecheck` passed; targeted Jest passed 2 tests; targeted ESLint passed; grep confirmed `useReflectLog` is not yet consumed in production.
- Scope: additive adapter only. No Reflect wiring yet.

### Cross-cutting infrastructure and decisions

- `5c3ab6a4` — `feat(redesign): add IOSRegisterErrorState kit component (canonical error state)`.
- Files touched: `app/error-state-ios.tsx`, `components/ios-register/IOSRegisterErrorState.tsx`, `components/ios-register/index.ts`, `IOS_MIGRATION_PLAN.md`, `IOS_SURFACE_INVENTORY.json`.
- Size: 5 files, 996 insertions / 4 deletions.
- Verification status: git-verified. This is the canonical implementation for Principle #2.

- `90a9ed97` — architecture decision addendum: density is the surface, not the principle.
- Files touched: `docs/redesign/IOS_MIGRATION_PLAN.md`.
- Size: 48 insertions.
- Verification status: git-verified. Ratified by later Profile iOS work.

## What Staged This Session

These are build-only or pre-cutover commits: components, flags, preview routes, or data prerequisites that do not by themselves complete a production render switch.

| Surface / work | Commit | Adds | Does not add | Unblocks |
|---|---|---|---|---|
| Race Log iOS | `316c5486` | `RaceLogScreen`, `app/race-log-ios.tsx`, `RACE_LOG_IOS_REGISTER`, exports | Real production data wiring | Reflect visual cutover; now needs Reflect data-wiring Commits 2-4 |
| Profile iOS | `505de4e3` | `ProfileScreen`, `app/profile-ios.tsx`, `PROFILE_IOS_REGISTER`, inventory updates | Real production profile adapter | Reflect visual cutover; now needs Reflect data-wiring Commits 2-4 |
| Get Inspired running state | `7c2dfeeb` | `LoadingNarration`, `app/get-inspired-ios-running.tsx`, `GET_INSPIRED_IOS_REGISTER` | Live modal render switch, AbortSignal plumbing, error-state integration | Get Inspired cutover specs |
| Trophy of Becoming | `496d2481` | `TrophyScreen`, refactored `app/trophy-ios.tsx`, `TROPHY_IOS_REGISTER` | Trophy data model, synthesis service, production entry point | Nothing executable yet; first-ship remains product/data-blocked |
| Concept detail variants | `a6c27c70` | `ConceptDetailScreen`, original `app/concept-variants-ios.tsx`, `CONCEPT_IOS_REGISTER` | Data-driven variant routing, canonical route render switch | Concept data-layer specs |
| Concept preview route rename | `06df3e87` | Renamed preview route to `app/concept-detail-ios.tsx`, flag/inventory alignment | Production route switch | Cleaner preview route convention |
| Concept detail data-layer Commit 1 | `f02b2e0e` | `supabase/migrations/20260515120000_create_playbook_concept_user_state.sql` | Read path and variant routing | Concept detail Commit 2 |
| Reflect log adapter | `a6031f1e` | `useReflectLog`, `ReflectLogService`, pure log mappers/tests | Profile adapter, Reflect production wiring | Reflect data-wiring Commit 2 |

## What Was Specced But Not Executed

Estimates use the observed Concept detail migration precedent: one well-specified Claude Code commit took about 7 minutes when the spec was executable and repo state matched it. UI render switches and data hooks can take longer when they reveal runtime or typing issues.

| Spec set | Docs | Commit count | Executed | Remaining estimate | Ship-readiness verdict |
|---|---|---:|---:|---:|---|
| Concept detail data-layer + variant routing | `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_1_MIGRATION.md`, `_2_READ_PATH.md`, `_3_VARIANT_ROUTING.md` | 3 pre-cutover specs | 1/3 (`f02b2e0e`) | ~14-25 min for Commits 2-3; render switch/docs still after | Ready after Commit 2 proves the read path |
| Get Inspired cutover | `GET_INSPIRED_COMMIT_1_PLAYBOOK_CTA.md` through `_4_MIGRATION_PLAN_UPDATE.md` | 4 | 0/4 | ~28-45 min | Ready; no data-layer blocker |
| Discover graph adapter | `DISCOVER_GRAPH_ADAPTER_COMMIT_1_TYPES_AND_MAPPERS.md` through `_3_HOOKS_AND_SELECTORS.md` | 3 | 0/3 | ~21-45 min | Ready as pre-cutover data work; render switch still far later |
| Reflect data wiring | `REFLECT_DATA_WIRING_COMMIT_1_LOG_ADAPTER.md` through `_4_STATUS_DOCS.md` | 4 | 1/4 (`a6031f1e`) | ~21-40 min | Highest-priority because visual cutover is already live with fixture leakage |
| Discover build-only surfaces | six `DISCOVER_*_BUILD_SPEC.md` files | 6 build-only handoffs | 0/6 | ~30-60 min if batched carefully | Designed/spec-ready, but should follow graph adapter or proceed only as preview builds |
| Legacy Race Log / Shift Log work plan | `RACE_LOG_SHIFT_LOG_COMMIT_1_MAPPERS.md` through `_3_REFLECT_WIRING.md` | 3 | 0/3 | superseded | Likely superseded by `REFLECT_DATA_WIRING_WORK.md`; keep for reference until reconciled |

## What Was Designed But Not Staged

Discover has six leaf designs and a parent shell architecture but no component build-only commits yet.

| Surface | Design locator | Build-only handoff shape |
|---|---|---|
| Discover Orgs list | Claude Design — Discover Orgs list iOS register | `components/ios-register/DiscoverOrgsListScreen.tsx`, `DISCOVER_IOS_REGISTER`, `/discover-orgs-ios`, spec `DISCOVER_ORGS_LIST_BUILD_SPEC.md` |
| Discover People list | Claude Design — Discover People list iOS register | `DiscoverPeopleListScreen`, `/discover-people-ios`, spec `DISCOVER_PEOPLE_LIST_BUILD_SPEC.md` |
| Discover Forums list | Claude Design — Discover Forums list iOS register | `DiscoverForumsListScreen`, `/discover-forums-ios`, spec `DISCOVER_FORUMS_LIST_BUILD_SPEC.md` |
| Discover Org detail | Claude Design — Discover Org detail iOS register | `DiscoverOrgDetailScreen`, `/discover-org-detail-ios`, spec `DISCOVER_ORG_DETAIL_BUILD_SPEC.md` |
| Discover Person detail | Claude Design — Discover Person detail iOS register | `DiscoverPersonDetailScreen`, `/discover-person-detail-ios`, spec `DISCOVER_PERSON_DETAIL_BUILD_SPEC.md` |
| Discover Topic detail | Claude Design — Discover Topic detail iOS register | `DiscoverTopicDetailScreen`, `/discover-topic-detail-ios`, spec `DISCOVER_TOPIC_DETAIL_BUILD_SPEC.md` |
| Discover home shell | Claude Design — Discover home shell iOS register | Parent shell in `app/(tabs)/discover.tsx` behind atomic `DISCOVER_IOS_REGISTER`; architecture doc `DISCOVER_CUTOVER_ARCHITECTURE.md` |

The key ratified Discover decisions are: UI says Topic while schema uses `communities`; one atomic `DISCOVER_IOS_REGISTER` flag; shared graph adapter before production cutover.

## What Was Researched And Documented

New or substantially updated documentation produced during this session:

- `docs/redesign/CROSS_CUTTING_COMPLIANCE_AUDIT.md`
- `docs/redesign/EXPORT_MANIFEST.json`
- `docs/redesign/CUTOVER_PATTERN.md`
- `docs/redesign/REFLECT_CUTOVER_CHECKLIST.md`
- `docs/redesign/snippets/reflect-cutover-commits.md`
- `docs/redesign/STAGING_AUDIT.md`
- `docs/redesign/GET_INSPIRED_CUTOVER_PLAN.md`
- `docs/redesign/TROPHY_OF_BECOMING_CUTOVER_PLAN.md`
- `docs/redesign/CONCEPT_DETAIL_CUTOVER_PLAN.md`
- `docs/redesign/DATA_LAYER_DEPENDENCIES.md`
- `docs/redesign/CONCEPT_DETAIL_DATA_LAYER_WORK.md`
- `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_1_MIGRATION.md`
- `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_2_READ_PATH.md`
- `docs/redesign/specs/CONCEPT_DETAIL_COMMIT_3_VARIANT_ROUTING.md`
- `docs/redesign/specs/GET_INSPIRED_COMMIT_1_PLAYBOOK_CTA.md`
- `docs/redesign/specs/GET_INSPIRED_COMMIT_2_RENDER_SWITCH.md`
- `docs/redesign/specs/GET_INSPIRED_COMMIT_3_ABORT_SEMANTICS.md`
- `docs/redesign/specs/GET_INSPIRED_COMMIT_4_MIGRATION_PLAN_UPDATE.md`
- `docs/redesign/DISCOVER_CUTOVER_ARCHITECTURE.md`
- six Discover leaf build specs in `docs/redesign/specs/DISCOVER_*_BUILD_SPEC.md`
- `docs/redesign/MIGRATION_PLAYBOOK.md`
- `docs/redesign/DISCOVER_GRAPH_ADAPTER_WORK.md`
- `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_1_TYPES_AND_MAPPERS.md`
- `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_2_SERVICE_READ_PATH.md`
- `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_3_HOOKS_AND_SELECTORS.md`
- `docs/redesign/REFLECT_DATA_WIRING_WORK.md`
- `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_1_LOG_ADAPTER.md`
- `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_2_PROFILE_ADAPTER.md`
- `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_3_REFLECT_WIRING.md`
- `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_4_STATUS_DOCS.md`

Some of these files are still untracked in the working tree at this snapshot. They are still part of the session state, but git will not preserve them until committed.

## What Was Decided

| Decision | Reasoning | Reversal path |
|---|---|---|
| Inventory tracks surfaces, not cutovers | Race Log and Profile ship together but have separate designs/components/flags | Edit inventory rule and collapse only if future product wants cutover-level inventory |
| Shipped means user-visible production behind default-on flag | Data instrumentation can follow if not rendered | Change shipped bar in `CUTOVER_PATTERN.md` and inventory semantics |
| Profile preview route is `app/profile-ios.tsx` | Matches flat `app/playbook-ios.tsx` and `app/race-log-ios.tsx` pattern | Rename preview route and update inventory/specs |
| Concept mature non-dormant fallback uses default chrome | New/Dormant/Breakthrough are exceptional signals, not all possible states | Change variant-routing helper |
| Concept dormancy formula uses 4x median cadence with 30/120 clamp and 3-reflection gate | Adapts to seasonal practice better than fixed days | Tune constants or add per-interest thresholds |
| Concept state gets a per-user table plus derived reflection aggregates | Shared concepts need user-specific state | Move to materialized view or compute-only approach |
| Get Inspired entry point is a single Playbook hero CTA | Avoids scattering a pipeline entry point before its use is proven | Add sparse-section CTAs later |
| Get Inspired stop semantics cancel the pipeline | No persistent job/result store is needed for v1 | Introduce background jobs/results if product wants async delivery |
| Discover uses `communities` schema for Topic UI | Existing schema can support v1; editorial topics can split later | Add separate topic model later |
| Discover uses one atomic `DISCOVER_IOS_REGISTER` flag | Cross-linked surfaces are unsafe under partial flags | Split flags only after IA can tolerate partial states |
| Discover requires a shared graph adapter | Prevents duplicated joins and inconsistent cross-reference counts | Let leaf surfaces query directly, but that is intentionally rejected for v1 |
| Reflect log data shape maps per-interest models into one `RaceLogScreen` shape | Smallest correct fix; component grammar is generic enough | Introduce separate `ShiftLogScreen` |
| Reflect data adapter lives in hooks/services/mappers, not the screen | Keeps iOS-register components presentational | Collapse into `reflect.tsx` if it stays tiny |
| Nursing data exists via `timeline_steps` | No dedicated shift table required for v1 | Add clinical-specific shift table later |
| Profile has the same preview-wrapper bug as Race Log | `ProfileIosPreview` passes sample Felix data in production branch | Disable profile flag or wire real adapter |
| Reflect data wiring is next priority, not duct-tape flag gating | The visual cutover is already live and visibly contradicts active interest | Temporarily set both Reflect flags false for a demo only |

## What Was Found Wrong

- Race Log segment value mismatch: `configs/sailing.ts` used `race_log` while Reflect sub-tab logic uses `racelog`. Current working tree contains the fix, but it is not committed.
- Race Log embedded layout collapse: fixed in `6b3fe596` by adding flex to the embedded `ScrollView`.
- Preview components leaked into production: `RaceLogIosPreview` and `ProfileIosPreview` were mounted in `app/(tabs)/reflect.tsx`. This is the source of Nursing showing sailing fixture data. Work plan and specs exist; only Commit 1 has landed.
- Early docs drifted as Profile moved from pending to staged and then cut over. `STAGING_AUDIT.md` still contains stale "Profile pending" text from an earlier repo state.
- Trophy was initially treated like a cutover, but repo investigation found no production mount or data layer. It is a first-ship feature.
- `EXPORT_MANIFEST.json` intentionally points at future `docs/redesign/ios-register/*` targets that should not exist yet. Those are export targets, not broken links.

## Lessons Banked Permanently

- `CUTOVER_PATTERN.md` now contains the hard rule: do not mount preview route wrappers in production.
- `MIGRATION_PLAYBOOK.md` now treats production adapter readiness as a cutover gate.
- Architecture Decision A was refined: density is determined by platform fit and surface job, not just user role.
- Data-layer blockers now get executable spec sets before render-switch work starts. Concept detail is the template.
- First-ship vs register-migration is a formal distinction. Trophy is the case study.
- Multi-surface cutovers are surface-level in inventory but atomic at the render switch when the IA cross-links.

## Current Working Tree Notes

Unrelated dirty state exists and should not be mixed with the next execution commit unless the human explicitly chooses to ship it:

- Modified: `app/concept-detail-ios.tsx`
- Modified: `configs/sailing.ts`
- Modified: `docs/redesign/IOS_MIGRATION_PLAN.md`
- Modified: `docs/redesign/IOS_SURFACE_INVENTORY.json`
- Modified: `docs/redesign/JSON_DRIFT_REPORT.md`
- Many untracked docs/specs under `docs/redesign/`

Any next engineering commit should stage narrowly.

## How this session has gone, from Codex's perspective

The autonomy pattern worked best when decisions were converted into executable specs before Claude Code touched source. Concept detail and Reflect data wiring both became clearer once the work was decomposed into migration/read-path/routing or adapter/profile/wiring/docs commits.

It worked less well when I let "visual cutover" and "production-ready cutover" blur. Reflect should have triggered the preview-wrapper rule before the render switch landed. The visual surface looked correct enough to ship, but the adapter boundary was wrong and the Nursing screenshot exposed it immediately.

The biggest wrong call was not classifying Trophy as first-ship early enough. The repo had no production mount or data model; a stricter grep-first rule would have prevented cutover-plan language from implying a migration.

The strongest decisions that held up were: Concept detail default mature chrome, the cadence-based dormancy formula, atomic Discover flagging, and the shared Discover graph adapter. The human ratified the Discover escalations without changing the direction, which suggests the option/recommendation/consequence format was useful.

In the next three hours I would do less broad planning and more narrow execution. The first priority is finishing Reflect data wiring because the broken behavior is already visible in the shipped tab. After that, pick one low-risk cutover path and push it through verification rather than starting another architecture branch.
