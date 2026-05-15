# Discover Graph Adapter Commit 3 Spec: Hooks And Selectors

## Scope

Expose React Query hooks for the tab shell and detail routes. Leaf visual components still receive props; they do not import these hooks directly.

## Files

- Add `hooks/useDiscoverGraph.ts`
- Add `hooks/__tests__/useDiscoverGraph.contract.test.ts`

## Hook Code

Add `hooks/useDiscoverGraph.ts`:

```ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  DiscoverDetailInput,
  DiscoverGraph,
  DiscoverGraphInput,
} from '@/types/discover-graph';
import {
  fetchDiscoverGraph,
  fetchDiscoverOrgGraph,
  fetchDiscoverPersonGraph,
  fetchDiscoverTopicGraph,
} from '@/services/discover/DiscoverGraphService';
import {
  selectDiscoverOrgDetail,
  selectDiscoverPersonDetail,
  selectDiscoverTopicDetail,
} from '@/services/discover/DiscoverGraphMappers';

const FIVE_MINUTES = 5 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const discoverGraphKeys = {
  all: ['discover-graph'] as const,
  graph: (input: DiscoverGraphInput) => [
    ...discoverGraphKeys.all,
    'graph',
    input.viewerId ?? 'auth',
    input.interestSlug ?? 'all',
    input.orgLimit ?? 'default-orgs',
    input.peopleLimit ?? 'default-people',
    input.topicLimit ?? 'default-topics',
  ] as const,
  org: (input: DiscoverDetailInput) => [...discoverGraphKeys.all, 'org', input.id, input.viewerId ?? 'auth', input.interestSlug ?? 'all'] as const,
  person: (input: DiscoverDetailInput) => [...discoverGraphKeys.all, 'person', input.id, input.viewerId ?? 'auth', input.interestSlug ?? 'all'] as const,
  topic: (input: DiscoverDetailInput) => [...discoverGraphKeys.all, 'topic', input.id, input.viewerId ?? 'auth', input.interestSlug ?? 'all'] as const,
};

export function useDiscoverGraph(input: DiscoverGraphInput = {}) {
  return useQuery({
    queryKey: discoverGraphKeys.graph(input),
    queryFn: () => fetchDiscoverGraph(input),
    staleTime: FIVE_MINUTES,
    gcTime: FIFTEEN_MINUTES,
  });
}

export function useDiscoverOrgGraph(input: DiscoverDetailInput, graph?: DiscoverGraph | null) {
  const selected = useMemo(
    () => (graph ? selectDiscoverOrgDetail(graph, input.id) : null),
    [graph, input.id],
  );

  return useQuery({
    queryKey: discoverGraphKeys.org(input),
    queryFn: () => fetchDiscoverOrgGraph(input),
    enabled: !selected && Boolean(input.id),
    initialData: selected ?? undefined,
    staleTime: FIVE_MINUTES,
    gcTime: FIFTEEN_MINUTES,
  });
}

export function useDiscoverPersonGraph(input: DiscoverDetailInput, graph?: DiscoverGraph | null) {
  const selected = useMemo(
    () => (graph ? selectDiscoverPersonDetail(graph, input.id) : null),
    [graph, input.id],
  );

  return useQuery({
    queryKey: discoverGraphKeys.person(input),
    queryFn: () => fetchDiscoverPersonGraph(input),
    enabled: !selected && Boolean(input.id),
    initialData: selected ?? undefined,
    staleTime: FIVE_MINUTES,
    gcTime: FIFTEEN_MINUTES,
  });
}

export function useDiscoverTopicGraph(input: DiscoverDetailInput, graph?: DiscoverGraph | null) {
  const selected = useMemo(
    () => (graph ? selectDiscoverTopicDetail(graph, input.id) : null),
    [graph, input.id],
  );

  return useQuery({
    queryKey: discoverGraphKeys.topic(input),
    queryFn: () => fetchDiscoverTopicGraph(input),
    enabled: !selected && Boolean(input.id),
    initialData: selected ?? undefined,
    staleTime: FIVE_MINUTES,
    gcTime: FIFTEEN_MINUTES,
  });
}
```

## Consumption Rules

- `DiscoverHomeScreen` calls `useDiscoverGraph` once.
- List surfaces receive `graph.orgs`, `graph.people`, and `graph.topics` as props.
- Detail routes first try selector hooks with a graph passed from parent/navigation context if available.
- Direct detail routes call the detail hook without a graph, which triggers one graph fetch.
- Presentational components never import `useDiscoverGraph`.

## Tests

Add `hooks/__tests__/useDiscoverGraph.contract.test.ts`:

```ts
import { discoverGraphKeys } from '../useDiscoverGraph';

describe('discoverGraphKeys', () => {
  it('keeps graph keys stable for equivalent input', () => {
    expect(discoverGraphKeys.graph({ interestSlug: 'sail-racing' })).toEqual(
      discoverGraphKeys.graph({ interestSlug: 'sail-racing' }),
    );
  });

  it('separates graph cache by viewer and interest', () => {
    expect(discoverGraphKeys.graph({ viewerId: 'u1', interestSlug: 'sail-racing' })).not.toEqual(
      discoverGraphKeys.graph({ viewerId: 'u2', interestSlug: 'sail-racing' }),
    );
    expect(discoverGraphKeys.graph({ viewerId: 'u1', interestSlug: 'sail-racing' })).not.toEqual(
      discoverGraphKeys.graph({ viewerId: 'u1', interestSlug: 'nursing' }),
    );
  });

  it('separates detail keys by entity type', () => {
    const base = { id: 'same-id', viewerId: 'u1', interestSlug: 'sail-racing' };
    expect(discoverGraphKeys.org(base)).not.toEqual(discoverGraphKeys.person(base));
    expect(discoverGraphKeys.person(base)).not.toEqual(discoverGraphKeys.topic(base));
  });
});
```

If hook-render testing infrastructure is available in the repo when Claude Code executes this spec, add one hook test that passes a preloaded graph and asserts the detail hook does not call `fetchDiscoverOrgGraph`. If not, the cache-key contract tests above are sufficient for this commit.

## Performance Assertion

The tab shell must call `useDiscoverGraph` once per mounted Discover tab. Leaf components should have zero React Query calls. Detail routes opened from the tab should use selector initial data and avoid a second network call where navigation context provides the graph.

## Commit Message

```text
feat(discover): expose Discover graph hooks and cache keys

Add the React Query layer for the Discover graph adapter.

- expose useDiscoverGraph for the tab shell
- expose org/person/topic detail hooks that can use selector-derived initial
  data from an existing graph
- keep cache keys scoped by viewer, interest, entity type, and entity id
- document that presentational iOS-register surfaces receive graph-derived
  props and never issue raw Discover queries
- cover cache-key behavior with contract tests

This completes the pre-cutover data adapter for Discover iOS.
```
