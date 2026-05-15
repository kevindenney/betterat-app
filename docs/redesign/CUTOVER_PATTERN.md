# iOS Register Cutover Pattern

## Open questions

- Prompt says the shipped Playbook home cutover is commit `da8c4270`. Repo state shows the actual cutover commit is `ae0334fd` (`feat(redesign): cut Playbook home over to iOS register (flag default ON)`). `da8c4270` is the immediate follow-up that hides the preview banner on the canonical tab path.
- Historical note: this doc originally observed that Profile iOS was not staged yet. Current repo state has `PROFILE_IOS_REGISTER` and [`app/profile-ios.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/profile-ios.tsx:1); the remaining Reflect issue is production data wiring, documented in `docs/redesign/REFLECT_DATA_WIRING_WORK.md`.
- Prompt says the `01c6af34` Race Prep render-switch commit used an approved `--no-verify` bypass. Repo commit metadata does not record that in the commit message. The explicit in-repo `--no-verify` precedent is `0099d7c3`.

## Commit shape

Canonical shape, in order:

1. Prep artifacts
2. Feature flag
3. New iOS-register components and screen adapters
4. Render switch in the canonical mounting screen
5. Migration-doc follow-up

Why it decomposes this way:

- Prep artifacts isolate planning, checklists, design-brief recovery, and prechecks from product behavior changes.
- Feature flag lands before any canonical switch so rollback semantics exist before the first render-path diff.
- Component commits stay presentational and reviewable on their own.
- The render-switch commit is intentionally narrow: one mounting screen, one flag gate, one fallback path.
- Migration docs flip only after the render switch is actually shipped, so status files remain truthful.

## Shipped references

### Playbook home

- Cutover commit: `ae0334fd`
- Follow-up correctness fix: `da8c4270`

Compressed shape:

1. Feature flag + preview-route adjustments + canonical render switch in one commit
2. Small follow-up fix for preview-only chrome leaking into the canonical tab

Why compression was acceptable:

- Single surface
- Single mount point: [`app/(tabs)/playbook/index.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/playbook/index.tsx:1)
- No new shared `components/ios-register/` kit files in the cutover commit
- Existing preview route already existed and only needed `embedded` behavior
- The fallback path was trivial: `<PlaybookHome />`

Use this compression only when the new surface already exists, the switch is one-file, and the cutover does not introduce new shared kit primitives or architectural follow-ups.

### Race Prep cards

- Prep artifacts: `b0a6e23b`
- Feature flag: `da9e92a9`
- Presentational components: `a84c8b50`
- Render switch: `01c6af34`
- Migration docs: `6a86f4e8`

Expanded shape was appropriate because:

- The cutover introduced new shared kit components under `components/ios-register/`
- The switch affected a large tab screen, not a small route wrapper
- The rollout needed explicit precheck/checklist artifacts
- The shipped state raised new architecture follow-ups that needed to be captured after the fact

Default to the expanded pattern unless there is a clear reason to compress.

## Feature flag convention

Location:

- [`lib/featureFlags.ts`](/Users/kdenney/Developer/BetterAt/betterat-app/lib/featureFlags.ts:1)

Naming:

- `PLAYBOOK_IOS_REGISTER`
- `RACE_PREP_IOS_REGISTER`
- `RACE_LOG_IOS_REGISTER`
- Convention: `<SURFACE>_IOS_REGISTER`

Default state:

- Live cutovers default `true`
- Staged preview-only flags can also default `true` if they do not yet affect canonical render paths

Env override pattern:

- `readBooleanEnv('EXPO_PUBLIC_FF_<FLAG_NAME>', true)`
- Emergency revert pattern: `EXPO_PUBLIC_FF_<FLAG_NAME>=false`

Operational rule:

- Add the flag before wiring the canonical screen
- Keep the revert path to a single env toggle
- Document in the flag comment whether the flag is already live or still preview-only

## Component conventions

Location:

- [`components/ios-register/`](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register:1)

Exports:

- Central barrel: [`components/ios-register/index.ts`](/Users/kdenney/Developer/BetterAt/betterat-app/components/ios-register/index.ts:1)

Constraint:

- Components in this directory are presentational-only
- No data fetching
- No router ownership
- No cutover gating inside the component

Evidence:

- The barrel file explicitly describes the kit as “Pure presentational components”
- `RaceCardsScreen` receives caller-owned data and callbacks
- `RaceLogScreen` receives caller-owned `seasons`, `filterChips`, and `onEntryPress`

Route-level adapters are where sample data, preview banners, close-X chrome, and router wiring belong. Example:

- [`app/race-log-ios.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/race-log-ios.tsx:1)

That split matters:

- `components/ios-register/*` stays reusable
- `app/*-ios.tsx` can absorb preview-only behavior without contaminating canonical mounts

## Preview route pattern

Pattern:

- `app/<surface>-ios.tsx` for top-level preview surfaces
- Nested exceptions exist for step surfaces, e.g. [`app/race/ios/[stepId].tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/race/ios/[stepId].tsx:1)

Role:

- Reachable-for-review entry
- Preview-only chrome and sample-data adapter
- Decoupled from the tab render switch

Examples:

- [`app/playbook-ios.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/playbook-ios.tsx:1)
- [`app/race-log-ios.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/race-log-ios.tsx:1)
- [`app/reflect-ios.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/reflect-ios.tsx:1)

Rule:

- Do not wire the canonical tab directly to unfinished surface code
- First make the preview route reviewable
- Then land the render switch separately

## Render switch wiring

The switch lives in the canonical mounting screen, not in the preview route.

Examples:

- Playbook: [`app/(tabs)/playbook/index.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/playbook/index.tsx:1)
- Race tab cards path: [`app/(tabs)/races.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/races.tsx:4591)

Pattern:

- Flag ON: render the iOS-register presentational screen with production data adapters
- Flag OFF: preserve the existing legacy path unchanged

Hard rule:

- Do not mount `app/*-ios.tsx` preview-route wrappers in production tab screens.
- Preview wrappers may contain sample fixtures, preview banners, close-X chrome, and route-specific tap-through guards.
- Production mounts must import from `components/ios-register/` and pass real props from a hook or route-level adapter.
- Specs that propose a production mount must verify no production code imports from `app/`. Catching this at execution time is the safety net, not the policy.

Case study:

- Reflect cutover `3d8b45dc` mounted `RaceLogIosPreview` and `ProfileIosPreview` directly inside `app/(tabs)/reflect.tsx`.
- Visual verification then showed Nursing's `Shift Log` segment rendering sailing fixtures (`Christmas Cup`, `Dragon · Hong Kong`).
- The correction is specified in `docs/redesign/REFLECT_DATA_WIRING_WORK.md`: replace preview wrappers with `RaceLogScreen` / `ProfileScreen` consuming real interest-aware adapters.

Keep the render-switch commit separate from the component build commit. That separation is what makes review, rollback, and blame clean.

## Git-history verification

After every cutover-shipping or fix-shipping commit, verify the fix exists in git history before moving on.

Rule:

- Run `git log origin/main --oneline -5`
- Confirm the new cutover or fix commit appears
- Do not treat a working-tree edit as shipped, even if the simulator visually reflects it
- Do not use Metro hot reload as proof that a fix is durable

Why this exists:

- Visual verification in the simulator confirms that Metro bundled the current working tree
- It does not confirm that the fix was committed
- It does not confirm the fix reached `origin/main`

Case study:

- The Race Log segment-name fix in [`configs/sailing.ts`](/Users/kdenney/Developer/BetterAt/betterat-app/configs/sailing.ts:496) changed `race_log` to `racelog`.
- It was visually validated in the simulator on 2026-05-15 mid-session.
- The app reflected the fix because Metro re-bundled the working-tree state on hot reload.
- The edit was never committed, so it was not durable in git history.
- `CONSISTENCY_AUDIT.md` caught the gap only by cross-referencing the claimed fix against `git log`.

## File-tracking verification

After every doc-creation or spec-creation task, verify the new files are tracked before moving on.

Rule:

- Run `git status --short | grep '^??'`
- Confirm no newly created deliverable files are sitting untracked
- If new files exist, make an explicit tracking commit before starting the next task
- Do not assume later commits will sweep in docs, specs, snippets, or audit outputs

Case study:

- Recovery commit `c539c2ed` tracked 46 migration files that had accumulated locally during the 2026-05-15 session.
- The files included `docs/redesign/specs/`, `docs/redesign/snippets/`, cutover plans, work plans, audits, `SESSION_STATE.md`, and `EXPORT_MANIFEST.json`.
- Several commits on `origin/main` already referenced those spec paths, but the files did not exist in git history until the recovery commit.

## Lint-staged gotcha

Repo behavior:

- `.husky/pre-commit` runs `npx lint-staged`
- `lint-staged` runs `eslint --fix --max-warnings 0` on staged `*.ts` / `*.tsx`

Sources:

- [package.json](/Users/kdenney/Developer/BetterAt/betterat-app/package.json:243)
- [.husky/pre-commit](/Users/kdenney/Developer/BetterAt/betterat-app/.husky/pre-commit:1)

Implication:

- A commit can fail even when your new diff is correct, if the touched file already carries warnings

Precedents:

- `0099d7c3` explicitly documents a `--no-verify` bypass because `app/(tabs)/races.tsx` had pre-existing warnings and the change was demo-critical
- `ae0334fd` avoided bypass by adding a narrow `eslint-disable-next-line no-console` in `lib/featureFlags.ts` when that file entered commit scope

Use `--no-verify` when:

- The target file already has unrelated warnings
- The cutover is time-sensitive
- The change is narrow and understood
- A warning-cleanup campaign would materially delay shipping

Do a warning-cleanup commit first when:

- The touched file is not time-critical
- The warning set is local and tractable
- You expect repeated future edits to the same file

For Reflect specifically, current repo-state evidence says [`app/(tabs)/reflect.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/reflect.tsx:1), [`app/race-log-ios.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/race-log-ios.tsx:1), and [`lib/featureFlags.ts`](/Users/kdenney/Developer/BetterAt/betterat-app/lib/featureFlags.ts:1) pass `eslint --max-warnings 0` today, so there is no current evidence that a bypass is required.

## Migration plan update

The final docs commit is separate.

Its job:

- Mark the cutover shipped
- Update status dashboards
- Remove or strike the fulfilled handoff blockers
- Capture new follow-ups surfaced by the cutover

Shipped examples:

- Race Prep cards post-cutover docs: `6a86f4e8`
- Playbook banner correctness follow-up stayed separate from the render-switch commit: `da8c4270`

Rule:

- Do not pre-flip docs in the render-switch commit unless the cutover commit itself is the only review artifact and there is no realistic chance of separation
- Prefer a distinct “docs(redesign)” follow-up commit

## Multi-surface cutovers

Reflect is the first documented extension of the pattern.

It is not a different pattern. It is the single-surface pattern applied to multiple staged surfaces that share one canonical mount.

Recommended shape:

1. Build Race Log iOS in its own components/preview-route commit
2. Build Profile iOS in its own components/preview-route commit
3. Add one flag per staged surface
4. Land one render-switch commit in the shared mounting screen
5. Land one docs follow-up commit

Rules:

- Each surface still gets its own presentational build commit
- The shared parent screen owns the atomic flip
- Each flag should still support single-toggle rollback for that sub-surface
- The render-switch commit should be explicit about what remains legacy and what flips together

Current Reflect mount point in repo state:

- [`app/(tabs)/reflect.tsx`](/Users/kdenney/Developer/BetterAt/betterat-app/app/(tabs)/reflect.tsx:930)

Current repo-state caveat:

- Race Log and Profile are staged and visually cut over.
- Reflect cutover `3d8b45dc` mounted preview wrappers in production, so the data-wiring remediation in `docs/redesign/REFLECT_DATA_WIRING_WORK.md` must land before the surfaces are treated as fully shipped.

## Practical reference

When picking a cutover shape:

- Use the compressed Playbook pattern for a small, single-mount, no-new-kit cutover
- Use the expanded Race Prep pattern when the cutover introduces new kit primitives, a broad parent-screen diff, or post-cutover architectural bookkeeping
- Treat multi-surface cutovers as the expanded pattern with multiple build-only commits feeding one shared render-switch commit

## Decisions on open questions

### Open questions

- None remaining from the original Reflect boundary questions. The active follow-up is the preview-wrapper production wiring bug documented above.

### 1. Surface boundary vs. cutover boundary

Question:

- Should Reflect be tracked as one shipped surface or as multiple surfaces sharing one cutover?

Resolution:

- Track surfaces, not cutovers.
- `race-log-ios` and `profile-ios` are first-class inventory entries because each has its own design, its own component, and its own feature flag.
- A shared cutover does not collapse multiple surfaces into one surface.
- State variants of one surface remain one inventory entry with `variants[]`; they are not separate surfaces.

Forward implication:

- Reflect ships via one render-switch commit, but the inventory tracks `reflect-home-ios`, `race-log-ios`, and `profile-ios` separately.
- Discover follows the same rule: `discover-orgs-ios`, `discover-people-ios`, and `discover-forums-ios` should be separate inventory entries even if they ship in one cutover.

### 2. What counts as shipped

Question:

- Does a data-layer follow-up like reflection-usage tracking block surface shipment?

Resolution:

- `shipped` means the user can see and use the new surface in production behind a flag that defaults on.
- Non-visible instrumentation does not block shipment.
- If a tracked value is rendered on the surface itself, that tracking is part of the shipment bar because shipping without it would ship a broken design.

Forward implication:

- Reflect cutover is not blocked by reflection-usage tracking unless Race Log iOS or Profile iOS visibly render a value that depends on that tracking.
- Verification check against current repo sources found no such dependency:
  `app/race-log-ios.tsx` renders sample seasons, race counts, capture counts, and status pills, but no reflection-usage metric.
  `docs/redesign/design-briefs/profile-ios.md` specifies identity, interests, preferences, subscription, and account sections, but no reflection-usage element.

Verification required:

- None triggered from current repo-state evidence for Race Log iOS or Profile iOS.
- Reflect home is a separate surface and may still carry its own follow-up for "moments returned to" data, but that is not a Race Log/Profile shipment blocker under this rule.

### 3. Profile preview route path

Question:

- What is the canonical preview-route path for Profile iOS?

Resolution:

- `app/profile-ios.tsx`

Forward implication:

- Profile follows the same flat `app/*-ios.tsx` preview-route pattern as Playbook and Race Log.
- The Profile build-only commit should create `app/profile-ios.tsx`, and the Reflect render-switch commit should mount its embedded export from there rather than inventing a nested route.
