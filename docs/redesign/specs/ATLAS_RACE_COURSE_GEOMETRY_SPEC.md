# Atlas Race-Course Geometry Spec

> Status: **Draft** · 2026-06-03
> Owner: Kevin (course data authoring) + Claude (rendering/derivation)
> Surface: Atlas tab — sailing frames (F1 overview, F2 race-course planning, F6 from-plan)

## 1. Goal

Today the Atlas map shows soft "race area" polygons (`venue_racing_areas`) — a
blurry blob over water. A sail racer wants the thing that actually makes them
faster at a venue: the **course geometry** — start line, marks, finish line,
laylines, and the tactical zones those imply. This spec defines a venue-scoped,
reusable **race course** that renders as real map geometry on Atlas, and the
authoring flow for Kevin to create them.

The target picture (Kevin's description, encoded below):

- **Start line** between a committee boat (starboard end) and a pin-end buoy (port end).
- **Windward mark** (upwind) and **leeward mark** (downwind).
- **Finish line** between the committee boat and a finish buoy on the *opposite*
  side of the committee boat from the start-line pin.
- **Start-line laylines**: the starboard-tack laylines to the committee boat and
  to the pin buoy.
- **Starting box**: an angular shaded zone bounded by those two start-line
  laylines and a boundary ~5 boat-lengths to leeward of the start line.
- **Windward-mark laylines**: port and starboard laylines extending downwind from
  the windward mark.
- **Beat corridor**: the start-line laylines extended to windward until they meet
  the windward-mark laylines (the starboard-tack layline off the pin meets the
  windward mark's layline; the port-tack layline off the committee boat meets the
  other windward-mark layline).

## 2. What already exists (reuse — do not rebuild)

| Asset | File | What it gives us |
| --- | --- | --- |
| Course types | `types/courses.ts` | `Mark`, `MarkType`, `PositionedCourse`, `StartLinePosition` (pin + committee), `CourseMarkTemplate`, `CoursePositioningOptions`, `PositionedCourseResult` |
| Positioning math | `services/CoursePositioningService.ts` | `calculateStartLine` (perpendicular-to-wind pin/committee), `calculateMarkPositions` (relX/relY leg-length templates), `calculateFinishMark` (buoy opposite pin across committee — **matches the brief**), `recalculateForWindChange`, `repositionCourse`, `toGeoJSON`, and geometry utils (`destinationPoint`, `calculateBearing`, `normalizeBearing`) |
| Course templates | `COURSE_TEMPLATES` in same service | `windward_leeward`, `triangle`, `olympic`, `trapezoid`, `custom` |
| **Full tactical overlay (THE WHOLE PICTURE)** | `components/races/NativeCourseOverlayMap.tsx` | **Already renders everything in §1**: start box (`outline: [P, C, committeeDown, pinDown]`, L259), start-end laylines (`windDirection ± 45`, L268–269) intersected via `rayIntersection` to the windward-mark laylines = the beat corridor (L273–277), thirds, side labels, favored-side current shading. Self-contained `@maplibre/maplibre-react-native` (same lib as Atlas). Takes a `PositionedCourse`. Regatta-scoped, read-only. |
| Laylines overlay | `components/race-detail/map/LaylinesOverlay.tsx` | standalone layline map overlay (106 lines) |
| Authoring editor | `components/races/CoursePositionEditor.{tsx,native,web}` | drag-to-adjust mark + start-box editor, 3063 lines (currently regatta-scoped) |
| Existing renderer | `components/race-detail/map/CourseOverlay.{tsx,web.tsx}` | renders the course GeoJSON on the race-detail map (NOT Atlas) |
| Atlas race areas | `hooks/useAtlasRacingAreas.ts`, `lib/atlas-race-areas.ts`, `venue_racing_areas` table | the current blob layer + the table where venue geometry lives |

**Key reuse decision:** the geometry is NOT new — `NativeCourseOverlayMap` already
derives and renders the start box, both layline sets, and the beat corridor from a
`PositionedCourse`. The Atlas work is to (a) source a venue-authored
`PositionedCourse`, (b) mount that overlay (or lift its `courseOverlay` derivation,
L152–306) onto the Atlas canvas, and (c) persist courses at venue scope. Extend
`CoursePositioningService` only for the parameter gaps below.

## 3. The gap (genuinely new work)

> **Correction (2026-06-03):** an earlier draft listed laylines, the starting box,
> and the beat corridor as new. They are **not** — `NativeCourseOverlayMap.tsx`
> already derives and renders all three (see §2). The real gap is narrower:

1. **Atlas mounting** — the tactical overlay is never placed on the Atlas MapLibre
   canvas; it only renders on race-detail / race-prep surfaces. Mount
   `NativeCourseOverlayMap` (or lift its `courseOverlay` derivation) into
   `AtlasMapLibreCanvas`, behind a layer toggle and zoom gate.
2. **Venue-scoped, reusable persistence** — `PositionedCourse` is keyed to a
   `regattaId`; we need a course that belongs to a *venue / racing area* so it's
   reusable and authorable independent of a specific regatta.
3. **Authoring entry from a venue** — `CoursePositionEditor` exists but is
   regatta-scoped; add a venue-scoped entry that saves to the new store.
4. **Parameter gaps in the existing derivation** (small, in `NativeCourseOverlayMap`):
   - **Start-box depth** is hardcoded `legDistanceM * 0.15` (L226). Kevin's brief
     wants **5 boat-lengths** — make depth a param (`startBoxDepthBoatLengths ×
     boatLengthM`) with the 0.15·leg as fallback.
   - **Tack angle** is hardcoded `45°` (L179, L268–269). Parameterize as
     `tackAngleDeg` (default 42), later class-aware from polars.
5. **Finish line** — the overlay draws the start box + laylines but (verify) does
   not emit the committee↔finish-buoy line; `CoursePositioningService.calculateFinishMark`
   gives the point. Add the finish LineString if missing.

## 4. Data model

### 4.1 Derivation parameters (new)

A full course is derivable from a small parameter set. Store these; derive the
rest at render time so geometry stays internally consistent.

```ts
interface CourseGeometryParams {
  // Anchors — either explicit endpoints OR a center + length.
  committee: { lat: number; lng: number };   // starboard end of start line
  pin: { lat: number; lng: number };          // port end of start line
  windDirectionDeg: number;                    // 0=N, 90=E — the course axis

  // Scalars
  legLengthNm: number;                         // start → windward mark
  tackAngleDeg: number;                        // half-angle off the wind a boat
                                               // points close-hauled (default 42)
  boatLengthM: number;                         // LOA, for the start box depth
  startBoxDepthBoatLengths: number;            // default 5

  courseType: CourseType;                      // windward_leeward default
}
```

`windDirectionDeg` is the **direction the wind blows FROM** (sailing convention —
see `feedback_sailing_conventions`). The windward mark is upwind, i.e. toward the
wind source. Confirm this against `CoursePositioningService` usage before coding —
its `calculateMarkPositions` moves "upwind" along `windDirection`; keep one
convention end-to-end.

### 4.2 Derived geometry (computed, not stored)

| Feature | Construction |
| --- | --- |
| **Start line** | `committee` ↔ `pin` (already have endpoints). |
| **Start line center** | midpoint of committee/pin. |
| **Windward mark** | from center, bearing = windDirection, distance = legLengthNm. (`calculateMarkPositions`, `windward_leeward` template.) |
| **Leeward mark** | from center, bearing = windDirection+180, small offset (template relY≈0). |
| **Finish buoy** | `calculateFinishMark` (reflect pin across committee). |
| **Finish line** | `committee` ↔ finish buoy (NEW LineString). |
| **Windward starboard layline** | ray from windward mark, bearing = windDirection + 180 + tackAngle, length = corridor cap. |
| **Windward port layline** | ray from windward mark, bearing = windDirection + 180 − tackAngle. |
| **Start-line starboard laylines** | from pin and from committee, bearing toward windward at the starboard close-hauled angle (windDirection ± tackAngle); extended to windward until intersecting the windward-mark laylines → defines the **beat corridor**. |
| **Starting box** | polygon: start line (top edge) + the two start-line laylines running to leeward + a bottom edge `startBoxDepthBoatLengths × boatLengthM` to leeward of (parallel to) the start line. |

> **Handedness caveat:** port vs starboard layline sides depend on which way you
> face. Implement the angles parametrically (`±tackAngle` about the wind axis) and
> **verify the labels against a known course diagram in the sim** — Kevin (a
> sailor) is the visual oracle here. Do not hard-trust the port/starboard
> assignment from this prose.

### 4.3 Persistence

Two viable homes — pick in review:

- **(A) Extend `venue_racing_areas`** with a nullable `course_geometry jsonb`
  column holding `CourseGeometryParams`. Pro: one table, Atlas already reads it.
  Con: overloads "area" with "course."
- **(B) New `venue_race_courses` table** (`venue_id`/`racing_area_id` FK,
  `name`, `course_geometry jsonb`, `is_active`, `created_by`, `classes_used`).
  Pro: clean separation, a venue can have many named courses. Con: new read hook.

Recommendation: **(B)** — courses are first-class and reusable; a racing area can
own several (e.g. "Victoria Harbour — W/L short", "…—long"). RLS: public SELECT
for discovery (`feedback_discovery_surface_rls_must_be_public`), owner/admin write.

## 5. Rendering (MapLibre on Atlas)

Extend `CoursePositioningService.toGeoJSON` to emit, with `properties.type`:

- `start-line`, `finish-line` (LineString)
- `mark` points: `windward`, `leeward`, plus `committee`/`pin`/`finish` buoys
- `layline` (LineString) ×4, tagged `tack: 'port'|'starboard'` and
  `anchor: 'windward'|'start'`
- `start-box` (Polygon)
- `course-line` (existing rounding sequence)

Atlas canvas (`components/ios-register/atlas/AtlasMapLibreCanvas.tsx`) adds layers:

- start/finish lines: solid 2px, brand ink.
- laylines: **dashed** 1px, lower opacity (tactical, not literal).
- start box: fill at ~0.12 opacity, no harsh stroke (it's a zone, not a boundary).
- marks: reuse the existing `race-mark` pin (`RaceMarkPin`); committee boat gets a
  distinct glyph.
- Zoom gating: course geometry renders at **zoom ≥ 13** (one step looser than the
  current `race-marks ≥ 14`, since the course spans more water). Sub-label in the
  layer panel states the threshold honestly (existing pattern, AtlasScreen L883).

## 6. Layer-panel integration

Add one toggle to the F1/F6 + F2 registries in
`components/ios-register/atlas/AtlasScreen.tsx` `getLayersForFrame()`:

```ts
{ key: 'sailing.course', label: 'Race course', sub: 'Marks, laylines, start box · zoom ≥ 13', defaultOn: true }
```

Add `'sailing.course'` to `AtlasLayerKey`. This sits alongside the now-default-on
`sailing.race_areas` / `sailing.wind` / `sailing.tide`. Race areas remain the
zoomed-out blob; the course is the zoomed-in detail — they layer, not conflict.

## 7. Authoring flow (Kevin creates a course)

Reuse `CoursePositionEditor` patterns, re-scoped to a venue:

1. From Atlas (or an admin venue screen), "Add race course" → pick the racing area.
2. Drop the **committee boat**, then the **pin** (sets start line + center).
3. Set **wind direction** (drag a compass handle or type degrees), **leg length**,
   **tack angle** (default 42°), **boat length / class**, **start-box depth** (5).
4. Service derives windward/leeward marks, finish, laylines, start box live.
5. Drag any mark to fine-tune (`isUserAdjusted` preserves it across wind changes —
   already supported by `recalculateForWindChange`).
6. Name + save → `venue_race_courses`.

## 8. Build phases (suggested commits)

1. **Extract + parameterize geometry** — lift the `courseOverlay` derivation out of
   `NativeCourseOverlayMap` (L152–306) into a pure, testable function; make start-box
   depth (boat-lengths) and tack angle params; add finish-line emission if missing.
   Pure functions — unit-testable, no sim needed.
2. **Persistence** — `venue_race_courses` table + migration + `useVenueRaceCourses`
   read hook (mirror `useAtlasRacingAreas`, public SELECT RLS).
3. **Atlas render** — mount the overlay layers in `AtlasMapLibreCanvas` (reuse
   `NativeCourseOverlayMap`'s GeoJSON layers), add the `sailing.course` toggle,
   zoom-gate at 13.
4. **Authoring** — venue-scoped entry into `CoursePositionEditor` + save path.
5. **Seed** — Kevin authors the HK Dragon Worlds course(s) for Victoria Harbour /
   the relevant racing area (this also fixes the empty `venue_racing_areas` blob
   problem from the original audit).

Phases 1–2 are pure logic + data and can land/verify without the sim. Phase 3 needs
visual verification in the sim (`feedback_observed_over_reasoned_ui`).

## 9. Open questions

1. **Persistence home** — (A) extend `venue_racing_areas` vs (B) new
   `venue_race_courses`. Spec recommends (B).
2. **Course ↔ regatta link** — should a `PositionedCourse` on a regatta be able to
   *reference* a venue course as its template? (Probably yes, later.)
3. **Tack angle source** — per-class default (Dragon vs dinghy point differently)?
   Could derive from `classes_used` once we have polars; default 42° for v1.
4. **Wind axis live vs authored** — does the course rotate with the live wind
   overlay, or stay as authored until edited? v1: authored/static; live rotation is
   a later tactical-mode enhancement.
5. **Layline handedness** — confirm port/starboard labels visually before shipping.
