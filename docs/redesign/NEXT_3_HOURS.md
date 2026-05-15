# Next 3 Hours — iOS Register Launch Plan

Snapshot basis: `docs/redesign/SESSION_STATE.md`, current HEAD `a6031f1e`.

## First Move

Ship **Reflect data-wiring Commit 2: Profile adapter**.

Why: Reflect is already visually live and already known broken because production mounts preview fixtures. Commit 1 (`a6031f1e`) landed the log adapter. Commit 2 is the next smallest additive step toward fixing the most visible current bug, and it does not touch `app/(tabs)/reflect.tsx` yet.

Expected time: ~15-25 minutes, including typecheck, targeted tests, lint, and narrow commit.

## Why Not The Other Candidates First

| Candidate | Why not first |
|---|---|
| Reflect data wiring Commit 1 | Already shipped as `a6031f1e`. |
| Concept detail Commit 2 | Important, but not fixing a live shipped limitation. Also the highest typing-fragility spec; better to run after the Reflect remediation path has momentum. |
| Concept detail Commit 3 | Depends on Concept detail Commit 2. |
| Get Inspired Commit 1 | Small and useful, but Get Inspired is not currently leaking wrong production data. |
| Discover graph adapter Commit 1 | Pure and likely easy, but Discover is not visually shipped yet. Reflect is. |
| Visual reverification of Reflect | Useful after wiring changes, not before. The current bug shape is already confirmed by screenshot and code. |
| Six Discover build-only handoffs | High throughput but broad context. They do not reduce current production risk. |

## Three-Hour Sequence

### 0:00-0:30 — Finish Reflect additive adapters

1. Execute `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_2_PROFILE_ADAPTER.md`.
2. Verify:
   - `npm run typecheck`
   - targeted mapper/hook tests
   - targeted ESLint
   - grep confirms profile adapter is not yet wired into production before Commit 3
3. Commit narrowly.

Pause point: if Commit 2 reveals Profile data mismatch, stop and fix the spec before touching Reflect production wiring.

### 0:30-1:15 — Wire Reflect production branch

1. Execute `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_3_REFLECT_WIRING.md`.
2. This is the first real remediation commit: replace `RaceLogIosPreview` and `ProfileIosPreview` in `app/(tabs)/reflect.tsx`.
3. Verify:
   - `npm run typecheck`
   - targeted tests from Commits 1 and 2
   - targeted ESLint
   - simulator: switch active interest to Nursing; Reflect segment should show Shift Log data or the canonical empty state, not sailing fixtures
   - simulator: Profile should render real profile data, not the preview Felix fixture

One-hour reassessment: if simulator verification passes, proceed to status docs. If it fails, do not start Get Inspired or Concept detail; debug Reflect until production data is correct.

### 1:15-1:35 — Close Reflect status docs

1. Execute `docs/redesign/specs/REFLECT_DATA_WIRING_COMMIT_4_STATUS_DOCS.md`.
2. Update status from shipped-with-known-limitation to shipped-with-real-data where the spec requires.
3. Capture follow-ups: filter persistence, season picker, Profile preference writeback, billing source.
4. Commit docs only.

### 1:35-2:20 — Take the next simplest ship path: Get Inspired Commit 1 and maybe Commit 2

1. Execute `GET_INSPIRED_COMMIT_1_PLAYBOOK_CTA.md`.
2. If clean and under time, execute `GET_INSPIRED_COMMIT_2_RENDER_SWITCH.md`.
3. Verify:
   - typecheck + lint
   - simulator Playbook entry point opens Get Inspired flow
   - running-state flag ON replaces spinner/timed text only
   - result rendering remains unchanged

Two-hour reassessment: decide whether to continue Get Inspired to AbortSignal semantics or pause for a simulator pass.

### 2:20-3:00 — Choose based on energy and failures

Preferred path if Reflect and Get Inspired stayed clean:

1. Execute `GET_INSPIRED_COMMIT_3_ABORT_SEMANTICS.md`.
2. Verify cancellation is cancellation, not an error state.
3. If there is time, do `GET_INSPIRED_COMMIT_4_MIGRATION_PLAN_UPDATE.md`.

Fallback path if Get Inspired gets sticky:

1. Switch to Discover graph adapter Commit 1 (`DISCOVER_GRAPH_ADAPTER_COMMIT_1_TYPES_AND_MAPPERS.md`).
2. It is pure types/mappers and can ship without simulator verification.

Do not start Concept detail Commit 2 in the last 40 minutes unless the human explicitly wants to spend the end of session on Supabase typing and read-path debugging.

## Parallel Work

Claude Code should execute one engineering commit at a time.

Codex can do in parallel:

- During Reflect Commit 2: prepare the verification checklist for Commit 3 from the spec.
- During Reflect Commit 3: inspect simulator result and draft exact status-doc update for Commit 4.
- During Get Inspired Commit 1: pre-read Commit 2 and identify touched files for narrow staging.
- During Get Inspired Commit 3: prepare the error/cancellation verification matrix.

Avoid parallel broad planning. The bottleneck is now reliable execution, not architecture.

## Verification Rules

- Adapter/migration commits: typecheck, targeted tests, targeted lint, narrow grep that proves no premature production consumption unless the commit is the wiring commit.
- Render-switch commits: typecheck, lint, simulator path under flag ON and flag OFF, rollback flag identified.
- Build-only handoffs: preview route opens; component has no data fetching/router calls; production tabs do not import it yet.
- Status-doc commits: no source files staged; inventory status matches actual shipped state.

## Stays Blocked

- Discover render switch: blocked until graph adapter plus six leaf surfaces plus shell composition exist.
- Trophy of Becoming: blocked until product feature/data layer ships.
- Concept detail render switch: blocked until Commits 2 and 3 after the migration land.
- Inline error variants beyond canonical `IOSRegisterErrorState`: next-pass design.
- Race Prep inline summary-card actions: open follow-up, not a blocker for the next three hours.

## Risks

- Metro may serve stale bundles during Reflect reverification. Hard reload before trusting visual state.
- Claude Design quota was reported at 82%; avoid new design asks unless a build-only handoff actually needs a missing URL.
- Preview-component leakage can recur. Treat any `app/*-ios.tsx` import in a tab screen as a blocker unless explicitly approved.
- Concept detail Commit 2 is the most likely to surface Supabase typing fragility.
- Working tree is dirty. Every commit must stage narrowly.

## Recommended Execution Order Across Open Work

1. Reflect data wiring Commits 2-4 — ship now; fixes live limitation.
2. Get Inspired Commits 1-4 — ship next; no data blocker and clear specs.
3. Concept detail Commits 2-3, then render switch/docs — ship after read-path confidence improves.
4. Discover graph adapter Commits 1-3 — ship when there is a clean data-work block.
5. Discover build-only surfaces — batch after adapter direction is stable.
6. Trophy — wait for product/data first-ship work.
