# Phase N — Nursing Atlas redesign spec

> Sibling docs:
> - `docs/redesign/ios-register/atlas-tab-brief.md` — overall Atlas vision
> - `docs/redesign/ios-register/atlas-roadmap.md` — phase ledger
> - `docs/redesign/mockups/23_betterat_atlas_nursing_redesign.html` — this spec's mockup
> - `docs/redesign/mockups/22_betterat_atlas_sailracer_redesign.html` — the sailing sibling
>
> Authors: Kevin + Claude · 2026-06-03
> Scope guard: **Sailing frames F1/F2/F3 are out of scope and must not change.** All work
> lives in F4/F5, the frame-picker (`app/(tabs)/atlas.tsx`), and nursing-scoped hooks.

---

## Thesis

The nursing Atlas today (frame **F4**) is the sail-racer canvas with nursing paint. It inherits
sailing's central assumption — that *"where"* is continuous outdoor geography you pan across by
lat/lng, with a street map as the primary surface, fleet/crew relationships, and distance/route
intelligence as content.

For a nursing student that assumption is wrong on every axis:

| | Sailor | Nursing student |
|---|---|---|
| The "where" | The water — continuous, marks, wind/tide gradients | A handful of **named sites** (JHH, Bayview, Sibley, Suburban, Howard County) + the school |
| Meaningful unit | Position on the course | **Unit/ward** (MICU, ED, L&D) — which HIPAA *forbids* rendering on a map |
| The map's job | It **is** the strategy | Near content-free: a few big buildings, routes irrelevant |
| What they want | Favored side, fleet activity | Rotation journey, **competency coverage by site**, who's at my site this block |

The spatial resolution a nurse cares about (which unit) is exactly the resolution privacy forbids
showing. So the street map is the wrong *primary* surface. What the "where" lens uniquely earns for
nursing: **skills are located — you got each competency at a place — and the medium that fits is a
coverage grid, not a chart.**

**The move:** invert the hierarchy. Lead with a structured **Sites** surface; demote the MapLibre
canvas to a secondary toggle (kept for cold first-run POI discovery + orientation).

---

## What's broken today (grounded in the 2026-06-03 screenshots)

1. **Nearby leaks sailing into the nursing frame.** The sheet header reads `WITHIN 25KM · HONG KONG
   - VICTORIA HARBOR` and lists yacht clubs + `demo-markus@regattaflow.app · Victoria Harbour · start
   line bias · fleet` — *inside* the nursing frame. Root cause: `DiscoverNearbyContent` anchors to
   the user's sailing **home venue** (`useUserHomeVenue`) and is not interest-scoped.
2. **"Log shift · Coming soon"** — the core nursing loop is a stub (roadmap Phase A.3). Without it the
   coverage grid can never fill in.
3. **Walk-time annotations** ("2 min / 3 min" between JHH ↔ Pinkard ↔ Sibley) are the sailor's
   distance/layline grammar misapplied. No nurse optimizes hospital-to-hospital walking.
4. **NEXT pill is a hardcoded fixture** ("JHH 4 South · cardiac"), not the student's real next rotation.
5. **Home geography is global** — the persona's home venue is Hong Kong (from sailing), so nursing
   opens on the wrong continent.

---

## Design (see mockup #23 for visuals)

### Frame A — Sites-first home (new default)
- Header: `Atlas` / "Your clinical sites & coverage", segment toggle **`Sites | Map`** (Sites on).
- Relationship chips: `You · Cohort · Program · Faculty` (Fleet/Crew dropped).
- **Hero card = NEXT rotation** — replaces the floating pill. Site + unit, "N cohort-mates rotate
  here", "builds N competencies", buttons `Plan a step` / `What to prep`.
- **Site cards** grouped *This block / Coming up / Completed*. Each card:
  - rotation status badge (now / soon / done)
  - **competency-coverage bar** segmented by skill cluster (cardiac/respiratory/medication/
    assessment/general)
  - cohort-presence footer ("5 cohort-mates here this block") — date-based, aggregate.

### Frame B — Site detail
- Site header + "Now · week 3 of 4".
- **Competencies evidenced here** — list with cluster dot + count; gaps faded ("not yet").
- **Cohort · this week** aggregate card (reuses `atlas_cohort_step_hex`): "21 of 30 practiced
  central-line care on this unit", hex chips, explicit `🔒 site-level aggregate · no patient or room
  detail` line.
- **Preceptors here** — faculty diamonds.
- Primary CTA: **`＋ Log a shift here`** (real, replaces the stub).

### Frame C — Competency constellation
- Competency header + framework status.
- Coverage ring ("8/12 required") + plain-language summary.
- **Where you've evidenced this** — every site with a count.
- **Gap card** — "Pediatric assessment & OR scrub aren't evidenced yet. Both are available at Howard
  County General — your week 9 rotation," routing to plan a step there.

### Frame D — Nearby (fixed)
- Header `Sites & people nearby` / `Baltimore · within 25 km`.
- Clinical sites (JHH, Bayview, JHSON Pinkard) + cohort-mates with **real names** and clinical verbs
  ("Logged a shift · JHH 4 South · cohort"), site-level.

---

## Privacy (keep — already correct in principle)
- Site-level precision floor on healthcare sites; cannot sharpen to floor/unit/room.
- Healthcare write-lint blocks room/bed/MRN/DOB/initials in step text.
- `atlas_can_view_step_location` fails **closed** (NULL audience → not visible).
- No real-time presence; cohort presence is date-based only.
- The structured surface makes this *easier*: a clinical step renders as "a step at this site," which
  is inherently site-level — there is no precise dot to leak.

---

## Build order (each ships independently; none touches sailing F1–F3)

### N0 — Coherence fixes (do first; low risk, biggest "this isn't sailing" win)
- **Interest-scope Nearby:** anchor `DiscoverNearbyContent` to the active frame center (Baltimore for
  nursing), pass `interestSlug` into `useAtlasPeerSteps` / `useNearbyOrganizations`. Stop reading the
  sailing home venue inside non-sailing frames.
- **Per-interest home geography:** `home_geography_resolver(user, interest)` — sailing → HK home
  venue, nursing → Baltimore (or device location with permission).
- **Strip walk-time annotations** from the nursing frame (keep for sailing if desired).
- **Real next-rotation resolver:** extend `useAtlasNextEvent` (or a nursing variant) to read the
  student's upcoming rotation instead of the fixture.

### N1 — Sites-first view (design centerpiece)
- New `Sites` mode for the nursing frame: rotation-grouped site cards + coverage bar + cohort chip.
- Map demoted to the `Map` segment.
- **Data:** rotation/assignment grouping + competency-by-site coverage.

### N2 — Real Log Shift loop
- Site-card / map → log a completed clinical shift → site-level step, cohort audience default, healthcare
  lint applied → feeds coverage.

### N3 — Competency constellation + gap view
- Per-competency: sites evidenced, coverage vs JHSON framework, gap → upcoming-rotation routing.

### N4 — Curated JHU partner layer
- `institution.curated_sites` (8 JHSON sites + Pinkard sim suite), SSO cohort link. Partnership-gated.

---

## Data dependencies / open questions (verify before N1/N3)
- **Rotation/assignment concept** — does a per-student rotation schedule exist, or is the "block /
  week 3 of 4 / upcoming" structure fixture-only today? May piggyback on cohort schedule +
  `timeline_steps` grouped by site POI.
- **Competency-by-site coverage** — realistic path is `competency_attempts` ⋈ `step_location` → site
  POI. Confirm `competency_attempts` carries (or can carry) a location/site link for the demo persona.
- **JHSON framework** for the gap view (Frame C) — confirm a required-competency list exists to
  compute "8/12 required".
- **`organization_locations`** for Baltimore sites is seeded (the 6 JHU rows); Bayview/Sibley/Suburban/
  Howard County may need seeding for Nearby + site cards.

---

## Acceptance
1. Nursing Atlas opens on the **Sites surface in Baltimore**, never a Hong Kong map or sailing Nearby.
2. **Log a shift** works end-to-end and increments a site's coverage.
3. A student can answer **"where am I short before graduation"** from Frame C.
4. Sailing frames F1/F2/F3 are byte-for-byte unchanged.
