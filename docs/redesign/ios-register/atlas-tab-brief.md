# Atlas tab — design brief

**Status.** Pre-canonical. This brief defines the Atlas tab so a designer can produce the HTML canonical mockup, and so engineering can scope schema + privacy + layer registry work in parallel.

**Mode.** Atlas is a **fifth top-level tab** — peer to Practice · Library · Discover · Profile. Tab order: `Practice · Library · Atlas · Discover · Profile`. Center position is intentional; Atlas is a primary lens, not a feature.

**Supersedes.** Sailing-only "Pick on map" + "Full peer map" surfaces sketched in `library-tab-canonical.html` D33's *Where* affordance. Those two views become entry-points into Atlas, not standalone screens.

---

## The 30-second pitch

BetterAt has four lenses on the same step data: **Practice** (when), **Library** (kind), **Discover** (what next), **Profile** (who I am). Atlas is the missing fifth — **where**. Every step has an optional location; Atlas is the surface where those locations become legible.

The unit is **locatable steps + the people doing them**, not "venues" or "race marks." Sailing happens to have rich place-ontology (marks, start lines); most interests just need pins + relationship colors. Cross-interest, the same person's golf course and sketch spot live on one canvas.

---

## Core decisions

| # | Decision |
|---|---|
| A1 | Atlas is the 5th tab, centered: `Practice · Library · Atlas · Discover · Profile` |
| A2 | The unit is a **locatable step**, not a venue. Venues/marks are POI layers that decorate the step layer |
| A3 | Empty state is **interest-driven** via a per-interest template (see "Universal empty-state formula") |
| A4 | A new relationship primitive — **Cohort** — joins existing You/Crew/Fleet/Following/All. Generalizes "people in your program who started together" (nursing cohort, racing fleet, golf league, drawing class) |
| A5 | Privacy is **per-interest**, not global. Each interest's template ships a default `(location_precision, location_audience)` pair. Sailing defaults open; nursing defaults locked. Override-able per step |
| A6 | Map shell is universal. **Layer registry** lets each interest opt into bespoke layers (race marks for sailing, holes for golf, curated sites for nursing) |
| A7 | Atlas works **cold** — no school/club onboarding required. Curation is a partnership layer on top, not a launch gate |
| A8 | Empty maps are death. First-run shows **ghost pins** (faded sample data, labeled "sample") until real peers arrive |
| A9 | **Compose-at-location** — long-press / drop-pin → "plan a step here." Replaces the legacy `SelectLocation` modal entirely. The modal opens Atlas in *commit-mode* (one prop: tap-pin returns coords to Plan) |
| A10 | **No real-time presence.** Steps have a date; "currently here" is off the table for safety + surveillance reasons |
| A11 | **No patient-identifiable anything**, ever, on healthcare-tagged sites. Schema-level lint, not a checkbox. Floor/unit/bed/MRN/initials/DOB all forbidden in step text on clinical-site steps |
| A12 | **Site-level precision floor** on healthcare sites. Users can blur further (neighborhood / hidden) but never sharpen below building-level |
| A13 | **International peers visible at world zoom** — a HK Dragon racer who follows an Amsterdam Dragon sees both fleets' pins on one canvas. Cross-fleet/cross-program visibility is a sailing+sport delight; nursing keeps it cohort-scoped |
| A14 | **Admin view** (Dean / Club Captain / Coach) shows aggregate only — heatmap by competency × site, never individual pins. Same primitive, different copy per interest |
| A15 | **Next-event pre-stages composition** — empty state highlights `user.next_event.venue` and the primary CTA is "Plan a step for [next event]." The map isn't a memory surface; it's set-up for what's next |

---

## Universal empty-state formula

Every persona's first-run is the same five-line template. Interests fill in the slots.

```
frame:       user.home_geography                    — where the map opens
pin:         user.base                              — club / school / office / home course
pin:         user.active_locations                  — racing areas / clinical sites / courses / markets
show:        user.peers × relationship × recent     — color-coded by Crew/Cohort/Fleet/Following
highlight:   user.next_event.venue                  — pre-staged for what's next
cta:         "Plan a step for [next event]"         — composition anchored to that venue
fallback:    ghost-pins if no real peers yet        — sample data, fades out as real pins arrive
```

Interests are templates for this formula. The interest registry holds:
- `home_geography_resolver(user) → bounds`
- `base_resolver(user) → POI`
- `active_locations_resolver(user) → POI[]`
- `next_event_resolver(user) → {venue, date, action_copy}`
- `relationship_palette` — copy + colors for filter chips (Fleet vs Cohort vs League etc.)
- `default_privacy` — `(precision, audience)` for new steps
- `layers` — list of registered POI/overlay layers to render

---

## Per-persona empty states

### HK Dragon racer at RHKYC

**Framing.** Hong Kong, weighted toward Causeway Bay (RHKYC clubhouse). Tiles styled water-forward, light land mass.

**Pre-pinned.**
- RHKYC marina with user's boat ("Lady Catriona · Berth 14")
- 4 racing areas: Victoria Harbour, Port Shelter, Middle Island channel, Lamma channel — each with last-race tag (date · conditions · who from fleet was there)
- Race-marks layer renders inside any racing area at zoom ≥ 14 (TOP / PIN / C BOAT / SC + start line geometry)

**Peers live.** ~15–20 RHKYC Dragon owners' recent step pins; crew sharper, fleet medium, following dim. Tap a pin → step preview sheet (3 sub-steps · 6 captures · 2 concepts · Add to my timeline · Suggest to…).

**Next event.** "Race 4 · Saturday 10am · Victoria Harbour" — venue gently glows. Tap zooms to that course with last Saturday's marks visible.

**Tide/wind badges.** On each racing area, today + Saturday forecast as a small badge (e.g., "Sat: 12kn ESE · ebb 0.4kn").

**Primary CTA.** "Plan a step for Saturday's start" — pre-staged composition anchored to favored end.

**International toggle.** Zoom out to world → Phyl Loong's (HK), Amsterdam fleet's, Worlds-venue pins all appear. Dragon community as one global racing graph.

**Privacy defaults.** `precision: exact`, `audience: Fleet`. Race courses are public; no jitter required.

### Amsterdam Dragon racer

**Framing.** Markermeer centered, with home club marina pinned (resolved from user profile — KNZ&RV Muiden / KWVL Loosdrecht / etc.).

**Pre-pinned.**
- Home club marina with user's boat
- Racing areas: Markermeer, IJmeer, Braassemermeer, Loosdrechtse Plassen
- Race-marks layer same as HK

**Peers live.** Local Dutch fleet color-coded. Zoom out → international Dragons visible (followed RHKYC peers, regatta circuit veterans).

**Next event.** Driven by regatta calendar, not weekly racing — "Easter Regatta · Medemblik · April 4" (or whatever's next).

**Locale.** Metric units, wind in degrees, Dutch place names by default.

**Privacy defaults.** `precision: exact`, `audience: Fleet`.

### JHU MSN nursing student (cold, no JHU onboarding)

**Framing.** Baltimore, centered on user's current location (with permission) or generic Baltimore frame.

**Pre-pinned (cold version, no JHU curation).**
- Healthcare POIs from OSM/Overpass — hospitals, clinics, the school — rendered as generic dots labeled with names
- No competency overlays yet (those come with curation)

**Peers live.** Anyone in her cohort who's joined; site-level fuzzy pins only. Until cohort exists: ghost-pins ("sample" overlay) showing what the map would look like if 12 cohort-mates were active.

**Empty-state copy.** "Tag your last clinical step to where it happened" — pulls from her recent timeline, one tap to anchor.

**Viral hook.** After 1–2 self-pins: "Invite your cohort to see each other's clinical sites" — share link. Individual benefit before institutional buy-in.

**Primary CTA.** "Plan your next clinical step" → composition anchored to her upcoming rotation site (from her own schedule, not JHU's).

**Privacy defaults.** `precision: site-level (floor: false)`, `audience: Cohort`. Never public. Never patient-identifiable text (write-time lint blocks room numbers, initials, MRNs, DOBs, bed identifiers).

### JHU MSN nursing student (curated demo mode)

Same shell, layered with:
- **JHSON-claimed sites** — Hopkins Hospital East Baltimore, Bayview, Sibley, Suburban, Howard County General, Pinkard sim suite, library, community partners. Each pinned with full name + "JHU clinical partner" badge.
- **Cohort linked** at signup via SSO → 60ish peer pins appear immediately, fuzzed to site-level.
- **Competency overlays** — tap "IV insertion · supervised" in Library → Atlas filters to "all places this cohort has evidenced this skill." Constellation across sites.
- **Dean dashboard** — separate admin route, aggregate only. Heatmap of competency × site × term. No individual pins.

For the JHU demo: **manually curate JHSON's data once.** Don't build school self-service onboarding until after they sign.

### Chicago golfer (for completeness; not v1)

- Framing: Chicago metro
- Base: home course (Cog Hill / Olympia / muni)
- Active locations: courses played in last 12 months, driving range, winter indoor sim
- Relationship: **League** (Tuesday night men's league) replaces Fleet/Cohort
- Next event: "Saturday 8am tee · Cog Hill #4"
- Privacy: `precision: course-level`, `audience: League`

### Ranchi entrepreneur (for completeness; not v1)

- Framing: village + nearby markets (~30km radius)
- Base: field office or home
- Active locations: weekly market, supplier villages, customer cluster pins
- Relationship: **Network** (mentees, peer entrepreneurs, support org)
- Next event: "Wednesday — Khunti market visit"
- Privacy: `precision: neighborhood (jitter 500m)`, `audience: Network`. Offline tiles required.

---

## Layer registry

Each interest can register zero or more layers. The shell renders them in z-order.

```ts
interface AtlasLayer {
  id: string;                  // e.g. "sailing.race_marks"
  interest_slug: string;       // e.g. "sailing", "nursing"
  z_index: number;             // 0 = base, 1 = POIs, 2 = peer steps, 3 = own steps, 4 = overlays
  min_zoom: number;            // only render at zoom >= this
  data_source: 'static' | 'rpc' | 'institution_curated';
  rpc?: string;                // supabase RPC name if dynamic
  pin_style: PinStyle;         // size, shape, color, label rules
  on_tap?: 'preview_sheet' | 'detail_route' | 'context_menu';
}
```

**v1 ships with:**
- `core.peer_steps` — all interests. Pin color from relationship.
- `core.own_steps` — all interests. Always visible.
- `core.healthcare_pois` — nursing only. From OSM/Overpass, no curation needed.
- `sailing.race_marks` — sailing only. Renders inside known racing areas at zoom ≥ 14.
- `institution.curated_sites` — opt-in per institution (JHSON, RHKYC). When the institution claims its data, this layer activates for their members.

**Not v1:** golf holes, hospital floor plans, sketch-worthy POI curation. Add as interests prove the pattern.

---

## Relationship primitive: Cohort

Sailing has Fleet. Nursing needs Cohort. Generalize.

A **Cohort** is "people in your same program who started at the same time." It's a tightly-scoped peer group with a shared start date, distinguished from the broader Program (everyone in your school/club/network).

**Filter chips become:** `You · Crew · Cohort · Following · All`

Per-interest copy:
- Sailing: `Crew · Fleet · Following · All` (no Cohort; Fleet plays the role)
- Nursing: `You · Cohort · Program · Following · All`
- Golf: `You · League · Club · Following · All`
- Drawing class: `You · Class · School · Following · All`

Schema-wise: this is `program_id + cohort_start_date`, not a new top-level entity. Materialized view `cohort_members` joins users who share both.

---

## Privacy model

Three primitives, all set per-step (with interest-driven defaults):

```ts
type LocationPrecision = 'exact' | 'site' | 'neighborhood' | 'hidden';
type LocationAudience  = 'crew' | 'cohort' | 'program' | 'following' | 'public';
type TimeReveal        = 'datetime' | 'date_only' | 'hidden';
```

**Interest templates ship defaults:**

| Interest | Precision | Audience | Time |
|----------|-----------|----------|------|
| Sailing  | exact     | fleet    | datetime |
| Nursing  | site (floor:false) | cohort | date_only |
| Golf     | course    | league   | datetime |
| Drawing  | neighborhood | following | date_only |
| Entrepreneur | neighborhood (500m jitter) | network | date_only |

**Hard rules (not user-overridable):**
- Healthcare sites → precision floor at `site`; cannot sharpen to floor/unit/room.
- Healthcare step text → write-time lint blocks: room numbers, bed identifiers, MRNs, DOBs, patient initials, full names that match a known pattern.
- No real-time presence anywhere. `currently_here` is not a thing.
- Public audience requires explicit per-step opt-in, never a default.

**Pin jitter.** When precision = `neighborhood` or `site` (without exact), the displayed pin is jittered within the appropriate radius and stable per user-viewer pair (same student sees same jitter each session — not a wandering dot).

---

## Compose-at-location

The current `SelectLocation` modal goes away. Atlas absorbs it.

**Two entry modes:**
1. **Browse mode** (default): pan/zoom, tap pins, add to timeline, suggest to peers.
2. **Commit mode**: opened from Plan tab's *Where* field. One prop: `onCommit(coords, place_name, peer_context) → close`. Long-press / single-tap on map drops a candidate pin → bottom sheet shows place name + "N peers set steps within 200m · M in your fleet" + `Use this location`.

Same map, same layers, different sheet. Eliminates code duplication and keeps the picker feeling like a peek into the real surface.

---

## Schema additions

```sql
-- Step location (added to existing steps table)
alter table steps add column location_lat double precision;
alter table steps add column location_lng double precision;
alter table steps add column location_precision text default 'exact';  -- exact|site|neighborhood|hidden
alter table steps add column location_audience text default 'fleet';   -- crew|cohort|program|following|public
alter table steps add column location_poi_id uuid references atlas_pois(id);  -- nullable; set if pinned to known POI

-- POI registry (institution-curated and OSM-sourced places)
atlas_pois (
  id uuid pk,
  interest_slug text,                  -- nullable; null = universal
  source text,                         -- 'osm' | 'institution' | 'user_proposed'
  source_ref text,                     -- osm node id, institution id, etc.
  name text,
  lat double precision,
  lng double precision,
  kind text,                           -- 'club' | 'hospital' | 'sim_lab' | 'racing_area' | 'course' | 'market' | ...
  metadata jsonb,                      -- interest-specific (e.g. racing_area_bounds, hospital_partner_of)
  claimed_by_org_id uuid references organizations(id)  -- nullable; institution ownership
);

-- Institution-curated layers
atlas_institution_layers (
  id uuid pk,
  org_id uuid references organizations(id),
  layer_id text,                       -- matches AtlasLayer.id
  is_active boolean default true,
  pois uuid[] references atlas_pois(id)
);

-- Cohort materialized view
create materialized view cohort_members as
  select user_id, program_id, cohort_start_date
  from organization_memberships
  where program_id is not null and cohort_start_date is not null;

-- Peer steps geo RPC
create function atlas_peer_steps_near(
  lat double precision,
  lng double precision,
  radius_m integer,
  relationship_filter text[]  -- ['crew','cohort','fleet',...]
) returns table (step_id uuid, lat double precision, lng double precision, relationship text, preview jsonb)
  security definer
  ...

-- Healthcare content lint
create function lint_healthcare_step_text(step_id uuid, body text)
  returns table (offense text, span_start int, span_end int)
  ...  -- regex bank for MRN/DOB/room/bed/initials; called from trigger
```

---

## What's **not** in v1

- Golf-specific hole/tee overlays (defer until a real golfer is testing)
- Hospital floor plans (defer; site-level only)
- Plein-air / drawing-spot curated POIs (defer)
- Real-time presence (never)
- Patient-tagged steps (never)
- School self-service onboarding (manual curation for JHU demo; build self-serve after first signed institution)
- Offline tile caching (defer to v2; entrepreneur persona needs it but isn't v1)
- Map-as-CRM features for entrepreneurs (defer)
- Suggestion-mode (pin an idea at a location, send to a sailor) — defer until `Suggest to…` exists elsewhere

---

## Open questions for design

1. **Tab icon.** Atlas needs an icon that reads as "world / where" without being literal globe. Candidates: `ti-map-2`, `ti-map-pin`, `ti-compass`, `ti-route`. Lean compass — implies wayfinding + planning, not just locations.
2. **Empty-state visual treatment for ghost-pins.** How faded is "faded"? Designer call. Must read as "sample data, not yours" without being so dim it disappears.
3. **Next-event glow.** Is the next-event venue a literal animated pulse, a colored ring, a labeled callout, or a bottom-banner? Designer call.
4. **Filter chip overflow.** With Cohort + Program + Following + All + interest-specific chips, the top can get crowded. Designer should mock at the busiest persona (nursing curated) to test density.
5. **International zoom transition.** When a sailor zooms out to see Amsterdam fleet, when do local race marks fade out and global pins fade in? Probably at zoom 8–9 transition. Designer-tunable.
6. **Cross-interest toggle UI.** "Show all my interests" — is this a chip, a layer toggle in the layers menu, or a profile-level setting? Lean chip — discoverability matters and the moment of seeing both lives is the magic.
7. **Admin view route.** Does the Dean access Atlas from inside the app, or from a separate `/admin` web surface? Lean web — admins live in browsers, students live in iOS.

---

## Implementation phasing

**Phase A1 — Foundation (2 weeks)**
- Schema: location columns on steps, atlas_pois, cohort view, peer-steps RPC
- Privacy primitives + healthcare content lint
- Atlas tab shell, base map, peer/own step layers
- Compose-at-location (replaces SelectLocation)

**Phase A2 — Sailing template (1 week)**
- Sailing interest template (frame, base, racing_areas, next_event resolvers)
- Race-marks layer
- HK Dragon RHKYC first-run live

**Phase A3 — Nursing template + JHU curation (1.5 weeks)**
- Nursing interest template (Baltimore frame, cohort relationship, healthcare layer)
- JHSON manual curation script (8 clinical sites + sim suite + competency overlay)
- JHU demo ready

**Phase A4 — Polish (1 week)**
- Ghost-pin fallback for empty states
- International zoom transitions
- Next-event glow + pre-staged composition CTA
- Cross-interest toggle

Total: ~5.5 weeks for sailing + nursing live, JHU demo-ready. Other interests bolt on by registering templates.

---

## What earns this tab

Atlas earns its slot in the bottom bar if and only if:
1. **A sailor's first-run** shows them their next race's water with fleet activity, before they touch anything.
2. **A nursing student's first-run**, cold, shows healthcare POIs around her and a one-tap path to anchor her last clinical step.
3. **The JHU demo** lets a dean zoom out on a cohort and see competency-evidence as a constellation across affiliated sites.
4. **Cross-interest** — a sailor who also draws can see their sketch spot and the harbor on one canvas.

If any of those four don't land, Atlas isn't ready to ship as a tab and should stay a Practice sub-surface.
