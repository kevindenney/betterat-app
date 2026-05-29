# Persona Demo Polish Plan

> Source: live walkthrough of the **Nursing (JHSON)** persona on iOS sim
> (2026-05-29), tabbing through Discover, Library, the account sheet, the
> inbox, the add-step composer, and the step-detail tabs. Goal: every
> surface must read as if built for *this* persona, with no sailing
> vernacular, no seed-data debris, and no contradictory/empty states.
>
> Three pitches ride on this: **HK Dragon Worlds** (sailing), **Johns
> Hopkins School of Nursing** (nursing), **PRADAN** (India SHG
> entrepreneurs). The sailing persona is the reference; nursing + PRADAN
> are where leaks show.
>
> Build order: P0 (demo-breaking) → P1 (polish) → verify each on-sim per
> persona. Check items off as MCP/logs/sim confirm the fix.

---

## P0 — Demo-breaking (sailing vernacular + seed debris)

### Code: hardcoded sailing strings → vocab()
- [x] `lib/vocabulary.ts` — add `Peer`/`Peers` keys to all 14 interest maps
- [x] `components/library/plans/PlanRowCard.tsx` — subscriber count `sailor(s)` → `vocab('Peer'|'Peers')`
- [x] `components/library/LibraryNearbyContent.tsx` — empty-state + section copy: `clubs`/`sailors` → `organizations`/`vocab('Peers')`
- [x] `components/library/LibraryLanding.tsx` — Nearby zone description → `organizations` + `vocab('Peers')`
- [x] `components/library/zones/PeopleZone.tsx` — empty-state `sailors and coaches` → `vocab('Peers')` + `vocab('Coaches')`
- [x] `components/capture/PlusComposerV3Sheet.tsx` — placeholder "Sunita's spinnaker tip…" → neutral "What do you want to work on?" *(left in working tree, not committed — file carries unrelated WIP)*
- [ ] Sweep for remaining sailing literals across non-Library surfaces (grep `sailor|spinnaker|downwind|regatta|club\b|leeward|windward|tack|leg\b` in `components/` + `app/`, excluding `sailing/` dirs and route names like `/sailor/[id]`)

### Seed data: persona-incorrect rows (data pass, not code) — applied on BetterAt-dev 2026-05-29
- [x] Inbox suggestion "Scrub bottom" appears under Nursing — dismissed; also dismissed 3 other junk pending suggestions ("Diagnostic accept #3", "with bruwh", "Test suggest")
- [x] Junk substeps "Test", "Test 2", "Test 3" on a seeded step — cleared `how_sub_steps` to `[]` on "Learn Basic First Aid & Rescue" (026ea784) + empty placeholders on "Fundamentals & Patient Safety" (2c0e5c35)
- [x] Blueprint/author chip shows raw seed email — set human `full_name` on 10 demo profiles (and matching `public.users` rows): jhu2 → Dr. Evelyn Reyes, szanton → Dr. Sarah Szanton, pradan.field → Suman Tirkey, sailing cast → Markus Tham / Ricardo Costa / Tomás Renart / Yvonne Leung / Demo Sailor / Sailor One
- [x] Profile/account sheet showed `demo-sailor@regattaflow.app` — `full_name` now "Demo Sailor" in both `profiles` and `users`
- [ ] Audit all three demo personas' seed for cross-persona bleed before each pitch
- [ ] Note: profile fixes are DB-only on dev; if the demo DB is reseeded, ensure `scripts/seed-multi-audience-demo-personas.mjs` / signup trigger writes `full_name` (not the email) so this doesn't regress

---

## P1 — Polish (states, copy, layout)

### Empty / loading / contradictory states
- [x] **Discover → Nearby**: rendered blank — root cause: the `nearby` segment was the only one not passed `toolbarOffset`, so the empty card drew at y=0 *behind* the floating toolbar. Added `toolbarOffset` prop + applied as top inset on every branch; also fixed `isLoading` AND→OR (was hiding the loader prematurely) and replaced sailing copy ("clubs/sailors/where you sail from") with `organizations` + `vocab('Peers')`. Verified on-sim under Nursing.
- [x] **Discover → Orgs**: not reproducible — `DiscoverOrgsContent` already has try/catch → `setOrgs([])`, a `finally` that always flips `loading=false`, and a `cells.length === 0` empty state. DB query is 2.7ms with trivial SELECT RLS (`is_active = true`). Renders the full club list on-sim. The original observation was a transient mid-load frame, not a hang. No code change.
- [x] **Account sheet**: count read `plan_subscriptions` (status=active) while the Library list it links to reads `blueprint_subscriptions`. Demo personas had 0/0/4 across the two — hence "0" over a populated list. Pointed the count at `blueprint_subscriptions` (subscriber_id). Confirmed row counts on dev.
- [x] **Step Review copy**: `SynthesisPrompt` now returns null when `capturesCount === 0` — nothing to synthesize from, so the "from your 0 observations" copy can't render for any persona.

### Copy / label bugs
- [x] **Discover Today pick**: deduped the meta line — `From {author}` (or `Blueprint`) · `{n} steps`, dropped the trailing duplicate "Path".
- [x] **People subtitles truncate mid-word** ("12 stude…"): in `PersonRowCard` the role was inline next to the name competing for one row; moved it to its own line so it ellipsizes at the row width instead of mid-word. (Discover's `CanonicalPersonRow` already wraps to 2 lines — fine.)
- [x] **"COMING UP … 7mo ago"**: `L3SeasonView` AnchorStrip now filters to `daysAway >= 0` (and hides the strip if none remain), so a future-tense header can't pair with a past anchor.

---

## Keep as-is (validated strengths — do not regress)
- Discover Today pick card ("IV insertion · supervised") reads exactly right for nursing
- People profiles (MSN Cohort '26 tracks, CRNA, DNP) — rich and persona-true
- Library Resources (AACN, Bates, NEJM) — correct nursing canon
- Concepts empty states — clear and on-voice

---

## Verification protocol (per item)
1. Make the change; `npm run typecheck` + lint touched files (`--max-warnings 0`).
2. Switch the sim to the affected persona; navigate to the exact surface.
3. Confirm the persona-native term/state renders (use `read_console_messages` / Supabase logs for data-backed items).
4. Spot-check the **sailing** persona for the same surface — the fix must not regress the reference persona.
5. Check the box; commit per logical unit (explicit paths only).
