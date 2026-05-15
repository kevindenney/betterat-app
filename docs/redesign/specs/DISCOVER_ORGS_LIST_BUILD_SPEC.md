# Discover Orgs List Build-Only Spec

## Surface

- Component: `components/ios-register/DiscoverOrgsListScreen.tsx`
- Feature flag: `DISCOVER_IOS_REGISTER`
- Preview route: `app/discover-orgs-ios.tsx`
- Production parent: `DiscoverHomeScreen` inside the Discover tab cutover

## Prop API

```ts
export interface DiscoverOrgListItem {
  id: string;
  name: string;
  slug?: string | null;
  subtitle: string;
  memberCount: number;
  activityLabel?: string;
  joinState: 'not_joined' | 'joined' | 'pending' | 'invite_only';
  accentColor?: string;
  topicIds?: string[];
  peopleIds?: string[];
}

export interface DiscoverOrgsListScreenProps {
  title?: string;
  orgs: DiscoverOrgListItem[];
  selectedOrgId?: string | null;
  onSelectOrg?: (orgId: string) => void;
  onJoinOrg?: (orgId: string) => void;
  onBack?: () => void;
}
```

## Preview Data

The preview route mocks 6 orgs with mixed join states, member counts, topic IDs, and people IDs. Do not fetch live data in the build-only commit.

## Cross-References

- Opens `discover-org-detail-ios` in preview or calls `onSelectOrg` in production.
- Uses `peopleIds` and `topicIds` only as props; no child surface import.

## Acceptance Criteria

- Presentational only: no Supabase, router, React Query, or auth imports in the component.
- Preview route is flat under `app/`.
- Uses iOS-register tokens and grouped-card/list chrome.
- Empty state exists for no orgs in current interest.
- Join state is visible but action is delegated through `onJoinOrg`.
