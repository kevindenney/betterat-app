# Org Admin Calendar & the Universal Race Model

**Status:** Read surface built (2026-06-06) — authoring flows (§4.1–§4.3) specced, not yet built
**Created:** 2026-06-06
**Owner:** Kevin Denney
**Related:** `decisions-log.md` (D30–D35), `betterat-redesign-spec.md`, `project_step_type_race_flag_reframe`, `ATLAS_RACE_COURSE_GEOMETRY_SPEC.md`, `CREATE_ORG_FLOW_SPEC.md`

---

## 1. Problem

An organization admin (e.g. a yacht club running a race calendar) has **no surface** to place events on a
calendar and administer them. Concretely:

- The **new** Studio admin shell (`app/admin/[orgId]/*`) has nav for Overview, People, Fleets, Programs,
  Blueprints, Venues, Insights, Billing, Invoices, Payouts, SSO, Domain, Audit — **no Calendar / Events / Races**.
- The **old** admin shell (`app/organization/*`) also has none.
- Actual race administration lives in a **third, disconnected place**: the sailing-only satellite UI
  `app/club/*` (`event/create`, `results/[raceId]`, `scoring/[regattaId]`, `check-in`, `log`, `protests`,
  `handicap`, `safety`). None of it is reachable from the org admin the user actually lands on.

Underneath the UI gap sits a **data-model fragmentation** — three parallel models for "an event":

| Model | Tables | Nature |
| --- | --- | --- |
| Sailing regatta system | `regattas` → `regatta_races` → `race_results`, `season_regattas` | Mature, sailing-only, full scoring |
| Club event calendar | `club_events`, `event_registrations`, `event_documents` | Generalized, but only wired to `app/club/*` |
| Universal step layer | `timeline_steps` with `is_race` | The direction the platform is moving |

The sailor side already renders `timeline_steps.is_race` (Practice timeline, Atlas ⛵ pins), but nothing links
`club_events`/`regattas` → `timeline_steps`, and the admin has no way to author the calendar in step terms.

## 2. The universal model

**A race is not a separate step type. A race is a `Step` with `is_race = true`.**

This is a deliberate, already-made decision (`project_step_type_race_flag_reframe`): we **rejected** a taxonomy
of step kinds (the abandoned `step_kind` enum, Phase M.5). A step is a step. The single exception promoted to
first-class is **race vs. non-race**, carried by the boolean `timeline_steps.is_race`
(`supabase/migrations/20260603160000_timeline_steps_is_race.sql`; `lib/step-kind-config.ts` is the legacy
keyword-resolver fallback during transition).

It is **one primitive with one boolean**, not "two step types (step + race)."

### 2.1 A race calendar is a collection of scheduled shared steps

- The admin Calendar authors **shared, scheduled `timeline_steps`** (D25: author-fixed dates).
- A race on the calendar is such a step with `is_race = true`.
- A shared step is **one entity, many participants** — each subscriber/fleet member adopts it onto their own
  timeline with private reflections layered over the shared frame (D26).
- For a yacht club the admin ticks `is_race` → the calendar *is* the race calendar. For a nursing school the
  same Calendar surface authors clinical shifts with `is_race = false` and zero sailing baggage. **One surface,
  one boolean** decides per-vertical behavior — we do not fork the calendar per domain.

## 3. `is_race` is the branch point (D31)

`is_race` is the single switch that lights up the race machinery. When `true`, the step earns race-only
affordances; when `false`, it stays a generic scheduled step.

| Concern | `is_race = false` (generic step) | `is_race = true` (race step) |
| --- | --- | --- |
| Atlas rendering | Standard pin | ⛵ blue marker + course/marks/conditions (`ATLAS_RACE_COURSE_GEOMETRY_SPEC.md`) |
| Detail cockpit | Plan / Do / Reflect | + course editor, start sequence, fleet/class splits |
| Scoring / results | None | Bridges to `regattas` / `regatta_races` / `race_results` |
| Calendar admin | Schedule + roster | + check-in, scoring, protests, committee log |

### 3.1 Race detail lives in a JOIN, not in `timeline_steps` columns (D32)

A race genuinely needs more structured data than a generic step (start sequence, marks, fleet/class splits,
finish positions, handicap corrections). **Do not bloat `timeline_steps` with race columns no other vertical
uses.** Instead:

- `timeline_steps` stays the **universal spine** (title, schedule, location, participants, visibility, `is_race`).
- When `is_race = true`, the step **joins** to the existing sailing scoring tables. Add a nullable
  `timeline_steps.regatta_race_id` (FK → `regatta_races`) so a race step points at its scoring row; `regattas` /
  `race_results` remain the scoring backend unchanged.
- Light, cross-vertical scheduling attributes (registration window, capacity, fee) may live in `metadata` or be
  unified later; deep sailing-specific data stays in the regatta tables behind the FK.

**Rationale:** keep the universal model clean and let the mature scoring engine keep doing its job, rather than
rebuilding scoring on `timeline_steps` on day one.

## 4. Surface: `Calendar` in the new admin shell

A **Calendar** (a.k.a. Schedule) nav item sits in the `app/admin/[orgId]/*` Studio shell, between People/Fleets
and Programs. It is the single org-facing entry point for authoring the schedule.

**Built (2026-06-06, read-only):**

- **Calendar view** — month-grouped list of the org's scheduled shared steps; race steps badge ⛵.
  `app/admin/[orgId]/calendar/index.tsx` reads `admin_org_calendar` (SECURITY DEFINER, gated by
  `is_org_admin_member`) via `hooks/useAdminCalendar.ts`; pure shaping in `lib/admin/adminCalendar.ts`.
- **Administer a race** — rows deep-link to `/step/[id]`; the `regatta_race_id` join is in place so a race step
  can reach the existing `app/club/*` operational tools (results, scoring, check-in, protests) rather than
  rebuilding them. Long-term those tools migrate under the admin shell; the join lets us reuse them now.
- **Roll-up** — completed race results/reflections feed the admin's Insights / Competencies grid (D17–D19), so
  results map to capability evidence over time.

Migration of `app/club/*` and consolidation of `club_events` are **out of scope**; the Calendar reads/writes
`timeline_steps` and bridges to the regatta tables. `club_events` is not extended further.

The three authoring flows below are the next build. The through-line: **one create form (the `is_race` toggle)
→ one series generator → one clone-with-reanchor action.** Same three primitives serve every vertical; races
just light up extra fields.

### 4.1 Make one race (D33)

A race is a scheduled `timeline_steps` row with `is_race = true`, so "new race" and "new event" are the **same
form** with one toggle.

- **Form** — title, date/time (D25 author-fixed), location (writes `step_location`), visibility, and an
  **`is_race` toggle**. Flipping it on progressively discloses the race block: course/marks, fleet/class splits,
  start sequence. Off → it stays a plain scheduled step with zero sailing fields.
- **Write** — inserts one `timeline_steps` row with `organization_id = <this org>`, `is_race`, `starts_at`/
  `ends_at`, `status = 'pending'`. Course geometry persists per `ATLAS_RACE_COURSE_GEOMETRY_SPEC.md`.
- **Lazy scoring (D33)** — the toggle does **not** mint a `regatta_races` row. `regatta_race_id` stays null
  until someone opens the race cockpit to actually score; most club races never get formally scored, so eager
  creation would litter the scoring table. First score → mint the row → backfill the FK.
- **Invalidate** — the create mutation must invalidate `adminCalendarKey(orgId)` (and the member timeline keys)
  so the new step appears without a refetch (`feedback_query_cache_key_invalidation_audit`).

### 4.2 Make a season of races (D34)

A "season" is a **series container + a recurrence that generates many race steps** — not one fat step.

- **Container** — one row in the existing series table (`race_series` / `regattas`) carries the season's
  identity and date window (e.g. "Dragon Saturday Series, Oct–Mar"). Season label ≡ its date range in persona
  vocab (`project_season_is_persona_vocab`).
- **Generator** — the admin sets a recurrence (e.g. *every Saturday, 09:00, Oct 4 → Mar 28*) and a shared
  template (course, fleets, default location). The generator emits **one `is_race` step per occurrence**, each
  linked to the series id, each independently editable afterward (skip a holiday, move one start time).
- **Why many-not-one (D34)** — a recurring *series* is N schedulable calendar entries; members adopt them
  selectively. This is distinct from a single multi-race *regatta weekend* (open question #3), which stays one
  step fanning out to child `regatta_races`. Series = many steps; regatta-weekend = one step.
- **Adoption stays selective** — the season is authored in bulk by the admin, but a *member* still adopts steps
  incrementally onto their personal timeline (`feedback_plan_is_menu_not_calendar`); the generator does not
  bulk-push the season onto anyone's timeline.

### 4.3 Roll last year's calendar into this year (D35)

Cloning a past season forward is **admin bulk authoring on the org's canonical calendar** — legitimate, and not
in tension with the "never bulk-adopt a season" rule (that governs a *member's personal timeline*, not the org
schedule).

- **Pick source** — select last season's series (or a date range). Set the **new anchor** (this season's start).
- **Re-anchor by rule, not by offset (D35)** — shift each step by its **recurrence**, snapping races back to the
  intended weekday/ordinal ("first Saturday of October"), **not** a naive +364 days, which drifts the weekday by
  one or two. Where a step has no recurrence, fall back to the same offset applied to the anchor.
- **Clone semantics** — copy `is_race`, course geometry, fleet/class config, and series linkage (new series row
  for the new season). **Reset `status` to `pending`; drop results and `regatta_race_id`** (fresh scoring rows
  per D33). Reflections/results from last year do **not** carry over.
- **Output** — a fully-dated draft season the admin reviews and publishes; members then adopt selectively as in
  §4.2.

## 5. Non-goals (v1)

- Rebuilding the scoring engine on `timeline_steps`.
- Deleting or migrating `regattas` / `race_results` / `club_events` (kept as backend / deferred).
- Per-vertical calendar forks.
- A `step_kind` taxonomy — explicitly rejected; `is_race` is the only first-class subtype.

## 6. Open questions

1. **`club_events` fate.** Three event models is one too many. Does `club_events` get absorbed into
   `timeline_steps` + regatta join, or kept for non-race club ops (social/meeting/maintenance)? Lean: absorb
   over time; not v1.
2. **Registration model.** Where do `event_registrations` live once events are steps — adoption of the shared
   step, or a separate registration row? Adoption may be the natural fit.
3. **Multi-race regattas.** Partly resolved by D34: a recurring **series** is many steps (one per occasion). The
   remaining open case is a single multi-race **regatta weekend** (several races over consecutive days) — lean is
   one schedulable step fanning out to child `regatta_races`, but the boundary between "weekend" and "series"
   needs a UI rule (likely: same location + contiguous days = one step; weekly cadence = series).
