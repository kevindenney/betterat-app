# Discover iOS Register Cutover Architecture

## Discrepancies

- Prior migration-plan language still says Discover-Orgs, Discover-People, and Discover-Forums design handoffs are outstanding. Current task context says six Discover designs have landed. This document proceeds from the current task context and updates the plan/inventory accordingly.
- Existing inventory has `discover-paths-ios`, but the new Discover set is Orgs / People / Forums list + detail surfaces plus a parent shell. Treat `discover-paths-ios` as a parked predecessor, not the new canonical Discover tab architecture.

## Current State Inventory

Current tab route: `app/(tabs)/discover.tsx`

The Discover tab is a legacy multi-segment surface with four segments:

- `Interests`: `DiscoverInterestsContent`
- `Orgs`: `DiscoverOrgsContent`
- `People`: `DiscoverPeopleContent`
- `Forums`: `DiscussContent`

It already has live-ish data paths:

- Organizations query `organizations` by `interest_slug` and join/request membership through `OrganizationDiscoveryService`.
- People use `useSailorSuggestions`, `useFollowActivityFeed`, and `user_follows` for sailing, with demo data for other interests.
- Forums use `communities`, `community_memberships`, and `venue_discussions` through community hooks/services.

The tab also exposes a toolbar action to `/discover-ios`, which is the older Discover Paths iOS preview. That preview is not the six-surface Discover canonical set covered by this architecture.

## Surface Inventory

The new Discover iOS register cutover has seven inventory entries:

| Surface | Surface ID | Role |
|---|---|---|
| Discover home shell | `discover-home-ios` | Parent shell: title, search, segmented control / section switcher, navigation between list surfaces |
| Discover Orgs list | `discover-orgs-ios` | List of organizations for the current interest |
| Discover People list | `discover-people-ios` | List of people to follow / inspect |
| Discover Forums list | `discover-forums-ios` | List of forums/topics/communities |
| Discover Org detail | `discover-org-detail-ios` | Organization detail, people and topic cross-references |
| Discover Person detail | `discover-person-detail-ios` | Person detail, organizations and topics cross-references |
| Discover Topic detail | `discover-topic-detail-ios` | Forum/topic detail, people and organization cross-references |

Decision: the parent shell is its own surface for inventory and cutover accounting because it owns the segmented Discover IA and the render switch in `app/(tabs)/discover.tsx`. It does not get a separate leaf feature flag.

## Naming Convention (ratified)

Decision: the UI can say `Topic`, while the v1 data model remains `communities`.

The Topic detail surface is backed by `communities` rows in v1. This divergence is intentional and accepted: the user-facing language follows the Discover design, while the implementation uses the existing forums/community schema. If product later wants editorial topics that are distinct from forums/communities, that becomes a separate `discover_topics` data-model project and does not block this cutover.

## Cutover Decomposition

Ship Discover as one atomic tab-level cutover after build-only staging.

Reason: list and detail surfaces cross-link. A per-surface production switch creates unsupported mixed states, e.g. iOS Org list linking into legacy Org detail while iOS Person detail links back into a legacy People list. The tab either owns the new information architecture or it does not.

Commit sequence:

1. Prep docs/specs: this architecture, six build-only specs, inventory/plan updates.
2. Build-only: Discover Orgs list component + preview route.
3. Build-only: Discover People list component + preview route.
4. Build-only: Discover Forums list component + preview route.
5. Build-only: Discover Org detail component + preview route.
6. Build-only: Discover Person detail component + preview route.
7. Build-only: Discover Topic detail component + preview route.
8. Data adapter: shared Discover graph read path that returns orgs, people, topics, and cross-reference maps.
9. Parent shell: `DiscoverHomeScreen` composition component using the six leaf surfaces and shared graph props.
10. Feature flag: add `DISCOVER_IOS_REGISTER`, default ON with `EXPO_PUBLIC_FF_DISCOVER_IOS_REGISTER=false` rollback.
11. Render switch: `app/(tabs)/discover.tsx` gates the full tab behind `DISCOVER_IOS_REGISTER`.
12. Migration-plan update: mark all seven Discover surfaces shipped and capture follow-ups.

## Render-Switch Wiring

Decision (ratified): use one tab-level cutover flag: `DISCOVER_IOS_REGISTER`.

Why not six per-surface flags:

- Per-surface flags improve kill-switch granularity, but Discover's leaf surfaces are not independent in production because they cross-link.
- Existing app already has one mounting tab route (`app/(tabs)/discover.tsx`), so a single flag is the safer rollback seam.
- Preview routes still let each leaf surface be reviewed independently before the atomic cutover.

Flag convention:

```ts
DISCOVER_IOS_REGISTER: readBooleanEnv('EXPO_PUBLIC_FF_DISCOVER_IOS_REGISTER', true)
```

Render switch:

```tsx
if (FEATURE_FLAGS.DISCOVER_IOS_REGISTER) {
  return <DiscoverHomeScreen />;
}

return <LegacyDiscoverTab />;
```

The render-switch commit should preserve the current tab implementation as the flag-off fallback.

Tradeoff accepted: no per-surface kill switch. If any one Discover surface ships broken, the rollback flips the whole Discover tab back to legacy. Mitigation: all six leaf surfaces and the parent shell must be visually verified before flag-on rollout; document that as a precondition in the eventual render-switch commit.

## Routing Scheme

Production routes:

- Tab shell: `app/(tabs)/discover.tsx`
- Org detail: `app/discover/org/[id].tsx`
- Person detail: `app/discover/person/[id].tsx`
- Topic detail: `app/discover/topic/[id].tsx`

Reason: top-level nested `/discover/...` routes avoid converting the existing tab file into a directory route and avoid file/folder conflicts with `app/(tabs)/discover.tsx`. This matches existing top-level detail patterns like `/org/[slug]` and `/person/[userId]` while namespacing the new iOS-register details under Discover.

Preview routes:

- `app/discover-orgs-ios.tsx`
- `app/discover-people-ios.tsx`
- `app/discover-forums-ios.tsx`
- `app/discover-org-detail-ios.tsx`
- `app/discover-person-detail-ios.tsx`
- `app/discover-topic-detail-ios.tsx`

## Data Dependencies

### Organizations

Existing render data:

- `organizations`: `id`, `name`, `slug`, `join_mode`, `interest_slug`
- `organization_memberships`: member counts and viewer membership state
- `timeline_blueprints` / `programs`: existing org detail pages already surface published paths/programs

Gaps:

- Rich org description/avatar/banner are inconsistent; some may live in metadata.
- Activity signals beyond member count are not normalized.

Blocking status: not render-blocking. Orgs list/detail can render with existing org + membership data; richer activity is a follow-up.

### People

Existing render data:

- `profiles`: `id`, `full_name`, `avatar_url`
- `user_follows`: follow graph
- `timeline_steps`: public/follower/org visibility steps
- Existing person detail route `/person/[userId]` already composes memberships, organizations, activities, and published blueprints.

Gaps:

- Role/context copy is derived from organization membership and timeline activity rather than a single profile field.
- Recent activity counts require aggregation.

Blocking status: not render-blocking. People list/detail can render from profiles + follow suggestions + timeline summaries.

### Forums / Topics

Existing render data:

- `communities`: `id`, `name`, `slug`, `description`, `member_count`, `post_count`, `last_activity_at`, category/type fields
- `community_memberships`: joined state
- `venue_discussions`: posts through community feed services

Gaps:

- The design calls this leaf `Topic detail`; the schema's canonical entity is `communities`. For v1, route `/discover/topic/[id]` should load a community/topic record from `communities`.
- Cross-links to orgs/people are indirect today.

Blocking status: not render-blocking for list/detail shell. Rich cross-references are partial until a shared Discover graph view exists.

## Cross-Reference Handling

Decision (ratified): add a shared Discover graph query/adapter before render switch.

The adapter should live in `services/DiscoverGraphService.ts` or `hooks/useDiscoverGraph.ts` and fetch a single graph shape:

```ts
export interface DiscoverGraph {
  orgs: DiscoverOrgSummary[];
  people: DiscoverPersonSummary[];
  topics: DiscoverTopicSummary[];
  orgPeople: Record<string, string[]>;
  orgTopics: Record<string, string[]>;
  personOrgs: Record<string, string[]>;
  personTopics: Record<string, string[]>;
  topicPeople: Record<string, string[]>;
  topicOrgs: Record<string, string[]>;
}
```

Use existing joins where available:

- Org ↔ People: `organization_memberships`.
- People ↔ Orgs: same data reversed.
- Forums/Topics ↔ People: recent `venue_discussions.author_id` grouped by `community_id`.
- Forums/Topics ↔ Orgs: v1 derived from shared `interest_slug` / metadata only; not a hard relationship.

Do not let each detail surface independently fetch the same joins. The tab shell and detail routes should consume the shared graph/query layer.

## Graph Adapter Prerequisites

Work plan: `docs/redesign/DISCOVER_GRAPH_ADAPTER_WORK.md`

The Discover render-switch cutover is blocked until these pre-cutover commits land:

1. `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_1_TYPES_AND_MAPPERS.md` — shared graph types, pure mappers, detail selectors, mapper tests.
2. `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_2_SERVICE_READ_PATH.md` — bounded Supabase read path over orgs, memberships, profiles, follows, communities, community memberships, and discussion authors.
3. `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_3_HOOKS_AND_SELECTORS.md` — React Query hooks, cache keys, selector-first detail hook behavior.

These commits are data-adapter prerequisites, not visual-surface commits. The six leaf surfaces should consume graph-derived props after these land.

## Activity Signal Data

| Signal | Current source | Blocking? |
|---|---|---|
| Org member count | count active `organization_memberships` | No |
| Org recent activity | derived from member timeline steps / org programs; no normalized field | Follow-up |
| People follower/following state | `user_follows` | No |
| People recent activity | `timeline_steps`, activity feed hooks | No for basic, follow-up for richer copy |
| Forum member count | `communities.member_count` | No |
| Forum thread/post count | `communities.post_count` + `venue_discussions` | No |
| Forum last activity | `communities.last_activity_at` | No |
| Cross-surface relevance | shared graph derived from memberships, follows, discussions | Partial, data-adapter commit required before cutover |

## Ship Sequence

1. `docs(redesign): add Discover iOS cutover architecture and build specs`
2. `feat(redesign): stage Discover Orgs iOS list surface`
3. `feat(redesign): stage Discover People iOS list surface`
4. `feat(redesign): stage Discover Forums iOS list surface`
5. `feat(redesign): stage Discover Org detail iOS surface`
6. `feat(redesign): stage Discover Person detail iOS surface`
7. `feat(redesign): stage Discover Topic detail iOS surface`
8. `feat(discover): add shared Discover graph read path`
9. `feat(redesign): compose Discover iOS home shell`
10. `feat(flags): add Discover iOS register flag`
11. `feat(redesign): cut Discover tab over to iOS register`
12. `docs(redesign): mark Discover iOS cutover shipped`

## Escalations

None open after ratification. The naming divergence, atomic flag seam, and graph-adapter prerequisite are resolved architecture decisions.
