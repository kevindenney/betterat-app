# Atlas — Hole-Level Anchoring (place-within-a-place)

> Status: **Draft** · 2026-06-18
> Owner: Atlas
> Surface: `components/ios-register/atlas/` (AtlasScreen + AtlasMapLibreCanvas), `timeline_steps` location model

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
| Basemap switch | `AtlasMapLibreCanvas.tsx` L84 `AtlasBasemap = 'map' \| 'satellite' \| 'nautical'` | The user-facing Map/Satellite/Nautical control already exists in the Layers panel. |
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

### 3b. The "place within a place" anchor (the core model)

A step needs to optionally bind to a **sub-feature** of its site. Proposed additive shape on
`where_location`:

```jsonc
"where_location": {
  "poi_id": "<atlas_pois id — the site, unchanged>",
  "lat": 39.29, "lng": -76.61,
  "location_name": "Mount Pleasant Golf Course",
  "sub_site": {                       // NEW — optional
    "source": "osm",                  // provenance of the feature
    "osm_type": "way",                // node|way|relation
    "osm_id": 123456789,              // stable OSM id
    "feature": "golf=hole",           // the tag that classifies it
    "ref": "7",                       // human label — hole number / ward name / stall id
    "name": "Hole 7",                 // display string
    "lat": 39.291, "lng": -76.609     // the sub-feature's own anchor
  }
}
```

Why a nested field on `where_location` rather than a new table:
- Steps already read/write `where_location` as one JSON blob; this rides the existing read/write
  paths and the existing `poi_id → atlas_pois.name` resolution stays intact.
- The sub-site is **descriptive provenance**, not a joined entity we own — we're pointing *at* an
  OSM feature, not adopting it into `atlas_pois`. (If a sub-feature later earns first-class status —
  e.g. a hospital ward people repeatedly anchor to — it can be promoted to an `atlas_pois` child row
  with a `parent_poi_id`. Don't build that until the data says it's needed.)

### 3c. Capture UX — snap a step to a sub-feature

- When a step's `where` resolves to a site that has known sub-features (golf course, hospital,
  market), offer a **"which one?"** affordance: tap the map / pick from a list of the site's holes
  or wards. Source the candidate list from the OSM features under the site polygon (golf=hole,
  healthcare unit, shop) at capture time.
- Default to **no sub-site** (the centroid pin) — sub-anchoring is opt-in, never blocking. A step is
  still a step (`project_step_type_race_flag_reframe`); this is metadata, not a new step kind.

### 3d. Surfacing the anchor

- **Map** — render the sub-site at its own anchor when present (hole-7 pin sits on hole 7, not the
  clubhouse), falling back to the site centroid.
- **Sites segment** — show the sub-label under the site row ("Mount Pleasant · Hole 7 ×2").
- **Capabilities "where evidenced"** — read the sub-label so "Bunker & sand play" evidences at
  *Hole 7*, not just *Mount Pleasant*. This is where hole-anchoring pays off: capability evidence
  becomes locatable to the exact feature that exercised it.

## 4. Out of scope (for this pass)

- Promoting sub-features to first-class `atlas_pois` rows (revisit only if anchoring volume warrants).
- Editing/contributing geometry back to OSM.
- Cross-interest sub-feature taxonomy unification — golf hole, nursing ward and market stall stay
  loosely-typed `feature` strings; don't force a shared enum yet.

## 5. Verification (when built)

- Golf basemap shows hole numbers/greens under the default golf style (not only under Nautical).
- "Nautical" no longer appears on golf/nursing/entrepreneur Layers panels; still present on sailing.
- A golf step anchored to a hole renders its pin on the hole, lists "· Hole N" in Sites, and the
  capability it evidences reads as evidenced *at that hole*.
- A step with no sub-site behaves exactly as today (centroid pin, no regression).
- `npm run typecheck` && `npm run lint`.
