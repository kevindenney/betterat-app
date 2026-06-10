# Place Local Knowledge — generalizing the area-knowledge anchor

> Status: SHIPPED 2026-06-10 as Phase P (`62cadb35` → P.5; see atlas-roadmap.md).
> Loose threads: none — golf surface (P.6) and per-interest topic categories (P.7) shipped 2026-06-10.
> Originally a follow-up to `AREA_LOCAL_KNOWLEDGE_SPEC.md` (shipped as
> Phase O, commits `458dbf37` → `2b1e1be3`). That work made `venue_discussions` audience-
> scoped (`scope_type`/`scope_id`: public / private / fleet / org / blueprint) but left the
> **geo-anchor** sailing-shaped: posts hang off `venue_racing_areas.racing_area_id` and
> `sailing_venues.venue_id`. This spec generalizes the anchor so nursing, golf, and
> rural-India entrepreneurship get place-anchored knowledge on the same primitive.

## The question this answers

"How does a nursing cohort share what they know about a clinical site? How do golfers
share course knowledge? How does a lac-craft self-help group share what they know about
a haat or a supplier?" — same shape as the sailing question, different place primitive.

## What's already generic vs. sailing-bound

| Layer | Status |
| --- | --- |
| Audience scoping + RLS (`can_read_venue_discussion` → `can_access_venue_scope`) | **Generic.** Audience-only — never touches the anchor. Verified 2026-06-10: zero RLS changes needed. |
| `AreaKnowledgeSection` / `GroupKnowledgeSection` / composer audience picker | Generic *behavior*, sailing *keying* (`racingAreaId`, `venue_racing_areas` join) and sailing *copy* ("Local knowledge", "about this water"). |
| Geo-anchor columns (`venue_id` → `sailing_venues`, `racing_area_id` → `venue_racing_areas`) | **Sailing-bound.** |
| Conditions matching ("Matches now" wind chip) | Sailing-only; already optional (`conditions: null`). |

## Anchor model: `poi_id` → `atlas_pois`

`atlas_pois` is already the universal place catalog (`id, kind, interest_slug, name,
lat/lng, claimed_by_org_id, metadata`) read by `hooks/useAtlasPois.ts` and rendered by
every persona frame. Current dev rows:

| Persona | Kinds present | Rows |
| --- | --- | --- |
| nursing | hospital ×7, sim_lab ×2, preceptor ×3 | real sites, ready today |
| lac-craft-business (India) | haat ×3, supplier ×5, market, bank, collection/processing/training centers, home, mentee | ready today |
| sail-racing | racing_area ×4 (mirror of some `venue_racing_areas`) | authoritative table is still `venue_racing_areas` |
| golf | **none** | pure data gap |

**Decision:** add `poi_id uuid REFERENCES atlas_pois(id) ON DELETE SET NULL` to
`venue_discussions`, alongside the existing `racing_area_id`. A post anchors to **at most
one place**: `CHECK (racing_area_id IS NULL OR poi_id IS NULL)`. Sailing keeps
`racing_area_id` because user-authored areas live in `venue_racing_areas` (composer +
Atlas authoring flow own that geometry); folding racing areas into `atlas_pois` is a
separate consolidation, noted as an open question. `venue_id` stays nullable and is
simply NULL for non-sailing posts.

Person-kind POIs (`preceptor`, `mentee`, `home`) are **not** knowledge anchors — knowledge
attaches to places, not people. Use a denylist (`preceptor`, `mentee`, `home`), not a
kind allowlist, per `feedback_admin_evidence_grid_site_kind_allowlist`.

## Per-persona mapping

| Persona | Anchor | Group audiences that matter | Heading vocab | Empty-state copy |
| --- | --- | --- | --- | --- |
| sail-racing | racing area (unchanged) | fleet, org, blueprint | LOCAL KNOWLEDGE / ABOUT THIS AREA | "…what you know about this water." |
| nursing | hospital / sim_lab POI | org (school), blueprint (program) | SITE KNOWLEDGE / ABOUT THIS SITE | "…what you know about this site — parking, charge desk, documentation quirks." |
| golf | course POI (kind `course`, to be seeded) | org (club), blueprint | COURSE KNOWLEDGE / ABOUT THIS COURSE | "…what you know about this course." |
| lac-craft-business | haat / market / supplier / center POI | org (SHG/CLF), blueprint | MARKET KNOWLEDGE / ABOUT THIS PLACE | "…what you know about this market — prices, timing, who to ask for." |

Vocab lives in `lib/vocabulary.ts` following the `getVisibilityLabels(interestSlug)`
pattern: `getPlaceKnowledgeLabels(interestSlug)` returning
`{ heading, aboutHeading, emptyText, addCta }`, slug-keyed table + `_default`
(KNOWLEDGE-neutral: "LOCAL KNOWLEDGE" / "ABOUT THIS PLACE"). Per
`project_interest_vernacular_personas`, copy must read persona-native.

## Schema (Commit 1)

```sql
ALTER TABLE venue_discussions
  ADD COLUMN poi_id uuid REFERENCES atlas_pois(id) ON DELETE SET NULL;
ALTER TABLE venue_discussions
  ADD CONSTRAINT venue_discussions_single_anchor
  CHECK (racing_area_id IS NULL OR poi_id IS NULL);
CREATE INDEX idx_venue_discussions_poi ON venue_discussions(poi_id)
  WHERE poi_id IS NOT NULL;
```

No RLS changes. No backfill (no existing poi-anchored posts).

## Service + hooks (Commit 2)

All `venue_discussions` access is already centralized in `CommunityFeedService` — the
blast radius is one file plus `hooks/useCommunityFeed.ts`.

- `getAreaKnowledge(racingAreaId)` → `getPlaceKnowledge(anchor)` where
  `anchor = { racingAreaId: string } | { poiId: string }`. Same summary shape
  (countsByScope, totalVisible, posts). Keep a thin `getAreaKnowledge` alias or update
  the two call sites (AreaKnowledgeSection, AtlasScreen) — prefer updating call sites.
- `getGroupKnowledge(scopeType, scopeId)`: bucket key becomes
  `racing_area_id ?? poi_id ?? null`; join both
  `racing_area:venue_racing_areas!racing_area_id(area_name)` and
  `poi:atlas_pois!poi_id(name, kind)`; bucket carries `{ placeKind }` so the section can
  pick an icon (map for areas, business/medkit/golf per POI kind).
- `createPost(params)`: accept optional `poiId`; `venueId` becomes optional (required
  only when `racingAreaId` is set — DB check enforces single anchor).
- Hooks: `useAreaKnowledge(racingAreaId)` → `usePlaceKnowledge(anchor)`;
  `useGroupKnowledge` unchanged signature, richer buckets. Query keys stay under
  `communityFeedKeys.feeds()` so existing create/vote/comment invalidations keep covering
  them (`feedback_query_cache_key_invalidation_audit`).

## UI (Commits 3–4)

**Commit 3 — components + vocab.**
- `AreaKnowledgeSection` → accepts `anchor` ( racingAreaId | poiId ) and resolves heading
  / empty copy via `getPlaceKnowledgeLabels(interestSlug)` (explicit `heading` prop still
  wins, used by the race step's ABOUT THIS AREA). Conditions prop stays optional —
  non-sailing callers pass null. Keep the file where it is; consider renaming to
  `PlaceKnowledgeSection` in the same commit (one rename, no compat shim).
- `GroupKnowledgeSection`: render poi buckets (kind icon + name) alongside area buckets;
  already mounted on fleet + org pages, so nursing/India org pages light up with **zero
  new mounting** once posts exist.

**Commit 4 — Atlas POI callout + composer.**
- AtlasScreen: the existing POI pin BottomSheet branch (`selectedPin` for hospital /
  sim_lab / haat / market / supplier / center kinds, denylist person-kinds) gains the
  knowledge section keyed by `poi.id` + an "Add …" primary CTA →
  `/venue/post/create?poiId=…` (mirrors Phase O.4's racing-area callout).
- Composer (`app/venue/post/create`): when `poiId` param present, show the place as a
  pre-bound chip (like the racing-area chip) and skip the sailing venue/area pickers.
  A standalone place *picker* (no param) lists `atlas_pois` for the viewer's active
  interest, person-kinds denylisted. Audience picker unchanged — it's already
  membership-driven.

## Seeds + verification (Commit 5)

- **Nursing:** no seeding needed (7 hospitals exist). Verify in sim by flipping the
  persona interest via AsyncStorage (`reference_activate_persona_interest_in_sim`):
  hospital pin → callout shows SITE KNOWLEDGE; create an org-scoped post; org page
  GroupKnowledgeSection shows it; RLS probe: non-member `can_read_venue_discussion` =
  false.
- **India:** no seeding needed (haats/suppliers exist). Same walkthrough on f7.
- **Golf:** seed a handful of `kind='course'` POIs near the golf demo account's home
  area first (data pass — `project_org_locations_unseeded` pattern: this is data, not
  code). Then same walkthrough on f9.
- Sailing regression: race-step ABOUT THIS AREA + fleet/org sections + Atlas area callout
  unchanged.

## Open questions (non-blocking)

1. **Cohort audience.** Nursing's natural group is the cohort, not a fleet. `scope_type`
   stays public/private/fleet/org/blueprint for v1; adding `cohort` is a follow-up
   (`can_access_venue_scope` + composer picker), consistent with the one-group-primitive
   model (`project_group_three_axis_model`).
2. **Folding `venue_racing_areas` into `atlas_pois`.** Four racing_area POI mirror rows
   already exist; consolidating would let `racing_area_id` retire. Out of scope —
   touches the Atlas authoring flow.
3. **Golf course data source** — manual seed vs. import. Start manual (demo scale).
4. **Members-only state for `/venue/post/[id]`** — carried over from Phase O, still open.
