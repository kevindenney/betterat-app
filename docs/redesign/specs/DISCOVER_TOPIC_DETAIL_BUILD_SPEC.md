# Discover Topic Detail Build-Only Spec

## Surface

- Component: `components/ios-register/DiscoverTopicDetailScreen.tsx`
- Feature flag: `DISCOVER_IOS_REGISTER`
- Preview route: `app/discover-topic-detail-ios.tsx`
- Production route: `app/discover/topic/[id].tsx`

## Prop API

```ts
export interface DiscoverTopicPersonRef {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  initials: string;
  activityLabel?: string;
}

export interface DiscoverTopicOrgRef {
  id: string;
  name: string;
  activityLabel?: string;
}

export interface DiscoverTopicDetailScreenProps {
  topic: {
    id: string;
    name: string;
    description: string;
    memberCount: number;
    postCount: number;
    lastActivityLabel?: string;
    isJoined: boolean;
    accentColor?: string;
  };
  people: DiscoverTopicPersonRef[];
  orgs: DiscoverTopicOrgRef[];
  onBack?: () => void;
  onToggleJoin?: (topicId: string) => void;
  onSelectPerson?: (personId: string) => void;
  onSelectOrg?: (orgId: string) => void;
}
```

## Preview Data

Mocks one topic/forum, 5 people, and 3 org references.

## Data Dependencies

Production adapter maps `communities` into the user-facing topic model. `venue_discussions` authors provide people references. Org references are v1 best-effort through shared interest/context until a direct org-topic relationship exists.

## Acceptance Criteria

- Presentational only.
- Topic join state is controlled by props.
- The component copy can say Topic or Forum according to the design; the underlying data is `communities`.
- Missing cross-references render a named absence rather than blank space.
