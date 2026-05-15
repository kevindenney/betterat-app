# Phase A.8 Spec: Practice Route Alias

## Goal

Make `/practice` the canonical user-facing URL for the Practice tab while preserving the existing `app/(tabs)/races.tsx` implementation and `/races` compatibility path. This is a route-semantics cleanup, not a Practice UI rebuild.

Decision source: `MASTER_IMPLEMENTATION_BACKLOG.md` commit `ec957e55` ratified that `app/(tabs)/races.tsx` may remain the short-term implementation, but `/practice` is the canonical public URL. `/races` is legacy/backwards-compatible because it is wrong for Nursing, Design, Fitness, and other non-sailing interests.

## Verified Current State

- There is no `app/(tabs)/practice.tsx`.
- `app/(tabs)/races.tsx` is the large existing implementation for the first learner timeline tab.
- `lib/navigation-config.ts` centralizes primary learner tab routing in `getEventTabRoute()`, currently returning `/(tabs)/races`.
- `app/(tabs)/_layout.tsx` registers the tab as `<Tabs.Screen name="races" />`, has custom toolbar paths containing `/races`, and uses `/races` in tour routing.
- `lib/navigation/routes.ts` allows `/(tabs)/races` but not `/(tabs)/practice`.
- `lib/utils/lastTab.ts` treats `/races` as a restorable tab path.
- Many call sites hardcode `/(tabs)/races`, including auth, onboarding, Discover, Playbook concept links, Race Log empty actions, notifications, account routing, and tests.

## Files to Change

- `app/(tabs)/practice.tsx` — new route alias file.
- `lib/navigation-config.ts`
- `lib/navigation/routes.ts`
- `lib/utils/lastTab.ts`
- `app/(tabs)/_layout.tsx`
- Tests under `lib/navigation/__tests__/routes.test.ts` and a new or existing route-alias contract test.

## Files to Not Change

- Do not rename `app/(tabs)/races.tsx` in this phase.
- Do not rename `components/races/*` or `hooks/useRace*` imports.
- Do not update every `/(tabs)/races` call site in the repo in this phase. That is too broad and should be gradual after the alias is proven.
- Do not change tab bar labels or icons; Phase A already did Profile, and Practice/Race tab display labels are vocabulary-driven.

## Implementation Plan

### Commit 1: Add Alias Route and Route Types

Create `app/(tabs)/practice.tsx` as a thin wrapper around the existing implementation:

```tsx
export { default } from './races';
```

Add `/(tabs)/practice` to `StaticRoute` in `lib/navigation/routes.ts`, and add route tests proving `navigateTo(router, '/(tabs)/practice')` is valid and static.

Update `lib/utils/lastTab.ts` so both `/practice` and `/races` are valid restorable tab paths. Prefer preserving existing saved `/races` values; do not force-migrate localStorage in this commit.

### Commit 2: Make New Navigation Prefer Practice

Update `getEventTabRoute()` in `lib/navigation-config.ts`:

```ts
return '/(tabs)/practice';
```

Update its comment to say:

- `/practice` is canonical public/product URL.
- `/races` remains legacy compatibility and implementation route.

Update future-facing user navigation call sites that create new product-visible URLs or post-action destinations:

- `components/ios-register/RaceLogScreen.tsx`
- `components/inspiration/InspirationSuccessStep.tsx`
- `components/blueprint/PeerStepSheet.tsx`
- `components/playbook/concepts/ConceptDetail.tsx`
- `components/step/CrossInterestSuggestions.tsx`
- `components/discover/DiscoverScreen.tsx`
- `components/discover/TemplateActionBar.tsx`
- `components/social/NotificationsList.tsx`
- `app/[interest].tsx`

Do not sweep all legacy onboarding/auth redirects in this commit unless tests require it. Auth boot paths can continue to land on `/races` until a later cleanup because the alias exists and route stability matters more than complete string cleanup.

### Commit 3: Layout/Tour Compatibility

In `app/(tabs)/_layout.tsx`, add `/practice` to `ROUTES_WITH_CUSTOM_TOOLBAR`. Keep `/races`.

For tour routing, change future target routes from `/races` to `/practice`, but keep compatibility checks accepting either `/practice` or `/races` so an existing session does not bounce unnecessarily:

```ts
const isPracticePath = pathnameRef.current === '/practice' || pathnameRef.current === '/races';
```

Keep `<Tabs.Screen name="races" />` unchanged unless Expo Router requires a visible `practice` tab entry for the alias. If adding a `<Tabs.Screen name="practice" />` creates duplicate bottom tabs, stop and switch the alias route to a top-level redirect instead.

## Cutover Flag

No feature flag is recommended if `app/(tabs)/practice.tsx` is a pure alias and `/races` remains valid. This qualifies for the mechanical-only exception only if the implementation does not remove `/races`, does not alter tab mounting, and can be reverted by one commit.

If implementation requires changing tab registration or removing `/races`, stop and re-scope with a default-OFF flag.

## Test Plan

Run:

```bash
npm run typecheck
npx jest lib/navigation/__tests__/routes.test.ts --runInBand
rg -n "/\\(tabs\\)/races|'/races'|\\\"/races\\\"" app components hooks lib providers services configs --glob '*.{ts,tsx}'
```

The grep is not expected to be zero after Phase A.8. It should be reviewed to ensure remaining `/races` references are legacy/auth/internal or explicitly deferred.

Manual checks:

- Navigate directly to `/practice` on web/native deep link and confirm the same screen renders as `/races`.
- Navigate directly to `/races` and confirm it still works.
- Switch interest from Nursing/Design and confirm any new links use `/practice`.
- Existing saved last-tab `/races` still restores without crash.

## Acceptance Criteria

- `/practice` is a valid route and renders the existing Practice timeline implementation.
- `/races` still works as a compatibility route.
- New centralized route helpers prefer `/(tabs)/practice`.
- No duplicate bottom tab appears.
- Route tests cover both `/(tabs)/practice` and `/(tabs)/races`.
- Backlog status can mark Phase A.8 as shipped after simulator/browser verification.

## Rollback

Revert the commit(s). Since `/races` remains active throughout, rollback should not strand users or break existing deep links.

## Commit Messages

```text
feat(navigation): add Practice route alias
chore(navigation): prefer Practice route for new timeline links
test(navigation): cover Practice route alias compatibility
```

