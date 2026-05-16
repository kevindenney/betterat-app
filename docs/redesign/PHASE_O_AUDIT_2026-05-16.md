# Phase O Existing-User Privacy Audit - 2026-05-16

## Summary

Phase O would affect a much larger cohort than the initial "Bram, Bill, possibly others" framing suggested.

Read-only remote probes found:

- `profiles`: 214 total rows; 214 have `profile_public = true`; 0 have `false`; 0 are null.
- `sailor_profiles`: 83 total rows; 83 have `is_profile_public = true`; 0 have `false`; 0 are null.
- Unique affected users across both tables: 217.
- Distinct organizations represented by affected users: 4.

This triggers the stop-and-surface rule from the Phase O prep prompt: the affected population is materially larger than a small known-user list. Do not draft or execute the migration until Kevin decides whether Phase O should segment users, exclude internal/test accounts, or change the communication plan.

No PII is included in this document. The audit used email only locally to classify probable test/internal vs probable real-user cohorts; no names or emails are recorded here.

## Queries Used

The remote project did not allow the CLI DB login role to read several application tables directly. The audit therefore used service-role PostgREST `select` requests in read-only mode. The logical SQL equivalents are below.

Profile visibility counts:

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE profile_public = true) AS public_true,
  COUNT(*) FILTER (WHERE profile_public = false) AS public_false,
  COUNT(*) FILTER (WHERE profile_public IS NULL) AS public_null
FROM profiles;
```

Sailor profile visibility counts:

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_profile_public = true) AS public_true,
  COUNT(*) FILTER (WHERE is_profile_public = false) AS public_false,
  COUNT(*) FILTER (WHERE is_profile_public IS NULL) AS public_null
FROM sailor_profiles;
```

Affected-user cohort inputs:

```sql
SELECT id, email, created_at, updated_at, profile_public, account_type, primary_interest_id
FROM profiles;

SELECT id, user_id, created_at, updated_at, is_profile_public, home_club, website_url, instagram_handle, bio
FROM sailor_profiles;

SELECT id, email, user_type, onboarding_completed, created_at, updated_at, last_active_at,
       subscription_tier, subscription_status, username
FROM users;

SELECT user_id, organization_id, role, status, membership_status, is_verified,
       verification_source, created_at, updated_at
FROM organization_memberships;
```

The client-side audit script then joined rows by user id and computed aggregate-only cohorts.

## Raw Aggregate Result

```json
{
  "generated_at": "2026-05-16T02:21:53.704Z",
  "profiles": {
    "total": 214,
    "public_true": 214,
    "public_false": 0,
    "public_null": 0
  },
  "sailor_profiles": {
    "total": 83,
    "public_true": 83,
    "public_false": 0,
    "public_null": 0
  },
  "affected_unique_users": 217,
  "overlap": {
    "both_public_profile_and_sailor_profile": 73,
    "profile_only": 141,
    "sailor_only": 3
  },
  "activity_cohorts": {
    "active_90d": 198,
    "active_7d": 12,
    "active_30d": 4,
    "dormant_gt_90d": 3
  },
  "account_class": {
    "probable_real_user": 107,
    "probable_test_or_internal": 107,
    "missing_email": 3
  },
  "user_type": {
    "sailor": 134,
    "unknown": 75,
    "club": 8
  },
  "onboarding_completed": {
    "true": 107,
    "false": 110
  },
  "org_distribution": {
    "affected_users_with_org_membership": 51,
    "affected_users_verified_or_active_org_member": 51,
    "distinct_orgs_represented": 4
  },
  "intentional_public_posture_proxies": {
    "explicit_opt_in_marker_found_in_schema": false,
    "profile_rows_edited_after_create": 99,
    "sailor_rows_with_public_posture_fields_bio_website_or_instagram": 0
  }
}
```

## Cohort Breakdown

Affected unique users:

- 217 users have at least one public visibility field currently set to true.
- 73 users have both `profiles.profile_public = true` and `sailor_profiles.is_profile_public = true`.
- 141 users have only `profiles.profile_public = true`.
- 3 users have only `sailor_profiles.is_profile_public = true`.

Activity:

- 12 affected users had recent activity within 7 days.
- 4 additional affected users had activity within 30 days.
- 198 additional affected users had activity within 90 days.
- 3 affected users appear dormant for more than 90 days.

Account class:

- 107 affected users look like probable real users.
- 107 affected users look like probable test/internal/demo accounts.
- 3 affected users have missing email data in the joined user/profile shape.

Organization/tenant distribution:

- 51 affected users have at least one organization membership row.
- 51 affected users have a verified or active organization membership signal.
- 4 distinct organizations are represented.

## Intentional Public Posture Signals

No explicit opt-in marker was found in the inspected schema. The database stores the current boolean state, but it does not distinguish "true because default" from "true because user intentionally opted in."

Available proxies:

- 99 affected users have profile rows where `updated_at` is materially later than `created_at`. This could mean a user edited profile information, but it does not prove they intentionally selected public visibility.
- 0 affected sailor profiles had obvious public-posture fields populated from the limited probe fields (`bio`, `website_url`, `instagram_handle`).

Conclusion: Phase O cannot safely infer consent from existing data. If existing users are flipped, the communication plan needs to treat this as a platform privacy-policy correction, not as reversing known user choices.

## Recommendation

Stop before drafting Phase O migration SQL.

The migration can still be written later, but Kevin should first decide:

1. Whether Phase O should target all 217 affected users or segment the rollout.
2. Whether probable test/internal accounts should be excluded or handled separately.
3. Whether probable real users and organization-affiliated users need advance direct communication before the flip.
4. Whether users with edited profiles should receive a different message, since edits may indicate they expected profile visibility.

Phase N remains the right pre-demo move: new users become private-by-default without changing this existing-user cohort.
