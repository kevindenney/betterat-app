# Discover People List Build-Only Spec

## Surface

- Component: `components/ios-register/DiscoverPeopleListScreen.tsx`
- Feature flag: `DISCOVER_IOS_REGISTER`
- Preview route: `app/discover-people-ios.tsx`
- Production parent: `DiscoverHomeScreen`

## Prop API

```ts
export interface DiscoverPersonListItem {
  id: string;
  displayName: string;
  handle?: string | null;
  roleLabel?: string | null;
  avatarUrl?: string | null;
  initials: string;
  activityLabel?: string;
  followerContext?: string;
  isFollowing: boolean;
  orgIds?: string[];
  topicIds?: string[];
}

export interface DiscoverPeopleListScreenProps {
  title?: string;
  people: DiscoverPersonListItem[];
  selectedPersonId?: string | null;
  onSelectPerson?: (personId: string) => void;
  onToggleFollow?: (personId: string) => void;
  onBack?: () => void;
}
```

## Preview Data

The preview route mocks 8 people across sailing and nursing contexts, with mixed following state, org links, and forum/topic links.

## Cross-References

- Opens `discover-person-detail-ios` in preview or calls `onSelectPerson`.
- Detail surfaces use `orgIds` and `topicIds` to resolve cross-reference chips through the shared graph.

## Acceptance Criteria

- Presentational only.
- Follow/unfollow state is controlled by props.
- Shows an empty state for no recommended people.
- Uses accessible row buttons with display name and role/context in the label.
