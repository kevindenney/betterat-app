# Phase F.1 Spec: JHU Admin Onboarding Card

## Goal

Add the canonical dismissible Org Admin onboarding card to the top of the organization dashboard. This gives newly invited JHU-style admins an immediate orientation path without rebuilding the full admin dashboard. It is a small, flagged visual addition to the existing `/organization/cohort-dashboard` screen.

## Source Canonicals

- Design source: `docs/redesign/FIVE_SURFACES_CONSOLIDATED_ADDENDUM.md`, Surface 4.
- Visual canonical: `docs/redesign/ios-register/jhu-admin-dashboard-canonical.html`.
- The relevant canonical frame labels this as `Welcome to Org Admin`, with `Maybe later`, `Take the tour →`, progress dots, and a dismiss affordance.

## Pre-Execution Reality Check

Before editing, Claude Code must verify:

```bash
test -f app/organization/cohort-dashboard.tsx
test -f components/organizations/OrgAdminHeader.tsx
test -f components/organization/FacultyCohortDashboard.tsx
test -f lib/organizations/adminGate.ts
test -f providers/OrganizationProvider.tsx
rg -n "CohortDashboardScreen|OrgAdminHeader|FacultyCohortDashboard|canView|activeOrganization|resolvedActiveOrgId" app/organization/cohort-dashboard.tsx
rg -n "OrganizationProvider|activeOrganization|memberships|canManageActiveOrganization" providers/OrganizationProvider.tsx
rg -n "JHU_ADMIN_DASHBOARD_IOS|EXPO_PUBLIC_FF_JHU_ADMIN_DASHBOARD_IOS" lib/featureFlags.ts
```

Expected current state: `app/organization/cohort-dashboard.tsx` is the Dashboard tab implementation. It gates access through `resolveActiveOrgId`, `getActiveMembership`, `isActiveMembership`, and `isOrgAdminRole`, renders `OrgAdminHeader`, then either access states, cohort selector, or `FacultyCohortDashboard`. There is no onboarding card currently.

Check the HTML canonical around `Welcome to Org Admin` and `Take the tour →`. The card is top-of-dashboard only and must not appear on Members, Requests, Cohorts, Competencies, Blueprints, Billing, or Settings.

## Commit Boundaries

### Commit 1: Flag and Onboarding Card Component

Files:

- `lib/featureFlags.ts`
- `components/organizations/OrgAdminOnboardingCard.tsx`
- `components/organizations/__tests__/OrgAdminOnboardingCard.test.tsx`

Add:

```ts
JHU_ADMIN_DASHBOARD_IOS: readBooleanEnv('EXPO_PUBLIC_FF_JHU_ADMIN_DASHBOARD_IOS', false),
```

Create a presentational component:

```ts
interface OrgAdminOnboardingCardProps {
  adminName?: string | null;
  organizationName?: string | null;
  onTakeTour: () => void;
  onDismiss: () => void;
}
```

Copy:

- Eyebrow: `Welcome to Org Admin`
- Title: `Welcome${adminName ? \`, ${adminName}\` : ''}. Here’s a quick tour of your dashboard.`
- Body: `Four minutes covers the roster, cohort setup, capability mapping, and how invitations and clinical-site approvals flow.`
- Buttons: `Maybe later`, `Take the tour →`

Use existing React Native primitives and `Ionicons`; no data fetching and no router calls inside the component.

Commit message:

```text
feat(organization): add Org Admin onboarding card
```

### Commit 2: Dismissal State Hook

Files:

- `hooks/useOrgAdminOnboardingCard.ts`
- `hooks/__tests__/useOrgAdminOnboardingCard.test.ts`

Create a small AsyncStorage-backed hook:

```ts
export function useOrgAdminOnboardingCard(organizationId?: string | null): {
  shouldShow: boolean;
  ready: boolean;
  dismiss: () => Promise<void>;
};
```

Storage key:

```ts
betterat.orgAdminOnboarding.dismissed:${organizationId}
```

Behavior:

- `shouldShow=false` until storage is read.
- No organization id means `shouldShow=false`.
- Dismissal is per organization, not global, because admins may belong to multiple orgs.

Commit message:

```text
feat(organization): persist Org Admin onboarding dismissal
```

### Commit 3: Wire Into Dashboard Behind Flag

Files:

- `app/organization/cohort-dashboard.tsx`

Under the successful `canView` branch, render the card above the cohort selector and `FacultyCohortDashboard` when:

- `FEATURE_FLAGS.JHU_ADMIN_DASHBOARD_IOS` is true.
- `useOrgAdminOnboardingCard(resolvedActiveOrgId).shouldShow` is true.
- The dashboard is not in loading/access-denied/empty-cohort state.

`onTakeTour` v1 behavior:

- If an existing feature-tour API for org admin exists, use it.
- If none exists, route to `/organization/members` and dismiss the card only after the user taps `Maybe later` or `x`; do not invent a fake tour. Record `Org Admin guided tour` as follow-up in commit body.

`onDismiss` calls the hook dismissal.

Commit message:

```text
feat(organization): show JHU admin onboarding card behind flag
```

## Files to Not Change

- Do not redesign `FacultyCohortDashboard`.
- Do not add full sidebar/product chrome from the desktop canonical.
- Do not touch invite modal behavior; F.2 owns that.
- Do not add SSO/Shibboleth flows; Phase K owns that.
- Do not hardcode JHU-specific IDs. The feature may be used for JHU but must work for any active org admin.

## Cutover Flag

Required, default OFF: `EXPO_PUBLIC_FF_JHU_ADMIN_DASHBOARD_IOS=false`. This is a new visual surface with persistence, so it does not qualify for the mechanical-only exception.

## Test Approach

Run:

```bash
npm run typecheck
npx jest components/organizations/__tests__/OrgAdminOnboardingCard.test.tsx hooks/__tests__/useOrgAdminOnboardingCard.test.ts --runInBand
rg -n "JHU_ADMIN_DASHBOARD_IOS|EXPO_PUBLIC_FF_JHU_ADMIN_DASHBOARD_IOS|OrgAdminOnboardingCard" lib app components hooks --glob '*.{ts,tsx}'
```

Manual verification:

- Flag off: dashboard unchanged.
- Flag on with admin membership: card appears above dashboard content.
- `Maybe later` and `x` dismiss for that org and survive reload.
- Switching to another org can show the card again.
- Members/Requests/Cohorts/etc. do not show the card.

## Rollback Path

Set `EXPO_PUBLIC_FF_JHU_ADMIN_DASHBOARD_IOS=false` for immediate rollback. Revert commits to remove the card and hook.

## Risks and Open Questions

- The canonical calls for `Take the tour`, but no org-admin tour implementation was verified. V1 should provide a safe route or no-op prompt rather than fake completion.
- This spec intentionally scopes out full JHU dashboard chrome; it is an onboarding-card polish pass, not Phase F.3.
- If admin onboarding should be JHU-only, a tenant-config decision is needed before execution. Default recommendation here is org-admin generic, not hardcoded JHU.
