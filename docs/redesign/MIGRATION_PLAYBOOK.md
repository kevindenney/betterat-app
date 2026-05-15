# iOS Register Migration Playbook

This is the judgment reference for future iOS-register migrations. `CUTOVER_PATTERN.md` is the mechanical sequence; this playbook explains how to decide whether a surface is ready, what kind of cutover it is, and when to stop and write specs instead of wiring UI.

## Ready To Cut Over

Check readiness in this order:

1. Design exists and is canonical. If the only canonical is in Claude Design, export debt is real but not a cutover blocker if the component has already been built from that design.
2. Component is presentational. It lives under `components/ios-register/`, exports through `components/ios-register/index.ts`, takes typed props, and does not fetch data or call the router.
3. Feature flag exists. Use the cutover seam as the flag seam: surface-level for independent surfaces, tab-level for an atomic multi-surface IA.
4. Preview route is reachable. Build-only commits must leave a direct route reviewers can open without changing production navigation.
5. Mounting screen is known. If grep cannot prove where the production surface mounts, do not guess.
6. Production adapter exists. The canonical mount must consume real data, not preview-route fixtures.
7. Data dependencies are met. Base render data must exist before cutover; richer instrumentation can follow.
8. Cross-cutting states are designed. Loading states over roughly two seconds need narration; failure modes need actionable error states.
9. Rollback is one flag flip. If rollback requires reverting data or navigating a half-switched IA, the cutover is too broad or the flag seam is wrong.

## Not Ready

Common blockers we hit:

- Design references data that does not exist. Trophy of Becoming needs a trophy record, synthesis service, and production entry point; without them it is a first-ship feature, not a migration.
- Variant selection depends on unmodeled per-user state. Concept detail needed `playbook_concept_user_state` plus linked-reflection aggregates before Dormant / Breakthrough could be real.
- The surface has AI/network wait states but no loading narration. Get Inspired became the canonical fix: plain-language narration, no spinner-only state.
- Failure modes exist but no error state is designed. The canonical fix is `IOSRegisterErrorState`, not ad hoc alerts.
- The mounting screen is ambiguous. Concept detail had to distinguish `/concept-ios/[slug]` from the legacy Playbook stack route before the render switch could be scoped.
- The design is a first ship, not a migration. Trophy has no production predecessor; it needs a product/data launch plan, not a render-switch checklist.
- The production branch mounts a preview wrapper. Reflect shipped visually, but `RaceLogIosPreview` and `ProfileIosPreview` carried sample data into production. Preview wrappers are not production adapters.

## Decisions Before A Cutover

Make these calls before touching production render paths:

- Density: does the platform already do this job well? If yes, defer to platform density and assert the register only where it adds value. If no, the register asserts itself more strongly.
- Earned-register exception: only weight up an interaction when the action is irreversible or near-irreversible without re-entry and the surface's primary purpose is that decision.
- Summary vs detail boundary: never shrink a detail design into a summary card. Summary surfaces get their own design.
- Surface vs cutover boundary: inventory tracks surfaces, not cutovers. Race Log and Profile are separate surfaces that shipped in one Reflect cutover.
- Loading-state narration: any AI work, network fetch, or multi-step process over roughly two seconds needs user-facing narration.
- Error-state principle: any failure path needs plain-language consequence plus a concrete next action.
- First ship vs migration: if no production render path exists, write a first-ship plan with data and entry-point prerequisites.

## Data-Layer Pattern

When a cutover blocks on data, the usual shape is:

1. Migration: add the net-new table/fields with RLS, indexes, rollback, and test queries.
2. Read path: extend the existing query/hook to return the render and routing fields.
3. Routing function: map data into design variants with tested, reversible business logic.
4. Render switch: wire the presentational component into the mounting screen behind the flag.
5. Docs update: mark shipped and capture follow-ups.

Concept detail is the template. Its migration/read-path/routing specs are intentionally executable; future blocked surfaces should get the same treatment before Claude Code starts implementing.

## Single-Surface vs Multi-Surface

Single-surface cutover:

- Build one presentational component.
- Add one flag.
- Keep one preview route.
- Wire one mounting screen.

Multi-surface cutover:

- Build each leaf surface in its own build-only commit.
- Keep each leaf surface presentational and previewable.
- Use a single render-switch commit when the mounting screen flips multiple surfaces together.
- Prefer an atomic tab-level flag when the surfaces are one information architecture and cross-link heavily.

Reflect was the first multi-surface cutover: Race Log and Profile stayed separate inventory surfaces, but the Reflect tab flipped them together. Discover should follow the atomic-tab extension because six surfaces cross-link through one Discover IA.

## First-Ship Pattern

Some iOS-register surfaces do not replace anything. Trophy of Becoming is the example.

First ship needs different gates:

- Production entry point exists.
- Render-blocking data exists.
- Empty/default state is meaningful.
- Product has decided why the surface appears now.
- Rollback removes access without orphaning generated data.

Do not write "cutover" docs that imply a legacy predecessor if grep cannot find one.

## Escalation Pattern

Codex should make mechanical and architectural calls:

- flag seam
- file ownership
- hook signatures
- route shape consistent with repo patterns
- variant fallback when the design meaning is clear
- which data is render-blocking vs follow-up

Escalate product or strategy calls only when the repo/design cannot disambiguate:

- two valid product meanings produce different user promises
- a data model choice affects long-term analytics or billing
- a surface's presence changes the product roadmap, not just implementation

Escalations must include options, recommendation, and consequence. "Needs human input" without a recommendation is not useful.

## Agent Coordination

Three agents have distinct responsibilities:

- Claude Design owns visual canonical intent.
- Codex translates visual intent and architecture decisions into executable specs.
- Claude Code implements specs and should not re-decide product architecture unless the repo contradicts the spec.

Handoff rule: design URL + Codex spec should be enough for Claude Code to implement a build-only or cutover commit in one pass. If it is not enough, Codex writes the missing spec before implementation starts.

## Audit Template

For any staged set of surfaces, run this audit before render switch:

- Components present: paths, line counts, exports, presentational-only confirmation.
- Feature flag: name, default, env override, location.
- Preview route: flat route, imports component, direct URL reachable.
- Render switch absence: no production tab references before cutover.
- Production adapter check: flag-on branch imports presentational screens and hooks, not `app/*-ios.tsx` preview wrappers.
- Typecheck: current `npm run typecheck` result.
- Lint: new files clean; note whether `--no-verify` was needed because of pre-existing warnings.
- Commit references: build-only commit hash per surface.
- Pattern deviations: any route reuse, split commit, missing staging piece.
- Data dependencies: render-blocking, variant-blocking, follow-up.

The staging audit caught real queue/state problems: Profile was initially missed, Concept detail split across commits, and Trophy looked like a migration until grep proved it had no production mount.

## What We Would Do Differently

- Export canonical designs earlier. Several docs had to say "canonical in Claude Design" because the repo did not own the visual source of truth.
- Separate first-ship candidates earlier. Trophy should have been classified before cutover planning began.
- Require build-only commit hashes before writing readiness tables. Prompt-supplied hashes drifted; repo verification caught it, but late.
- Treat multi-surface IAs atomically sooner. Reflect clarified the pattern; Discover should not repeat early per-surface ambiguity.
- Write data specs before render-switch plans when variants depend on state. Concept detail planning improved once the migration/read-path/routing commits were specified.
- Keep snippets synced with specs. Once a "single cutover" decomposes into multiple implementation commits, the commit snippets need to move with the decomposition.
- Ban preview wrappers from production mounts. Reflect's first visual cutover proved that an embedded preview can look correct while leaking sample fixtures across interests.
- Treat production imports from `app/` as a hard stop in specs, not an editorial choice. The Get Inspired Commit 2 spec exhibited the same structural defect as the original Reflect data-wiring specs; see `CUTOVER_PATTERN.md` for the rule.
- Verify fix commits in git history, not just in the simulator. See `CUTOVER_PATTERN.md` for the git-log verification rule, banked after the Race Log segment-name fix shipped to the working tree but not to history.
- Track files at task-completion, not just at session-end. Codex doc-creation tasks should include explicit `git add` and commit steps for the files they produce instead of assuming downstream commits will sweep them in.
- Calibrate agent roles around repo-state verification. See `AGENT_COORDINATION_NOTES.md` for the finding that Codex specs and audits need explicit file/type/hash checks at write time, while Claude Code should keep stopping on spec/repo contradictions.

## Relationship To CUTOVER_PATTERN.md

Use `CUTOVER_PATTERN.md` for mechanical execution: commit order, feature flags, component conventions, preview routes, render switches, lint gotchas, and migration-plan updates.

Use this playbook for judgment: readiness, data blockers, first-ship vs migration, escalation, and how to coordinate Claude Design, Codex, and Claude Code.
