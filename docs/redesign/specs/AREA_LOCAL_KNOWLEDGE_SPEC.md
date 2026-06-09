# Area Local Knowledge Spec

> How does a fleet share what it knows about Port Shelter? How does
> the public? How does RHKYC? How do Dragon Worlds Performance
> blueprint subscribers share what they know about Nine Pins before
> Worlds and APAC? Today the answer is fragmented or missing. This
> spec unifies all four onto **one primitive** — `venue_discussions`,
> which is already keyed by place — by giving it the audience model
> the rest of the app already uses. Sailing is the first vertical;
> the same mechanics serve nursing students sharing knowledge about a
> clinical site or golfers about a course.

## Motivating example

Kevin's Dragon fleet — 18 boats out of RHKYC — races five primary
areas: Port Shelter, Victoria Harbour, Middle Island, Lamma Island,
and Nine Pins / Causeway Bay. The fleet's collective knowledge about
those areas ("in a NE monsoon the right pays at Nine Pins until the
ebb starts", "Victoria Harbour shipping lane closes the left on
weekdays") lives today in WhatsApp threads and dies there.

Meanwhile Dragon Worlds and the APAC championship will both be
sailed at Nine Pins / Causeway Bay. Subscribers to the *Dragon
Worlds Performance* blueprint — many of whom have never sailed Hong
Kong — need exactly that area knowledge, scoped to people who paid
for / committed to the campaign, and it must outlive either regatta
because the **area** is the durable thing, not the event.

## Core principle

**One knowledge primitive, four read scopes.** Local knowledge is a
`venue_discussions` post pinned to a racing area (or a precise
lat/lng inside it). Who can read it is a generic `(scope_type,
scope_id)` pair — exactly the three-axis group model: a fleet, an
org, and a blueprint cohort are all "groups", so they get one
mechanism, not three features.

| Audience | scope_type | scope_id | Resolved by |
| --- | --- | --- | --- |
| General public | `public` | NULL | everyone, incl. anon (route is already in AuthGate publicSegments) |
| Fleet (Dragon HK) | `fleet` | fleets.id | `fleet_members` |
| Org (RHKYC) | `org` | organizations.id | `organization_memberships` status='active' |
| Blueprint subscribers | `blueprint` | timeline_blueprints.id | `blueprint_subscriptions` |

Adding a future scope (cohort, crew) is a new enum value + one RLS
arm, not a new table.

## What already exists (do not rebuild)

- `venue_discussions` — keyed by `venue_id` + `racing_area_id` +
  optional `location_lat/lng/label`. Post types
  (`tip|question|report|discussion|safety_alert`), category, votes,
  comments, pinning, hot-score ranking, view counts, accepted
  answers. (`20260127120000_community_knowledge_feed.sql`)
- `venue_post_condition_tags` — wind direction/speed ranges, tide
  phase, wave/current, season, time-of-day. **This is the moat**: it
  lets the read surface answer "what applies *right now*?"
- `venue_topic_tags` + join — tactics, currents, safety, marks,
  logistics, weather, rules, gear.
- `venue_member_roles` — moderator / race_officer / coach /
  contributor per venue.
- Routes: `/venue/post/[id]`, `/venue/post/create` (public read).
- `venue_racing_areas` — the five HK areas are seeded geometry;
  Atlas already renders them and the race composer binds to them.
- Vocab: `getVisibilityLabels(slug)` in `lib/vocabulary.ts` —
  sailing → Crew/Fleet, default → Collaborators/Group.

What's missing is only: **audience scoping beyond `is_public`**, and
**read surfaces** (Atlas area callout, group pages, race step).

## Known wrinkles (be honest in implementation)

1. **`is_public` is the only gate today.** RLS is `USING (is_public
   = true)` for read. There is a dormant `fleet_id UUID` column with
   no policy referencing it — fold it into `scope_id` and drop it.
2. **Step "fleet" visibility ≠ fleet roster.** `timeline_steps`
   visibility `fleet` is resolved via blueprint *co-subscription*
   (phase 7 RLS), not `fleet_members`. For venue knowledge we scope
   by **explicit membership** (`fleet_members`) because knowledge is
   addressed *to a group*, whereas step visibility is *about a
   person's activity*. Do not "unify" these; note the asymmetry in
   code comments.
3. **`venue_member_roles` vs org roles.** Venue moderation stays
   venue-scoped (race officers moderate the public layer at their
   venue). Org-scoped posts are moderated by org admins via
   `organization_memberships.role`. Don't merge the two role tables.
4. **RLS style**: wrap `auth.uid()` as `(SELECT auth.uid())`
   (feedback_rls_auth_uid_must_be_wrapped).

## Schema changes (Commit 1)

```sql
ALTER TABLE venue_discussions
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'public'
    CHECK (scope_type IN ('public', 'fleet', 'org', 'blueprint')),
  ADD COLUMN IF NOT EXISTS scope_id UUID;

-- scope_id required iff scoped
ALTER TABLE venue_discussions
  ADD CONSTRAINT venue_discussions_scope_pair
  CHECK ((scope_type = 'public') = (scope_id IS NULL));

-- Backfill: legacy fleet_id rows become fleet-scoped; everything
-- else keeps its current public/private meaning.
UPDATE venue_discussions SET scope_type = 'fleet', scope_id = fleet_id
  WHERE fleet_id IS NOT NULL;
UPDATE venue_discussions SET is_public = false WHERE scope_type <> 'public';

ALTER TABLE venue_discussions DROP COLUMN IF EXISTS fleet_id;

CREATE INDEX IF NOT EXISTS idx_venue_discussions_scope
  ON venue_discussions(scope_type, scope_id) WHERE scope_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_venue_discussions_area_scope
  ON venue_discussions(racing_area_id, scope_type)
  WHERE racing_area_id IS NOT NULL;
```

`is_public` is kept **as a synced legacy column** (`is_public :=
scope_type = 'public'`, enforced by trigger) until all read paths
move to scope columns; then a follow-up migration drops it. Old
clients keep working during the transition.

### RLS rewrite

Replace the single public-read policy with one per scope. Read:

```sql
CREATE POLICY "Scoped knowledge readable by scope members"
  ON venue_discussions FOR SELECT
  USING (
    scope_type = 'public'
    OR ((SELECT auth.uid()) = author_id)
    OR (scope_type = 'fleet' AND EXISTS (
      SELECT 1 FROM fleet_members fm
      WHERE fm.fleet_id = venue_discussions.scope_id
        AND fm.user_id = (SELECT auth.uid())))
    OR (scope_type = 'org' AND EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.organization_id = venue_discussions.scope_id
        AND om.user_id = (SELECT auth.uid())
        AND om.status = 'active'))
    OR (scope_type = 'blueprint' AND EXISTS (
      SELECT 1 FROM blueprint_subscriptions bs
      WHERE bs.blueprint_id = venue_discussions.scope_id
        AND bs.subscriber_id = (SELECT auth.uid())))
  );
```

Insert: author must satisfy the same membership predicate for the
chosen scope (you can't post *into* a fleet you're not in).
Update/delete: author, OR venue moderator (public scope only), OR
org admin (org scope only). **Comments and votes inherit**: their
read/insert policies change from "parent is_public" to "parent
passes the scope predicate" — express it as a `SECURITY DEFINER`
helper `can_read_venue_discussion(p_discussion_id, p_user_id)` so
the predicate lives in exactly one place.

> ⚠️ Audience gates fail **CLOSED**: a NULL/unknown scope_type reads
> as nothing, never as public (lesson from the Nearby location-leak,
> project_nearby_privacy_disconnected).

## Authoring (Commit 3)

`/venue/post/create` gains two controls:

1. **Area picker** — chips of the venue's `venue_racing_areas`
   (Port Shelter · Victoria Harbour · Middle Island · Lamma · Nine
   Pins/CWB) + "whole venue". Pre-filled when launched from an Atlas
   area callout. Optional precise pin on a mini-map (existing
   lat/lng columns).
2. **Audience picker** — same control pattern as the step composer,
   labels via `getVisibilityLabels(interestSlug)`:
   - **Public** (default for tips/safety — knowledge wants to be found)
   - **{Fleet label}: Dragon HK** — user's fleets from `fleet_members`
   - **{Org}: RHKYC** — user's active org memberships
   - **Subscribers: Dragon Worlds Performance** — blueprints the
     user is subscribed to (or owns)

No new composer surface. Entry points: Atlas area callout "Add local
knowledge", venue page existing CTA, and the race-step detail
(below). Per feedback_cta_on_visible_element_not_buried, the Atlas
entry hangs on the area callout itself, not inside a buried sheet.

## Read surfaces

### Atlas area callout (Commit 4)

Tapping a racing-area polygon today selects it. Add a **Local
knowledge** section to the area callout/sheet:

```
Nine Pins / Causeway Bay
├── 12 notes · 4 fleet · 2 subscriber        ← counts I can see
├── ★ "Ebb starts ~2h after HW; right pays"  ← top by hot score
├── ⚡ Matches now (208° · 9 kn, flood): 3   ← condition-tag match
└── [ See all ]  [ Add local knowledge ]
```

"Matches now" filters `venue_post_condition_tags` against the live
conditions Atlas already displays (the wind chip in the top chrome).
This is the aha: the map answers "what do people who know this water
know about *these* conditions". Scope mixing follows the active
chips — Fleet chip on → fleet-scoped notes surface; chips off →
public only.

This lands inside the area callout work, sibling to the queued
pin-popover redesign (project_atlas_pin_popover_redesign) — don't
build a second popover system; if the callout redesign hasn't
started, render the section in the existing bottom sheet.

### Group surfaces (Commit 5)

Fleet and org pages gain a **Local knowledge** section, grouped by
racing area:

```
Dragon HK — Local knowledge
  Port Shelter (6) · Victoria Harbour (4) · Middle Island (2)
  Lamma (1) · Nine Pins/CWB (9)
```

Same rows as Atlas, list-shaped. One query:
`venue_discussions WHERE scope_type='fleet' AND scope_id=$fleet
ORDER BY racing_area_id, hot_score`. Org pages identically with
`scope_type='org'`, which also gives org posts on Atlas an
org-provenance badge — the fix for "Organizations nearby is
low-value" (project_atlas_nearby_orgs_low_value): orgs become
map-useful through *located content they originate*, not HQ pins.

### Race step detail (Commit 5)

A race step (`is_race`, per ORG_ADMIN_CALENDAR_RACE_MODEL_SPEC) that
binds to a racing area gets a **Local knowledge** row linking to
that area's feed, pre-filtered to scopes the viewer holds. So a
Dragon Worlds Performance subscriber opening the Worlds race step at
Nine Pins sees public + subscriber notes for that area — and the
same notes resurface untouched for APAC, because they're keyed to
the **area**, not the event. Per-race chatter (start strategy for
*this* start) stays in `step_discussions`; the row's copy makes the
split legible: "About this area" vs the step's own discussion.

## Worked example — the four audiences

1. **Public**: visiting Etchells sailor taps Nine Pins on Atlas,
   reads 12 public tips, the ebb-timing one is condition-matched to
   today. Posting requires an account.
2. **Dragon HK fleet**: Rita posts "our 2024 trick: stay right of
   the fish farms until the gate" scoped `fleet:dragon-hk`,
   condition-tagged NE 15–20 kn. All 18 boats see it on Atlas (Fleet
   chip) and on the fleet page; nobody else does.
3. **RHKYC**: race officer posts a `safety_alert` ("CWB typhoon
   shelter entrance restricted during Worlds") scoped public with
   org provenance badge, pinned. Org-internal logistics go
   `org:rhkyc`.
4. **Blueprint subscribers**: a coach posts a Nine Pins current
   analysis scoped `blueprint:dragon-worlds-performance`. Every
   Worlds *and* APAC campaigner subscribed to the blueprint gets it;
   it reads as part of what the subscription buys.

## Commit plan

| # | Scope | Verify |
| --- | --- | --- |
| 1 | Migration: scope columns, backfill, RLS rewrite, `can_read_venue_discussion` helper | SQL probes as four test users (member / non-member per scope); fail-closed probe with bogus scope_type |
| 2 | Service + hooks read path (`useVenueKnowledge(areaId)` with scope-aware counts; add to mutation invalidation lists per feedback_query_cache_key_invalidation_audit) | typecheck, hook unit test |
| 3 | Composer: area picker + audience picker | sim: post as each scope, relaunch (not Cmd+R), confirm visibility per account |
| 4 | Atlas area callout section + condition-match | sim by sight (feedback_observed_over_reasoned_ui) |
| 5 | Fleet/org page section + race-step row | sim, both member and non-member accounts |

## Out of scope (explicitly)

- Notifications on scoped posts (inbox folds onto avatar; later).
- AI digest / extraction of knowledge from step reviews.
- Endorsement flow (org "promotes" a fleet tip to public) — design
  sketch only: it's a moderator action that flips scope with an
  attribution line, **not** a copy.
- Per-interest vocab for non-sailing verticals beyond what
  `getVisibilityLabels` already gives (nursing "clinical site
  knowledge" naming pass rides the interest-vernacular campaign).

## Open questions

1. Should `crew` be a launch scope? Steps have it; knowledge
   addressed to ≤5 people is probably just a step note. Deferred
   until someone asks.
2. Demo seed: the five HK areas need a handful of seeded posts per
   scope for the RHKYC demo (`npm run seed:rhkyc` extension) —
   without it every surface ships looking empty
   (cf. project_org_locations_unseeded).
3. Does the existing `/venue/post/[id]` detail route need an access
   denied state? Yes — a shared link to a fleet-scoped post must
   render "members only", not a spinner (cf.
   feedback_settings_screen_infinite_spinner).
