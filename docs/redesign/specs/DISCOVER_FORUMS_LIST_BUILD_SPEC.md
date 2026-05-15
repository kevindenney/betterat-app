# Discover Forums List Build-Only Spec

## Surface

- Component: `components/ios-register/DiscoverForumsListScreen.tsx`
- Feature flag: `DISCOVER_IOS_REGISTER`
- Preview route: `app/discover-forums-ios.tsx`
- Production parent: `DiscoverHomeScreen`

## Prop API

```ts
export interface DiscoverForumListItem {
  id: string;
  name: string;
  slug?: string | null;
  description: string;
  memberCount: number;
  postCount: number;
  lastActivityLabel?: string;
  isJoined: boolean;
  accentColor?: string;
  peopleIds?: string[];
  orgIds?: string[];
}

export interface DiscoverForumsListScreenProps {
  title?: string;
  forums: DiscoverForumListItem[];
  selectedForumId?: string | null;
  onSelectForum?: (forumId: string) => void;
  onToggleJoin?: (forumId: string) => void;
  onBack?: () => void;
}
```

## Preview Data

The preview route mocks 6 forums/topics using community-like data: member count, post count, recent activity, and join state.

## Cross-References

- Opens `discover-topic-detail-ios` in preview or calls `onSelectForum`.
- Uses `peopleIds` and `orgIds` for cross-reference chips.

## Acceptance Criteria

- Presentational only.
- Join state is controlled by props.
- Uses "Forum" or design-provided label in UI, but prop/interface names can use `Forum` for clarity.
- Empty state exists for no forums in current interest.
