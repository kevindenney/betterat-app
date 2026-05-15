# Discover Org Detail Build-Only Spec

## Surface

- Component: `components/ios-register/DiscoverOrgDetailScreen.tsx`
- Feature flag: `DISCOVER_IOS_REGISTER`
- Preview route: `app/discover-org-detail-ios.tsx`
- Production route: `app/discover/org/[id].tsx`

## Prop API

```ts
export interface DiscoverOrgDetailPersonRef {
  id: string;
  displayName: string;
  roleLabel?: string | null;
  avatarUrl?: string | null;
  initials: string;
}

export interface DiscoverOrgDetailTopicRef {
  id: string;
  name: string;
  activityLabel?: string;
}

export interface DiscoverOrgDetailScreenProps {
  org: {
    id: string;
    name: string;
    subtitle: string;
    description?: string | null;
    memberCount: number;
    activityLabel?: string;
    joinState: 'not_joined' | 'joined' | 'pending' | 'invite_only';
    accentColor?: string;
  };
  people: DiscoverOrgDetailPersonRef[];
  topics: DiscoverOrgDetailTopicRef[];
  onBack?: () => void;
  onJoinOrg?: (orgId: string) => void;
  onSelectPerson?: (personId: string) => void;
  onSelectTopic?: (topicId: string) => void;
}
```

## Preview Data

Mocks one org, 4 people, and 3 related topics. No live fetch.

## Data Dependencies

Production adapter maps `organizations`, active `organization_memberships`, `profiles`, and community/topic matches into this prop shape.

## Acceptance Criteria

- Presentational only.
- Join action is delegated.
- Cross-reference rows call handlers and do not import detail screens.
- Missing description falls back to concise org metadata rather than blank chrome.
