# Atlas — Hole-Level Anchoring (place-within-a-place)

> Status: **Partially built** · 2026-06-18
> Owner: Atlas
> Surface: `components/ios-register/atlas/` (AtlasScreen + AtlasMapLibreCanvas), `components/step/plan-tab/PlanWhereCard.tsx`, `timeline_steps` location model
>
> **Built so far:** (a) per-interest "Detailed" OSM basemap, Nautical scoped to sailing; (b) the
> sub-site anchor model + capture picker, reusing the existing `level_label`/`level_index`
> primitive (NOT the `sub_site` JSON field originally proposed below — see §3b); (c) Sites-hero
> surfacing of the captured label. **Not yet built:** map-pin placement at the sub-feature anchor,
> Capabilities "where evidenced" sub-label, and OSM-feature snapping (the picker is currently a
> config-driven numeric grid / free-text field, not a tap-the-hole-on-the-map flow).

## 1. Goal

Today a step anchors to a **site** — a single `atlas_pois` centroid pin (the golf course, the
hospital, the market). That is the right granularity for "where did this happen" at the city scale,
but it throws away the structure *inside* a site that the craft actually cares about:

- **Golf** — which **hole** (number / green / tee / fairway / bunker). "Worked my bunker game" means
  nothing at the course centroid; it means the green-side bunker on **hole 7**.
- **Nursing** — which **ward / floor / unit** inside the hospital (4 West, the ED, the NICU).
- **Entrepreneur** — which **stall / shop / block** inside the market.

The user observed that flipping the Atlas basemap to **Nautical** on a golf course incidentally
exposes rich OpenStreetMap golf geometry — hole numbers, greens, tees, fairways — because the
nautical style is raw OSM raster, while our default brand styles deliberately strip that detail.
That points at two related pieces of work:

1. **Per-interest basemaps that preserve the OSM features the craft cares about** (golf holes,
   hospital wards, shop/market features) instead of stripping them — and stop offering "Nautical"
   as a generic option on non-sailing interests, where it's the *wrong* word for the *right* data.
2. **A "place within a place" anchoring model** — let a step bind to a specific sub-feature of a
   site (a hole, a ward, a stall), carrying that feature's OSM id + human label (e.g. hole `ref`),
   not just the site centroid.

This spec covers the direction. It is a **design + data-model spec**, not an implementation ticket.

## 2. What already exists (reuse — do not rebuild)

| Asset | File | What it gives us |
| --- | --- | --- |
| Basemap switch | `AtlasMapLibreCanvas.tsx` L84 `AtlasBasemap = 'map' \| 'satellite' \| 'nautical' \| 'detailed'` | The user-facing basemap control in the Layers panel; now interest-aware — sailing offers Nautical, others offer **Detailed** (§3a, built). |
| Sub-site primitive | `types/step-detail.ts` `StepLocation.level_label` / `level_index` / `hierarchy` | Pre-existing (authored for hospital wards, never wired). The "place within a place" anchor **reuses** these — see `lib/atlas/subSiteAnchor.ts` (§3b, built). |
| `mapStyleForFrame(frame, basemap)` | `AtlasMapLibreCanvas.tsx` L147 | Single chokepoint that resolves a frame + basemap → a MapLibre style. **Per-interest tuning lands here.** |
| `NAUTICAL_MAP_STYLE` | `AtlasMapLibreCanvas.tsx` L110 | Raw OSM raster (`tile.openstreetmap.org`, opacity 0.92) + OpenSeaMap seamarks. This is *why* golf holes appear — it's the unfiltered OSM tile. Proof-of-concept that the data is in OSM and just needs a craft-tuned style. |
| Frame → brand style map | `AtlasMapLibreCanvas.tsx` L150-162 | `SAILING_MAP_STYLE` / `NURSING_MAP_STYLE` / `ENTREPRENEUR_MAP_STYLE` already vary land/water/road detail **per interest**. The pattern for "this interest shows this geometry" is established; golf needs to join it. |
| Step location model | `timeline_steps.metadata.plan.where_location` (`poi_id`, lat/lng, `location_name`) | Steps already carry a structured "where". The sub-site anchor is an **additive field**, not a new table. |
| POI registry | `atlas_pois` (kind = club/site/racing_area/…) | Sites are already first-class rows; a hole/ward/stall is a *child* of one of these. |
| Located-step resolution | `useFrameStepSiteLinks` + `useInterestCapabilityCoverage` (poi_id → `atlas_pois.name`) | The Sites segment + "where evidenced" already resolve a step to its site. They'd extend to show the sub-site label when present. |

## 3. The gap (genuinely new work)

### 3a. Per-interest basemaps (preserve, don't strip)

`mapStyleForFrame` currently returns a brand style **only** when `basemap === 'map'`; Satellite and
Nautical short-circuit before the frame branch. The genuinely new work:

- Give **golf** (currently routed through the generic F1 frame — see
  `project_atlas_f7_f9_hardcoded_geography`) a **golf-tuned vector style** that keeps
  `golf=hole|green|tee|fairway|bunker|rough` features and renders hole `ref` labels, instead of
  inheriting the sailing "no roads/labels" style.
- Confirm **nursing** keeps building footprints (it already does at z13+) and, where OSM has them,
  `healthcare=*` / `amenity=hospital` sub-features.
- Confirm **entrepreneur** keeps `shop=*` / `marketplace` features.
- **Gate "Nautical" out of non-sailing interests.** It's surfacing the right data for the wrong
  reason; on golf/nursing/entrepreneur the option should not appear (or should be renamed to a
  craft-appropriate "Detailed" basemap that points at the same OSM source). Sailing keeps Nautical.

> Open question: do we tune **MapLibre vector styles** (precise, themeable, more work) or accept a
> craft-labelled **OSM raster** basemap (cheap, ships now, less brand-consistent)? Raster is the
> fast path to "golfers can see holes today"; vector is the durable answer. Recommend shipping the
> raster "Detailed" basemap first, vector-tuning per interest as a follow-on.

### 3b. The "place within a place" anchor (the core model) — **BUILT**

A step optionally binds to a **sub-feature** of its site. The original draft (below the line)
proposed a new `sub_site` JSON blob. **During implementation we found the model already exists:**
`StepLocation` carries unused `level_label` / `level_index` / `hierarchy` fields (`types/step-detail.ts`),
authored for hospital wards but never wired. The built design **reuses these** rather than inventing
a parallel field — see `lib/atlas/subSiteAnchor.ts`:

```jsonc
"where_location": {
  "poi_id": "<atlas_pois id — the site, unchanged>",
  "lat": 39.29, "lng": -76.61,
  "location_name": "Mount Pleasant Golf Course",
  "level_label": "Hole 7",            // human label — hole number / ward name / stall id
  "level_index": 7                    // numeric index when the unit is numbered (optional)
}
```

`subSiteConfigForInterest(slug)` decides whether an interest exposes a sub-site dimension and how:
golf → `{ unit: 'Hole', mode: 'numeric', count: 18 }`, entrepreneur/market → `{ unit: 'Stall',
mode: 'text' }`, everything else → `null` (no sub-site UI). `withSubSiteAnchor` / `readSubSiteAnchor`
apply and read the anchor; the site identity (`poi_id`/coords/`location_name`) is left untouched, so
every reader that resolves a step to its site keeps working.

Why reuse `level_label`/`level_index` rather than a new `sub_site` blob:
- The field is **already in the type and the JSON blob** — zero schema/type churn, and the existing
  `poi_id → atlas_pois.name` resolution stays intact.
- It's **descriptive metadata on the site anchor**, not a joined entity. (If a sub-feature later
  earns first-class status — e.g. a hospital ward people repeatedly anchor to — promote it to an
  `atlas_pois` child row with a `parent_poi_id`. Don't build that until the data says it's needed.)

> The richer `sub_site` shape below (OSM provenance: `osm_type`/`osm_id`/`feature`/feature-own
> lat-lng) is **deferred**. It's only needed once we snap to real OSM geometry and place a pin at the
> sub-feature's own anchor (§3c/§3d). For now the anchor is a label + optional index, which is enough
> to capture, store, and surface "Hole 7" without owning the geometry.
>
> ```jsonc
> // DEFERRED — richer OSM-backed shape, revisit with map-snap capture:
> "sub_site": { "source": "osm", "osm_type": "way", "osm_id": 123456789,
>               "feature": "golf=hole", "ref": "7", "name": "Hole 7",
>               "lat": 39.291, "lng": -76.609 }
> ```

### 3c. Capture UX — pick a sub-feature — **BUILT (config-driven), OSM-snap deferred**

Built in `PlanWhereCard` (the canonical "where" card): once a step has a named site **and** the
interest has a `subSiteConfig`, the card shows a sub-site block:
- **numeric** mode (golf) → a chip grid: a "Whole course" clear chip + chips `1..count`; tapping a
  chip writes `level_label: "Hole 7"`, `level_index: 7` (toggling the active chip clears it).
- **text** mode (entrepreneur/market) → a free-text field writing `level_label`.

Default is **no sub-site** (the centroid pin) — sub-anchoring is opt-in, never blocking. A step is
still a step (`project_step_type_race_flag_reframe`); this is metadata, not a new step kind.

**Deferred:** sourcing the candidate list from real OSM features under the site polygon (tap the
hole on the map). The numeric grid is a stand-in that works without geometry; the OSM-snap flow
lands with the richer `sub_site` shape in §3b.

### 3d. Surfacing the anchor

- **Sites segment** — **BUILT**: the Sites hero shows `location_name · level_label` ("Mount
  Pleasant · Hole 7"); `level_label` is threaded through `PickerStep` in `useUserAtlasSteps.ts`.
- **Map** — *pending*: render the sub-site at its own anchor when present (hole-7 pin sits on hole 7,
  not the clubhouse), falling back to the site centroid. Needs the deferred OSM feature lat/lng.
- **Capabilities "where evidenced"** — *pending*: read the sub-label so "Bunker & sand play"
  evidences at *Hole 7*, not just *Mount Pleasant*. This is where hole-anchoring pays off: capability
  evidence becomes locatable to the exact feature that exercised it.

## 4. Out of scope (for this pass)

- Promoting sub-features to first-class `atlas_pois` rows (revisit only if anchoring volume warrants).
- Editing/contributing geometry back to OSM.
- Cross-interest sub-feature taxonomy unification — golf hole, nursing ward and market stall stay
  loosely-typed `feature` strings; don't force a shared enum yet.

## 5. Verification

**Built slice (verify now):**
- Golf/non-sailing Layers panel offers **Detailed** (not Nautical); Detailed renders OSM golf
  cartography (holes/greens). Sailing still offers Nautical. ✅ verified on sim (Emily/Golf).
- A golf step with a named course shows the hole chip grid in PlanWhereCard; picking "Hole 7"
  persists `level_label: "Hole 7"`, `level_index: 7` on `where_location`.
- That step's "Hole 7" surfaces in the Atlas Sites hero as `<course> · Hole 7`.
- A step with no sub-site behaves exactly as today (centroid pin, no sub-site UI on interests
  without a `subSiteConfig`).
- `npm run typecheck` && `npm run lint`. ✅

**Deferred slice (verify when built):**
- A golf step anchored to a hole renders its **pin on the hole** (not the clubhouse) — needs the
  OSM feature anchor (§3b deferred shape).
- The capability it evidences reads as evidenced *at that hole* in Capabilities "where evidenced".
- OSM-snap capture: tap the hole on the map instead of picking a number from the grid.
