# Supabase Migration Drift Diagnosis - 2026-05-16

## Summary

Phase N execution should stay paused. The remote Supabase migration history and local `supabase/migrations/` directory are out of sync in both directions:

- **31 migrations are applied on remote but missing locally.** These match the timestamps surfaced by `npx supabase db push` and confirmed by Kevin as direct Supabase Studio edits.
- **11 local migrations are not applied on remote.** This is the inverse drift shown by `npx supabase migration list`; it means the remote database is not simply "ahead" of local. It has a different migration lineage.
- **The exact SQL for the 31 remote-only migrations is not available locally.** `rg` found no references to those timestamps elsewhere in the repo, and `supabase migration list` reports timestamps only, not migration bodies.
- **The remote OpenAPI schema still advertises unsafe defaults:** `profiles.profile_public` has `default: true`, and `sailor_profiles.is_profile_public` has `default: true`.
- **Remote RLS policy definitions could not be inspected safely from this environment.** `pg_policies` is not exposed via PostgREST, and `supabase db dump` could not run because Docker is not running.

Phase N's premise is therefore still likely intact for the column defaults, but Phase N should not execute until the migration history is synced and the remote RLS policies are inspected.

## Local Migration Directory State

Command run:

```bash
ls supabase/migrations/ | sort
```

Local migration directory summary:

- 385 valid timestamped `.sql` migration files.
- 14 `.sql.skip` files that Supabase CLI skips because they do not match the `<timestamp>_name.sql` pattern.
- 2 non-timestamp `.sql` files that Supabase CLI skips:
  - `fix_security_advisor_issues.sql`
  - `fix_security_definer_views.sql`

Recent valid local migrations:

```text
20260413140000_user_proposed_interests.sql
20260413150000_blueprint_interest_migration.sql
20260414090000_blueprint_step_actions_author_read.sql
20260414100000_creator_mentoring_adopted_step_update.sql
20260414110000_blueprint_auto_curate.sql
20260415000000_inspiration_source_tracking.sql
20260415100000_add_lac_craft_interest_slug.sql
20260415110000_seed_food_textile_blueprints.sql
20260416000000_step_reviewed_notification_and_sent_suggestions_rls.sql
20260416051945_add_sort_order_to_regattas.sql
20260416120000_fix_blueprint_notification_title_again.sql
20260417120000_create_timeline_step_rpc.sql
20260417130000_timeline_steps_delete_trigger.sql
20260418120000_strip_starts_at_now_default.sql
20260418130000_backfill_timeline_step_titles.sql
20260511110000_fix_club_events_rls_recursion.sql
20260512120000_create_step_recent_activity.sql
20260512130000_mark_step_active_service_role.sql
20260512140000_step_arch_e_backfill_review_sections.sql
20260513090000_document_service_role_only_tables.sql
20260513120000_share_tokens.sql
20260514110000_enable_rls_step_review_backfill_audit.sql
20260514120000_pin_function_search_paths.sql
20260514130000_drop_duplicate_indexes.sql
20260515120000_create_playbook_concept_user_state.sql
```

## Remote-Only Migrations

`npx supabase migration list` confirms these 31 timestamps are applied remotely but absent locally:

```text
20260421120000
20260422110000
20260423120000
20260423130000
20260423140000
20260424170000
20260425120000
20260430120000
20260501120000
20260502120000
20260505120607
20260505125247
20260505131443
20260511030557
20260511081129
20260511092020
20260512032523
20260512043042
20260512043141
20260512110139
20260512122224
20260512122320
20260512140949
20260512141535
20260512141902
20260512221312
20260514032519
20260514033855
20260514033928
20260514114919
20260515053428
```

Context available:

- `rg` found no matching timestamp references in the repo.
- `git log --all --oneline -- supabase/migrations` found no commits containing these migration files.
- `supabase migration list` shows timestamps only; it does not expose the SQL body for those remote-applied migrations.
- Because Kevin confirmed these came from Supabase Studio edits, the local repo cannot currently answer what each individual timestamp changed.

Known limitation: Supabase's migration history can prove that a timestamp was applied, but it does not provide a local SQL file if the change was made outside the repo. To recover actual SQL, use a remote schema dump or Supabase Studio history if available.

## Local-Only Migrations

`npx supabase migration list` also shows these local migrations are missing from remote:

```text
20260410120000
20260511110000
20260512120000
20260512130000
20260512140000
20260513090000
20260513120000
20260514110000
20260514120000
20260514130000
20260515120000
```

This matters because Phase N is not only blocked by remote-only history. A future `db push` may also attempt to apply local migrations that remote has not recorded, including recent Step Architecture and Playbook Concept state migrations.

## Phase N Target Fields - Local State

Local migrations currently define the unsafe defaults Phase N intends to change:

- `supabase/migrations/20260327050000_add_privacy_settings_to_profiles.sql`
  - `profiles.profile_public BOOLEAN DEFAULT true`
  - `allow_peer_visibility BOOLEAN DEFAULT true`
  - `allow_follower_sharing BOOLEAN DEFAULT true`
- `supabase/migrations/20260327050001_privacy_rls_policies.sql`
  - profile SELECT policy uses `COALESCE(profile_public, true) = true`
- `supabase/migrations/20260130000100_sailor_profile_extensions.sql`
  - `sailor_profiles.is_profile_public BOOLEAN DEFAULT true`

Local service/UI defaults also remain unsafe:

- `services/PrivacySettingsService.ts`
  - `DEFAULT_SETTINGS.profile_public: true`
- `app/onboarding/privacy-quick-set.tsx`
  - `useState(true)` for `profilePublic`
- `services/SailorProfileService.ts`
  - `isProfilePublic: sailorProfile?.is_profile_public ?? true`

Local `/person/[userId]` route behavior:

- `app/person/[userId].tsx` fetches `profiles` with `select('id,full_name,avatar_url')`.
- It does not select or explicitly check `profile_public`.
- It falls back to `users` for `full_name` and `email`.
- That matches the Phase N spec's route-guard concern: UI-level leakage can still occur if RLS is misconfigured or if fallback tables expose identity fields.

## Phase N Target Fields - Remote State

Remote column defaults were inspected through the Supabase REST OpenAPI document using the service-role key. This is read-only schema metadata.

Findings:

- `profiles.profile_public`
  - Remote OpenAPI schema includes the column.
  - Remote OpenAPI schema reports `default: true`.
  - Description matches the local migration comment.
- `sailor_profiles.is_profile_public`
  - Remote OpenAPI schema includes the column.
  - Remote OpenAPI schema reports `default: true`.

Remote RLS policy state could not be confirmed from this environment:

- `public.pg_policies` is not exposed through PostgREST.
- `supabase db dump --schema public` failed before producing output because Docker is not running:

```text
failed to inspect docker image: Cannot connect to the Docker daemon at unix:///Users/kdenney/.docker/run/docker.sock.
Docker Desktop is a prerequisite for local development.
```

No direct Postgres password or `DATABASE_URL` was present in the repo environment files. Without Docker running for `supabase db dump`, a Kevin-provided read-only SQL run in Supabase Studio, or direct `psql` credentials, the current RLS definitions cannot be inspected safely here.

Recommended read-only SQL for Kevin or a connected SQL console:

```sql
select
  table_name,
  column_name,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'profiles' and column_name = 'profile_public')
    or (table_name = 'sailor_profiles' and column_name = 'is_profile_public')
  )
order by table_name, column_name;

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'sailor_profiles')
order by tablename, policyname;
```

## Recommended Sync Path

Recommendation: **Path A, with a review gate: run `supabase db pull` after the working tree is clean, then review and commit the generated schema migration before Phase N.**

Reasoning:

- The remote database is the operational truth because the 31 missing migrations are already applied there.
- `migration repair --status applied` would silence the drift but would not bring the schema SQL into local history. That would preserve the audit hole that caused this pause.
- Manual reconstruction from Studio history would be most audit-complete if Studio has a reliable change log, but it is slow and may be impossible to reconstruct exactly.
- A schema pull will at least put the current remote schema into local migration history so future Phase N migration SQL is generated and reviewed against the actual remote baseline.

Important caveat: `supabase db pull` usually captures the current schema diff, not necessarily 31 individual Studio edits as 31 faithful migration files. That is acceptable as an operational sync, but not a perfect historical reconstruction.

Safe sequence:

1. Get the working tree clean or explicitly stash unrelated in-flight source work.
2. Start Docker Desktop, because Supabase CLI schema dump/pull depends on Docker in this environment.
3. Run a read-only inspection first:
   - `supabase db dump --schema public` or the SQL queries above.
4. Review remote `profiles`, `sailor_profiles`, and policies before writing Phase N.
5. Run `supabase db pull` to capture remote schema drift into local migration files.
6. Review generated migration SQL carefully.
7. Commit the sync migration(s) separately from Phase N.
8. Run `supabase migration list` again; it should show no remote-only drift before Phase N starts.
9. Execute Phase N as a separate migration after the baseline sync commit.

Do not use Path B unless the only goal is to unblock the CLI immediately and auditability is explicitly deprioritized. It would make future schema audits less trustworthy because the migration history would say "applied" without local SQL.

## Phase N Safety Assessment

Phase N should **not execute yet**.

What is safe to say now:

- Remote column defaults still appear to be `true` for both `profiles.profile_public` and `sailor_profiles.is_profile_public`.
- Therefore, Phase N's column-default premise is still intact and not already a no-op.
- Local service/onboarding/route-guard findings still match the Phase N spec.

What is not safe to say yet:

- Whether the remote `profiles` SELECT policy still uses `COALESCE(profile_public, true) = true`.
- Whether `sailor_profiles` has an active SELECT policy that also needs a Phase N change.
- Whether one of the 31 Studio migrations added related privacy schema that Phase N should account for.
- Whether the 11 local-only migrations would apply cleanly if `db push` were run after the drift is handled.

Proceeding with Phase N before sync risks writing a migration against a false local baseline. The next safe action is to reconcile remote schema into local migration history, then re-run Phase N's pre-execution checks against that synchronized baseline.

