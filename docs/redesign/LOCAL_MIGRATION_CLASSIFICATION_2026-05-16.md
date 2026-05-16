# Local Migration Classification - 2026-05-16

## Summary

This classifies the 11 migrations that are present in local `supabase/migrations/` but absent from remote migration history as of `npx supabase migration list` on 2026-05-16.

Classification source of truth:

- Local migration SQL files under `supabase/migrations/`.
- Remote schema dump committed at `docs/redesign/REMOTE_SCHEMA_DUMP_2026-05-16.sql` (`8251c220`).

No migration repair, database pull, database push, or SQL execution was run for this classification.

## Summary Table

| Timestamp | Filename | Verdict | One-line Description |
|---|---|---:|---|
| `20260410120000` | `20260410120000_seed_jhu_degree_programs_and_templates.sql` | `AMBIGUOUS` | Data seed for JHU nursing programs, sessions, templates, and baseline concepts; schema-only dump cannot prove row presence. |
| `20260511110000` | `20260511110000_fix_club_events_rls_recursion.sql` | `APPLIED-EQUIVALENT` | RLS recursion helper functions and replacement policies are present remotely. |
| `20260512120000` | `20260512120000_create_step_recent_activity.sql` | `APPLIED-EQUIVALENT` | `step_recent_activity` table, index, RLS, policy, and evolved `mark_step_active` path are present remotely. |
| `20260512130000` | `20260512130000_mark_step_active_service_role.sql` | `APPLIED-EQUIVALENT` | Final 3-argument `mark_step_active` service-role-compatible function is present remotely. |
| `20260512140000` | `20260512140000_step_arch_e_backfill_review_sections.sql` | `AMBIGUOUS` | Schema artifacts are present, but the migration also performs a data backfill that cannot be verified from a schema-only dump. |
| `20260513090000` | `20260513090000_document_service_role_only_tables.sql` | `APPLIED-EQUIVALENT` | `platform_transfers` service-role-only table comment is present remotely. |
| `20260513120000` | `20260513120000_share_tokens.sql` | `APPLIED-EQUIVALENT` | `share_tokens` table, indexes, RLS policies, and resolver functions are present remotely. |
| `20260514110000` | `20260514110000_enable_rls_step_review_backfill_audit.sql` | `APPLIED-EQUIVALENT` | `step_review_backfill_audit` RLS and service-role-only comment are present remotely. |
| `20260514120000` | `20260514120000_pin_function_search_paths.sql` | `APPLIED-EQUIVALENT` | All 33 functions named by the migration have `SET "search_path" TO 'pg_catalog', 'public'` in the remote dump. |
| `20260514130000` | `20260514130000_drop_duplicate_indexes.sql` | `APPLIED-EQUIVALENT` | Redundant indexes are absent and the kept canonical indexes/constraint are present remotely. |
| `20260515120000` | `20260515120000_create_playbook_concept_user_state.sql` | `APPLIED-EQUIVALENT` | `playbook_concept_user_state` table, indexes, RLS policies, trigger, and grants are present remotely. |

Bucket counts:

- `APPLIED-EQUIVALENT`: 9
- `NOT-APPLIED`: 0
- `AMBIGUOUS`: 2

## `20260410120000` - `seed_jhu_degree_programs_and_templates.sql`

Verdict: `AMBIGUOUS`

Intended effect: idempotently seed JHU School of Nursing degree programs, program sessions, timeline step templates, and baseline nursing `playbook_concepts` rows for demo/program content.

Evidence checked:

- Remote schema has the target tables:
  - `playbook_concepts` at remote dump line 14888.
  - `program_sessions` at remote dump line 15471.
  - `programs` at remote dump line 15537.
  - `timeline_step_templates` at remote dump line 19735.
- The committed remote dump is schema-only. It does not contain row data, so it cannot prove whether rows like `MSN Entry into Nursing`, `DNP — Family NP`, `Healthcare Organizational Leadership MSN`, or `management-of-care` were inserted.

Recommendation: human review. Do not mark this as applied-equivalent from the schema dump alone. If Kevin wants to avoid applying it, verify the seed rows via read-only SQL first. If those rows are absent, keep the migration pending.

## `20260511110000` - `fix_club_events_rls_recursion.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: replace recursive `club_events` / `event_registrations` RLS subqueries with `SECURITY DEFINER` helper functions.

Evidence checked:

- `_user_is_club_admin_for_event(uuid)` exists at remote dump lines 256-275.
- `_user_is_registered_for_event(uuid)` exists at remote dump lines 279-294.
- Replacement policies are present:
  - `Club admins can update registrations` at line 39949.
  - `Club admins can view event registrations` at line 39967.
  - `Registered users can view events` at line 40842.
- Grants for both helper functions to `anon`, `authenticated`, and `service_role` are present at lines 50845-50861.

Recommendation: classify as applied-equivalent. Per Kevin's requested repair vocabulary, this is eligible for a bookkeeping command:

```bash
supabase migration repair --status reverted 20260511110000
```

## `20260512120000` - `create_step_recent_activity.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: create `step_recent_activity`, enable RLS, add own-row SELECT policy, index recent activity, and introduce `mark_step_active`.

Evidence checked:

- `step_recent_activity` table exists at remote dump line 19224.
- Source check constraint is present at line 19229.
- Table comment is present at line 19241.
- Primary key is present at lines 24589-24593.
- Index `idx_step_recent_activity_user_recent` is present at line 30868.
- RLS is enabled at line 50013.
- SELECT policy `step_recent_activity_select_own` is present at line 50020.
- The final remote function is the 3-argument version introduced by the next migration, not the initial 2-argument version. That is expected if `20260512120000` and `20260512130000` have both effectively landed.

Recommendation: classify as applied-equivalent together with `20260512130000`. Eligible bookkeeping command:

```bash
supabase migration repair --status reverted 20260512120000
```

## `20260512130000` - `mark_step_active_service_role.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: replace the 2-argument `mark_step_active(uuid,text)` with a 3-argument service-role-compatible function `mark_step_active(uuid,text,uuid default null)`.

Evidence checked:

- `mark_step_active(p_step_id uuid, p_source text, p_user_id uuid DEFAULT NULL)` exists at remote dump line 5292.
- Function comment explicitly describes service-role callers requiring `p_user_id` at line 5353.
- Function grants include `authenticated` and `service_role` at lines 52339-52342.

Recommendation: classify as applied-equivalent. Eligible bookkeeping command:

```bash
supabase migration repair --status reverted 20260512130000
```

## `20260512140000` - `step_arch_e_backfill_review_sections.sql`

Verdict: `AMBIGUOUS`

Intended effect: create `step_review_backfill_audit`, add `step_review_parse_telegram_stamp`, add `step_arch_e_backfill_batch`, and execute a data backfill converting legacy `metadata.review` flat fields into `metadata.review.sections[]`.

Evidence checked:

- Schema artifacts are present:
  - `step_review_backfill_audit` table exists at line 19249.
  - `step_review_backfill_audit_step_id_idx` exists at line 31988.
  - `step_review_parse_telegram_stamp(content text)` exists at line 7081.
  - `step_arch_e_backfill_batch(batch_size integer DEFAULT 1000)` exists at line 6944.
  - Function comment exists at line 7073.
- The migration also executes a `DO` loop that mutates `timeline_steps.metadata` data. The schema dump cannot prove whether that backfill ran or whether all intended rows were transformed.

Recommendation: human review. Do not classify as fully applied-equivalent from schema alone. If Kevin wants to mark it as already handled, first verify via read-only SQL that legacy flat review rows either no longer exist or were intentionally left for a later backfill.

## `20260513090000` - `document_service_role_only_tables.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: add a service-role-only explanatory comment to `platform_transfers`.

Evidence checked:

- `platform_transfers` table exists at line 14839.
- Service-role-only comment is present at line 14857.
- RLS is enabled on `platform_transfers` at line 48390.

Recommendation: classify as applied-equivalent. Eligible bookkeeping command:

```bash
supabase migration repair --status reverted 20260513090000
```

## `20260513120000` - `share_tokens.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: create unified `share_tokens` table, indexes, RLS policies, and helper functions for creating, revoking, and resolving share tokens.

Evidence checked:

- `share_tokens` table exists at line 19025.
- `share_tokens` constraints are present at lines 19039-19041.
- Table comment is present at line 19053.
- Primary key and unique token constraints are present at lines 24490-24503.
- Indexes are present:
  - `idx_share_tokens_creator` at line 30716.
  - `idx_share_tokens_target` at line 30724.
- Functions are present:
  - `create_share_token` at line 1695.
  - `resolve_share_token` at line 6105.
  - `revoke_share_token` at line 6520.
- RLS and owner policies are present:
  - RLS enabled at line 49897.
  - owner delete/insert/read/update policies at lines 49904, 49912, 49920, and 49928.
- Function grants are present at lines 51209-51214, 52537-52542, and 52572-52577.

Recommendation: classify as applied-equivalent. Eligible bookkeeping command:

```bash
supabase migration repair --status reverted 20260513120000
```

## `20260514110000` - `enable_rls_step_review_backfill_audit.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: enable RLS on `step_review_backfill_audit` and update the table comment to document service-role-only access.

Evidence checked:

- `step_review_backfill_audit` table exists at line 19249.
- Updated service-role-only comment is present at line 19266.
- RLS is enabled at line 50029.
- No client-facing policies are present for `step_review_backfill_audit` in the dump; this matches the intended "RLS enabled with no policies" shape.

Recommendation: classify as applied-equivalent. Eligible bookkeeping command:

```bash
supabase migration repair --status reverted 20260514110000
```

## `20260514120000` - `pin_function_search_paths.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: set `search_path = pg_catalog, public` on 33 public functions flagged by Supabase advisor.

Evidence checked:

- The remote dump shows the expected `SET "search_path" TO 'pg_catalog', 'public'` form in function definitions.
- Scripted verification checked all 33 function names from the migration against the dump and found zero missing or different search-path settings.
- Representative evidence:
  - `auto_curate_blueprint_step` function at line 625, search path at line 627.
  - `step_arch_e_backfill_batch` function at line 6944, search path immediately under the function header.
  - `update_user_skill_goals_updated_at` function at line 8858, search path at line 8860.

Recommendation: classify as applied-equivalent. Eligible bookkeeping command:

```bash
supabase migration repair --status reverted 20260514120000
```

## `20260514130000` - `drop_duplicate_indexes.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: drop four duplicate indexes while preserving canonical equivalents.

Evidence checked:

- Kept/canonical objects are present:
  - `idx_ai_coach_analysis_timer_session_id` at line 25844.
  - `boat_classes_name_key` unique constraint at lines 21709-21713.
  - `idx_crew_members_class_id` at line 27132.
  - `idx_crew_members_sailor_id` at line 27148.
- Dropped duplicate names are absent from the remote dump:
  - `idx_ai_coach_analysis_session`
  - `boat_classes_name_unique`
  - `idx_crew_members_class`
  - `idx_crew_members_sailor`

Recommendation: classify as applied-equivalent. Eligible bookkeeping command:

```bash
supabase migration repair --status reverted 20260514130000
```

## `20260515120000` - `create_playbook_concept_user_state.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: create per-user concept state table for Concept Detail variant routing, with indexes, RLS policies, updated-at trigger, and grants.

Evidence checked:

- `playbook_concept_user_state` table exists at line 14865.
- Progression-state check constraint is present at line 14877.
- Primary key and unique user/playbook/concept constraint are present at lines 23176-23189.
- Indexes are present:
  - breakthrough index at line 28300.
  - concept index at line 28308.
  - user/playbook index at line 28316.
- Trigger function exists at line 7207.
- Updated-at trigger exists at line 32933.
- RLS policies are present:
  - delete at line 42094.
  - insert at line 42673.
  - update at line 43692.
  - select at line 44589.
- RLS is enabled at line 48398.
- Grants are present at lines 55399-55404.

Recommendation: classify as applied-equivalent. Eligible bookkeeping command:

```bash
supabase migration repair --status reverted 20260515120000
```

## Recommended Repair Plan

Do not execute these from this document. This is the precomputed command list for Kevin review only.

Per Kevin's requested classification vocabulary, the following `APPLIED-EQUIVALENT` local-only migrations are candidates for bookkeeping repair as `reverted`, because their effects are already present in the remote schema dump:

```bash
supabase migration repair --status reverted 20260511110000
supabase migration repair --status reverted 20260512120000
supabase migration repair --status reverted 20260512130000
supabase migration repair --status reverted 20260513090000
supabase migration repair --status reverted 20260513120000
supabase migration repair --status reverted 20260514110000
supabase migration repair --status reverted 20260514120000
supabase migration repair --status reverted 20260514130000
supabase migration repair --status reverted 20260515120000
```

Hold for human review:

```text
20260410120000_seed_jhu_degree_programs_and_templates.sql
20260512140000_step_arch_e_backfill_review_sections.sql
```

Reason: both include data effects that cannot be proven from the schema-only dump. The first is primarily seed data. The second includes schema objects that are present, but also executes a `timeline_steps.metadata` backfill.

