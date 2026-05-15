# Discover Person Detail Build-Only Spec

## Surface

- Component: `components/ios-register/DiscoverPersonDetailScreen.tsx`
- Feature flag: `DISCOVER_IOS_REGISTER`
- Preview route: `app/discover-person-detail-ios.tsx`
- Production route: `app/discover/person/[id].tsx`

## Prop API

```ts
export interface DiscoverPersonOrgRef {
  id: string;
  name: string;
  roleLabel?: string | null;
}

export interface DiscoverPersonTopicRef {
  id: string;
  name: string;
  activityLabel?: string;
}

export interface DiscoverPersonDetailScreenProps {
  person: {
    id: string;
    displayName: string;
    handle?: string | null;
    roleLabel?: string | null;
    avatarUrl?: string | null;
    initials: string;
    bio?: string | null;
    activityLabel?: string;
    isFollowing: boolean;
  };
  orgs: DiscoverPersonOrgRef[];
  topics: DiscoverPersonTopicRef[];
  onBack?: () => void;
  onToggleFollow?: (personId: string) => void;
  onSelectOrg?: (orgId: string) => void;
  onSelectTopic?: (topicId: string) => void;
}
```

## Preview Data

Mocks one person, 3 orgs, and 3 topic/forum references.

## Data Dependencies

Production adapter maps `profiles`, `user_follows`, `organization_memberships`, `organizations`, public/follower-visible timeline activity, and community activity into this prop shape.

## Acceptance Criteria

- Presentational only.
- Follow state is controlled by props.
- Cross-reference actions are delegated.
- No assumption that every person has a bio or avatar.
