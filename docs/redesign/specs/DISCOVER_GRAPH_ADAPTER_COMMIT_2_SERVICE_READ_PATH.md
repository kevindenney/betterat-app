# Discover Graph Adapter Commit 2 Spec: Service Read Path

## Scope

Add the Supabase service that fetches rows, batches joins, and calls the pure mappers from Commit 1.

## Files

- Add `services/discover/DiscoverGraphService.ts`
- Add `services/discover/__tests__/DiscoverGraphService.test.ts`

## Service Code

Add `services/discover/DiscoverGraphService.ts`:

```ts
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type {
  DiscoverDetailInput,
  DiscoverGraph,
  DiscoverGraphInput,
  DiscoverOrgDetailGraph,
  DiscoverPersonDetailGraph,
  DiscoverTopicDetailGraph,
} from '@/types/discover-graph';
import {
  buildDiscoverGraph,
  selectDiscoverOrgDetail,
  selectDiscoverPersonDetail,
  selectDiscoverTopicDetail,
  type FollowRow,
  type OrgMembershipRow,
  type OrgRow,
  type ProfileRow,
  type TopicActivityRow,
  type TopicMembershipRow,
  type TopicRow,
} from './DiscoverGraphMappers';

const logger = createLogger('DiscoverGraphService');

const DEFAULT_ORG_LIMIT = 24;
const DEFAULT_PEOPLE_LIMIT = 40;
const DEFAULT_TOPIC_LIMIT = 24;
const DEFAULT_EDGE_LIMIT = 300;

export async function fetchDiscoverGraph(input: DiscoverGraphInput = {}): Promise<DiscoverGraph> {
  const authResult = await supabase.auth.getUser();
  const viewerId = input.viewerId ?? authResult.data.user?.id ?? null;
  const interestSlug = normalizeNullable(input.interestSlug);
  const orgLimit = clampLimit(input.orgLimit, DEFAULT_ORG_LIMIT, 60);
  const peopleLimit = clampLimit(input.peopleLimit, DEFAULT_PEOPLE_LIMIT, 80);
  const topicLimit = clampLimit(input.topicLimit, DEFAULT_TOPIC_LIMIT, 60);
  const edgeLimit = clampLimit(input.edgeLimit, DEFAULT_EDGE_LIMIT, 1000);

  try {
    const [orgsResult, topicsResult, followsResult] = await Promise.all([
      fetchOrganizations({ interestSlug, limit: orgLimit }),
      fetchTopics({ limit: topicLimit }),
      viewerId ? fetchFollows(viewerId) : Promise.resolve([]),
    ]);

    const orgIds = orgsResult.map((row) => row.id);
    const topicIds = topicsResult.map((row) => row.id);

    const [orgMemberships, topicMemberships, topicActivity] = await Promise.all([
      orgIds.length ? fetchOrgMemberships(orgIds, edgeLimit) : Promise.resolve([]),
      viewerId && topicIds.length ? fetchTopicMemberships(viewerId, topicIds) : Promise.resolve([]),
      topicIds.length ? fetchTopicActivity(topicIds, edgeLimit) : Promise.resolve([]),
    ]);

    const peopleIds = collectPeopleIds({
      viewerId,
      follows: followsResult,
      orgMemberships,
      topicActivity,
      limit: peopleLimit,
    });

    const profiles = peopleIds.length ? await fetchProfiles(peopleIds) : [];

    return buildDiscoverGraph({
      viewerId,
      interestSlug,
      orgs: orgsResult,
      orgMemberships,
      profiles,
      follows: followsResult,
      topics: topicsResult,
      topicMemberships,
      topicActivity,
    });
  } catch (error) {
    logger.error('Failed to fetch Discover graph', error);
    throw error;
  }
}

export async function fetchDiscoverOrgGraph(input: DiscoverDetailInput): Promise<DiscoverOrgDetailGraph | null> {
  const graph = await fetchDiscoverGraph({ ...input, orgLimit: Math.max(input.orgLimit ?? 0, DEFAULT_ORG_LIMIT) });
  return selectDiscoverOrgDetail(graph, input.id);
}

export async function fetchDiscoverPersonGraph(input: DiscoverDetailInput): Promise<DiscoverPersonDetailGraph | null> {
  const graph = await fetchDiscoverGraph({ ...input, peopleLimit: Math.max(input.peopleLimit ?? 0, DEFAULT_PEOPLE_LIMIT) });
  return selectDiscoverPersonDetail(graph, input.id);
}

export async function fetchDiscoverTopicGraph(input: DiscoverDetailInput): Promise<DiscoverTopicDetailGraph | null> {
  const graph = await fetchDiscoverGraph({ ...input, topicLimit: Math.max(input.topicLimit ?? 0, DEFAULT_TOPIC_LIMIT) });
  return selectDiscoverTopicDetail(graph, input.id);
}

async function fetchOrganizations(input: { interestSlug: string | null; limit: number }): Promise<OrgRow[]> {
  let query = supabase
    .from('organizations')
    .select('id,name,slug,join_mode,interest_slug,is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(input.limit);

  if (input.interestSlug) {
    query = query.eq('interest_slug', input.interestSlug);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OrgRow[];
}

async function fetchOrgMemberships(orgIds: string[], limit: number): Promise<OrgMembershipRow[]> {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('organization_id,user_id,role,status,membership_status,created_at')
    .in('organization_id', orgIds)
    .in('membership_status', ['active', 'pending'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as OrgMembershipRow[];
}

async function fetchProfiles(userIds: string[]): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,avatar_url,profile_public,allow_follower_sharing')
    .in('id', userIds);

  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

async function fetchFollows(viewerId: string): Promise<FollowRow[]> {
  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id,created_at')
    .eq('follower_id', viewerId);

  if (error) throw error;
  return (data ?? []) as FollowRow[];
}

async function fetchTopics(input: { limit: number }): Promise<TopicRow[]> {
  const { data, error } = await supabase
    .from('communities')
    .select('id,name,slug,description,member_count,post_count,last_activity_at,metadata,community_type,category_id,is_official,is_verified')
    .order('last_activity_at', { ascending: false })
    .limit(input.limit);

  if (error) throw error;
  return (data ?? []) as TopicRow[];
}

async function fetchTopicMemberships(viewerId: string, topicIds: string[]): Promise<TopicMembershipRow[]> {
  const { data, error } = await supabase
    .from('community_memberships')
    .select('community_id,user_id,role,joined_at')
    .eq('user_id', viewerId)
    .in('community_id', topicIds);

  if (error) throw error;
  return (data ?? []) as TopicMembershipRow[];
}

async function fetchTopicActivity(topicIds: string[], limit: number): Promise<TopicActivityRow[]> {
  const { data, error } = await supabase
    .from('venue_discussions')
    .select('community_id,author_id,created_at')
    .in('community_id', topicIds)
    .not('author_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as TopicActivityRow[];
}

function collectPeopleIds(input: {
  viewerId: string | null;
  follows: FollowRow[];
  orgMemberships: OrgMembershipRow[];
  topicActivity: TopicActivityRow[];
  limit: number;
}): string[] {
  const ids = new Set<string>();
  if (input.viewerId) ids.add(input.viewerId);
  for (const row of input.follows) ids.add(row.following_id);
  for (const row of input.orgMemberships) ids.add(row.user_id);
  for (const row of input.topicActivity) {
    if (row.author_id) ids.add(row.author_id);
  }
  return Array.from(ids).filter(Boolean).slice(0, input.limit);
}

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  const next = Number(value ?? fallback);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(1, Math.min(Math.round(next), max));
}

function normalizeNullable(value: string | null | undefined): string | null {
  const next = String(value ?? '').trim();
  return next.length > 0 ? next : null;
}
```

## Tests

Add `services/discover/__tests__/DiscoverGraphService.test.ts`:

```ts
import { fetchDiscoverGraph } from '../DiscoverGraphService';
import { supabase } from '@/services/supabase';

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

type QueryResult = { data: any[]; error: null };

function query(result: QueryResult) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    not: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => Promise.resolve(result)),
  };
  return builder;
}

describe('DiscoverGraphService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'viewer-1' } },
      error: null,
    });
  });

  it('fetches the graph with bounded batched queries', async () => {
    const results: Record<string, QueryResult> = {
      organizations: { data: [{ id: 'org-1', name: 'Club', interest_slug: 'sail-racing' }], error: null },
      communities: { data: [{ id: 'topic-1', name: 'Starts', post_count: 2, member_count: 4, metadata: { interest_slug: 'sail-racing' } }], error: null },
      user_follows: { data: [{ following_id: 'person-1' }], error: null },
      organization_memberships: { data: [{ organization_id: 'org-1', user_id: 'person-1', status: 'active', membership_status: 'active' }], error: null },
      community_memberships: { data: [{ community_id: 'topic-1', user_id: 'viewer-1' }], error: null },
      venue_discussions: { data: [{ community_id: 'topic-1', author_id: 'person-1' }], error: null },
      profiles: { data: [{ id: 'person-1', full_name: 'Hugo Wong', profile_public: true }], error: null },
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => query(results[table]));

    const graph = await fetchDiscoverGraph({ interestSlug: 'sail-racing' });

    expect(graph.orgs).toHaveLength(1);
    expect(graph.people[0]?.id).toBe('person-1');
    expect(graph.topics[0]?.id).toBe('topic-1');
    expect(supabase.from).toHaveBeenCalledTimes(7);
  });

  it('does not fetch memberships or activity when list seeds are empty', async () => {
    const results: Record<string, QueryResult> = {
      organizations: { data: [], error: null },
      communities: { data: [], error: null },
      user_follows: { data: [], error: null },
      profiles: { data: [{ id: 'viewer-1', full_name: 'Viewer', profile_public: true }], error: null },
    };

    (supabase.from as jest.Mock).mockImplementation((table: string) => query(results[table]));

    await fetchDiscoverGraph({ viewerId: 'viewer-1' });

    expect(supabase.from).toHaveBeenCalledWith('organizations');
    expect(supabase.from).toHaveBeenCalledWith('communities');
    expect(supabase.from).toHaveBeenCalledWith('user_follows');
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from).not.toHaveBeenCalledWith('organization_memberships');
    expect(supabase.from).not.toHaveBeenCalledWith('venue_discussions');
  });
});
```

## Performance Assertion

`fetchDiscoverGraph` must stay at or below 8 Supabase round trips for a full tab render. The test above asserts the normal populated case uses 7 `from(...)` calls plus auth. No cell-level fetches are allowed.

## Commit Message

```text
feat(discover): add shared Discover graph read path

Add the service read path for the Discover iOS graph adapter.

- fetch organizations, memberships, profiles, follows, communities, community
  memberships, and recent discussion authors through bounded batched queries
- assemble a normalized DiscoverGraph using the pure mappers
- expose detail graph fetchers that reuse the same graph/selectors
- cover populated and empty-seed query behavior with Jest tests

This is the data prerequisite for the Discover iOS render switch.
```
