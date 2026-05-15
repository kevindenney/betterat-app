# Discover Graph Adapter Commit 1 Spec: Types And Mappers

## Scope

Add the shared graph contract and pure mappers. No Supabase calls in this commit.

## Files

- Add `types/discover-graph.ts`
- Add `services/discover/DiscoverGraphMappers.ts`
- Add `services/discover/__tests__/DiscoverGraphMappers.test.ts`

## TypeScript Types

Add `types/discover-graph.ts`:

```ts
export type DiscoverJoinState = 'not_joined' | 'joined' | 'pending' | 'invite_only';

export interface DiscoverGraphInput {
  viewerId?: string | null;
  interestSlug?: string | null;
  orgLimit?: number;
  peopleLimit?: number;
  topicLimit?: number;
  edgeLimit?: number;
}

export interface DiscoverDetailInput extends DiscoverGraphInput {
  id: string;
}

export interface DiscoverOrgSummary {
  id: string;
  name: string;
  slug: string | null;
  subtitle: string;
  memberCount: number;
  activityLabel: string | null;
  joinState: DiscoverJoinState;
  viewerRole: string | null;
  memberSince: string | null;
  accentColor: string | null;
  peopleIds: string[];
  topicIds: string[];
}

export interface DiscoverPersonSummary {
  id: string;
  displayName: string;
  handle: string | null;
  roleLabel: string | null;
  avatarUrl: string | null;
  initials: string;
  activityLabel: string | null;
  followerContext: string | null;
  isFollowing: boolean;
  orgIds: string[];
  topicIds: string[];
}

export interface DiscoverTopicSummary {
  id: string;
  name: string;
  slug: string | null;
  description: string;
  memberCount: number;
  postCount: number;
  lastActivityLabel: string | null;
  isJoined: boolean;
  accentColor: string | null;
  peopleIds: string[];
  orgIds: string[];
}

export interface DiscoverGraph {
  generatedAt: string;
  viewerId: string | null;
  interestSlug: string | null;
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

export interface DiscoverOrgDetailGraph {
  org: DiscoverOrgSummary;
  people: DiscoverPersonSummary[];
  topics: DiscoverTopicSummary[];
}

export interface DiscoverPersonDetailGraph {
  person: DiscoverPersonSummary;
  orgs: DiscoverOrgSummary[];
  topics: DiscoverTopicSummary[];
}

export interface DiscoverTopicDetailGraph {
  topic: DiscoverTopicSummary;
  people: DiscoverPersonSummary[];
  orgs: DiscoverOrgSummary[];
}
```

## Mapper Code

Add `services/discover/DiscoverGraphMappers.ts`:

```ts
import type {
  DiscoverGraph,
  DiscoverJoinState,
  DiscoverOrgDetailGraph,
  DiscoverOrgSummary,
  DiscoverPersonDetailGraph,
  DiscoverPersonSummary,
  DiscoverTopicDetailGraph,
  DiscoverTopicSummary,
} from '@/types/discover-graph';

export type OrgRow = {
  id: string;
  name: string | null;
  slug?: string | null;
  join_mode?: string | null;
  interest_slug?: string | null;
  is_active?: boolean | null;
};

export type OrgMembershipRow = {
  organization_id: string;
  user_id: string;
  role?: string | null;
  status?: string | null;
  membership_status?: string | null;
  created_at?: string | null;
};

export type ProfileRow = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  profile_public?: boolean | null;
  allow_follower_sharing?: boolean | null;
};

export type FollowRow = {
  following_id: string;
  created_at?: string | null;
};

export type TopicRow = {
  id: string;
  name: string | null;
  slug?: string | null;
  description?: string | null;
  member_count?: number | null;
  post_count?: number | null;
  last_activity_at?: string | null;
  metadata?: Record<string, unknown> | null;
  community_type?: string | null;
  is_official?: boolean | null;
  is_verified?: boolean | null;
};

export type TopicMembershipRow = {
  community_id: string;
  user_id: string;
  role?: string | null;
  joined_at?: string | null;
};

export type TopicActivityRow = {
  community_id: string | null;
  author_id: string | null;
  created_at?: string | null;
};

export interface BuildDiscoverGraphInput {
  viewerId: string | null;
  interestSlug: string | null;
  now?: Date;
  orgs: OrgRow[];
  orgMemberships: OrgMembershipRow[];
  profiles: ProfileRow[];
  follows: FollowRow[];
  topics: TopicRow[];
  topicMemberships: TopicMembershipRow[];
  topicActivity: TopicActivityRow[];
}

export function buildDiscoverGraph(input: BuildDiscoverGraphInput): DiscoverGraph {
  const generatedAt = (input.now ?? new Date()).toISOString();
  const followedIds = new Set(input.follows.map((row) => row.following_id).filter(Boolean));
  const profilesById = new Map(input.profiles.map((row) => [row.id, row]));
  const activeMemberships = input.orgMemberships.filter(isActiveMembership);
  const viewerMembershipByOrg = new Map(
    activeMemberships
      .filter((row) => row.user_id === input.viewerId)
      .map((row) => [row.organization_id, row]),
  );

  const orgPeople = groupIds(activeMemberships, 'organization_id', 'user_id');
  const personOrgs = groupIds(activeMemberships, 'user_id', 'organization_id');

  const topicPeople = groupTopicPeople(input.topicActivity);
  const personTopics = invertRecord(topicPeople);

  const orgTopics = deriveOrgTopics(input.orgs, input.topics);
  const topicOrgs = invertRecord(orgTopics);

  const orgs = input.orgs
    .filter((row) => row.id && row.name)
    .map((row): DiscoverOrgSummary => {
      const viewerMembership = viewerMembershipByOrg.get(row.id) ?? null;
      const peopleIds = orgPeople[row.id] ?? [];
      const topicIds = orgTopics[row.id] ?? [];
      return {
        id: row.id,
        name: String(row.name),
        slug: row.slug ?? null,
        subtitle: formatOrgSubtitle(row.interest_slug),
        memberCount: peopleIds.length,
        activityLabel: peopleIds.length > 0 ? `${peopleIds.length} members` : null,
        joinState: resolveOrgJoinState(row.join_mode, viewerMembership),
        viewerRole: viewerMembership?.role ?? null,
        memberSince: viewerMembership?.created_at ?? null,
        accentColor: null,
        peopleIds,
        topicIds,
      };
    })
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name));

  const people = Array.from(profilesById.values())
    .filter((row) => row.id && row.full_name && row.profile_public !== false)
    .map((row): DiscoverPersonSummary => {
      const orgIds = personOrgs[row.id] ?? [];
      const topicIds = personTopics[row.id] ?? [];
      return {
        id: row.id,
        displayName: String(row.full_name),
        handle: null,
        roleLabel: formatPersonRole(orgIds.length, topicIds.length),
        avatarUrl: row.avatar_url ?? null,
        initials: getInitials(String(row.full_name)),
        activityLabel: formatPersonActivity(orgIds.length, topicIds.length),
        followerContext: followedIds.has(row.id) ? 'Following' : null,
        isFollowing: followedIds.has(row.id),
        orgIds,
        topicIds,
      };
    })
    .sort((a, b) => Number(b.isFollowing) - Number(a.isFollowing) || a.displayName.localeCompare(b.displayName));

  const topicMembershipIds = new Set(input.topicMemberships.map((row) => row.community_id));
  const topics = input.topics
    .filter((row) => row.id && row.name)
    .map((row): DiscoverTopicSummary => {
      const peopleIds = topicPeople[row.id] ?? [];
      const orgIds = topicOrgs[row.id] ?? [];
      return {
        id: row.id,
        name: String(row.name),
        slug: row.slug ?? null,
        description: row.description || 'A place to compare notes and keep the practice moving.',
        memberCount: Number(row.member_count ?? 0),
        postCount: Number(row.post_count ?? 0),
        lastActivityLabel: formatLastActivity(row.last_activity_at),
        isJoined: topicMembershipIds.has(row.id),
        accentColor: null,
        peopleIds,
        orgIds,
      };
    })
    .sort((a, b) => b.postCount - a.postCount || b.memberCount - a.memberCount || a.name.localeCompare(b.name));

  return {
    generatedAt,
    viewerId: input.viewerId,
    interestSlug: input.interestSlug,
    orgs,
    people,
    topics,
    orgPeople,
    orgTopics,
    personOrgs,
    personTopics,
    topicPeople,
    topicOrgs,
  };
}

export function selectDiscoverOrgDetail(graph: DiscoverGraph, orgId: string): DiscoverOrgDetailGraph | null {
  const org = graph.orgs.find((item) => item.id === orgId);
  if (!org) return null;
  return {
    org,
    people: org.peopleIds.map((id) => graph.people.find((item) => item.id === id)).filter(Boolean) as DiscoverPersonSummary[],
    topics: org.topicIds.map((id) => graph.topics.find((item) => item.id === id)).filter(Boolean) as DiscoverTopicSummary[],
  };
}

export function selectDiscoverPersonDetail(graph: DiscoverGraph, personId: string): DiscoverPersonDetailGraph | null {
  const person = graph.people.find((item) => item.id === personId);
  if (!person) return null;
  return {
    person,
    orgs: person.orgIds.map((id) => graph.orgs.find((item) => item.id === id)).filter(Boolean) as DiscoverOrgSummary[],
    topics: person.topicIds.map((id) => graph.topics.find((item) => item.id === id)).filter(Boolean) as DiscoverTopicSummary[],
  };
}

export function selectDiscoverTopicDetail(graph: DiscoverGraph, topicId: string): DiscoverTopicDetailGraph | null {
  const topic = graph.topics.find((item) => item.id === topicId);
  if (!topic) return null;
  return {
    topic,
    people: topic.peopleIds.map((id) => graph.people.find((item) => item.id === id)).filter(Boolean) as DiscoverPersonSummary[],
    orgs: topic.orgIds.map((id) => graph.orgs.find((item) => item.id === id)).filter(Boolean) as DiscoverOrgSummary[],
  };
}

function isActiveMembership(row: OrgMembershipRow): boolean {
  const membershipStatus = String(row.membership_status || '').toLowerCase();
  const status = String(row.status || '').toLowerCase();
  return membershipStatus === 'active' || status === 'active';
}

function resolveOrgJoinState(
  joinMode: string | null | undefined,
  viewerMembership: OrgMembershipRow | null,
): DiscoverJoinState {
  if (viewerMembership) return 'joined';
  if (joinMode === 'open_join') return 'not_joined';
  if (joinMode === 'request_to_join') return 'not_joined';
  return 'invite_only';
}

function groupIds<T extends Record<string, unknown>>(rows: T[], keyField: keyof T, valueField: keyof T): Record<string, string[]> {
  const result: Record<string, Set<string>> = {};
  for (const row of rows) {
    const key = typeof row[keyField] === 'string' ? row[keyField] : null;
    const value = typeof row[valueField] === 'string' ? row[valueField] : null;
    if (!key || !value) continue;
    result[key] ??= new Set<string>();
    result[key].add(value);
  }
  return mapSetsToSortedArrays(result);
}

function groupTopicPeople(rows: TopicActivityRow[]): Record<string, string[]> {
  const result: Record<string, Set<string>> = {};
  for (const row of rows) {
    if (!row.community_id || !row.author_id) continue;
    result[row.community_id] ??= new Set<string>();
    result[row.community_id].add(row.author_id);
  }
  return mapSetsToSortedArrays(result);
}

function deriveOrgTopics(orgs: OrgRow[], topics: TopicRow[]): Record<string, string[]> {
  const result: Record<string, Set<string>> = {};
  for (const org of orgs) {
    if (!org.id) continue;
    const orgInterest = String(org.interest_slug || '').toLowerCase();
    result[org.id] ??= new Set<string>();
    for (const topic of topics) {
      const topicInterest = String((topic.metadata as any)?.interest_slug || '').toLowerCase();
      if (orgInterest && topicInterest && orgInterest === topicInterest) {
        result[org.id].add(topic.id);
      }
    }
  }
  return mapSetsToSortedArrays(result);
}

function invertRecord(record: Record<string, string[]>): Record<string, string[]> {
  const result: Record<string, Set<string>> = {};
  for (const [key, values] of Object.entries(record)) {
    for (const value of values) {
      result[value] ??= new Set<string>();
      result[value].add(key);
    }
  }
  return mapSetsToSortedArrays(result);
}

function mapSetsToSortedArrays(record: Record<string, Set<string>>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(record).map(([key, values]) => [key, Array.from(values).sort()]),
  );
}

function getInitials(name: string): string {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatOrgSubtitle(interestSlug: string | null | undefined): string {
  if (!interestSlug) return 'Organization';
  return interestSlug.replace(/-/g, ' ');
}

function formatPersonRole(orgCount: number, topicCount: number): string | null {
  if (orgCount > 0) return `${orgCount} org${orgCount === 1 ? '' : 's'}`;
  if (topicCount > 0) return `${topicCount} forum${topicCount === 1 ? '' : 's'}`;
  return null;
}

function formatPersonActivity(orgCount: number, topicCount: number): string | null {
  const parts = [];
  if (orgCount > 0) parts.push(`${orgCount} org${orgCount === 1 ? '' : 's'}`);
  if (topicCount > 0) parts.push(`${topicCount} active topic${topicCount === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function formatLastActivity(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.max(0, Math.round(diffMs / 86_400_000));
  if (diffDays === 0) return 'Active today';
  if (diffDays === 1) return 'Active yesterday';
  return `Active ${diffDays} days ago`;
}
```

## Tests

Add `services/discover/__tests__/DiscoverGraphMappers.test.ts`:

```ts
import {
  buildDiscoverGraph,
  selectDiscoverOrgDetail,
  selectDiscoverPersonDetail,
  selectDiscoverTopicDetail,
} from '../DiscoverGraphMappers';

describe('DiscoverGraphMappers', () => {
  it('builds org, person, and topic cross-reference maps', () => {
    const graph = buildDiscoverGraph({
      viewerId: 'viewer-1',
      interestSlug: 'sail-racing',
      now: new Date('2026-05-15T00:00:00.000Z'),
      orgs: [{ id: 'org-1', name: 'Royal Hong Kong Yacht Club', slug: 'rhkyc', join_mode: 'open_join', interest_slug: 'sail-racing' }],
      orgMemberships: [
        { organization_id: 'org-1', user_id: 'viewer-1', status: 'active', membership_status: 'active', role: 'member' },
        { organization_id: 'org-1', user_id: 'person-1', status: 'active', membership_status: 'active', role: 'coach' },
      ],
      profiles: [
        { id: 'viewer-1', full_name: 'Felix Wong', profile_public: true },
        { id: 'person-1', full_name: 'Hugo Wong', profile_public: true },
      ],
      follows: [{ following_id: 'person-1' }],
      topics: [{ id: 'topic-1', name: 'Victoria Harbour starts', metadata: { interest_slug: 'sail-racing' }, post_count: 3, member_count: 12 }],
      topicMemberships: [{ community_id: 'topic-1', user_id: 'viewer-1' }],
      topicActivity: [{ community_id: 'topic-1', author_id: 'person-1' }],
    });

    expect(graph.orgPeople['org-1']).toEqual(['person-1', 'viewer-1']);
    expect(graph.orgTopics['org-1']).toEqual(['topic-1']);
    expect(graph.personOrgs['person-1']).toEqual(['org-1']);
    expect(graph.personTopics['person-1']).toEqual(['topic-1']);
    expect(graph.topicPeople['topic-1']).toEqual(['person-1']);
    expect(graph.topicOrgs['topic-1']).toEqual(['org-1']);
  });

  it('excludes private profiles from people summaries', () => {
    const graph = buildDiscoverGraph({
      viewerId: 'viewer-1',
      interestSlug: null,
      orgs: [],
      orgMemberships: [],
      profiles: [{ id: 'person-private', full_name: 'Hidden Person', profile_public: false }],
      follows: [],
      topics: [],
      topicMemberships: [],
      topicActivity: [],
    });

    expect(graph.people).toHaveLength(0);
  });

  it('selects detail graphs from the shared graph without extra data', () => {
    const graph = buildDiscoverGraph({
      viewerId: 'viewer-1',
      interestSlug: 'sail-racing',
      orgs: [{ id: 'org-1', name: 'Club', interest_slug: 'sail-racing' }],
      orgMemberships: [{ organization_id: 'org-1', user_id: 'person-1', status: 'active' }],
      profiles: [{ id: 'person-1', full_name: 'Ada Lee', profile_public: true }],
      follows: [],
      topics: [{ id: 'topic-1', name: 'Starts', metadata: { interest_slug: 'sail-racing' } }],
      topicMemberships: [],
      topicActivity: [{ community_id: 'topic-1', author_id: 'person-1' }],
    });

    expect(selectDiscoverOrgDetail(graph, 'org-1')?.people[0]?.id).toBe('person-1');
    expect(selectDiscoverPersonDetail(graph, 'person-1')?.topics[0]?.id).toBe('topic-1');
    expect(selectDiscoverTopicDetail(graph, 'topic-1')?.orgs[0]?.id).toBe('org-1');
  });
});
```

## Performance Assertion

Pure mapper build time should stay under 10ms for 24 orgs, 40 people, 24 topics, and 300 edges in local Jest. Add a perf test only if the mapper starts doing nested scans over large unbounded arrays.

## Commit Message

```text
feat(discover): add graph adapter types and mappers

Add the shared Discover graph contract used by the iOS-register Discover
surfaces.

- define normalized org/person/topic summary and detail graph types
- map organizations, memberships, profiles, follows, communities, and
  discussion activity into a single cross-reference graph
- add pure selectors for org, person, and topic detail surfaces
- cover cross-reference, privacy, and selector behavior with Jest tests

No Supabase read path is wired in this commit.
```
