# Phase N — Profile Public Default Fix Spec

## Goal

Fix `profile_public` default to `false` across all five layers for new users only: DB column default, RLS policy null handling, service-layer default, onboarding flow default, and public route guard. Existing users with `profile_public = true` intentionally retain their current setting; existing-user migration is deferred to Phase O after the May 20 demo.

Phase ID choice: Phase N is the lowest free non-B phase letter after the current backlog uses A, B, C, D, E, F, G, H, I, J, K, L, and M. B-series remains reserved for iOS-register surface work. This phase is priority-high and must ship before the May 20 demo.

Reasoning: BetterAt has known existing users (Bram van Olphen, Bill Gladstone, Kevin, and possibly others) who may have built or demoed profiles expecting public visibility. Flipping them silently during demo week creates two avoidable risks: demo references to existing user profiles may unexpectedly hide content, and existing users may discover the change accidentally without prior communication.

Splitting the work preserves the correct demo posture: any new sign-up shown in the May 20 demo is opt-in for public profile visibility, while existing-user migration happens post-demo with communication and verification.

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

Production count of existing `profile_public = true` users cannot be determined from repo state. It is not required for Phase N because existing rows are intentionally untouched. Phase O must run the admin count before migrating existing users.

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

Admin count query required for Phase O, not Phase N:

```sql
SELECT
  COUNT(*) FILTER (WHERE profile_public = true) AS public_profiles,
  COUNT(*) FILTER (WHERE profile_public = false) AS private_profiles,
  COUNT(*) FILTER (WHERE profile_public IS NULL) AS null_profiles,
  COUNT(*) AS total_profiles
FROM profiles;
```

If active public routes depend on `sailor_profiles.is_profile_public`, Phase N still owns the new-user default fix for that parallel field, but execution must stop before changing route behavior if the route has active dependencies that would break unexpectedly.

## Commit Boundaries

### Commit 1: Profiles Column Default and RLS Policy

Message:

```text
fix(privacy): default profiles private for new users
```

Files:

- New migration under `supabase/migrations/`.
- Migration test or SQL verification note if the repo has migration test conventions.

Migration requirements:

- Change `profiles.profile_public` database default to `false`.
- Treat null as private in RLS policy by replacing `COALESCE(profile_public, true)` with `COALESCE(profile_public, false)`.
- Do not update existing rows. Existing users with `profile_public = true` stay public until Phase O.
- Wrap the schema/policy change in a transaction.

Exact SQL shape, adjusted only for timestamp/filename and existing policy names:

```sql
-- Migration: profile_public default false for new users only
BEGIN;

ALTER TABLE public.profiles
  ALTER COLUMN profile_public SET DEFAULT false;

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

Existing rows with `profile_public = true` are intentionally untouched. Phase O will migrate them after the May 20 demo with prior user communication.

Verification SQL after migration:

```sql
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'profile_public';

SELECT COUNT(*) AS existing_public_profiles_unchanged
FROM public.profiles
WHERE profile_public = true;
```

Expected result: `column_default` is `false`. The count of existing public profiles may remain greater than zero; that is expected in Phase N.

### Commit 2: Service-Layer Default

Message:

```text
fix(privacy): default profile_public false in service layer
```

Files:

- `services/PrivacySettingsService.ts`
- Tests for privacy settings defaults if test harness exists.

Required changes:

- Change `DEFAULT_SETTINGS.profile_public` from `true` to `false`.
- Add a short code comment in `PrivacySettingsService.ts` explaining that public profile visibility is opt-in.
- If any new-user creation path explicitly writes `profile_public: true`, change it to `false`. The current grep did not find such a direct path outside onboarding, but execution must re-check.

Do not change `allow_peer_visibility`, `allow_follower_sharing`, or `default_step_visibility` in this phase.

### Commit 3: Onboarding Flow Default

Message:

```text
fix(privacy): default onboarding public profile toggle off
```

Files:

- `app/onboarding/privacy-quick-set.tsx`
- Onboarding test if one exists.

Required changes:

- Change `useState(true)` for `profilePublic` in onboarding privacy quick-set to `useState(false)`.
- Confirm the UI copy makes clear the user can opt in to public visibility.
- Do not change peer visibility or step visibility defaults in this phase.

### Commit 4: Public Route Guard

Message:

```text
fix(privacy): guard public profile route for private profiles
```

Files:

- `app/person/[userId].tsx`
- Privacy-related test(s) if available.

Required behavior:

- Non-owner viewers must not see full profile details when `profiles.profile_public = false` unless they are allowed by existing follower/org-member RLS semantics.
- Owner viewing their own profile remains allowed.
- If Supabase/RLS returns no `profiles` row for a non-owner because the profile is private, the UI should render a safe private-profile state instead of falling back to `users.full_name` / email and showing a partial public profile.
- Do not expose email on a public/private blocked page.

Implementation guidance:

- Fetch `profile_public` with the profile query.
- For non-owner viewers, if profile is missing because RLS hides it, do not use `users` fallback to build a public profile. Render `This profile is private`.
- If a signed-in follower/org member can read the profile through RLS, the existing profile view can continue.

### Commit 5: `sailor_profiles` Parallel Default Fix

Message:

```text
fix(privacy): default sailor profiles private for new users
```

Files:

- New Supabase migration under `supabase/migrations/`.
- `services/SailorProfileService.ts`
- Any route/service tests around sailor profile public visibility if present.

Required changes:

- Change `sailor_profiles.is_profile_public` database default from `true` to `false`.
- Change `SailorProfileService` fallback/default behavior from public to private for missing `is_profile_public`.
- Do not update existing `sailor_profiles` rows. Phase O owns existing-user migration.

Stop condition:

- If execution discovers active `sailor_profiles` public routing or discovery behavior where changing the default to false breaks an expected demo path, stop and surface before committing this piece. The confirmed Phase N requirement is new-user safe defaults, but legacy sailing-specific public behavior may need a separate route guard analysis.

## Files to Change

- New Supabase migration under `supabase/migrations/`.
- `services/PrivacySettingsService.ts`
- `app/onboarding/privacy-quick-set.tsx`
- `app/person/[userId].tsx`
- `services/SailorProfileService.ts`
- Tests adjacent to the touched service/route where available.

## Files to NOT Change

- Do not change B.12 Profile Screen implementation or spec.
- Do not change `allow_peer_visibility`, `allow_follower_sharing`, `default_step_visibility`, or per-interest visibility defaults.
- Do not change endorsement, capability, or public Profile credential routing.
- Do not update existing `profiles` or `sailor_profiles` rows.
- Do not add a feature flag.

## Cutover Flag

None. This is a production privacy fix, not a reversible feature experiment. A flag that can turn a privacy leak back on is the wrong control. The migration commit is the cutover.

## Test Approach

Unit tests:

- `getPrivacySettings()` returns `profile_public: false` when no profile value is available.
- Onboarding privacy quick-set initializes the Public Profile switch to off.
- `SailorProfileService` treats missing `is_profile_public` as false.

Migration verification:

- Apply migration locally/staging.
- Verify database default is `false`.
- Verify existing `profile_public = true` rows are not modified by Phase N.
- Verify the discovery RLS policy uses `COALESCE(profile_public, false)`.
- Verify `sailor_profiles.is_profile_public` default is `false`.

Manual route checks:

- Create or identify a test user with `profile_public = false`.
- As the owner, open `/person/<userId>` and verify profile is visible.
- As an unrelated signed-in user, open `/person/<userId>` and verify only a private-profile state appears.
- As a follower/org member, verify existing allowed visibility still works if that is current product behavior.

Production/staging preflight:

- Run the count query from the reality-check section for awareness, but do not update existing rows.
- Confirm a newly-created profile defaults `profile_public = false`.
- Confirm a newly-created sailor profile defaults `is_profile_public = false` if that row is created in the flow.

## Rollback

Rollback is straightforward because Phase N does not mutate existing user rows.

Required rollback plan:

1. Flip `profiles.profile_public` column default back to `true`.
2. Revert the discovery RLS policy from `COALESCE(profile_public, false)` to `COALESCE(profile_public, true)`.
3. Flip `sailor_profiles.is_profile_public` column default back to `true` if Commit 5 shipped.
4. Revert service and onboarding defaults.

No data restoration is required because existing rows are untouched.

## Risks

- New users signing up between Phase N and Phase O will have the safer private default; existing users may remain public. This mixed state is intentional and acceptable for the short demo-week window.
- If the schema/policy migration half-completes, column defaults and RLS null behavior can disagree. Wrap the migration in a transaction.
- `app/person/[userId].tsx` currently has a `users` fallback; if not guarded, private users may still leak name/email even after `profiles` RLS hides the profile row.
- Legacy `sailor_profiles.is_profile_public` has the same default-public pattern; Phase N applies the parallel default fix, but route behavior must be verified before changing active demo paths.
- Search/discovery behavior for new users may change because their profiles will not appear until they opt in. That is intended.

## Phase O: Existing User Migration (Post-May-20)

Phase O is deferred until after the May 20 demo. It migrates existing users from public-by-default to private-by-default with prior communication.

Phase O requires:

1. Admin SQL query to count affected users.
2. Outreach to known users (Bram van Olphen, Bill Gladstone, Kevin, and any other known public-profile users) explaining the change.
3. Optional in-app notification to all users that public profile visibility changed to opt-in.
4. Migration SQL: `UPDATE profiles SET profile_public = false WHERE profile_public = true;`
5. Same migration for `sailor_profiles.is_profile_public`.
6. Database snapshot before migration runs.
7. Post-migration verification of affected row counts.

No Phase O execution spec exists yet. This section is the placeholder so the existing-user migration does not get lost after Phase N ships.

## Open Product Questions

- Should existing users receive an in-app notification, email, or direct manual outreach before Phase O changes their visibility to private?
- Should demo/admin/test accounts be manually re-enabled as public after migration for demo purposes?
- Should there be a one-click undo/grace period, or is the Settings > Privacy switch enough?
- Should legacy `sailor_profiles.is_profile_public` be folded into the universal `profiles.profile_public` model in Phase O or a later cleanup?
