# Pass 7 — Seed Data & Test Artifacts

Read-only audit of the seed scripts, demo accounts, fixture data, hardcoded demo IDs, disabled migrations, and live "sample data" code paths that the demo experience depends on. Every claim is grounded in a `file:line` citation.

> Audit branch: `audit/codebase-recon`. No source code or data was modified.

---

## TL;DR

- **The JHU Dean demo silently depends on a disabled migration.** `supabase/migrations/20260410120000_seed_jhu_degree_programs_and_templates.sql.skip` is the canonical source of MSN/DNP programs, `program_sessions`, `timeline_step_templates`, and Playbook baseline concepts (`supabase/migrations/20260410120000_seed_jhu_degree_programs_and_templates.sql.skip:1-11`). With the `.skip` suffix this migration is **not applied** by Supabase CLI. The peer seed script `scripts/seed-nursing-peers.ts:49-50` explicitly says it expects those templates to exist — so without manual intervention, the "subscribe to MSN curriculum and watch it land on the timeline" demo beat (`docs/DEMO-WALKTHROUGH.md:70`) cannot work.
- **Personal account UUIDs are baked into production migrations.** Kevin's auth UUID `d67f765e-7fe6-4f79-b514-f1b7f9a1ba3f` appears as `v_author_id` in `supabase/migrations/20260325170000_seed_rhkyc_programs.sql:10`, `supabase/migrations/20260326050000_seed_hkis_hksf_programs.sql:22`, and as a hardcoded cohort member in `supabase/migrations/20260331190000_add_real_user_to_cohort.sql:4`. Migrations are committed source-of-truth — these will replay on every fresh environment.
- **Two parallel demo backbones coexist.** A RegattaFlow-era hardcoded data layer (`lib/demo/demoRaceData.ts`, `services/DemoRaceService.ts`, `services/onboarding/SailorSampleDataService.ts`) is still wired into the running app, while the BetterAt-era seed scripts (`scripts/seed-jhu-nursing-demo.mjs`, `scripts/seed-nursing-peers.ts`, `scripts/seed-india-demo.ts`) populate Supabase out-of-band. Neither stack knows about the other.
- **`isDemoRace` branching leaks throughout race-prep code.** `hooks/useRacePreparation.ts:223,255` and `hooks/useGuestRaces.ts:118,164` call `DemoRaceService.getDemoRacePreparation()` and `isDemoRace()` from non-demo code paths, so real-user behavior diverges from demo behavior based on an ID match against hardcoded constants.
- **15 disabled (`.sql.skip`) migrations** sit in `supabase/migrations/` — abandoned features (Rule 42 tracking, live race signals, fleet race prep seed, mock coach data, JHU degree programs). They are not documented anywhere.
- **Demo accounts still use `regattaflow.io` and mixed branding.** `scripts/setup-demo-accounts.ts:18-39` creates `demo-sailor@regattaflow.io`, `demo-club@regattaflow.io`, `demo-coach@regattaflow.io`. The India demo uses `@betterat.app`; JHU uses suffix-only `@jhu-demo.edu` (not real JHU). This inconsistency surfaces in the UI any time a demo email is shown.

---

## 1. Seed script inventory

The `scripts/` directory contains **31 files matching `seed-*`** (Glob `scripts/seed-*`). The mjs/ts/sql split is:

| Category | Count | Examples |
|---|---|---|
| `.mjs` (Node) | 23 | `seed-jhu-nursing-demo.mjs`, `seed-rhkyc-demo.mjs`, `seed-dragon-fleet-demo.mjs` |
| `.ts` (tsx) | 4 | `seed-nursing-peers.ts`, `seed-india-demo.ts`, `seed-venues.ts`, `seed-boat-data.ts` |
| `.sql` | 4 | `seed-demo-sailor-suggestions{,-fixed,-final,-correct}.sql` (4 versions of the same file) |

Only **three** are surfaced through `package.json` (`package.json:33-35`):

```
"seed:jhu":     "node scripts/seed-jhu-nursing-demo.mjs"
"seed:rhkyc":   "node scripts/seed-rhkyc-demo.mjs"
"seed:sailors": "node scripts/seed-sailors-tab-demo.mjs"
```

The other 28 are run by hand (`npx tsx ...` / `node ...`). There is no manifest documenting which to run, in what order, or against which environment. `seed-nursing-peers.ts:13` documents itself via the leading docstring; `seed-india-demo.ts:11-16` does likewise; the rest rely on tribal knowledge.

> Risk: **demo reproducibility**. A fresh environment cannot be seeded by anyone except the original author without reading docstrings file-by-file.

### 1.1 Worktree duplication

`Glob "**/seed*"` reveals each seed script also exists under at least three `.claude/worktrees/agent-*` paths (see the truncated Glob output). These are Claude Code worktrees, not source-of-truth, but they bloat search results and inflate `find` time on the repo.

---

## 2. The JHU demo seed chain

The JHU Dean demo composes **four** seed steps that must execute in order. Three are documented; one is implicit.

### 2.1 `scripts/seed-jhu-nursing-demo.mjs` (714 lines)

Creates the JHU organization, 30 students, 4 preceptors, 2 faculty, 1 cohort, and a fully-populated competency/attempts/reviews/timeline corpus.

Key hardcoded artifacts:

- `ORG_ID = deterministicUuid('org', 'jhu-nursing')` (`scripts/seed-jhu-nursing-demo.mjs:66`) — produces `48361c72-3705-fe99-a34a-3389c0be6692`.
- `INTEREST_ID = 'bec249c5-6412-4d16-bb84-bfcfb887ff67'` (`scripts/seed-jhu-nursing-demo.mjs:430`) — **literal hardcode**, not deterministic, embedded again at lines 611 and 668. Same UUID appears in 6 other files (`Grep bec249c5-...` returns 7 file matches).
- 50 AACN competencies inlined as `NURSING_CAPABILITIES` (`scripts/seed-jhu-nursing-demo.mjs:71-122`). Mirrors `configs/competencies/nursing-core-v1.ts:25` — comment at `scripts/seed-jhu-nursing-demo.mjs:70` warns "must match" but there is no compile-time enforcement.
- Tier-weighted random distribution of student progress (`STATUS_WEIGHTS` at `scripts/seed-jhu-nursing-demo.mjs:166-171`) — each run produces different per-student rosters.
- Student emails: `${first.toLowerCase()}.${last.toLowerCase()}@jhu-demo.edu` (`scripts/seed-jhu-nursing-demo.mjs:189`). `jhu-demo.edu` is not a real domain. Preceptors get `@jhu-hospital-demo.edu`; faculty `@jhu-faculty-demo.edu`.
- Reviewer/preceptor pick is `pickRandom()` at `scripts/seed-jhu-nursing-demo.mjs:486-487` — same competency may belong to a different preceptor on each replay. Validation timestamps are uniformly random within 1–21 days ago (`scripts/seed-jhu-nursing-demo.mjs:497`), so the time-series chart will look uniform/uninformative.

### 2.2 `supabase/migrations/20260401170000_merge_duplicate_jhu_orgs.sql`

A post-hoc cleanup migration: moves all data created by `seed-jhu-nursing-demo.mjs` (under org `48361c72-...`) **into a different canonical org `678e149e-2abb-422c-ac61-b76756a2150e`** (`supabase/migrations/20260401170000_merge_duplicate_jhu_orgs.sql:1-3`), then deletes the seed org and six other empty duplicates (`supabase/migrations/20260401170000_merge_duplicate_jhu_orgs.sql:50-57`).

This means **the org ID the seed script writes is different from the org ID the app reads**. Every line of seed code that hardcodes `48361c72-...` is implicitly relying on this merge migration having already been applied.

### 2.3 `supabase/migrations/20260410120000_seed_jhu_degree_programs_and_templates.sql.skip` — DISABLED

423 lines. Purpose (`supabase/migrations/20260410120000_seed_jhu_degree_programs_and_templates.sql.skip:1-11`):

- Insert 4 degree programs: MSN Entry into Nursing, DNP-FNP, DNP-PMHNP, Healthcare Organizational Leadership.
- Insert `program_sessions` (semesters).
- Insert `timeline_step_templates` (the canonical curriculum that students subscribe to).
- Insert Playbook baseline `playbook_concepts` for nursing.

**This migration has the `.skip` extension, so Supabase CLI will not apply it.** No comment in the file or any other file explains why. The demo walkthrough (`docs/DEMO-WALKTHROUGH.md:55,70`) sells "Four programs published as blueprints" and "Students subscribe with one tap" — both depend on these rows existing.

### 2.4 `scripts/seed-nursing-peers.ts` — peers

Creates 5 fake peer accounts `nursing-peer-{1..5}@demo.regattaflow.io` (`scripts/seed-nursing-peers.ts:42-46`). The script's docstring (`scripts/seed-nursing-peers.ts:49-50`) explicitly says:

> "MSN Entry into Nursing curriculum, matches templates seeded in supabase/migrations/20260410120000_seed_jhu_degree_programs_and_templates.sql"

That migration is disabled (§2.3). The peer script falls back to inlining its own copy of the curriculum (`scripts/seed-nursing-peers.ts:51-87`), but the templates the peers should be linked to do not exist, so blueprint-driven assertions in the UI (subscribe-to-template counts, "X students enrolled") will be empty for the JHU org.

### 2.5 `supabase/migrations/20260331190000_add_real_user_to_cohort.sql`

```sql
INSERT INTO betterat_org_cohort_members (user_id, cohort_id)
VALUES ('d67f765e-7fe6-4f79-b514-f1b7f9a1ba3f', '99d86cd8-aa39-4d9b-a664-bef240d3133b')
```

(`supabase/migrations/20260331190000_add_real_user_to_cohort.sql:3-5`) — adds the maintainer's personal auth UUID to a hardcoded cohort. There is no protection against this firing in environments where neither row exists.

---

## 3. Personal-UUID leak into production migrations

`Grep "d67f765e-7fe6"` in `supabase/migrations/*.sql` returns **3** non-`.skip` migrations that hardcode the maintainer's auth UUID:

| File | Line | Context |
|---|---|---|
| `supabase/migrations/20260325170000_seed_rhkyc_programs.sql` | 10 | `v_author_id uuid := 'd67f765e-...'` — every RHKYC program will list Kevin as author forever |
| `supabase/migrations/20260326050000_seed_hkis_hksf_programs.sql` | 22 | Same pattern for HKIS / HKSF |
| `supabase/migrations/20260331190000_add_real_user_to_cohort.sql` | 4 | Direct cohort membership insert |

Also referenced (read-only, not insert) in `docs/audit/00-SCREENSHOT-INDEX.md`, `docs/DEMO-WALKTHROUGH.md:158-161`, `scripts/seed-nursing-peers.ts:31` (default `--user-email denneyke@gmail.com`).

> Risk: **production data hygiene**. If the maintainer's account is ever deleted, three migrations will produce orphan rows on replay. If a different operator runs the demo against a fresh project, those migrations will reference a UUID that does not exist in `auth.users`.

The Telegram demo also pins UUIDs: `f160779d-5a54-465e-a0f9-b97b94f6a475` (Savitri) and `d67f765e-...` (Kevin) plus `telegram_user_id=8266922334` (Patrick? Kevin's Telegram?) hardcoded in the switch commands at `docs/DEMO-WALKTHROUGH.md:96,103,158-161`. The switch commands run raw `node -e` against the production DB; there is no env guard.

---

## 4. Live in-app demo data services

Two services still inject hardcoded sample data into the live application surface — not just into seed scripts.

### 4.1 `services/onboarding/SailorSampleDataService.ts`

- Creates a sample Dragon-class boat, 5 boat names, 2 crew, 4 equipment items, and at least one historical race for any new sailor account (`services/onboarding/SailorSampleDataService.ts:18-48`).
- `DRAGON_CLASS_ID = '130829e3-05dd-4ab3-bea2-e0231c12064a'` is hardcoded — environment-specific UUID embedded in shipping code.
- Hardcoded crew names (`Alex Chen`, `Sam Wong`) and equipment names referencing real brands (`Petticrows`, `North Sails`, `Sta-Lok`).
- Wired into `app/(tabs)/settings.tsx:12,208` as a user-facing **"Reset Sample Data"** button (`app/(tabs)/settings.tsx:201,372`).

For a nursing demo this is dead weight; for a fresh JHU dean signup it would inject sailing equipment into their profile if they hit the button.

### 4.2 `services/DemoRaceService.ts`

Wraps the hardcoded `lib/demo/demoRaceData.ts` module (`services/DemoRaceService.ts:1-14`). Caches in-memory for 1 hour (`services/DemoRaceService.ts:35`). Used at three live entry points:

| Caller | Line | What it does |
|---|---|---|
| `app/(tabs)/races.tsx` | 126, 363 | Falls back to `DemoRaceService.getDemoSeason()` cast to `SeasonWithSummary` |
| `hooks/useRacePreparation.ts` | 10, 223, 255 | If `isDemoRace(targetRegattaId)` → return `getDemoRacePreparation()` instead of live data |
| `hooks/useGuestRaces.ts` | 10, 118, 164 | Guest experience returns the entire demo race list verbatim |

So a sailor whose `regatta_id` happens to match a hardcoded constant in `lib/demo/demoRaceData.ts` will get demo data instead of their real prep state. The collision risk is low (UUIDs), but the **conditional branch** still lives in production hooks and is unrelated to the JHU demo path.

> The two services are mutually exclusive: the JHU demo never touches `DemoRaceService` or `SailorSampleDataService`. They exist solely from the RegattaFlow era. They are not load-bearing for the dean demo, but they are unguarded surface area in shared code paths.

---

## 5. `.skip` migrations — abandoned features

`Glob supabase/migrations/*.skip` returns **15** files. None are commented. None appear in any deployment doc.

| Migration | Apparent purpose |
|---|---|
| `20251105000000_seed_demo_race_analysis.sql.skip` | Sailing-era demo data |
| `20251106121000_create_mock_coach_data.sql.skip` | Mock coach rows |
| `20251109000000_seed_fleet_race_prep_data.sql.skip` | Demo fleet prep |
| `20251109130000_add_coaching_clients_fkeys_and_mock_data.sql.skip` | Mock coaching client data |
| `20251109140000_add_coaching_clients_foreign_keys.sql.skip` | Schema (not seed) — disabled |
| `20251109150000_sync_sailor_boats_to_classes.sql.skip` | Backfill — disabled |
| `20251201000001_create_race_crew_assignments_table.sql.skip` | Schema — disabled |
| `20251201100000_create_venue_knowledge_platform.sql.skip` | Schema — disabled |
| `20251202000001_rule42_tracking.sql.skip` | Schema — disabled |
| `20251202000002_live_race_signals.sql.skip` | Schema — disabled |
| `20260102000000_add_fleet_notifications_foreign_keys.sql.skip` | Schema — disabled |
| `20260102000000_email_confirmation_welcome.sql.skip` | Auth flow — disabled |
| `99999999999999_fix_timeline_events_constraint.sql.skip` | Hotfix — disabled |
| `20260209200000_delete_demo_users.sql.skip` | Cleanup — disabled |
| `20260410120000_seed_jhu_degree_programs_and_templates.sql.skip` | **JHU templates (see §2.3)** |

Some are intentional (schema features deprecated). Others — like `20260410120000_seed_jhu_degree_programs_and_templates.sql.skip` — are demo-critical. There is no convention that distinguishes the two, and `git log` is the only way to learn why each was disabled.

> Risk: **mystery state**. A new operator running `supabase db reset` will not get JHU degree programs even if the demo script says they should.

---

## 6. Demo account naming inconsistency

The three demo persona stacks each use a different email convention:

| Source | Pattern | Examples |
|---|---|---|
| `scripts/setup-demo-accounts.ts:18-39` | `@regattaflow.io` | `demo-sailor@regattaflow.io`, `demo-coach@regattaflow.io` |
| `scripts/seed-india-demo.ts:53-83` | `@betterat.app` | `demo-savitri@betterat.app`, `demo-suman@betterat.app` |
| `scripts/seed-nursing-peers.ts:42-46` | `@demo.regattaflow.io` | `nursing-peer-1@demo.regattaflow.io` |
| `scripts/seed-jhu-nursing-demo.mjs:189` | `@jhu-demo.edu` etc. | `emily.rodriguez@jhu-demo.edu` |

These addresses surface anywhere the UI shows user emails — peer lists, faculty rosters, "invited by" trails. The brand inconsistency is visible to the demo audience.

Additionally, `Grep "regattaflow\.io"` returns 24 file matches across both runtime code (`providers/AuthProvider.tsx`, `app/(tabs)/settings.tsx`, `supabase/functions/send-welcome-email/index.ts`, `supabase/functions/send-trial-reminder/index.ts`) and seed scripts. Even after the BetterAt rebrand, sender domains and example users still say RegattaFlow.

---

## 7. Test suite shape

`Glob **/*.test.{ts,tsx,js,jsx}` returns **>100** test files (truncated). The split is:

- `api/__tests__/` — auth, AI endpoint contract, club workspace bootstrap, domain resolution
- `app/__tests__/` — route contracts (programs, settings, onboarding, coach-home, communications), regressions, signature-insight surfaces
- `services/__tests__/` — RLS SQL-security (`OrganizationInviteService.security.test.ts`, `AssessmentRecordsRls.sql-security.test.ts`, `ProgramsCoreRls.sql-security.test.ts`, `CommunicationTemplatesRls.sql-security.test.ts`), service contracts (`ProgramService.contract.test.ts`, `RaceChecklistSignatureInsight.{contract,behavior}.test.ts`), TimelineStepService, NotificationService, LibraryService
- `scripts/__tests__/` — CI gate contracts, deployment readiness, integration validation
- `lib/__tests__/`, `lib/programs/__tests__/`, `lib/coach/__tests__/`, `hooks/__tests__/` — narrow unit tests
- `services/ai/__tests__/EducationalIntegration.test.ts`, `services/__tests__/aiService.selectDocumentAndGenerateStrategy.test.ts`, `lib/config/__tests__/aiModels.test.ts`, `app/__tests__/ai-strategy.utils.test.ts` — AI-adjacent unit tests

Observations:

- No tests for `StepPlanAIService`, `BrainDumpAIService`, `PlaybookAIService`, `RaceCoachingService`, the entire `supabase/functions/_shared/ai/*` stack, or `clinical-reasoning-evaluate` (the non-AI heuristic; Pass 6 §7).
- `services/__tests__/RaceSuggestionService.test.ts` and `aiService.selectDocumentAndGenerateStrategy.test.ts` are surface-level — they mock the LLM and assert on adapter logic, not on the prompt-shaping or fallback behavior.
- No e2e or contract tests target the JHU nursing happy path. `e2e/README.md` and `.maestro/auth/*` cover sailor auth flows only.
- `package.json:41` test:ci:gates:unit lists **35** explicit test files — large but selective. The full `jest` suite is not run in CI by default; only the named subset.

Coverage is heavy where it gates deploys (RLS SQL, routing contracts) and thin where it would catch demo regressions (AI prompts, JHU domain wiring, blueprint subscription flow).

---

## 8. Fixture/mock data inventory in runtime code

`Grep` for `SAMPLE_|sample_data|isSample|mockData|MOCK_|fake_|placeholder` against `{services,hooks,components,app}/**/*.{ts,tsx}` returns **75 occurrences across 15 files** (head_limit 30 file list). Notable hot spots:

| File | Hit count | Notes |
|---|---|---|
| `services/onboarding/SailorSampleDataService.ts` | 30 | Defines and consumes its own sample data |
| `services/PostRaceLearningService.ts` | 21 | Sample/placeholder content in production service |
| `services/DemoRaceService.ts` | 1 | Demo-race branching (covered §4.2) |
| `services/TemplateService.ts` | 1 | "placeholder" — needs grep |
| `services/BathymetryTileCacheService.ts` | 1 | Likely cache key placeholder |
| `components/blueprint/PublishBlueprintSheet.tsx` | 6 | UI-side placeholder text |
| `app/catalog-race/index.tsx` | 3 | Sailing-era catalog page |
| `hooks/usePrograms.ts` | 1 | Worth verifying — programs feed the JHU demo |
| `hooks/useForYouItems.ts` | 1 | "For You" rail in §2.4 docs |
| `hooks/useStepDetail.ts` | 2 | Step rendering — see Pass 3 |

This is not necessarily wrong (UI placeholder copy is fine) but is a useful inventory of where mock/sample logic could short-circuit a demo.

`Grep "@demo\.|@jhu-demo|@jhu-faculty|@jhu-hospital|regattaflow\.io"` shows demo-email patterns in **24** files including `providers/AuthProvider.tsx`, `services/agents/ClubOnboardingAgent.ts`, `supabase/functions/club-scrape/index.ts`, `supabase/functions/send-welcome-email/index.ts`, `supabase/functions/send-trial-reminder/index.ts`. The welcome-email function in particular will send mail to demo accounts at sailing-era domains.

---

## 9. SQL seed redundancy

`scripts/seed-demo-sailor-suggestions.sql`, `…-fixed.sql`, `…-final.sql`, `…-correct.sql` are all present in the repo — four versions of the same file (Glob `**/seed*`). Only `…-correct.sql` is the surviving canonical version, but there is no commit note pruning the others.

Similarly:

- `scripts/insert-demo-data.sql` and `scripts/insert-demo-data-direct.mjs` — JS wrapper around the same SQL.
- `scripts/seed-demo-race-analysis.{mjs,ts}` — TS and JS twins.

> Risk: someone runs the wrong copy and produces inconsistent state.

---

## 10. Hardcoded "magic" UUIDs across the demo

Grouping the constants surfaced in this pass:

| UUID | Meaning | Locations |
|---|---|---|
| `bec249c5-6412-4d16-bb84-bfcfb887ff67` | Nursing interest | `scripts/seed-nursing-peers.ts:22`, `scripts/seed-jhu-nursing-demo.mjs:430,611,668`, `supabase/migrations/20260410120000_seed_jhu_degree_programs_and_templates.sql.skip:22`, 3 others |
| `678e149e-2abb-422c-ac61-b76756a2150e` | Canonical JHU org | `supabase/migrations/20260401170000_merge_duplicate_jhu_orgs.sql:8,13,...`, `supabase/migrations/20260410120000_seed_jhu_degree_programs_and_templates.sql.skip:21` |
| `48361c72-3705-fe99-a34a-3389c0be6692` | Seed-generated JHU org (merged away) | `scripts/seed-jhu-nursing-demo.mjs:66` (deterministic), `supabase/migrations/20260401170000_merge_duplicate_jhu_orgs.sql:9` |
| `99d86cd8-aa39-4d9b-a664-bef240d3133b` | Cohort | `supabase/migrations/20260331190000_add_real_user_to_cohort.sql:4` |
| `d67f765e-7fe6-4f79-b514-f1b7f9a1ba3f` | Kevin (personal) | 4 migration files + `docs/DEMO-WALKTHROUGH.md` switch commands |
| `f160779d-5a54-465e-a0f9-b97b94f6a475` | Savitri | `docs/DEMO-WALKTHROUGH.md:96` |
| `130829e3-05dd-4ab3-bea2-e0231c12064a` | Dragon class | `services/onboarding/SailorSampleDataService.ts:18` |
| Telegram `chat_id=8266922334` | Demo Telegram user | `docs/DEMO-WALKTHROUGH.md:96,103,158-161` |

A drift-resistant seed system would centralize these in one file. They currently live wherever they were first typed.

---

## 11. Findings — prioritized

P0 — block the JHU demo if not resolved:

1. **Re-enable or replicate `20260410120000_seed_jhu_degree_programs_and_templates.sql.skip`.** Without it, the "subscribe to MSN curriculum" demo beat has no templates to subscribe to.
2. **Verify `scripts/seed-nursing-peers.ts` against current schema and `interest_id`.** It expects templates from the disabled migration.
3. **Confirm `seed-jhu-nursing-demo.mjs` runs cleanly against the current org after the `merge_duplicate_jhu_orgs` migration.** The org-ID hand-off between scripts and migrations is fragile.

P1 — visible quality issues:

4. Standardize demo email domains. Sailing-era `@regattaflow.io` should not appear in a JHU demo.
5. Move Kevin's personal UUID out of `supabase/migrations/2026032{5,6}*.sql` and `20260331190000_add_real_user_to_cohort.sql`. Use seed scripts, not migrations, for personal data.
6. Document the 15 `.skip` migrations. Either delete them or note in-file why they are inactive.
7. Decommission `services/onboarding/SailorSampleDataService.ts` (and the "Reset Sample Data" button at `app/(tabs)/settings.tsx:372`) or gate it behind a sailing-domain check. It currently runs for every sailor signup including JHU students who somehow land in the sailing interest.
8. Remove or domain-gate `DemoRaceService` branching in `useRacePreparation.ts:223,255` and `useGuestRaces.ts:118,164`. Demo-data fallback inside a production hook is a footgun.

P2 — hygiene:

9. Delete the 3 stale SQL variants of `seed-demo-sailor-suggestions*.sql`.
10. Add a `scripts/seed-*` manifest (or single `seed:demo` aggregate target in `package.json`) so the demo flow is one command.
11. Move the 50 nursing competencies into a single source-of-truth module imported by both `configs/competencies/nursing-core-v1.ts` and `scripts/seed-jhu-nursing-demo.mjs:71-122`.
12. Centralize demo UUID constants (§10) in `lib/demo/constants.ts` or similar.

---

End of Pass 7.
