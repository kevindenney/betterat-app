# Atlas — Roadmap & Status

> Sibling docs:
> - `atlas-tab-brief.md` — overall vision
> - `atlas-phase-8-pin-provenance-brief.md` — provenance model
>
> Authors: Kevin + Claude · last updated 2026-05-25
>
> Convention: phases are unordered (number is identity, not sequence).
> Status legend: ⬜ not started · 🟨 in flight · ✅ shipped · ⏸ paused

---

## Phases

### ✅ Phase 1 — F1 sailing canvas
RHKYC anchor, race-marks (clickable), peer cluster, wind/tide arrows, race-mark sheet with "Open Spring Series Race 5" CTA. Shipped pre-2026-05-23.

### ✅ Phase 2 — F4 nursing canvas
JHH 4 South NEXT pill, preceptor diamonds, cohort hex heatmap, Faculty/Heatmap/Following filter chips, "COHORT · THIS WEEK" sheet. Shipped 2026-05-24.

### ✅ Phase 3 — F7 entrepreneur canvas
Khunti/Tamar/Bero haats, supplier squares, home anchor, mentee dots, NEXT-haat amber pill, Network/Haat/Suppliers/Mentees chip filtering, Open route → Google Maps deep link. Shipped 2026-05-25 (`5763cb2c` + `776e1117`).

### ✅ Phase 4 — Walkthrough bug batch (F4 + F7)
4 bugs from 2026-05-25 walkthrough: F4 cohort title truncation, F4 NEXT clinical CTA copy, F7 mentee Route button, F7 NEXT-haat CTA branching for existing step. Shipped 2026-05-25.

### ⬜ Phase 8 — Pin provenance & visibility
Four-source pin model (Mine/Network/Institution/System) with colored rings, two-axis Layers sheet, pin-detail source line, Save-to-my-pins, Add-a-pin flow with visibility picker, network-step satellites attached to POIs. **Brief shipped 2026-05-25** at `atlas-phase-8-pin-provenance-brief.md`.

Sub-phases:
- ⬜ 8.0 — DB groundwork (migration: `source_tier`, `owner_user_id`, `owner_org_id`, `visibility`, `derived_from_poi_id`)
- ⬜ 8.1 — Render the source ring on existing markers
- ⬜ 8.2 — Layers sheet two-axis (What + Who)
- ⬜ 8.3 — Pin detail source line + Save-to-my-pins
- ⬜ 8.4 — Add-a-pin long-press flow + visibility picker
- ⬜ 8.5 — Network-step satellites attached to parent POI

### ⬜ Phase A — Time-aware pin status
Render every step with lat/lng as a status-encoded dot on the atlas — not just the single NEXT pill.

- ⬜ A.1 — Step status vocabulary
  - `done-recent` (last 7 days) → desaturated dot
  - `done-old` (>7 days) → tiny ghost dot
  - `planned-week` (next 7 days) → bright dot + day badge
  - `planned-next` (the very next planned step) → existing amber pill (already shipped as NEXT)
- ⬜ A.2 — `useAtlasFramePins` extension to query user's own steps with lat/lng + interest_slug match + window filter
- ⬜ A.3 — Marker variants in AtlasMapLibreCanvas + tap → opens the step (no need to "plan" a new one)
- ⬜ A.4 — Layers chip "My steps" toggle (default on)
- ⬜ A.5 — "New since last visit" pulse — store `atlas_last_visited_at` per user; pins authored after that timestamp get a brief 1s pulse on next mount, then quiet. Includes both new POIs in scope and new peer steps.

### ⬜ Phase B — Mobile interaction polish
- ⬜ B.1 — Long-press → "Add a pin here" (gated on Phase 8.4)
- ⬜ B.2 — Two-finger rotate disable on iOS (compass disorientation in slow zooms)
- ⬜ B.3 — Pin-tap haptic feedback (light impact)

### ⬜ Phase C — Voice memo real audio capture
Item 6 from F7 walkthrough — deferred because the audio-recording surface doesn't exist yet. Needs:
- ⬜ C.1 — Audio capture component (expo-av or react-native-audio-recorder-player)
- ⬜ C.2 — Upload pipeline to Supabase Storage with size cap + tus for >50MB
- ⬜ C.3 — Step extraction: voice → transcript → AI step proposal (reuse existing AddStep AI flow)
- ⬜ C.4 — Wire Voice memo CTA on F7 NEXT-haat sheet to capture flow

### ⏸ Phase D — Atlas round-trip with /races timeline rebuild
Deferred until the parallel /races rebuild lands (`project_races_rebuild_in_flight`). Then verify atlas pins → races timeline → atlas restores state.

### ⏸ Phase E — F2/F3/F5/F6 frames
F1/F4/F7 cover the three personas. F2/F3/F5/F6 are sub-variants of those personas (different zoom levels, different time-of-day states). Build only if explicit walkthroughs surface gaps.

---

## How to use this doc

- **Before starting a new feature pass:** check if it's already in a phase here. If not, add it.
- **Before shipping a batch:** flip its status to ✅ with the commit SHA + date.
- **When a walkthrough surfaces bugs:** add them as a new Phase N (next number), not inside an existing one. Keeps git blame readable.
- **When the brief for a Phase changes:** update both the linked brief AND the sub-phase list here.

## Cross-references that matter

- Sailing-namespace consolidation (`project_sailing_namespace_consolidation`) — when this lands, Atlas-internal sailing helpers move to `sailing/` subdirs. Atlas itself stays generic.
- Discover Pass 11 (`project_discover_pass_11_status`) — Discover surfaces what's on Atlas as recommendations; keep their data sources aligned (both read from atlas_pois + atlas_peer_steps).
- Race timeline rebuild (`project_races_rebuild_in_flight`) — Phase D depends on this.
