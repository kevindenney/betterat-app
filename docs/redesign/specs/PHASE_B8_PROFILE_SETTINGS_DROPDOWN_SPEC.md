# Phase B.8 Spec: Profile / Settings Dropdown

## Goal

Upgrade the top-right avatar menu into the canonical Profile / Settings dropdown. This is the account/settings menu, not the Profile bottom-tab surface. It should expose identity, account preferences, support, and sign-out while preserving the existing guest sign-up behavior and current navigation safety.

Phase A.10 applies indirectly: the first bottom tab’s visible label is interest-specific, while Profile remains the universal fourth tab. This dropdown must not navigate to or redefine Profile-the-credential; it is account/settings chrome.

## Source Canonicals

- Design addendum: `docs/redesign/FOUR_SURFACES_FAST_SPEC_ADDENDUM.md`, Surface B: Profile / Settings Dropdown.
- Visual canonical: `docs/redesign/ios-register/four-small-surfaces-canonical.html`, Frame 2: Profile / settings popover.
- Existing implementation: `components/ui/ProfileDropdown.tsx`.
- Existing mount points: `components/ui/TabScreenToolbar.tsx` and `components/landing/SimpleLandingNav.tsx`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify current repo state:

```bash
sed -n '1,340p' components/ui/ProfileDropdown.tsx
sed -n '230,295p' components/ui/TabScreenToolbar.tsx
sed -n '110,145p' components/landing/SimpleLandingNav.tsx
find app -maxdepth 2 -type f \\( -name '*settings*' -o -name '*subscription*' -o -name '*appearance*' -o -name '*help*' -o -name '*about*' -o -name '*feedback*' -o -name '*notifications*' -o -name '*privacy*' \\) | sort
rg -n "ACCOUNT_MENU_IOS_REGISTER|FF_ACCOUNT_MENU" lib .env* app components
rg -n "<ProfileDropdown|ProfileDropdown\\(" app components -g '*.{ts,tsx}'
```

Verified at spec-write time:

- `ProfileDropdown` is mounted in `TabScreenToolbar` and `SimpleLandingNav`.
- The current authenticated menu rows are `Home`, `Dashboard`, `My Profile`, `Creator Dashboard`, `Settings`, and `Sign Out`.
- Existing routes include `app/account.tsx`, `app/settings.tsx`, `app/settings/notifications.tsx`, `app/settings/privacy.tsx`, `app/notifications.tsx`, and `app/privacy.tsx`.
- No verified routes were found for dedicated Appearance, Help & Support, Send feedback, About BetterAt, or Subscription settings screens.

Stop and surface if:

- `ProfileDropdown` has already been replaced.
- A flag with the same intent already exists under another name.
- The existing `signOut` behavior has changed from `useAuth()`.

## Commit Boundaries

### Commit 1: Flag and Menu Model

Message:

```text
feat(redesign): add account menu model
```

Files:

- `lib/featureFlags.ts`
- New `components/ui/accountMenuModel.ts`
- New `components/ui/__tests__/accountMenuModel.test.ts` or matching test convention.

Add flag:

- `ACCOUNT_MENU_IOS_REGISTER`
- Env override: `EXPO_PUBLIC_FF_ACCOUNT_MENU_IOS_REGISTER`
- Default: `false`

Menu model:

```ts
export type AccountMenuItemKind = 'route' | 'action' | 'disabled';

export interface AccountMenuItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  kind: AccountMenuItemKind;
  route?: string;
  destructive?: boolean;
  accessibilityHint?: string;
}

export interface AccountMenuSection {
  key: string;
  items: AccountMenuItem[];
}
```

Canonical authenticated sections:

- Account/settings: Account, Settings, Appearance, Notifications, Privacy, Subscription.
- Help: Help & Support, Send feedback, About BetterAt.
- Sign out: Sign out.

Route mapping:

- `Account` -> `/account`
- `Settings` -> `/settings`
- `Notifications` -> `/settings/notifications` if present, otherwise `/notifications`
- `Privacy` -> `/settings/privacy` if present, otherwise `/privacy`
- `Subscription` -> `/pricing` unless a verified subscription settings route exists at execution time.
- `Appearance`, `Help & Support`, `Send feedback`, `About BetterAt` -> disabled rows in v1 unless verified routes exist.

### Commit 2: Canonical Authenticated Dropdown

Message:

```text
feat(redesign): render flagged account dropdown
```

Files:

- `components/ui/ProfileDropdown.tsx`
- Optional new `components/ui/AccountMenuPopover.tsx`

Behind `FEATURE_FLAGS.ACCOUNT_MENU_IOS_REGISTER`, render the canonical authenticated menu:

- Identity header: avatar, full name/display name, handle if available, email.
- Section 1: Account, Settings, Appearance, Notifications, Privacy, Subscription.
- Section 2: Help & Support, Send feedback, About BetterAt.
- Section 3: Sign out in destructive styling.

Use existing `userProfile?.full_name`, `userProfile?.display_name`, `user?.email`, and `avatar_url` logic. If there is no handle field in the verified profile type, omit handle rather than inventing one.

Preserve flag-off behavior exactly.

### Commit 3: Mount Safety, Accessibility, and Guest Preservation

Message:

```text
feat(redesign): polish account dropdown interactions
```

Files:

- `components/ui/ProfileDropdown.tsx`
- Tests if the repo has component interaction tests.

Requirements:

- Guest state remains unchanged: unauthenticated users still get the existing create-account/login menu.
- Avatar trigger keeps `accessibilityRole="button"`.
- Authenticated trigger label becomes `Account and settings menu`.
- Rows expose clear accessibility labels and hints.
- Disabled rows are visibly muted and do not navigate.
- Sign out still calls the existing `signOut` from `useAuth`.
- On web/iPad, keep popover-style positioning near the avatar. On phone widths, it may continue to use the existing overlay/dropdown geometry unless implementation already has a native action-sheet primitive.

## Files to Change

- `lib/featureFlags.ts`
- `components/ui/ProfileDropdown.tsx`
- Optional `components/ui/AccountMenuPopover.tsx`
- Optional `components/ui/accountMenuModel.ts`
- Tests for menu model and disabled route behavior.

## Files to NOT Change

- Do not change `components/ios-register/ProfileScreen.tsx`; that is Profile-the-credential.
- Do not change `app/(tabs)/reflect.tsx`; the Profile tab is separate from this account menu.
- Do not create new settings sub-screens in this phase.
- Do not change `providers/AuthProvider.tsx` sign-out semantics.
- Do not change bottom-tab labels or `lib/navigation-config.ts`.

## Cutover Flag

Required. This is a substantive menu replacement and changes account navigation.

- Flag: `ACCOUNT_MENU_IOS_REGISTER`
- Env override: `EXPO_PUBLIC_FF_ACCOUNT_MENU_IOS_REGISTER`
- Default: `false`

## Test Approach

Unit tests:

- Menu model returns the canonical section order.
- Existing routes are mapped correctly.
- Missing routes become disabled items rather than broken links.
- Sign-out item is destructive.

Manual checks:

- Authenticated user taps avatar from the Practice/Race tab toolbar and sees identity header plus canonical rows.
- Tapping Account, Settings, Notifications, Privacy, and Subscription routes to verified destinations.
- Disabled rows do not navigate and are announced as unavailable.
- Sign out still signs out.
- Guest user flow still shows create-account/login actions.
- Landing nav dark variant still renders acceptably.

Run:

```bash
npm run typecheck
npx eslint components/ui/ProfileDropdown.tsx --ext .tsx --max-warnings 0
```

## Rollback Path

Set `EXPO_PUBLIC_FF_ACCOUNT_MENU_IOS_REGISTER=false` to restore the current menu. Revert commits in reverse order if routing or sign-out behavior regresses.

## Risks and Open Questions

- Several canonical rows do not have verified routes. V1 must disable them or map only to verified existing routes; broken navigation is worse than incomplete menu coverage.
- The current component serves both toolbar and landing nav. The new menu must preserve the landing nav dark variant and guest CTA.
- Do not confuse this menu with the Profile bottom tab. The menu is account/settings; the bottom tab is the credential/profile surface.
