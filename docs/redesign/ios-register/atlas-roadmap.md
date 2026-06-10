# Atlas — Roadmap & Status

> Sibling docs:
> - `atlas-tab-brief.md` — overall vision
> - `atlas-phase-8-pin-provenance-brief.md` — provenance model
>
> Authors: Kevin + Claude · last updated 2026-06-03
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

### 🟨 Phase A — Time-aware pin status
Render every step with lat/lng as a status-encoded dot on the atlas — not just the single NEXT pill.

- ✅ A.1 — Step status vocabulary + marker variants (`my-step-planned`, `my-step-done-recent`, `my-step-done-old`); planned-next promoted to the existing amber NEXT pill. Shipped in commit pending.
- ✅ A.2 — `useUserAtlasSteps` hook queries `timeline_steps` joined to `interests.slug`, classifies into status, returns `AtlasPinSpec[]` merged into `useAtlasFramePins`. Shipped.
- ✅ A.2b — F4 nextNursing + F7 nextHaat now detect `has_user_step` (planned-week pin within ~500m of NEXT POI) and flip the bottom-sheet primary CTA to "Open clinical" / "Open Wednesday step". Shipped.
- ⬜ A.3 — Tap on `my-step-*` → open step detail in the live tab (currently routes to `onPrimaryAction` via selected-pin path; need explicit `onPinPress`→ step detail wiring)
- ⬜ A.4 — Layers chip "My steps" toggle (default on)
- ⬜ A.5 — "New since last visit" pulse — store `atlas_last_visited_at` per user; pins authored after that timestamp get a brief 1s pulse on next mount, then quiet. Includes both new POIs in scope and new peer steps.

### 🟨 Phase B — Mobile interaction polish + picker handoff
- ✅ B.1 — v2 StepShell "Pick on map" now registers an `AtlasPickerBus` listener, pushes `/atlas?fromPlan=1`, and writes the returned coordinate back into the Plan tab Where row. Shipped 2026-05-25.
- ✅ B.2 — Pin-tap camera padding (zoom-independent) so tapped pin lands above the bottom sheet instead of behind it. Walkthrough 2026-05-25.
- ✅ B.3 — Faculty filter exempts anchor/institution/my-step kinds (Pinkard no longer hides when Faculty chip toggled). Walkthrough 2026-05-25.
- ⬜ B.4 — Long-press → "Add a pin here" (gated on Phase 8.4)
- ⬜ B.5 — Two-finger rotate disable on iOS (compass disorientation in slow zooms)
- ⬜ B.6 — Pin-tap haptic feedback (light impact)

### ⬜ Phase C — Voice memo real audio capture
Item 6 from F7 walkthrough — deferred because the audio-recording surface doesn't exist yet. Needs:
- ⬜ C.1 — Audio capture component (expo-av or react-native-audio-recorder-player)
- ⬜ C.2 — Upload pipeline to Supabase Storage with size cap + tus for >50MB
- ⬜ C.3 — Step extraction: voice → transcript → AI step proposal (reuse existing AddStep AI flow)
- ⬜ C.4 — Wire Voice memo CTA on F7 NEXT-haat sheet to capture flow

### ✅ Phase G — Chip selected-state visual fix
Walkthrough 2026-05-25 surfaced: black-bg active chip + light-gray inactive chip reads ambiguous — users (validly) interpret black as "off / disabled" and gray as "on / active." Active chips now use iOS systemBlue with white text. Optional future refinement: add small checkmark glyph for redundant affordance.

### ✅ Phase H — Walk-time annotations need visible line connectors
"2 min" / "4 min" labels floated in midair between same-campus POIs (JHH ↔ Pinkard, Sibley ↔ Suburban). Users couldn't tell which two pins they connect. `useWalkTimeAnnotations` now emits endpoint pairs and AtlasMapLibreCanvas renders dashed MapLibre line connectors under the label.

### ✅ Phase I — Heatmap legend popover
"Cohort heatmap · this week" pill now toggles a small floating legend explaining: hex number = step count, color = dominant skill cluster, source = cohort-level cells (no individual patient sites). Same pattern can extend to F7 entrepreneur density layers later.

### ✅ Phase J — Atlas auth-gated query keys
Walkthrough 2026-05-25 surfaced: toggling F4 Heatmap changed nothing because `useCohortHeatmap` could cache an empty pre-auth RPC result. Same pattern can affect peer steps and POIs. Fixed by including `user.id` in query keys and gating queries until auth is ready for `useCohortHeatmap`, `useAtlasPeerSteps`, and `useAtlasPois`. Shipped 2026-05-25.

### 🟨 Phase K — Organization and fleet lenses
Atlas POIs that map to claimed BetterAt organizations should not behave like generic "plan here" pins. Club/institution pins now carry `orgSlug` from `atlas_pois → organizations` and the RHKYC sheet opens the organization route when linked; the sheet also exposes a stubbed "View club lens" action. Remaining work: a real Atlas lens state for organization POV (`RHKYC`) and nested fleet/class POV (`RHKYC · Dragon`, `HHYC · Etchells`, etc.), with empty-state copy when a class does not exist at a club.

### 🟨 Phase L — Sailing conditions overlays
The top sailing chip now reads `Wind/tide` and toggles both weather vectors so users do not think the visible current arrow is controlled by a wind-only filter. Layers still expose separate `Wind forecast` and `Tidal current` toggles. Remaining work: replace one-off arrows with race-useful sailing intelligence — favored side, cross-current legs, tide gates, start-line set, layline/current interaction, and time-to-start scrubbing.

### ⬜ Phase F — Reach-out channel sheet
When a user taps "Reach out" on a mentor/peer/preceptor/mentee pin, surface a channel-aware action sheet:
- US/EU professional → email primary, in-app secondary
- India/SEA/Africa community → WhatsApp primary, in-app secondary
- Same-cohort peers → in-app message primary
Needs profile contact fields + mailto/WhatsApp deep-link helpers + the in-app messaging surface (none of which exist yet). Until shipped, mentor/preceptor pins use the honest "Open profile" CTA.

### ✅ Phase M — Step-kind lens (universal activity kinds)
From v23 mockup (`docs/redesign/mockups/23_betterat_atlas_steps_redesign.html`). Atlas no longer shows only on-water racing — every step kind (race / practice / boat work / learn / coach) gets a kind-colored glyph pin, a kind filter row, and a kind-adaptive cockpit. Kind is derived from the freeform `category` (+ title) via `stepKindFor()` in `lib/step-kind-config.ts` — no `step_kind` DB column yet (v1 keyword match). Per-interest vocab via `stepKindLabel()` (sailing → Race/Practice/Boat work/Learn/Coach; default → Event/Practice/Prep/Learn/Coach; nursing → Shift/Practice/Prep/Study/Mentor).

- ✅ M.1 — Step-kind resolver + kind-colored glyph pins (`my-step-*` pins carry `stepKind` driving color + glyph). `a9573991`.
- ✅ M.2 — Kind filter row in f1 top chrome; `filteredFramePins` applies peer + kind filters together (my-step pins filtered by `stepKind`, non-my-step always pass). `2f52409d`.
- ✅ M.3 — Kind-adaptive cockpit: ashore kinds (boat_work / learn / coach) swap the wind/tide scrubber for `StepKindCockpit` — real `metadata.plan.how_sub_steps[]` checklist via `useAtlasCockpitStep`. No fabricated target numbers (mockup's shroud-tension/mast-rake have no schema). On-water (race / practice) keeps the scrubber. `7d890847`.
- ✅ M.4 — Ashore cockpit *replaces* the redundant "YOUR NEXT STEP" sheet (was rendering the title twice): cockpit absorbs Open step / Pick another (kind-tinted primary). f4 nursing surfaces Nearby as a TopChrome action + drops the floating pill. `677cbda4`.
- ⬜ M.5 (future) — promote kind to a real `step_kind` column once the keyword resolver's misclassifications justify it; extend the lens to f4/f7 cockpits. **Superseded by Phase N.4** — the kind taxonomy collapses to a single `is_race` flag rather than a 5-kind enum.

### 🟨 Phase N — Peer-step drill-down + Step/Race reframe
From f1 walkthrough 2026-06-03 (`project_atlas_peer_steps_present_but_clustered`, `project_step_type_race_flag_reframe`). Two threads: make individual peer steps reachable on the map, and collapse Phase M's 5-kind lens to the only distinction that changes Atlas behavior — race vs not-race. Mockups: `docs/redesign/mockups/26_betterat_atlas_peer_steps_and_step_types.html` (peer drill-down + model), `27_betterat_sailracing_step_design.html` (full Step/Race composer).

- ⬜ N.1 (deferred) — Zoom-aware de-cluster: `clusterPeerPins()` only merges peers below a zoom threshold; at close zoom render individual peer pins as relationship-colored avatars (you/crew/fleet/following tones from `PIN_TONE`). Replaces the always-on "+N sessions" density badge. **Deferred:** needs the canvas's live MapLibre zoom plumbed up into `useAtlasFramePins` (the hook only sees the per-frame camera preset today), and is hard to verify by sight without peers seeded across multiple zoom levels. Do it as its own zoom-plumbing change.
- ✅ N.2 — Cluster badge → drill-down sheet: tapping a "+N" cluster now opens the privacy-safe member list (`PeerMemberList` in AtlasScreen) — relationship-toned dot + name (or "Someone nearby" when hidden) + relationship + relative time, most-recent-first, capped at 8 with a "+N more" tail. Members ride on `AtlasPinSpec.peerMembers`, collected in `clusterPeerPins()`. Replaced the `key="peer-steps"` Coming-soon stub.
- ✅ N.3 — Peer-step detail callout: tapping an individual peer pin opens a `key="peer-step"` sheet (who · relationship · when + a jitter/privacy note). Identity rides on `AtlasPinSpec.peer` (from `atlas_peer_steps_near`). Reach-out + View-profile CTAs are future work; precision still honors the server-side jitter the RPC applies.
- ✅ N.4 — Step/Race binary: `is_race` boolean (migration `20260603160000`) replaces the 5-kind lens for Atlas rendering. Set in the step composer (`PlanStepRaceSelector`, gated to sail-racing in `StepPlanQuestions`). Atlas pins render ⛵ royal-blue when `is_race` else a neutral relationship dot; filter row collapsed to All/Races; race next-step keeps the wind/tide cockpit, non-race shows the checklist. `stepKind` stays populated for `StepKindCockpit`'s header (Phase M not ripped out).

### ✅ Phase O — Area local knowledge (scoped venue_discussions)
Spec: `docs/redesign/specs/AREA_LOCAL_KNOWLEDGE_SPEC.md` (`66afd7f5`). One primitive — `venue_discussions` + `(scope_type, scope_id)` audience (public / private / fleet / org / blueprint), RLS fail-closed via `can_read_venue_discussion()`. Answers "how does a fleet / the public / an org / blueprint subscribers share local knowledge about a race area". Shipped 2026-06-10.

- ✅ O.1 — Migration: scope columns + backfill + RLS rewrite (incl. tag-table read policies scoped via the helper). `458dbf37`, tag policies in `7a2bcc8d`.
- ✅ O.2 — Read path: `CommunityFeedService.getAreaKnowledge` + `useAreaKnowledge`. `3ea458e2`.
- ✅ O.3 — Composer: racing-area + audience pickers in `/venue/post/create`. `b3f78ec5`.
- ✅ O.4 — Atlas: racing-area tap opens a Local Knowledge callout for everyone (was owner-only edit); counts by audience, condition-matched count, top posts, "Add local knowledge" CTA pre-bound to the area. `7a2bcc8d`.
- ✅ O.5 — Group surfaces: fleet + org pages get a LOCAL KNOWLEDGE section bucketed by area (`useGroupKnowledge`, collapses for non-members via RLS); race-step Plan tab gets ABOUT THIS AREA under the course map (detail view only). Also fixed the function-form-Pressable stacked-row bug in both knowledge sections. `2b1e1be3`.

### ✅ Phase P — Place local knowledge (POI anchor, all personas)
Spec: `docs/redesign/specs/PLACE_LOCAL_KNOWLEDGE_SPEC.md`. Generalizes Phase O's geo-anchor: `venue_discussions.poi_id → atlas_pois` alongside the sailing `racing_area_id` (single-anchor CHECK, audience RLS untouched). Per-interest vocab via `getPlaceKnowledgeLabels()` — SITE / COURSE / MARKET / LOCAL KNOWLEDGE. Shipped 2026-06-10.

- ✅ P.1 — Migration: `poi_id` column + single-anchor CHECK + person-kind denylist trigger. `62cadb35`.
- ✅ P.2 — Read/write path: `getPlaceKnowledge(anchor)` + `usePlaceKnowledge` (KnowledgeAnchor = racingAreaId | poiId); createPost accepts `poi_id`. `6cf1d3ab`.
- ✅ P.3 — `AreaKnowledgeSection` → `PlaceKnowledgeSection` (vocab-resolved heading/empty/CTA); `GroupKnowledgeSection` place-kind icons + org `interest_slug` plumbing. `acb58192`.
- ✅ P.4 — Atlas generic POI sheets (F1/F4/F7) gain an expanded knowledge section + "Add … knowledge" CTA; composer gets a pre-bound Place chip (`poiId` param skips community picker, hides race/conditions sections). `2891f695`.
- ✅ P.5 — Constraint fix (`venue_discussions_has_association` now accepts poi-only rows — poi-anchored inserts 23514'd before; duplicate `venue_or_community_required` dropped), nursing site detail gets SITE KNOWLEDGE (uuid-gated — Sites-list targets carry real `atlas_pois` ids, the mock node map's slugs don't), dev seeds (golf course POIs + 6 public posts across JHH East Baltimore / Bero haat / Baylands). Sim-verified: nursing site detail + composer chip, lac-craft Bero haat sheet + post detail, sailing ABOUT THIS AREA regression.
- ✅ P.6 — Golf surface: `GolfAtlasSurface` (f9) Courses view overlays real `atlas_pois` `kind='course'` rows (`useAtlasPois`) alongside the Oakridge mock pins; venues camera widens to fit them (zoom 11.5 bounds-midpoint). Pin tap opens a course sheet hosting `PlaceKnowledgeSection` (COURSE KNOWLEDGE) + "Add course knowledge" → composer pre-bound to the course with golf topic chips. Sim-verified on Baylands Golf Links (2 seeded posts + composer chips Greens/Layout/Tee times/Practice).
- ✅ P.7 — Per-interest composer topic chips: `venue_topic_tags.interest_slug` (NULL = universal Safety/Logistics; sailing tags scoped to `sail-racing`; new nursing/golf/lac-craft tag sets, Hindi-bilingual for lac-craft). `useTopicTags(interestSlug)` defaults to `sail-racing` so legacy venue surfaces keep their chips; add-knowledge CTAs pass the slug through `/venue/post/create`. The `category` column itself stays `general` for poi posts — chips were the real vocab surface. Sim-verified: nursing composer shows Parking/Charge desk/Documentation/Units/Preceptors.

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
