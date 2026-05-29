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

### Seed data: persona-incorrect rows (data pass, not code)
- [ ] Inbox suggestion "Scrub bottom" appears under Nursing — re-scope demo inbox suggestions per persona
- [ ] Junk substeps "Test", "Test 2", "Test 3" on a seeded step — remove from demo seed
- [ ] Blueprint author shows raw seed email `jhu2+denneyke@gmail.com` — set a real display name on the seed author profile
- [ ] Profile/account sheet shows `demo-sailor@regattaflow.app` under the Nursing persona — point nursing demo user at a nursing-appropriate identity
- [ ] Audit all three demo personas' seed for cross-persona bleed before each pitch

---

## P1 — Polish (states, copy, layout)

### Empty / loading / contradictory states
- [ ] **Discover → Nearby**: renders blank with no empty-state — add the same "set a home venue / nothing nearby yet" treatment Library Nearby has
- [ ] **Discover → Orgs**: stuck spinner (never resolves) — check the query; add error + empty fallbacks so it can't hang
- [ ] **Account sheet**: "Subscribed blueprints 0" while 3 blueprints are shown below — reconcile the count source with the rendered list
- [ ] **Step Review copy**: "from your 0 observations / 0 captures" reads awkwardly at zero — suppress or reword the zero case ("No observations logged yet")

### Copy / label bugs
- [ ] **Discover Today pick**: "Path · 4 steps · Path" — duplicate "Path" segment; dedupe the meta line
- [ ] **People subtitles truncate mid-word** ("12 stude…") — give the subtitle more width or `numberOfLines`/ellipsize at a word boundary
- [ ] **"COMING UP … 7mo ago"**: a future-tense header paired with a past relative time — shared timeline logic picking the wrong tense; fix is cross-platform (web + native)

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
