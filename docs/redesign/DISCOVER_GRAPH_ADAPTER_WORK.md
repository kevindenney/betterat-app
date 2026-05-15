# Discover Graph Adapter Work Plan

## Discrepancies

No ratified decision needs adjustment. Repo state supports the ratified architecture:

- `communities` exists and can back the Topic UI for v1.
- A single atomic `DISCOVER_IOS_REGISTER` flag remains the right cutover seam because the surfaces cross-link.
- No new table is required for the v1 adapter; the gating data work is a shared read/normalization layer over existing tables.

## Decisions

- The adapter is read-only for v1. Join/follow mutations stay in existing services until the Discover visual cutover proves stable.
- Topic UI is backed by `communities`. Type names use `DiscoverTopic*` for UI contracts and map from `communities` rows internally.
- Relationship edges are derived on read, not stored. The adapter computes cross-reference maps from organization memberships, community discussions, user follows, and shared interest context.
- Cache at the React Query hook layer for five minutes. Service functions stay stateless and testable.
- The tab shell fetches one graph per interest/viewer. Detail routes use selectors against that graph first, then can call the same service with a narrower limit if opened directly.

## What The Adapter Is

The Discover graph adapter is a single module that consolidates Discover queries across organizations, people, topics, and the edges between them. Six iOS-register Discover surfaces consume this adapter; no leaf surface should issue raw queries against join tables.

The adapter has three layers:

1. Types and pure mappers: normalize rows into `DiscoverGraph`.
2. Service read path: make bounded Supabase calls and assemble the graph.
3. Hook/selectors: expose React Query APIs to the tab shell and detail routes.

## Why Shared Adapter

See `docs/redesign/DISCOVER_CUTOVER_ARCHITECTURE.md`. The short version: Discover leaf surfaces cross-link heavily. Per-surface queries would duplicate joins, produce inconsistent counts, and make partial renders expensive.

## Public API

Service API:

```ts
export async function fetchDiscoverGraph(input: DiscoverGraphInput): Promise<DiscoverGraph>;
export async function fetchDiscoverOrgGraph(input: DiscoverDetailInput): Promise<DiscoverOrgDetailGraph | null>;
export async function fetchDiscoverPersonGraph(input: DiscoverDetailInput): Promise<DiscoverPersonDetailGraph | null>;
export async function fetchDiscoverTopicGraph(input: DiscoverDetailInput): Promise<DiscoverTopicDetailGraph | null>;
```

Hook API:

```ts
export function useDiscoverGraph(input: DiscoverGraphInput);
export function useDiscoverOrgGraph(input: DiscoverDetailInput);
export function useDiscoverPersonGraph(input: DiscoverDetailInput);
export function useDiscoverTopicGraph(input: DiscoverDetailInput);
```

Selector API:

```ts
export function selectDiscoverOrgDetail(graph: DiscoverGraph, orgId: string): DiscoverOrgDetailGraph | null;
export function selectDiscoverPersonDetail(graph: DiscoverGraph, personId: string): DiscoverPersonDetailGraph | null;
export function selectDiscoverTopicDetail(graph: DiscoverGraph, topicId: string): DiscoverTopicDetailGraph | null;
```

## Internal Queries

`fetchDiscoverGraph` consolidates eight bounded Supabase calls:

1. Current viewer auth: `supabase.auth.getUser()`.
2. Organizations: `organizations(id,name,slug,join_mode,interest_slug,is_active)` filtered by `interest_slug` where available.
3. Organization memberships for listed orgs: `organization_memberships(organization_id,user_id,role,status,membership_status,created_at)`.
4. Profiles for people IDs derived from memberships plus follow edges: `profiles(id,full_name,avatar_url,profile_public,allow_follower_sharing)`.
5. Follows for viewer: `user_follows(following_id,created_at)` where `follower_id=viewerId`.
6. Topics: `communities(id,name,slug,description,member_count,post_count,last_activity_at,metadata,community_type,category_id,is_official,is_verified)` ordered by activity/member count.
7. Topic memberships for viewer: `community_memberships(community_id,user_id,role,joined_at)` for listed topics.
8. Topic activity authors: `venue_discussions(community_id,author_id,created_at)` for listed topics, bounded to recent rows.

Detail fetches call `fetchDiscoverGraph` with a narrower `seed` and higher confidence that the requested entity is included. No surface should fetch membership/profile/discussion joins itself.

## Data Dependencies

| Table/view | Exists today | Adapter usage | New fields? |
|---|---:|---|---:|
| `organizations` | yes | org list/detail base rows | 0 |
| `organization_memberships` | yes | org member counts, person/org edges, member-since labels | 0 |
| `profiles` | yes | people summaries and privacy flags | 0 |
| `user_follows` | yes | following state and people seed edges | 0 |
| `communities` | yes | Topic UI base rows | 0 |
| `community_memberships` | yes | topic joined state | 0 |
| `venue_discussions` | yes | topic activity authors and last activity cross-references | 0 |
| `timeline_steps` | yes | not read by the initial adapter; future richer person activity labels | 0 |

Net-new tables: 0. Extended tables: 0. Added fields: 0.

## Net-New vs Derived Signals

| Signal | Source | Strategy |
|---|---|---|
| Org member count | `organization_memberships` | Derived on read from active rows for listed orgs |
| Viewer org relationship | `organization_memberships` | Derived on read for viewer rows |
| Member-since label | `organization_memberships.created_at` | Derived on read |
| People you may know in org | org memberships + viewer follows | Derived on read |
| Person follow state | `user_follows` | Derived on read |
| Person org memberships | `organization_memberships` | Derived on read |
| Topic base activity | `communities.member_count/post_count/last_activity_at` | Stored existing fields |
| Topic joined state | `community_memberships` | Derived on read |
| Topic people | recent `venue_discussions.author_id` | Derived on read |
| Topic orgs | shared interest context only | Derived best-effort; follow-up for direct org-topic model |

## Performance Constraints

- Full graph render budget: at most 8 Supabase round trips, most in parallel, target p95 under 800ms on warm network.
- List render budget: zero additional network calls per visible cell.
- Detail render budget from tab context: zero additional network calls; use selectors.
- Direct detail route budget: one `fetchDiscoverGraph` call with limits reduced to include the target entity plus related rows.
- Default limits: `orgLimit=24`, `peopleLimit=40`, `topicLimit=24`, `edgeLimit=300`.
- Cache: React Query `staleTime=5 * 60 * 1000`, `gcTime=15 * 60 * 1000`.

Biggest risk: `venue_discussions` can be high-volume. Mitigation: query only `community_id`, `author_id`, `created_at`; filter to listed topic IDs; order recent; limit `edgeLimit`.

## Ship Sequence

1. Commit 1 — types and mappers: `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_1_TYPES_AND_MAPPERS.md`.
2. Commit 2 — service read path: `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_2_SERVICE_READ_PATH.md`.
3. Commit 3 — hooks and selectors: `docs/redesign/specs/DISCOVER_GRAPH_ADAPTER_COMMIT_3_HOOKS_AND_SELECTORS.md`.
4. Future Discover render-switch cutover — build leaf surfaces, compose parent shell, add flag, then wire tab.

## Cutover Bar

The Discover render-switch commit must not land until all three adapter commits are merged and the six visual surfaces can render from `useDiscoverGraph` without issuing raw join-table queries.
