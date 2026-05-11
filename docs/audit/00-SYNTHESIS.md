# BetterAt Codebase Audit — Final Synthesis

*Branch: `audit/codebase-recon` · Read-only · 7 passes · Target audience: maintainer prepping the JHU School of Nursing dean demo*

This document rolls the 7 prior passes into a single prioritized worklist. Every finding is tagged P0/P1/P2, sized XS–XL, and flagged with a **DEMO-BLOCKER** marker when it would visibly break the JHU dean walkthrough described in `docs/DEMO-WALKTHROUGH.md`.

Effort scale (single-engineer working hours):
- **XS** ≤ 1 hr — single literal change
- **S**  1–4 hr — single file or single behavior
- **M**  ½ – 2 days — multi-file or careful migration
- **L**  3–5 days — cross-cutting refactor
- **XL** > 1 week — architectural rework

---

## How to read this

Each section is one ranked block of items. The **first 8 items** are the only ones that matter to make the JHU dean demo land. Everything else is debt that should be triaged after the demo, in priority order.

Citations follow `file:line` against the audit branch HEAD. Cross-references like *(P6 §7)* point at the pass deliverable that originated the finding.

---

## A. DEMO-BLOCKERS (do not demo without these)

These eight items will visibly break or contradict the script in `docs/DEMO-WALKTHROUGH.md`. They all need resolution before showing the product to the Dean.

### A1. JHU degree-program templates are not in the database — DEMO-BLOCKER · P0 · M
*Pass 7 §2.3*

`supabase/migrations/20260410120000_seed_jhu_degree_programs_and_templates.sql.skip` is the only source of the four MSN/DNP/HOL programs, their `program_sessions`, and the canonical `timeline_step_templates` that students subscribe to. The `.skip` extension prevents `supabase db push` from applying it. Demo beats #5, #8, #9 in `docs/DEMO-WALKTHROUGH.md:55,69,70` all describe subscribing to or browsing these programs. The peer-seed script (`scripts/seed-nursing-peers.ts:49-50`) explicitly assumes these rows exist.

**Action:** Rename the file (drop `.skip`), reconcile against current schema, apply against the demo Supabase, smoke-test the subscribe flow. Or build a one-shot seed mjs that idempotently inserts the same rows. Either path is M (½–1 day).

### A2. `clinical-reasoning-evaluate` is not AI — DEMO-BLOCKER · P0 · S
*Pass 6 §7 + Finding #1*

The most-likely-tested edge function for a nursing demo (`supabase/functions/clinical-reasoning-evaluate/index.ts:192`) contains **zero LLM calls**. It returns `buildFallbackEvaluation()` — a heuristic that picks a level from `(combined.length, completedSteps)` (`:37-41`) and returns canned strengths/improvements (`:64-76`). If the Dean asks any question that depends on the answer reflecting the student's actual reasoning, the response will not change in any meaningful way.

**Action:** Either route through `complete()` (`supabase/functions/_shared/ai/provider.ts:81`) like `race-coaching-chat` already does, or pre-script the demo to avoid the Review tab's reasoning eval. Wiring an LLM call into the existing function is S (2-3 hr) given the rest of the AI stack is plumbed.

### A3. `(tabs)/_layout.tsx` does not pass `workspaceContext` to the tab bar — DEMO-BLOCKER · P0 · S
*Pass 2 §3 + Carry #1*

`app/(tabs)/_layout.tsx:135` does not forward `workspaceContext` into the tab-config resolver. As a result, the mobile bottom tab bar **never** shows program-workspace labels — so on iPad/mobile the tab bar will keep saying "Races" / "Coaches" / "Practice" for a JHU student. The vocabulary engine works on web (because `NavigationDrawer` does pass it) but not in the mobile shell. Any demo beat that involves "log in as a nursing student" on a phone will leak sailing vocabulary.

**Action:** Wire `workspaceContext` through `getTabsForUserType()`. S (1–3 hr) with a careful test of every tab.

### A4. Sailing-tab redirect on blueprint subscribe — DEMO-BLOCKER · P0 · S
*Pass 4 §10 #1*

Three call sites push to `/(tabs)/races` after the subscribe action — the literal "I subscribed and my curriculum lands on my timeline" moment in `docs/DEMO-WALKTHROUGH.md:70`. For a nursing student, this kicks them into a sailing tab that has nothing for them.

**Action:** Replace the three redirects with `getEventTabRoute(workspaceContext)` or equivalent vocabulary-aware route. S.

### A5. Step-screen "back" fallback also lands in `/(tabs)/races` — DEMO-BLOCKER · P0 · XS
*Pass 3 Carry #8*

`app/step/[id].tsx:32, 53` falls back to `/(tabs)/races` when no back-stack is available. A nursing demo viewer who deep-links to a step (which the JHU demo does) and taps back will land on the sailing tab.

**Action:** Replace literal with the resolved tab route. XS.

### A6. `app/(tabs)/learn.tsx:100` hardcodes `'Coaches'` — DEMO-BLOCKER · P0 · XS
*Pass 2 Carry #2*

Will read "Coaches" instead of "Preceptors" on the JHU walkthrough screen #11 (`docs/DEMO-WALKTHROUGH.md:72`).

**Action:** Resolve via vocabulary. XS.

### A7. `window.prompt` for due-date editing on native — DEMO-BLOCKER · P0 · S
*Pass 3 Carry #1*

`window.prompt` does not exist on iOS/Android. Any demo flow that includes editing a step due date on a phone will throw. The JHU demo on `docs/DEMO-WALKTHROUGH.md:67-71` is a student timeline walkthrough — likely safe on web, but the user explicitly carried this as a demo blocker.

**Action:** Replace with `showAlert`/`showConfirm` cross-platform primitive (referenced in `CLAUDE.md` under "Web Compatibility"). S.

### A8. Step plan & critique surface hardcoded English labels — DEMO-BLOCKER (visible) · P0 · M
*Pass 3 Carry #2*

`components/step/StepPlanQuestions.tsx:1108, 1175, 1194, 1303`, `components/step/ActTab.tsx:48, 61`, `components/step/ReviewTab.tsx:70, 85, 98` ship hardcoded literals: "SESSION", "Mark Done", "Save & Reflect", "Instructor Feedback", and the four Q4/Q5/Competency titles. On a nursing student's step detail, these are the loudest sailing strings on screen.

**Action:** Plumb through `useVocabulary` or expose a `categoryLabels.stepFields` map. M because all four files need to be touched together to avoid divergence; alternatively do a tactical 5-string find-and-replace to nursing-appropriate strings just for the demo (S).

---

## B. POST-DEMO P0 (correctness debt that will bite)

Real bugs that the demo will likely not surface but will harm real users.

### B1. `instructor_review_status` labels disagree across mentor and mentee — P0 · XS
*Pass 5 #2*

"Needs Revision" on the mentor side vs "Revision Requested" on the mentee side. Same data, two strings. XS (1 file, 2 literals).

### B2. Adopt-on-mentee does not invalidate mentor caches — P0 · S
*Pass 5 #6*

Mentor's view of suggested steps never updates after the mentee adopts them. Requires `queryClient.invalidateQueries` in the mentee adopt handler. S.

### B3. `subscription_status` ignored in `checkBlueprintAccess` — P0 · S
*Pass 4 #9*

Recurring Stripe cancellations never revoke access — paid users keep their content after they stop paying. Single check to add. S.

### B4. Stripe Connect transfers missing `application_fee_amount` — P0 · S
*Pass 4 #8*

Fee is recorded in DB but **not collected** by Stripe; reconciliation must happen by hand. S (single param on the transfer call) but needs Stripe test-mode verification.

### B5. `betterat.com` regression in canonical share URL — P0 · XS
*Pass 4 #5*

`app/creator/[id].tsx:120` still emits `betterat.com` despite the start-of-audit commit `322b67a4 fix(blueprint): canonical share URL is better.at, not betterat.com`. Find-and-replace.

### B6. Personal UUID in production migrations — P0 · S
*Pass 7 §3*

`d67f765e-7fe6-4f79-b514-f1b7f9a1ba3f` (maintainer's auth UUID) is hardcoded as `v_author_id` in `supabase/migrations/20260325170000_seed_rhkyc_programs.sql:10` and `20260326050000_seed_hkis_hksf_programs.sql:22`, and as a direct cohort-member insert in `20260331190000_add_real_user_to_cohort.sql:4`. A fresh deploy on any other account will produce orphans. Move to seed scripts. S (with a follow-up migration that converts the existing rows to nullable / system-author).

### B7. Two duplicate Gemini implementations — P0 · S
*Pass 6 #5*

`supabase/functions/_shared/gemini.ts` and `supabase/functions/_shared/ai/providers/gemini.ts` are near-identical. A change to one will silently diverge. Keep only the provider-style one; switch the legacy callers (`step-plan-suggest` etc.) to `complete()`. S–M depending on retest coverage.

### B8. `step-plan-suggest` bypasses provider abstraction — P0 · S
*Pass 6 #4*

Highest-traffic AI endpoint (`supabase/functions/step-plan-suggest/index.ts:80`) calls `callGemini` directly. Cannot be re-routed via `AI_PROVIDER` env. Swap to `complete()` to inherit fallback chain + observability. S.

### B9. Cross-interest leak in Suggest Step "My Steps" tab — P0 · S
*Pass 5 #8 + Pass 3 cross-ref*

`useMyTimeline(null)` plus `SailorProfileService.getFollowing` short-circuit the active-interest scoping in `SuggestStepSheet`. A nursing user picking "from My Steps" can see their other interests' steps. S.

### B10. Brain-dump truncation is silent — P0 · S
*Pass 6 #10*

`services/ai/StepPlanAIService.ts:1395` caps the brain-dump JSON output at 1024 tokens — the model finishes mid-JSON, regex extraction returns `null`, and the user sees an "AI offline" toast for no apparent reason. Either raise the cap or stream/expand. S.

---

## C. P1 — visible quality (do after demo)

### C1. RegattaFlow strings in 100+ files — P1 · L
*Pass 1 §11 #4*

The brand rename is roughly half-done. Search returns 65+ occurrences in headers (`services/supabase.ts:135` sets `x-client-info: regattaflow`), email templates (`supabase/functions/send-welcome-email`, `send-trial-reminder`), OG images (`api/public/steps/[token]/og.ts`), `AuthProvider`, and ~90 components. Scope is measurable: this is a grep-and-replace plus careful diff. **L** because of risk of breaking deep-link slugs and auth callback URLs.

### C2. Demo account email-domain inconsistency — P1 · S
*Pass 7 §6*

Four conventions in active use (`@regattaflow.io`, `@betterat.app`, `@demo.regattaflow.io`, `@jhu-demo.edu`). Pick one (probably `@demo.betterat.app`), migrate the seed scripts, update `setup-demo-accounts.ts:18-39`.

### C3. Mentor voice strings hardcoded English — P1 · S
*Pass 5 #1*

"Your coach", "Your mentor", "Instructor Feedback" disagree across screens and never route through vocabulary. S.

### C4. `useInterestEventConfig.ts:20` defaults to `sail-racing` — P1 · S
*Pass 2 Carry #4*

Sailing vocabulary leaks any time `useInterestEventConfig` is called before the interest resolves. S.

### C5. Anthropic-branded UX on a Gemini-only stack — P1 · M
*Pass 6 #3*

Circuit breaker named `"Claude API"` (`lib/utils/aiCircuitBreaker.ts:204`), fallback messages say *"Anthropic API overloaded"* (`lib/utils/aiFallback.ts:177`), mock copy points users to `console.anthropic.com` (`:247, 281`). Confusing for support and observability. M because there are many copy points and at least one is a sailing-only mock generator.

### C6. AI client class triple-naming — P1 · S
*Pass 6 #13 + Pass 1 §11 #1*

`AIClient`/`EnhancedAIClient` + `ClaudeClient`/`EnhancedClaudeClient` aliases shipped in `services/ai/index.ts:7-18`. Plus `AIClient.createMessage` has **zero callers** (Pass 6 #6 — circuit breaker protects dead code). Delete the dead path; consolidate names. S.

### C7. `SailorSampleDataService` runs for every new sailor signup — P1 · S
*Pass 7 §4.1*

Sample Dragon-class boat, real-brand equipment ("Petticrows", "North Sails"), and hardcoded crew names get injected into any new sailor's profile. Reset button at `app/(tabs)/settings.tsx:372`. Either domain-gate behind sailing or remove entirely. S.

### C8. `DemoRaceService` branching in production hooks — P1 · S
*Pass 7 §4.2*

`hooks/useRacePreparation.ts:223,255` and `hooks/useGuestRaces.ts:118,164` swap real data for hardcoded demo races when `isDemoRace(id)` matches. Demo-data fallback inside a production hook is a footgun. S.

### C9. Hardcoded English Q4/Q5/Competency labels in step plan — P1 · S
*Pass 3 Carry #2 (overlaps A8 but extends to remaining screens)*

After A8 closes the demo-visible gap, the longer tail is in `StepPlanQuestions`, `ActTab`, `ReviewTab`. Route through vocabulary or a `categoryLabels.stepFields` map. S–M.

### C10. JHU degree program seed and competency catalog are duplicated — P1 · S
*Pass 7 §1.1 + §10*

`configs/competencies/nursing-core-v1.ts:25` and `scripts/seed-jhu-nursing-demo.mjs:71-122` repeat the same 50 competencies. The seed script's comment (`scripts/seed-jhu-nursing-demo.mjs:70`) says "must match" with no compile-time enforcement. Import the canonical config from the script. S.

### C11. JSON-extraction regex duplicated ~6 times — P1 · S
*Pass 6 #9*

`/\{[\s\S]*\}/` after fence-strip is hand-rolled in `StepPlanAIService` and `crossInterestSuggestions`. Falls back silently. Lift to a single `parseAIJson(text, fallback)` utility. S.

### C12. Dual-endpoint try-fallback duplicates system prompt — P1 · M
*Pass 6 #7*

Six call sites in `services/ai/StepPlanAIService.ts` follow `step-plan-suggest`-fails → `race-coaching-chat` with `system + '\n\n' + user` as a single prompt. The system role is lost; JSON-shape compliance drops. Plumb a `complete()` call that supports system messages on both endpoints. M.

### C13. AI activity logging has no `organization_id` — P1 · S
*Pass 6 §9 + Pass 6 #12*

`services/ai/AIActivityLogger.ts:51-62` payload has `club_id` (sailing-era) but no tenant scoping field. JHU admin cannot answer "how much AI activity in our org last week". Add column + write site. S (schema) + S (read sites).

### C14. WhatsApp / Telegram bots and `generate-race-coaching` / `club-onboarding` / `coach-matching` skip provider abstraction — P1 · M
*Pass 6 #14 + #15*

Use Anthropic SDK directly. Bypass circuit breaker and fallback chain. M.

### C15. Mobile blueprint subscribe fee model hardcoded `15%` — P1 · S
*Pass 4 #3*

Same 15% literal in webhook + UI. Move to a single constant + per-org override. S.

### C16. STATUS_CONFIG and access-pill labels hardcoded English — P1 · S
*Pass 4 #4*

No vocabulary integration on landing or creator surfaces. S.

### C17. `metadata.review.*` is unschema'd — P1 · M
*Pass 5 #3*

`as any` everywhere; blob-merge semantics depend on `useUpdateStepMetadata` internals. Schema the shape via Zod or TS-only types and lift to a service. M.

### C18. Header back/share/ellipsis menu navigates to `/library` — P1 · S
*Pass 3 Carry #7*

Ellipsis menu should be a contextual menu (share / delete / report / pin); it currently navigates away. S.

### C19. Demo-walkthrough Telegram switch commands run raw `node -e` against the prod DB — P1 · S
*Pass 7 §3*

`docs/DEMO-WALKTHROUGH.md:93-103, 158-161`. No env guard; one fat-finger and the prod state changes. Move to a checked-in script with a confirmation prompt.

### C20. 15 `.skip` migrations are undocumented — P1 · S
*Pass 7 §5*

Mix of intentional (deprecated schema) and demo-critical (`20260410120000_seed_jhu_degree_programs_and_templates.sql.skip`). Annotate each in-file or delete.

---

## D. P2 — hygiene & refactor backlog

### D1. Dead code — P2 · S each, parallelizable
*Pass 1 §11 #2,3,7,8,9 + Pass 4 #2 + Pass 6 #6*

- `providers/StripeProvider.tsx.old`
- `app/legacy.tsx`
- `app/creator/earnings.tsx` (494 lines — Pass 4 #2)
- `AIClient.createMessage` (zero callers)
- `lib/auth/firebaseBridge.ts` + `supabase/functions/firebase-auth-bridge/`
- Stale `Database` interface (`services/supabase.ts:194-746`) — typed schema doesn't include the BetterAt vocabulary tables
- Legacy `case 'coach'` arms in `lib/navigation-config.ts` while comment says coach persona is deprecated

### D2. Centralize hardcoded demo UUIDs — P2 · S
*Pass 7 §10*

`bec249c5-...` (nursing interest), `678e149e-...` (JHU org), `48361c72-...` (seed org), `130829e3-...` (Dragon class), Kevin's UUID, Savitri's UUID, Telegram chat ID. Lift to `lib/demo/constants.ts`.

### D3. Delete 3 SQL seed twins — P2 · XS
*Pass 7 §9*

`scripts/seed-demo-sailor-suggestions.sql`, `…-fixed.sql`, `…-final.sql` — only `…-correct.sql` is canonical. Same for `.ts`/`.mjs` twins.

### D4. `scripts/seed-*` manifest — P2 · S
*Pass 7 §1*

31 seed scripts; only 3 surfaced in `package.json`. Add a single `seed:demo` aggregate or a documented list.

### D5. Auto-adopt step-1 versus client-side adopt-all loop — P2 · M
*Pass 4 #6*

Two competing affordances, no transaction, partial timelines on partial failure. Pick one.

### D6. Notification-as-suggestion-table — P2 · M
*Pass 5 #5*

No separate suggestion model; no adopt/dismiss back-signal beyond `is_read`. Future feature work, not a regression.

### D7. `'custom'` magic-string sentinel — P2 · XS
*Pass 5 #4*

In `SuggestStepSheet` / `SuggestedStepsBar`. Replace with an explicit enum/discriminated union.

### D8. `getStatusPill` duplicated in two creator screens — P2 · XS
*Pass 5 #7*

Subtly different output. Lift to a single helper.

### D9. Apple/Google dev-console identity still says "RegattaFlow" — P2 · S (external)
*Pass 1 §11 #5 + §12*

`app.config.js:90` iOS reverse-client-id. Cannot be fixed in code — needs Apple/Google developer console reprovisioning.

### D10. `google-play-service-account.json` at repo root — P2 · XS (security review)
*Pass 1 §11 #11*

Worth checking is in `.gitignore` and rotated.

### D11. `SUPABASE-DIAG` bundle marker + verbose `[SUPABASE-FETCH]` logs in prod — P2 · XS
*Pass 1 §11 #6, #10*

Strip from web build.

### D12. Single API-key validation throw at module load — P2 · S
*Pass 6 #17*

`supabase/functions/_shared/gemini.ts:13` throws on import; cold-started function with missing env becomes a hard 500. Move to runtime check inside `callGemini`.

### D13. No usage telemetry surfaced to client — P2 · M
*Pass 6 #20*

Edge functions parse `usageMetadata` but discard before returning to client. `lib/config/aiModels.ts:161` has an unused `estimateCost()`. Surface tokens-in / tokens-out / model name.

### D14. Edge-function names lock in sailing vocabulary — P2 · L
*Pass 6 #16*

`race-coaching-chat`, `race-conditions-brief`, `sail-analysis-chat`, `race-analysis`, `generate-race-coaching`. Renaming requires redeploy + 36 client invoke-string updates for `race-coaching-chat` alone. Worth doing alongside C1 (rebrand).

### D15. Vocabulary key set (15 keys) too small for full tab bar — P2 · M
*Pass 2 Carry #6*

Either expand or move per-tab labels into `configs/{interest}.ts`. Architectural choice.

### D16. `configs/nursing.ts:919` keeps `'Shift Log'` independent of vocabulary — P2 · XS
*Pass 2 Carry #3*

Verify product intent then unify.

### D17. Hand-rolled Monte Carlo simulation in `aiService.ts` — P2 · XS (delete)
*Pass 6 #2*

`services/aiService.ts:631-647` returns `scenarios_analyzed: 1000, win_probability: 0.65` always. Delete and let the caller fall back, or label as `mock: true` on the response. XS.

### D18. `services/aiService.ts:547-548` persists hand-rolled strategy with `ai_generated: true` — P2 · XS
*Pass 6 #18*

Strategy strings from canned defaults (`:374-417`) get stored as if AI-generated, complete with `ai_model`. Audit/observability lies. XS.

### D19. Firebase bridge token poll — P2 · S
*Pass 4 #10*

Symptom-level workaround; deeper race between `FirebaseBridgeHandler` and `InterestProvider`'s URL handling. Fix once HKDW migration is fully retired.

### D20. `SailorProfileService` used universally for collaborator picker — P2 · S
*Pass 3 Carry #9*

Rename to `ProfileService` or `PeopleService` along with the rebrand thread.

### D21. Plan tab has two parallel renderers — P2 · M
*Pass 3 Carry #4*

`PlanTab` and `StepPlanQuestions` diverge on questions and button copy. Connection Space and org-location quick picks live only in the inline variant. Unify or document.

### D22. `instructor_review_*` field names live in metadata JSON — P2 · S
*Pass 3 Carry #6*

Cheap to rename (JSON keys) but every reader must change together.

### D23. `categoryLabels.tabs.X !== 'Prep'` string-equality resolver is fragile — P2 · XS
*Pass 3 Carry #3*

Recommend explicit `categoryLabels.tabs.usingDefault` flag.

### D24. `sail-analysis-chat` substring detection for sailing — P2 · S
*Pass 3 Carry #5 + Pass 6 #8*

`StepDetailContent.tsx:197` and `StepPlanAIService.ts:1244` use `isSailing` substring matching. Move to a domain-registry lookup so other interests can inject equipment context.

### D25. No retry / dead-letter on `notifyStepSuggested` — P2 · S
*Pass 5 #9*

Silent failure to both mentor and mentee.

### D26. `thinkingBudget: 0` hardcoded in two places — P2 · XS
*Pass 6 #19*

Already memoised as a known gotcha. Lift to a single constant.

### D27. Heavy worktree duplication of seed scripts — P2 · XS
*Pass 7 §1.1*

`.claude/worktrees/agent-*` paths bloat search. Add to `.ignore` for `rg`/Glob workflows.

---

## E. Cross-cutting themes (architectural)

These show up across multiple passes and deserve a paragraph each.

### E1. Vocabulary engine is read by exactly one slot
Pass 2, 3, 5 all surfaced this: vocabulary is consulted for the Learning Event tab title (`getEventTabTitle`) and then ignored elsewhere. The mentor labels, mentor voice strings, step plan questions, review status pills, ellipsis menu entries — none route through vocabulary. **Fixing this is the single highest-leverage architectural improvement** for multi-domain support. It's not a P0 because piecewise fixes (C3, C9, C16, A6, A8) cover the demo-visible gap; the architectural lift is a P1+ project that the team will need to scope post-demo.

### E2. Two backbones of demo data coexist
Pass 7 §4 documents this. The RegattaFlow-era `DemoRaceService` / `SailorSampleDataService` / `lib/demo/demoRaceData.ts` stack lives in **production hooks** alongside the BetterAt-era out-of-band seed scripts. Neither stack knows about the other. The risk is that a JHU student account that happens to land in the sailing interest gets injected Dragon-class boats and sample crew. C7 + C8 propose the surgical fixes; the deeper move is to delete `DemoRaceService` and `SailorSampleDataService` entirely once the catalog/freemium guest experience is removed or rebuilt for BetterAt.

### E3. AI provider story is half-migrated
Pass 6 §1–§5 documents two parallel edge-function stacks: ten functions go through the unified `complete()` provider abstraction with fallback chain + observability, while ten others (including `step-plan-suggest`, the highest-traffic endpoint) call `callGemini` directly. Client-side, three generations of AI client wrappers ship. Circuit breaker named "Claude API" wraps dead code (`AIClient.createMessage`). The 20 findings in Pass 6 §10 collectively describe the cleanup path. Pick **one** abstraction (`complete()`), retire the duplicate (`callGemini` direct callers, AIClient, EnhancedAIClient, Anthropic-branded fallback copy), and route all AI traffic through it. Estimated XL.

### E4. Personal/maintainer data leaks into checked-in source-of-truth
Pass 7 §3 + B6: the maintainer's auth UUID is in three migrations, the demo walkthrough hardcodes Telegram switch commands, and `denneyke@gmail.com` is the script default for nursing peer seeding. None of this is a security issue in itself but it makes the project un-rerunnable by anyone else. The fix is procedural: stop using migrations for personal data; centralize demo UUIDs in `lib/demo/constants.ts` (D2); document the seed flow (D4).

### E5. Sailing vocabulary embedded in identifiers, not just strings
Pass 6 #16 + Pass 7 §6: edge-function names (`race-coaching-chat`), service names (`SailorProfileService`, `DemoRaceService`), tab routes (`/(tabs)/races`), email domains (`@regattaflow.io`). String rebrand (C1) is L; identifier rebrand is XL because each rename has search-and-replace + redeploy + cache-bust dimensions.

---

## F. Suggested sequencing

If the goal is "make the JHU dean demo work this week", the minimum path is:

1. **Day 0 (today)**: A1 (re-enable JHU templates migration), A3 (`workspaceContext` to tabs), A4 (subscribe redirect), A5 (step-back fallback), A6 (`'Coaches'` literal), B5 (`betterat.com` regression). ~½ day of focused work.
2. **Day 1**: A8 (5 hardcoded labels in step screens — minimum tactical fix), A7 (`window.prompt` on native), A2 (clinical-reasoning-evaluate at least returns something thoughtful even if heuristic). ~½–1 day.
3. **Day 2**: Smoke-walk `docs/DEMO-WALKTHROUGH.md` end-to-end on web + mobile, fix anything that breaks. Buffer.

If the goal is "ship a clean v1 after the demo", add a sprint for **C1** (rebrand cleanup), **E1/E2/E3** (architectural consolidation), and **B1–B10** (correctness backlog).

---

## G. Audit hygiene notes

- This audit modified zero source files. Only `docs/audit/*.md` was created.
- 7 git commits on `audit/codebase-recon`, one per pass. See `git log audit/codebase-recon ^main`.
- Read-only verifications used `Read` / `Glob` / `Grep`; no edge functions invoked, no `supabase` CLI commands run.
- All citations are `file:line` against the audit branch HEAD at the time of capture. Drift will accumulate as fixes land.

---

End of synthesis. The screenshot index at `docs/audit/00-SCREENSHOT-INDEX.md` was the entry point and remains the source of UI-evidence cross-references.
