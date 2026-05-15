# Agent Coordination Notes

## The Pattern

Codex has been reliable on architectural intent, product-shape decisions, decomposition, and reasoning. It has been less reliable on claims about what is currently in the repo at this exact moment. Memory-based statements about files, hashes, fields, and working-tree state can drift from reality.

This is a calibration finding, not a blame note. The coordination pattern works when repo-state claims are verified at the point they matter.

## Case Studies

### Commit Hash Memory Errors

Claim: earlier session notes referenced cutover commit hashes from memory.

Reality: several references did not match `git log`. The human caught the mismatch. The structural fix is now documented in `CUTOVER_PATTERN.md` under `Git-history verification`: after a cutover-shipping or fix-shipping commit, verify it appears in `git log origin/main --oneline -5` before treating it as shipped.

### `CONSISTENCY_AUDIT.md` False Positive

Claim: `CONSISTENCY_AUDIT.md` reported `configs/sailing.ts` had an uncommitted Race Log segment-key edit.

Reality: Claude Code verified the fix was already shipped at `847e7855` (`fix(redesign): align sailing config segment key with Reflect render branch`). The audit was wrong on that claim.

Resolution: treat audits as starting points that require cross-checking before action.

### Reflect Profile Spec Field Mismatch

Claim: `REFLECT_DATA_WIRING_COMMIT_2_PROFILE_ADAPTER.md` mapped `memberSince` from `data.profile.memberSince`.

Reality: the repo defines `memberSince` on `ReflectProfileData.stats`, not `ReflectProfileData.profile`.

Resolution: Claude Code stopped before editing and surfaced the spec/repo contradiction. The implementation should honor the repo and record the deviation in the eventual Commit 2 body.

### Preview Route Imported Into Production Spec

Claim: `GET_INSPIRED_COMMIT_2_RENDER_SWITCH.md` could mount `GetInspiredIosRunningPreview` from `app/get-inspired-ios-running.tsx` directly inside production `components/inspiration/InspirationCaptureStep.tsx`.

Reality: this repeated the same structural defect as the original Reflect data-wiring specs, which mounted `RaceLogIosPreview` and `ProfileIosPreview` from `app/` into production `app/(tabs)/reflect.tsx`. Reflect leaked fixture data; Get Inspired's preview happened to have production-shaped props, but the production import from `app/` was still the same bad pattern.

Resolution: Claude Code stopped before editing. The correct path is to extract `GetInspiredRunningScreen` into a kit module before the production render switch mounts it.

### Untracked Migration Docs

Claim: the migration docs and specs created during the 2026-05-15 session were available because they existed on disk and were referenced by later commits.

Reality: 46 files, including `SESSION_STATE.md`, cutover plans, work plans, `EXPORT_MANIFEST.json`, all `docs/redesign/specs/`, and all `docs/redesign/snippets/`, were untracked. They were readable locally by agents and tools, but absent from git history. If the working tree had been lost, the session's documentation system and the specs referenced by multiple commits would have been lost too.

Resolution: emergency commit `c539c2ed` tracked the accumulated files as-is. The gap surfaced only because `git status --short` after `775b5a9c` showed the long untracked list.

## Process Implication

When Codex writes specs that reference specific files, types, fields, table names, or columns, the prompt should require explicit repo verification at spec-write time. The verification step is mandatory: read the file, check the exported type, confirm the table/column exists, and then write the spec. Inference from memory is not enough.

When Codex writes cutover specs that introduce a production mount, the spec-writing process must verify that production code does not import from `app/`. If the preview-route component encapsulates the UI being mounted, the spec must either require extracting it into a kit component as part of the cutover, or confirm that the import is only from a kit module such as `components/ios-register/`.

When any agent creates new files as part of a task, task-completion verification must include `git status --short | grep '^??'` to identify untracked files. Any new files must be explicitly tracked via `git add` and committed before the next task begins. This applies especially to doc-creation, spec-creation, and audit-output tasks where the deliverable is the new file itself. The `c539c2ed` recovery commit tracked 46 files that had accumulated over the session while commits on `origin/main` referenced spec paths that did not yet exist in git history.

## Execution Implication

Claude Code stopping on spec/repo contradictions is the safety net. Keep that behavior. When a spec references a field or file that does not exist, stop and surface the mismatch instead of smoothing it over.

## Audit Implication

Codex audits are useful but not authoritative until checked against repo state. Their findings should guide investigation, not replace it.

## Dev Environment Gotchas

### Simulator may launch the wrong dev client

The iOS simulator has two BetterAt-stack apps installed (`com.betterat.app`
and `com.denneyke.dragonworldshk2027`). If the wrong one launches against
the BetterAt Metro bundle, you'll see native-module errors that look
like dependency problems but aren't:

- `Worklets native part of Worklets doesn't seem to be initialized`
- `Cannot find native module 'ExpoLocalization'`

Before investigating native dependencies, verify the simulator is
running `com.betterat.app`, not `com.denneyke.dragonworldshk2027`.

Documented twice in this codebase before being banked: Codex hit it on
2026-05-16 morning during B.5 verification, then again later the same
morning. Banking it now so future agents don't waste 30 min on it.

## What This Is Not

This is not a claim that Codex is unreliable or should be replaced. Codex and Claude Code have different strengths. Codex is strong at reasoning, architecture, and synthesis; Claude Code is strong at repo-grounded execution. The three errors above were all caught quickly with no production damage. The pattern works as long as repo-state claims are verified.
