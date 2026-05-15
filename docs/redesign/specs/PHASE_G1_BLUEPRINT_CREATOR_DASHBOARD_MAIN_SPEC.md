# Phase G.1 Spec: Blueprint Creator Dashboard Main View

## Goal

Ship the iOS-register Creator Dashboard main view behind a default-off flag. This phase replaces the current compact creator hub at `/creator` with the canonical dashboard shell, Blueprints tab, and Subscribers tab needed to demonstrate the creator workflow. It does not ship the full Blueprint Editor, AI Coach scaffold, Insights tab, Settings tab, or mentoring screens; those remain later phases.

## Source Canonicals

- Design addendum: `docs/redesign/FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md`, Surface 3: Blueprint Creator Dashboard.
- Visual canonical: `docs/redesign/ios-register/blueprint-creator-dashboard-canonical.html`.
- Existing implementation: `app/creator/index.tsx` currently renders Blueprints + Earnings only.
- Existing data layer: `hooks/useBlueprint.ts`, `types/blueprint.ts`, `services/BlueprintService.ts`, `supabase/migrations/20260324130000_blueprint_subscriber_progress.sql`.

## Pre-Execution Reality Check

Before editing, Claude Code must verify current repo state:

- Read `app/creator/index.tsx`; confirm `type Segment = 'blueprints' | 'earnings'` and that the dashboard currently uses `useUserBlueprints()`.
- Read `app/creator/[id].tsx`; confirm the existing detail route already uses `useBlueprintSubscriberProgress(id)` for per-blueprint subscribers.
- Read `types/blueprint.ts`; confirm `BlueprintRecord`, `SubscriberProgress`, and `SubscriberStepProgress` field names before writing adapters.
- Read `hooks/useBlueprint.ts`; confirm `useUserBlueprints()` and `useBlueprintSubscriberProgress(blueprintId)` exist.
- Read `services/BlueprintService.ts`; confirm `getBlueprintSubscriberProgress()` maps the RPC into `SubscriberProgress[]`.
- Run `rg -n "Creator Dashboard|type Segment =|useUserBlueprints|useBlueprintSubscriberProgress|StripeConnectService" app/creator hooks services types`.
- Run `rg -n "BLUEPRINT_CREATOR_DASHBOARD_IOS|FF_BLUEPRINT_CREATOR_DASHBOARD" lib .env* app components`; if a flag already exists, stop and align this spec with the existing name rather than creating a duplicate.
- Inspect `docs/redesign/ios-register/blueprint-creator-dashboard-canonical.html` around “Frame 1 · Blueprints landing” and “Frame 3 · Subscribers”.

Contradictions to stop on:

- If `/creator` is no longer implemented by `app/creator/index.tsx`.
- If the subscriber RPC or hook has been removed or renamed.
- If the canonical has been superseded by a newer creator-dashboard doc.

## Commit Boundaries

### Commit 1: Flag, Types, and Adapters

Message:

```text
feat(redesign): add Creator Dashboard adapter types
```

Files to change:

- `lib/featureFlags.ts`
- New `components/creator-dashboard/types.ts`
- New `components/creator-dashboard/creatorDashboardAdapters.ts`
- New `__tests__/creatorDashboardAdapters.test.ts` or colocated test matching existing test convention.

Add `BLUEPRINT_CREATOR_DASHBOARD_IOS`, backed by `EXPO_PUBLIC_FF_BLUEPRINT_CREATOR_DASHBOARD_IOS`, default `false`.

Adapter types:

```ts
export type CreatorDashboardTab =
  | 'blueprints'
  | 'subscribers'
  | 'insights'
  | 'earnings'
  | 'settings';

export interface CreatorBlueprintCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: 'published' | 'draft';
  accessLabel: string;
  subscriberCount: number;
  updatedLabel: string;
  priceLabel: string;
  sparkline: number[];
}

export interface CreatorSubscriberRow {
  subscriberId: string;
  name: string;
  avatarUrl: string | null;
  blueprintId: string;
  blueprintTitle: string;
  subscribedLabel: string;
  status: 'active' | 'stalled' | 'completed';
  adoptedCount: number;
  completedCount: number;
  dismissedCount: number;
  totalStepCount: number;
}

export interface CreatorDashboardSummary {
  totalBlueprints: number;
  publishedBlueprints: number;
  draftBlueprints: number;
  totalSubscribers: number;
  activeSubscribers: number;
}
```

Adapter functions:

- `mapBlueprintsToCreatorCards(blueprints: BlueprintRecord[]): CreatorBlueprintCard[]`
- `summarizeCreatorBlueprints(blueprints: BlueprintRecord[], subscriberRows?: CreatorSubscriberRow[]): CreatorDashboardSummary`
- `mapSubscriberProgressToRows(input: { blueprint: BlueprintRecord; subscribers: SubscriberProgress[] }): CreatorSubscriberRow[]`

Use deterministic sparkline placeholders derived from `subscriber_count` until 30-day subscriber-history data exists. Do not introduce a new table in this phase.

### Commit 2: Dashboard Shell and Blueprints Tab

Message:

```text
feat(redesign): build flagged Creator Dashboard shell
```

Files to change:

- New `components/creator-dashboard/CreatorDashboardScreen.tsx`
- New `components/creator-dashboard/CreatorDashboardTabs.tsx`
- New `components/creator-dashboard/BlueprintsTab.tsx`
- New `components/creator-dashboard/BlueprintCard.tsx`
- Optional `components/creator-dashboard/index.ts`

Build a presentational shell matching the canonical: strap with creator avatar/initials and “Creator Dashboard”, `+ New Blueprint` action, tab strip with Blueprints, Subscribers, Insights, Earnings, Settings, summary strip, and Blueprint cards.

The `+ New Blueprint` action is wired to the existing creation path only if one is already available in `app/creator/index.tsx`. If there is no existing route or callback, it should be presentational and disabled with accessible hint “AI Coach blueprint creation is coming in Phase G.2.” Do not invent the AI Coach scaffold in this phase.

### Commit 3: Subscribers Tab v1

Message:

```text
feat(redesign): add Creator Dashboard subscribers tab
```

Files to change:

- `components/creator-dashboard/CreatorDashboardScreen.tsx`
- New `components/creator-dashboard/SubscribersTab.tsx`
- New `components/creator-dashboard/SubscriberRow.tsx`
- Optional new `hooks/useCreatorDashboardSubscribers.ts`
- Adapter tests from Commit 1 if more scenarios are needed.

The tab supports All, Active, Stalled, Completed filters. Data comes from existing `useBlueprintSubscriberProgress(blueprintId)` for the selected blueprint. For v1, select the first published blueprint by default, and expose a blueprint picker if more than one blueprint exists. Do not query subscriber progress for every blueprint on initial render; that would create N+1 fan-out.

Status mapping:

- `completed`: `completed_count === totalStepCount` and `totalStepCount > 0`.
- `stalled`: no completed/adopted action in the returned progress set, or last visible action is older than 14 days if the hook exposes a date; if no action date exists, use zero adopted/completed as the v1 proxy.
- `active`: all other rows.

If this status mapping conflicts with actual fields in `SubscriberProgress`, stop and update the adapter plan before implementing.

### Commit 4: Wire `/creator` Behind the Flag

Message:

```text
feat(redesign): gate Creator Dashboard iOS register surface
```

Files to change:

- `app/creator/index.tsx`
- `components/creator-dashboard/index.ts` if created.
- Tests for the flag branch if this repo has route-level tests.

Flag-on renders `CreatorDashboardScreen` with mapped blueprint and subscriber data. Flag-off preserves the existing `CreatorDashboardScreen` implementation in `app/creator/index.tsx` as the legacy path. Keep the existing Earnings implementation available in the flag-on shell, either by mounting the current earnings panel under the Earnings tab or by showing a “Use legacy earnings dashboard” link that toggles/renders the existing content. Do not remove Stripe Connect logic.

## Files to Change

- `lib/featureFlags.ts`
- `app/creator/index.tsx`
- New files under `components/creator-dashboard/`
- Optional `hooks/useCreatorDashboardSubscribers.ts`
- New adapter tests under the repo’s existing test location.

## Files to NOT Change

- Do not change `app/creator/[id].tsx`; full Blueprint Editor is G.2.
- Do not change `app/creator/subscriber/[subscriberId].tsx`; mentoring screens are Phase J.
- Do not change `components/blueprint/PublishBlueprintSheet.tsx`.
- Do not change Stripe service behavior in `services/StripeConnectService.ts`.
- Do not add Supabase migrations in G.1.
- Do not rename `/creator`; route stability matters.

## Cutover Flag

Required. This is a substantive mount and UI replacement, not a mechanical label change.

- Flag: `BLUEPRINT_CREATOR_DASHBOARD_IOS`
- Env override: `EXPO_PUBLIC_FF_BLUEPRINT_CREATOR_DASHBOARD_IOS`
- Default: `false`

## Test Approach

- Unit-test adapters for published/draft cards, free/paid/org pricing labels, empty blueprint arrays, and subscriber status classification.
- Typecheck after every commit.
- Visual verification at `/creator` with flag off and flag on.
- With flag on, verify the Blueprints tab renders existing user blueprints and the Subscribers tab does not fetch progress for every blueprint at once.
- With flag off, verify the legacy dashboard still renders Blueprints and Earnings.

## Rollback Path

Set `EXPO_PUBLIC_FF_BLUEPRINT_CREATOR_DASHBOARD_IOS=false` to return to the legacy dashboard. If the surface causes build problems, revert Commit 4 first; Commit 1-3 are inert until wired.

## Risks and Open Questions

- The canonical is desktop-dashboard shaped, while the current implementation is React Native. G.1 should preserve the canonical hierarchy and content, but responsive layout may require compromise on narrow screens.
- The canonical sparkline requires 30-day subscriber history. That data does not exist in the verified types; v1 uses deterministic placeholders and documents real history as a follow-up.
- The canonical `+ New Blueprint` opens an AI Coach scaffold, but that flow is explicitly separate. Do not build it in G.1.
- Earnings is already live in the current dashboard. Flag-on must not strand creators who rely on Stripe Connect controls.
