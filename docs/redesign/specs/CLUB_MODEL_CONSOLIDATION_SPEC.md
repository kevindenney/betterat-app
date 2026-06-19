# Club-Model Consolidation Spec

> Status (2026-06-19): **Phases 1–3 shipped** (user-visible discovery-surface fragmentation
> resolved). **Phase 6 orphan-UI cleanup done.** **Phases 4–5 RE-SCOPED + DEFERRED** — on audit
> `clubs`/`yacht_clubs` are a parallel club+membership+race model fused into auth and race
> machinery, not a quick stub-removal (see those sections). Table drops blocked behind that merge.
> Owner: platform IA. Origin: user "what is going on?" audit of clubs/orgs/groups/fleets surfaces.

## Problem

The same real-world thing — a yacht club, a fleet — exists as a row in up to **five different
tables**, and no two UI surfaces read the same one. The user observed three disjoint worlds
("Yours has groups, no orgs; the stacks has orgs, no groups; nowhere is the HK Dragon Fleet
except iOS Find Fleets; web top-search shows a historic '46 CLUBS' screen"). All three are the
same root cause: **surface ↔ table fragmentation.**

### The five club/group tables (dev counts 2026-06-19)

| Table | Rows | Role | User-facing surface |
| --- | --- | --- | --- |
| `organizations` | 158 (20 `yacht_club`) | **Canonical.** Claimable, owns blueprints/fleets, Atlas, billing. | Library "The stacks" / "Managed by you" / "Around Sail Racing"; Search "Organizations" (non-sailing branch). JOIN / CLAIM. |
| `fleets` | 26 | Groups that belong to an org. Bridged via `fleets.organization_id` (2026-06-19). | iOS "Find Fleets" (`app/(tabs)/fleet/select.tsx`) + Library "Groups" zone (memberships only, `useUserFleets`). JOIN. |
| `clubs` (stub) | 8 | Legacy fleet-ownership stub. Only `fleets.club_id` + a handful of readers. | None directly. Retirement candidate. |
| `global_clubs` | 46 | Legacy sailing directory ("**46 CLUBS**"). | Search "Clubs" segment (sailing branch) via `ClubDiscoveryService`. **The "historic screen."** |
| `yacht_clubs` | 39 | Sailing race/venue reference data. **24 readers** across race machinery. | Indirect (race registration, crew finder, venue intel, scraping). NOT a club-discovery surface. |
| `sailor_clubs` / `class_associations` | 1 / 10 | Ride along with `yacht_clubs` in `ClubDiscoveryService`. | Indirect. |

`organizations` already carries an FK `global_club_id → global_clubs` (1/155 populated) for
city/country, and an unused `club_id` (0/155).

### Two difficulty classes (drives the order)

- **Discovery-only legacy** (`global_clubs`, `clubs` stub) — feed old discovery/ownership paths
  only. Tractable.
- **Race-machinery reference data** (`yacht_clubs` 24 readers, `clubs` 18 readers) — wired into
  `RaceRegistrationService`, `CrewFinderService`, `RaceScrapingService`, `VenueIntelligenceAgent`,
  `ClubOnboardingAgent`, venue sheets, etc. NOT user-facing club surfaces; NOT quick deletes.
  Overlaps the existing sailing-namespace-consolidation project.

## Invariant (Phase 0 — the rule every phase enforces)

`organizations` is the **single source of truth** for "a club/org you discover, join, claim, that
owns blueprints + fleets." `fleets` = groups that belong to an org. Everything else is either a
*legacy directory to retire* or *sailing race-reference data to namespace* — never again a
user-facing "club" surface.

## Sequenced phases

### Phase 1 — Retire the `global_clubs` "46 CLUBS" surface. (small, low risk) — IN PROGRESS
Repoint the Search tab's "Clubs" segment to `organizations` for the **sailing** branch too.
`app/(tabs)/search.tsx` already routes the non-sailing branch to `OrganizationSearchContent`
(organizations-only); use it for sailing as well, with sailing vernacular ("clubs"). Drop
`ClubSearchContent` → `useClubSearch` → `ClubDiscoveryService` from the discovery path.
`ClubDiscoveryService` stays alive for race machinery only; `ClubSearchContent` becomes orphaned
(delete in Phase 6). **Result:** the historic screen disappears; one club discovery surface, one table.

### Phase 2 — Read across the fleets↔org bridge in the UI. (medium, high payoff)
Today's migration linked the data (`fleets.organization_id`: RHKYC=7, SFYC=2, RSYS=2, Miami=1) but
no screen reads it. Wire: org page lists its fleets (card scaffold exists in
`app/organizations/[slug].tsx`); fleet discovery card links up to its owning org; Library "Groups"
zone surfaces fleets-at-your-claimed-clubs. **Result:** a claimed Dragon org shows its fleets; a
fleet shows its club. The two worlds visibly merge.

### Phase 3 — Web fleet/group discovery. (medium)
Fold fleet discovery into the Library "Groups" zone (web + iOS) instead of the iOS-only
`fleet/select.tsx`, or mount that route on web. **Result:** fixes "nowhere on web do I see the HK
Dragon Fleet."

### Phase 4 — Collapse the `clubs` model. (RE-SCOPED: large data-merge, DEFERRED)
**Original estimate was wrong.** `clubs` is only 8 rows but has its own membership table
`club_members` (10 rows), a dedicated `lib/clubs/clubService.ts`, and **~25 read sites** across the
**login path** (`providers/AuthProvider.tsx` persona/club-membership context) and race machinery
(`RaceRegistrationService`, `CrewFinderService`, `RaceSuggestionService`, `raceDataDistribution`,
`OnboardingAgent`, `apiService`, `members.tsx`, `AddPeoplePicker`, venue sheets). It shares **no
key** with `organizations` (`orgs.club_id` 0/155) and selects club-specific columns + venue/race
linkages `organizations` does not have. So this is a genuine **data-model merge**, not a repoint:
migrate `clubs`→`organizations` and `club_members`→`organization_memberships`, reconcile schemas,
backfill venue/race linkages, then rewrite every reader. It touches auth and race features, so it
must be planned and tested deliberately — **fold into Phase 5 / sailing-namespace-consolidation; do
not force through in a discovery-cleanup pass.**

### Phase 5 — Merge/namespace the race-club + reference tables. (large, sailing-scoped, DEFERRED)
`clubs` (Phase 4), `yacht_clubs` (39, 24 readers), `global_clubs` (46), `sailor_clubs`,
`class_associations` are sailing club-directory + scraping/venue/crew internals, not the canonical
club-identity model. Either (a) merge the genuine club identity into `organizations`
(+ `organization_memberships`) and retire, or (b) rename/relocate the pure race-reference bits under
a clear sailing-internal namespace and sever any "club discovery" labeling. Do as part of the
sailing-namespace-consolidation project; requires data migration + auth/race regression testing.

### Phase 6 — Delete dead tables + orphaned components once readers hit zero.
**Done (orphaned UI from Phase 1):** deleted `ClubSearchContent`, `ClubSearchRow`, `useClubSearch`
(+ barrel exports) — they had zero consumers after Phase 1. **Blocked:** table drops (`global_clubs`,
`clubs`, the Phase-5 set) wait on the Phase 4/5 merge — `global_clubs` still has ~6 readers
(`app/discover/org/[slug].tsx`, `atlas.tsx`, `ClubDiscoveryService`, `apiService`,
`RaceSuggestionService`, `EntityResolutionService`, `useClubIntegrationSnapshots`); `ClubDiscoveryService`
is still used by claim/onboarding/directory surfaces.

## Why this order
Phases 1–3 are the ones the user felt in the screenshots — they remove the 4th world and unify
fleets↔orgs at low/medium risk. Phases 4–6 touch sailing internals and are safe to defer. Each
phase is independently shippable and reduces confusion.
