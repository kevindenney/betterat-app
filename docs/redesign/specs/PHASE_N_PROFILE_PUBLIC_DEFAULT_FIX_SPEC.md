# Phase N — Profile Public Default Fix Spec

## Goal

Fix the production privacy default for `profiles.profile_public`: new users must default to private (`false`), and existing users must be migrated to `profile_public = false` so public profile visibility becomes explicit opt-in.

Phase ID choice: Phase N is the lowest free non-B phase letter after the current backlog uses A, B, C, D, E, F, G, H, I, J, K, L, and M. B-series remains reserved for iOS-register surface work. This phase is priority-high and must ship before the May 20 demo.

Reasoning: BetterAt is pre-launch / early-stage. The cost of making existing users re-enable public profiles is low; the cost of continuing a public-by-default profile behavior is higher and grows with every signup.

## Source

This bug was surfaced while writing `PHASE_B12_PROFILE_SCREEN_SPEC.md` at commit `64f3f6ec`. B.12 found that the new credential Profile must treat public visibility as explicit opt-in, while the current production stack defaults profile visibility to public.

Kevin confirmed this is a bug, not an unresolved product decision.

Verified findings from this spec-writing pass:

- `profiles.profile_public` is created with `DEFAULT true` in `supabase/migrations/20260327050000_add_privacy_settings_to_profiles.sql:10`.
- The discovery RLS policy treats null as public with `COALESCE(profile_public, true) = true` in `supabase/migrations/20260327050001_privacy_rls_policies.sql:18`.
- `services/PrivacySettingsService.ts:31` defaults `profile_public` to `true` when no row/column value is returned.
- `app/onboarding/privacy-quick-set.tsx:44` initializes the onboarding privacy toggle to `true`.
- `app/settings/privacy.tsx:249` exposes the setting to users as a switch.
- Public profile routing exists at `app/person/[userId].tsx`, but this route does not explicitly check `profile_public`; it relies mostly on Supabase/RLS behavior and also queries `users`. Execution must verify this route does not leak profile content when `profiles.profile_public = false`.
- Related legacy privacy field found: `sailor_profiles.is_profile_public BOOLEAN DEFAULT true` in `supabase/migrations/20260130000100_sailor_profile_extensions.sql:127`, consumed by `services/SailorProfileService.ts`. This spec scopes the confirmed production bug to `profiles.profile_public`; execution must verify whether legacy sailor profile public routes still depend on `sailor_profiles.is_profile_public` and stop if the active public profile route uses it.

Production count of existing `profile_public = true` users cannot be determined from repo state. It requires an admin/staging SQL query before running the migration.

## Pre-Execution Reality Check

Before editing, Claude Code must verify:

```bash
rg -n "profile_public|is_profile_public|profile_visibility" supabase/migrations services app hooks components --glob '*.{ts,tsx,sql}'
rg -n "COALESCE\\(profile_public, true\\)|profile_public.*DEFAULT true|profile_public: true|setProfilePublic\\(true\\)" .
rg -n "from\\('profiles'\\).*profile_public|from\\('users'\\).*full_name|/person/|\\[userId\\]" app/person services hooks --glob '*.{ts,tsx}'
```

Specific files to read:

- `supabase/migrations/20260327050000_add_privacy_settings_to_profiles.sql`
- `supabase/migrations/20260327050001_privacy_rls_policies.sql`
- `services/PrivacySettingsService.ts`
- `app/onboarding/privacy-quick-set.tsx`
- `app/settings/privacy.tsx`
- `app/person/[userId].tsx`
- `services/SailorProfileService.ts`
- `supabase/migrations/20260130000100_sailor_profile_extensions.sql`

Admin preflight query required before applying migration to production:

```sql
SELECT
  COUNT(*) FILTER (WHERE profile_public = true) AS public_profiles,
  COUNT(*) FILTER (WHERE profile_public = false) AS private_profiles,
  COUNT(*) FILTER (WHERE profile_public IS NULL) AS null_profiles,
  COUNT(*) AS total_profiles
FROM profiles;
```

If active public routes depend on `sailor_profiles.is_profile_public`, stop and surface whether Phase N should also migrate that legacy field. Do not silently expand the data migration.

## Commit Boundaries

### Commit 1: Database Migration and RLS Default

Message:

```text
fix(privacy): make profiles private by default
```

Files:

- New migration under `supabase/migrations/`.
- Migration test or SQL verification note if the repo has migration test conventions.

Migration requirements:

- Change `profiles.profile_public` database default to `false`.
- Set all existing `profiles.profile_public = true` rows to `false`.
- Treat null as private in RLS policy by replacing `COALESCE(profile_public, true)` with `COALESCE(profile_public, false)`.
- Wrap the data change and policy replacement in a transaction.
- Take a database snapshot before applying in staging/production.

Exact SQL shape, adjusted only for timestamp/filename and existing policy names:

```sql
-- Migration: profile_public default false + migrate existing users
BEGIN;

ALTER TABLE public.profiles
  ALTER COLUMN profile_public SET DEFAULT false;

UPDATE public.profiles
SET profile_public = false
WHERE profile_public = true;

DROP POLICY IF EXISTS "Users can view all profiles for discovery" ON public.profiles;

CREATE POLICY "Users can view all profiles for discovery"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(profile_public, false) = true
    OR EXISTS (
      SELECT 1 FROM public.user_follows
      WHERE follower_id = auth.uid()
        AND following_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships om1
      JOIN public.organization_memberships om2
        ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
        AND om2.user_id = profiles.id
    )
  );

COMMENT ON COLUMN public.profiles.profile_public IS
  'When true the profile is discoverable by anyone. Defaults false; public profile visibility is explicit opt-in.';

COMMIT;
```

Verification SQL after migration:

```sql
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'profile_public';

SELECT COUNT(*) AS still_public
FROM public.profiles
WHERE profile_public = true;
```

Expected result: `column_default` is `false`; `still_public = 0` immediately after migration.

### Commit 2: Service and Onboarding Defaults

Message:

```text
fix(privacy): default profile_public false in app code
```

Files:

- `services/PrivacySettingsService.ts`
- `app/onboarding/privacy-quick-set.tsx`
- Tests for privacy settings defaults if test harness exists.

Required changes:

- Change `DEFAULT_SETTINGS.profile_public` from `true` to `false`.
- Change `useState(true)` for `profilePublic` in onboarding privacy quick-set to `useState(false)`.
- Add a short code comment in `PrivacySettingsService.ts` explaining that public profile visibility is opt-in.
- If any new-user creation path explicitly writes `profile_public: true`, change it to `false`. The current grep did not find such a direct path outside onboarding, but execution must re-check.

Do not change `allow_peer_visibility`, `allow_follower_sharing`, or `default_step_visibility` in this phase.

### Commit 3: Public Route Guard and Documentation

Message:

```text
fix(privacy): guard public profile route for private profiles
```

Files:

- `app/person/[userId].tsx`
- Privacy-related test(s) if available.
- Optional docs comment in `docs/redesign/MASTER_IMPLEMENTATION_BACKLOG.md` or `docs/redesign/IOS_STATUS.md` only if execution has a status-doc requirement.

Required behavior:

- Non-owner viewers must not see full profile details when `profiles.profile_public = false` unless they are allowed by existing follower/org-member RLS semantics.
- Owner viewing their own profile remains allowed.
- If Supabase/RLS returns no `profiles` row for a non-owner because the profile is private, the UI should render a safe private-profile state instead of falling back to `users.full_name` / email and showing a partial public profile.
- Do not expose email on a public/private blocked page.

Implementation guidance:

- Fetch `profile_public` with the profile query.
- For non-owner viewers, if profile is missing because RLS hides it, do not use `users` fallback to build a public profile. Render `This profile is private`.
- If a signed-in follower/org member can read the profile through RLS, the existing profile view can continue.

## Files to Change

- New Supabase migration under `supabase/migrations/`.
- `services/PrivacySettingsService.ts`
- `app/onboarding/privacy-quick-set.tsx`
- `app/person/[userId].tsx`
- Tests adjacent to the touched service/route where available.

## Files to NOT Change

- Do not change B.12 Profile Screen implementation or spec.
- Do not change `allow_peer_visibility`, `allow_follower_sharing`, `default_step_visibility`, or per-interest visibility defaults.
- Do not change endorsement, capability, or public Profile credential routing.
- Do not migrate `sailor_profiles.is_profile_public` unless execution proves it controls an active public profile route and Kevin explicitly expands scope.
- Do not add a feature flag.

## Cutover Flag

None. This is a production privacy fix, not a reversible feature experiment. A flag that can turn a privacy leak back on is the wrong control. The migration commit is the cutover.

## Test Approach

Unit tests:

- `getPrivacySettings()` returns `profile_public: false` when no profile value is available.
- Onboarding privacy quick-set initializes the Public Profile switch to off.

Migration verification:

- Apply migration locally/staging.
- Verify database default is `false`.
- Verify existing `profile_public = true` rows are updated to `false`.
- Verify the discovery RLS policy uses `COALESCE(profile_public, false)`.

Manual route checks:

- Create or identify a test user with `profile_public = false`.
- As the owner, open `/person/<userId>` and verify profile is visible.
- As an unrelated signed-in user, open `/person/<userId>` and verify only a private-profile state appears.
- As a follower/org member, verify existing allowed visibility still works if that is current product behavior.

Production preflight:

- Run the count query from the reality-check section before migration.
- Take a database snapshot before applying migration.
- Record the number of users whose profiles will be made private.

## Rollback

Rollback is non-trivial. You can restore the default to `true`, but you cannot know which users previously had intentional `profile_public = true` versus accidental default-public rows unless a database snapshot or audit table exists.

Required rollback plan:

1. Take a database snapshot before running the migration.
2. If rollback is required, restore affected rows from the snapshot or a purpose-built pre-migration export.
3. Only then consider reverting the migration/code commits.

Do not run this migration in production without a snapshot.

## Risks

- Users who intentionally made profiles public, including Kevin or early collaborators, will become private and need to re-enable public profile manually.
- If the migration half-completes, profile rows and policies can disagree. Wrap the migration in a transaction.
- `app/person/[userId].tsx` currently has a `users` fallback; if not guarded, private users may still leak name/email even after `profiles` RLS hides the profile row.
- Legacy `sailor_profiles.is_profile_public` also defaults true. This is a related privacy smell, but expanding this migration without verifying active route usage risks changing older sailing-specific behavior unexpectedly.
- Search/discovery behavior may change because private profiles will disappear from public discovery. That is intended, but tests and demo accounts may need explicit opt-in.

## Open Product Questions

- Should existing users receive an in-app notification or email saying their profile visibility was changed to private?
- Should demo/admin/test accounts be manually re-enabled as public after migration for demo purposes?
- Should there be a one-click undo/grace period, or is the Settings > Privacy switch enough?
- Should legacy `sailor_profiles.is_profile_public` be folded into the universal `profiles.profile_public` model in a follow-up phase?
