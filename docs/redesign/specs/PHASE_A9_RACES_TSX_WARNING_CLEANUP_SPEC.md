# Phase A.9 Spec: `races.tsx` Warning Cleanup

## Goal

Reduce `app/(tabs)/races.tsx` lint warnings to zero without changing runtime behavior. This unblocks every downstream Practice phase that needs to touch the current Practice implementation file, including B.5 Plan tab interior, B.6 Add Step FAB, C timeline-with-peek shell, and C.5 zoomed-out timeline view.

The pre-commit hook runs lint-staged with `eslint --fix --max-warnings 0`; as long as `races.tsx` has existing warnings, even a comment-only change to that file can block otherwise valid commits.

## Source

- Phase B execution report from commit `2e4f25a7`, which surfaced the lint-staged blocker after dropping a comment-only `races.tsx` change.
- Current measured lint state from:

```bash
npx eslint app/'(tabs)'/races.tsx --ext .tsx -f json
```

Current result at spec-write time: **0 errors, 105 warnings**. This differs from the earlier Phase B report’s 102 warnings; the repo state is authoritative.

Warning categories:

- `@typescript-eslint/no-unused-vars`: 88
- `react-hooks/exhaustive-deps`: 14
- `@typescript-eslint/array-type`: 3

No design canonical applies. This is engineering hygiene only.

## Pre-Execution Reality Check

Before editing, Claude Code must verify the current warning set from the repo, not from this spec:

```bash
npx eslint app/'(tabs)'/races.tsx --ext .tsx -f json > /tmp/races-eslint.json
node - <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/races-eslint.json', 'utf8'));
const file = data[0];
console.log({
  errorCount: file.errorCount,
  warningCount: file.warningCount,
  fixableErrorCount: file.fixableErrorCount,
  fixableWarningCount: file.fixableWarningCount,
});
const byRule = {};
for (const msg of file.messages) byRule[msg.ruleId || 'fatal'] = (byRule[msg.ruleId || 'fatal'] || 0) + 1;
console.log(byRule);
NODE
```

Stop and rescope if:

- Any lint errors appear.
- Warning count has materially changed because another commit already touched `races.tsx`.
- `git status --short` shows `app/(tabs)/races.tsx` modified before this work begins.

Initial examples observed at spec-write time:

- Unused imports/constants near the top: `IOS_COLORS`, `SocialTimelineView`, `BlueprintProgressStrip`, `Animated`, `withSequence`, `withDelay`, `calculateDistance`, `calculateBearing`.
- Unused auth/tour destructures: `userProfile`, `isTourActive`.
- Hook dependency warnings at lines around 608, 901, 1217, 1548, 1604, 1617, 2534, 2664, 2724, and 3441.
- Array type warnings at lines around 825, 2436, and 2441.

## Commit Boundaries

### Commit 1: Safe Mechanical Fixes

Message:

```text
chore(practice): fix mechanical races lint warnings
```

Scope:

- Run `npx eslint app/'(tabs)'/races.tsx --ext .tsx --fix` only if the diff is limited to the 3 `@typescript-eslint/array-type` warnings and other obviously safe formatting.
- Convert forbidden `Array<T>` syntax to `T[]`.
- Remove unused imports only when they are demonstrably not referenced elsewhere in the file.

Do not touch hook dependency warnings in this commit.

### Commit 2: Unused Variables and Dead Local Helpers

Message:

```text
chore(practice): remove unused races locals
```

Scope:

- Resolve the remaining `@typescript-eslint/no-unused-vars` warnings.
- Remove truly unused imports, constants, local variables, and helper functions.
- If a value is intentionally kept for a future phase, prefix it with `_` only when keeping it preserves current API shape. Do not keep dead local UI imports “for later.”
- If removing a variable reveals a larger inactive feature branch, remove only the unused binding, not the dormant feature code unless lint requires it.

Review requirement:

- For every deleted helper/function, grep its name in `races.tsx` before deletion.
- If an unused state setter or callback is part of a tuple where the state value is still used, replace the unused binding with `_unusedName` rather than restructure state.

### Commit 3: Hook Dependency Warnings

Message:

```text
chore(practice): document races hook dependencies
```

Scope:

- Resolve all `react-hooks/exhaustive-deps` warnings conservatively.
- Add missing dependencies when doing so is behavior-preserving.
- If adding a dependency would change runtime behavior, cause loops, refetch repeatedly, or reset user edits, suppress the warning with a one-line reason immediately above the dependency array.

Allowed suppression pattern:

```tsx
// eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally runs only when selectedRaceId changes; adding setDraft resets in-progress edits.
```

Do not use broad file-level disables. Do not suppress without a reason. Do not refactor large hooks just to satisfy lint.

### Commit 4: Final Lint Gate and Smoke Notes

Message:

```text
chore(practice): clear races lint gate
```

Scope:

- Only needed if cleanup leaves small residual warnings that do not fit Commits 1-3.
- Run the final verification commands.
- If no code changes remain after Commit 3, skip this commit.

## Files to Change

- `app/(tabs)/races.tsx` only.

## Files to NOT Change

- Do not change `components/cards/content/RaceSummaryCard.tsx`.
- Do not change configs under `configs/`.
- Do not change hooks, services, Supabase files, tests, or spec docs as part of execution.
- Do not touch Phase B/C feature work in the same commits.

## Cutover Flag

None. Per the refined flag rule from commit `33cef6d9`, this is internal cleanup: no user-facing design change, no route change, no data persistence change, no new mount, and no control-flow change intended. A feature flag would add risk without isolating behavior.

## Test Approach

After each commit:

```bash
npm run typecheck
npx eslint app/'(tabs)'/races.tsx --ext .tsx
git status --short | grep '^??' || true
```

Expected lint progression:

- After Commit 1: array-type warnings should be zero; total warning count reduced.
- After Commit 2: unused-var warnings should be zero; total warning count reduced to hook dependency warnings only.
- After Commit 3: total warning count should be zero.

Final verification:

```bash
npx eslint app/'(tabs)'/races.tsx --ext .tsx --max-warnings 0
npm run typecheck
```

Manual simulator smoke test:

- Open the Practice tab via `/practice`.
- Confirm the timeline loads for the active interest.
- Open a step card and switch Plan / Do / Reflect tabs.
- Open add/edit flows that were already present before A.9.
- Confirm no unexpected reset loop, repeated reload, or flicker after interactions that touch the hooks changed in Commit 3.

## Rollback Path

Revert the cleanup commits in reverse order. If a hook dependency change causes runtime behavior drift, revert that single commit first; Commits 1 and 2 should remain safe unless a deleted binding was actually relied on through dynamic access.

## Risks

The largest risk is changing runtime behavior while “fixing” warnings. `react-hooks/exhaustive-deps` is the risky category. When adding a dependency changes effect frequency or state-reset semantics, prefer a narrow `eslint-disable-next-line` with a specific reason over a broad refactor.

Unused-variable cleanup can also become risky if it turns into feature deletion. Remove unused bindings and imports, not large inactive branches, unless the branch is provably unreachable and lint requires it.

## Acceptance Criteria

- `npx eslint app/'(tabs)'/races.tsx --ext .tsx --max-warnings 0` passes.
- `npm run typecheck` passes.
- Only `app/(tabs)/races.tsx` changes in execution commits.
- No source behavior changes are intentional.
- Simulator smoke test confirms the Practice tab still renders and basic existing interactions work.
