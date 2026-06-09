# Atlas Race Source-of-Truth Reconciliation

**Status:** Spec only — not started. Blocks the "one course, many races" payoff + Series-on-map.
**Created:** 2026-06-09
**Owner:** Kevin Denney
**Related:** `ORG_ADMIN_CALENDAR_RACE_MODEL_SPEC.md` (the universal race model + 3-way fragmentation),
`PHASE_I_SERIES_FEATURE_INTEGRATION_SPEC.md` (existing Season infra), `ATLAS_RACE_COURSE_GEOMETRY_SPEC.md`,
`project_step_type_race_flag_reframe`, `project_wrong_table_binding_bugs`.

---

## 1. Problem

We just shipped the explicit race→course link (`b5ebbbd6`, `c1303c9b`): a race step carries
`metadata.race_plan.course_id`, the Atlas NEXT marker resolves to that exact course, and the authoring
picker stamps the id. **It can't light up**, because the NEXT marker is sourced from the wrong tables.

The broken chain:

- `race_plan.course_id` lives on **`timeline_steps`** (a race is a step with `is_race = true`).
- But `useAtlasNextEvent` (the thing that produces the amber NEXT pin + `AtlasNextEvent`) reads from
  **`regattas`**, **`race_participants → regattas`**, and **`race_events`** — *not* `timeline_steps`
  (`hooks/useAtlasNextEvent.ts:52–94`).
- So `AtlasNextEvent.course_id` is always `undefined` → `findNextEventCommittee` always falls back to
  proximity → the new link is dead code in practice.

The same fork blocks Series-on-map: Series/Season infra (`seasons`, `season_regattas`,
`race_events.season_id`) is bolted onto the **regatta** world, while the race-as-step canonical has **no**
`season_id`/`series_id` column. You cannot draw "Port Shelter · 16 races in this Series" from one source today.

This is not a new finding — `ORG_ADMIN_CALENDAR_RACE_MODEL_SPEC.md §1` already names the three parallel
"event" models. This spec is narrower: **pick the canonical source for the *Atlas read path* and migrate
that one path**, so the course link and Series both have a single spine to hang on.

## 2. The decision (already half-made — this makes it real)

**Canonical = `timeline_steps` with `is_race = true`.** This is the stated platform direction
(`project_step_type_race_flag_reframe`; `ORG_ADMIN_CALENDAR_RACE_MODEL_SPEC.md §2`). The regatta system
(`regattas`/`regatta_races`/`race_results`) stays as the **scoring/results** subsystem a race step *links
to*, not as the thing Atlas reads to find "the next race."

Implication: the Atlas read path must move from "query regattas/race_events" to "query the user's
upcoming race **steps**, joining regatta tables only for scoring detail." Everything `race_plan` already
carries (area, course type, laps, and now `course_id`) then flows to `AtlasNextEvent` for free.

## 3. Current read path vs. target

| | Today | Target |
| --- | --- | --- |
| NEXT pin source | `regattas` + `race_events` (`useAtlasNextEvent`) | upcoming `timeline_steps` where `is_race` |
| Course link | lost (source rows have no `race_plan`) | `race_plan.course_id` → `AtlasNextEvent.course_id` |
| Scoring/results | `regattas`/`regatta_races`/`race_results` | unchanged — joined *by* the race step, not the spine |
| Series grouping | `seasons`→`season_regattas`→`regattas` | a series link reachable from the race **step** (see §4) |

## 4. The Series tension (the real open question)

Series today = `seasons` + `season_regattas` keyed to `regattas`; `timeline_steps` has no series column.
To answer "16 races over time in this Series" from the step spine, the series must be reachable from the
race **step**. Two ways:

- **Option A — `season_id` on the step (smallest).** Add `timeline_steps.season_id UUID REFERENCES
  seasons(id)`. Reuse the existing `seasons` table + `SeasonService`/`useSeason` as-is. Race steps join to a
  season directly; `season_regattas` becomes legacy for the step world. Lowest lift, keeps Phase I's infra.
- **Option B — generalize to a `series` entity.** A vocabulary-aware `series` table the step links to, with
  `seasons` as the sailing projection. Correct long-term (nursing Term, drawing Workshop), but a real
  schema + migration of Phase I's surfaces. **Out of scope here** — `PHASE_I` explicitly says don't rename
  tables / don't build a generalized Series schema yet.

**Recommendation: Option A.** Add `season_id` to the race step, reuse `seasons`. It unblocks Series-on-map
without forking Phase I, and Option B can subsume it later (a `series` table can adopt `seasons` rows).

## 5. Commit boundaries (sequenced, each shippable)

### Commit 1 — Step-sourced NEXT event (read path), behind a flag
- New `useAtlasNextEvent` branch (or sibling hook) that, for sailing, queries upcoming `timeline_steps`
  where `is_race = true` for the user (owned + adopted), ordered by `starts_at`, picks the earliest future.
- Map the step → `AtlasNextEvent`: `label` ← title, `when` ← `starts_at`, `where`/`center` ←
  `race_plan.area_name`/`race_plan.center`, **`course_id` ← `race_plan.course_id`**, `event_kind` new value
  `'race_step'`, `event_id` ← step id.
- Gate behind `EXPO_PUBLIC_FF_ATLAS_NEXT_FROM_STEPS`. Old regatta/race_event path is the fallback when the
  flag is off or no race step exists. **This is the commit that makes the `course_id` link live.**
- Verify: a race step with a seeded `course_id` → NEXT marker locks to that course (not nearest). See §7.

### Commit 2 — `season_id` on the race step (Option A)
- Migration: `ALTER TABLE timeline_steps ADD COLUMN season_id UUID REFERENCES seasons(id) ON DELETE SET NULL;`
  (RLS unaffected — same row owner). Index `(season_id)`.
- Authoring: the race composer sets `season_id` from the active season (reuse `useCurrentSeason`).
- Carry `season_id` onto `AtlasNextEvent` (and the cockpit) so the map knows the race's series.

### Commit 3 — Series-on-map render
- On the course, render the course geometry **once** plus a "N races in {SeriesLabel}" badge derived from a
  count of sibling race steps sharing `(course_id | area_id, season_id)`. The other races stay off-map
  (they're the same geometry) and live in the L2 horizontal timeline / `Jump to` sheet (Phase I surface).
- Vocabulary-aware label via the Phase I `vocab('Period')` helper (Season/Term/Workshop/…).

### Commit 4 — Backfill + cutover (separate, deliberate)
- One-off: for existing `regattas`/`race_events` that should be races, create/align `timeline_steps`
  (`is_race=true`) and link `season_id`. Then flip the flag default on. Keep the legacy path one release for
  safety, then remove. **Do not** drop `regattas`/`regatta_races` — they remain the scoring subsystem.

## 6. Open decisions for Kevin (resolve before Commit 2)

1. **Series model: Option A (`season_id` on step) or B (generalize to `series`)?** Spec recommends A.
2. **Backfill scope:** migrate all historical regattas to race steps, or only forward-looking (new races are
   steps, old regattas stay in the results subsystem)? Forward-only is far cheaper and probably enough for
   the demo verticals.
3. **`race_events` fate:** is the `add-race` flow that writes `race_events` retired in favor of the
   race-step composer, or kept as a thin writer that also creates the step? (Relates to the duplicate-writer
   risk noted in `project_wrong_table_binding_bugs`.)

## 7. Verification (how we'll prove it)
- **Commit 1:** with the flag on, seed one `venue_race_courses` row for an RHKYC racing area and a race
  `timeline_step` whose `race_plan.course_id` points at it; on Atlas, confirm the NEXT marker sits on *that*
  course's committee boat even when a second course's committee is physically closer to the centroid (the
  proximity path would pick the wrong one — this is the discriminating test).
- **Commit 2/3:** seed 3 race steps sharing one `course_id` + `season_id`; confirm the map draws the course
  **once** with a "3 races in {Season}" badge, and all 3 appear in the `Jump to` / L2 timeline.
- Flag off → behavior identical to today (regatta/race_event sourced). Typecheck + lint clean each commit.

## 8. Out of scope (explicitly)
- Generalized vocabulary-aware `series` schema (Option B) — deferred; Phase I forbids it for now.
- Dropping or migrating the scoring subsystem (`regattas`/`regatta_races`/`race_results`).
- The org-admin race calendar authoring surface — owned by `ORG_ADMIN_CALENDAR_RACE_MODEL_SPEC.md §4`.
