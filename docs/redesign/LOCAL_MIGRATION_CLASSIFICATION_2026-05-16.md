# Local Migration Classification - 2026-05-16

## Summary

This classifies the 11 migrations that are present in local `supabase/migrations/` but absent from remote migration history as of `npx supabase migration list` on 2026-05-16.

Classification source of truth:

- Local migration SQL files under `supabase/migrations/`.
- Remote schema dump committed at `docs/redesign/REMOTE_SCHEMA_DUMP_2026-05-16.sql` (`8251c220`).

No migration repair, database pull, or database push was run for this classification. The original classification used only local SQL files and the remote schema dump; the two formerly ambiguous data-effect migrations were later resolved with read-only remote data probes.

## Summary Table

| Timestamp | Filename | Verdict | One-line Description |
|---|---|---:|---|
| `20260410120000` | `20260410120000_seed_jhu_degree_programs_and_templates.sql` | `APPLIED-EQUIVALENT` | Read-only data probe found all 4 JHU nursing programs, 28 sessions, 28 templates, and 10 baseline concepts present remotely. |
| `20260511110000` | `20260511110000_fix_club_events_rls_recursion.sql` | `APPLIED-EQUIVALENT` | RLS recursion helper functions and replacement policies are present remotely. |
| `20260512120000` | `20260512120000_create_step_recent_activity.sql` | `APPLIED-EQUIVALENT` | `step_recent_activity` table, index, RLS, policy, and evolved `mark_step_active` path are present remotely. |
| `20260512130000` | `20260512130000_mark_step_active_service_role.sql` | `APPLIED-EQUIVALENT` | Final 3-argument `mark_step_active` service-role-compatible function is present remotely. |
| `20260512140000` | `20260512140000_step_arch_e_backfill_review_sections.sql` | `APPLIED-EQUIVALENT` | Read-only data probe found 0 remaining eligible flat review rows, 14 legacy-section rows, and 14 audit rows. |
| `20260513090000` | `20260513090000_document_service_role_only_tables.sql` | `APPLIED-EQUIVALENT` | `platform_transfers` service-role-only table comment is present remotely. |
| `20260513120000` | `20260513120000_share_tokens.sql` | `APPLIED-EQUIVALENT` | `share_tokens` table, indexes, RLS policies, and resolver functions are present remotely. |
| `20260514110000` | `20260514110000_enable_rls_step_review_backfill_audit.sql` | `APPLIED-EQUIVALENT` | `step_review_backfill_audit` RLS and service-role-only comment are present remotely. |
| `20260514120000` | `20260514120000_pin_function_search_paths.sql` | `APPLIED-EQUIVALENT` | All 33 functions named by the migration have `SET "search_path" TO 'pg_catalog', 'public'` in the remote dump. |
| `20260514130000` | `20260514130000_drop_duplicate_indexes.sql` | `APPLIED-EQUIVALENT` | Redundant indexes are absent and the kept canonical indexes/constraint are present remotely. |
| `20260515120000` | `20260515120000_create_playbook_concept_user_state.sql` | `APPLIED-EQUIVALENT` | `playbook_concept_user_state` table, indexes, RLS policies, trigger, and grants are present remotely. |

Bucket counts:

- `APPLIED-EQUIVALENT`: 11
- `NOT-APPLIED`: 0
- `AMBIGUOUS`: 0

## `20260410120000` - `seed_jhu_degree_programs_and_templates.sql`

Verdict: `APPLIED-EQUIVALENT`

Intended effect: idempotently seed JHU School of Nursing degree programs, program sessions, timeline step templates, and baseline nursing `playbook_concepts` rows for demo/program content.

Evidence checked:

- Remote schema has the target tables:
  - `playbook_concepts` at remote dump line 14888.
  - `program_sessions` at remote dump line 15471.
  - `programs` at remote dump line 15537.
  - `timeline_step_templates` at remote dump line 19735.
- The committed remote dump is schema-only. It does not contain row data, so it cannot prove whether rows like `MSN Entry into Nursing`, `DNP — Family NP`, `Healthcare Organizational Leadership MSN`, or `management-of-care` were inserted.

Resolution - read-only data probe:

The schema-only dump could not prove row presence, so the seed effect was checked against remote data using the service-role read path. The CLI DB login role was not allowed to read the relevant tables directly, so this was executed as read-only PostgREST `select` requests, equivalent to the following SQL predicates:

```sql
-- JHU nursing seed presence probe
SELECT count(*) FROM programs
WHERE organization_id = '678e149e-2abb-422c-ac61-b76756a2150e'
  AND domain = 'nursing'
  AND title IN (
    'MSN Entry into Nursing',
    'DNP — Family NP',
    'DNP — Psych Mental Health NP',
    'Healthcare Organizational Leadership MSN'
  );

SELECT count(*) FROM program_sessions
WHERE program_id IN (
  SELECT id FROM programs
  WHERE organization_id = '678e149e-2abb-422c-ac61-b76756a2150e'
    AND domain = 'nursing'
    AND title IN (
      'MSN Entry into Nursing',
      'DNP — Family NP',
      'DNP — Psych Mental Health NP',
      'Healthcare Organizational Leadership MSN'
    )
);

SELECT count(*) FROM timeline_step_templates
WHERE organization_id = '678e149e-2abb-422c-ac61-b76756a2150e'
  AND interest_id = 'bec249c5-6412-4d16-bb84-bfcfb887ff67'
  AND path_name IN (
    'msn-entry-into-nursing',
    'dnp-family-np',
    'dnp-psych-mental-health-np',
    'hol-msn'
  );

SELECT count(*) FROM playbook_concepts
WHERE interest_id = 'bec249c5-6412-4d16-bb84-bfcfb887ff67'
  AND origin = 'platform_baseline'
  AND slug IN (
    'management-of-care',
    'safety-and-infection-control',
    'pharmacological-therapies',
    'physiological-adaptation',
    'psychosocial-integrity',
    'health-promotion-maintenance',
    'basic-care-and-comfort',
    'reduction-of-risk-potential',
    'delegation-and-prioritization',
    'clinical-judgment-model'
  );
```

Raw result:

```json
{
  "program_count": 4,
  "session_count": 28,
  "template_count": 28,
  "concept_count": 10,
  "programs_present": [
    "DNP — Family NP",
    "DNP — Psych Mental Health NP",
    "Healthcare Organizational Leadership MSN",
    "MSN Entry into Nursing"
  ],
  "templates_present": [
    "dnp-family-np:1",
    "dnp-family-np:2",
    "dnp-family-np:3",
    "dnp-family-np:4",
    "dnp-family-np:5",
    "dnp-family-np:6",
    "dnp-family-np:7",
    "dnp-psych-mental-health-np:1",
    "dnp-psych-mental-health-np:2",
    "dnp-psych-mental-health-np:3",
    "dnp-psych-mental-health-np:4",
    "dnp-psych-mental-health-np:5",
    "dnp-psych-mental-health-np:6",
    "dnp-psych-mental-health-np:7",
    "hol-msn:1",
    "hol-msn:2",
    "hol-msn:3",
    "hol-msn:4",
    "hol-msn:5",
    "hol-msn:6",
    "hol-msn:7",
    "msn-entry-into-nursing:1",
    "msn-entry-into-nursing:2",
    "msn-entry-into-nursing:3",
    "msn-entry-into-nursing:4",
    "msn-entry-into-nursing:5",
    "msn-entry-into-nursing:6",
    "msn-entry-into-nursing:7"
  ],
  "concepts_present": [
    "basic-care-and-comfort",
    "clinical-judgment-model",
    "delegation-and-prioritization",
    "health-promotion-maintenance",
    "management-of-care",
    "pharmacological-therapies",
    "physiological-adaptation",
    "psychosocial-integrity",
    "reduction-of-risk-potential",
    "safety-and-infection-control"
  ]
}
```

Verdict: `APPLIED-EQUIVALENT`. All intended seed row groups are present at the expected cardinalities. This is eligible for bookkeeping repair:

```bash
supabase migration repair --status reverted 20260410120000
```

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

Verdict: `APPLIED-EQUIVALENT`

Intended effect: create `step_review_backfill_audit`, add `step_review_parse_telegram_stamp`, add `step_arch_e_backfill_batch`, and execute a data backfill converting legacy `metadata.review` flat fields into `metadata.review.sections[]`.

Evidence checked:

- Schema artifacts are present:
  - `step_review_backfill_audit` table exists at line 19249.
  - `step_review_backfill_audit_step_id_idx` exists at line 31988.
  - `step_review_parse_telegram_stamp(content text)` exists at line 7081.
  - `step_arch_e_backfill_batch(batch_size integer DEFAULT 1000)` exists at line 6944.
  - Function comment exists at line 7073.
- The migration also executes a `DO` loop that mutates `timeline_steps.metadata` data. The schema dump cannot prove whether that backfill ran or whether all intended rows were transformed.

Resolution - read-only data probe:

The schema artifacts were already confirmed present. The remaining question was whether the data backfill ran. The remote data was checked with read-only `select` access equivalent to this SQL:

```sql
-- Step Arch E backfill completion probe
WITH eligible AS (
  SELECT id
  FROM timeline_steps
  WHERE metadata ? 'review'
    AND jsonb_typeof(metadata->'review') = 'object'
    AND (
      NOT (metadata->'review' ? 'sections')
      OR jsonb_typeof(metadata->'review'->'sections') <> 'array'
      OR jsonb_array_length(metadata->'review'->'sections') = 0
    )
    AND (
      (metadata->'review'->>'what_learned') IS NOT NULL
      OR (metadata->'review'->>'deviation_reason') IS NOT NULL
      OR (metadata->'review'->>'next_step_notes') IS NOT NULL
    )
),
backfilled AS (
  SELECT id
  FROM timeline_steps
  WHERE metadata ? 'review'
    AND jsonb_typeof(metadata->'review') = 'object'
    AND jsonb_typeof(metadata->'review'->'sections') = 'array'
    AND jsonb_array_length(metadata->'review'->'sections') > 0
    AND (metadata->'review'->>'composed_via') = 'legacy'
),
audit AS (
  SELECT count(*) AS audit_count FROM step_review_backfill_audit
)
SELECT
  (SELECT count(*) FROM eligible) AS remaining_eligible_flat_rows,
  (SELECT count(*) FROM backfilled) AS legacy_sections_rows,
  (SELECT audit_count FROM audit) AS audit_rows;
```

Raw result:

```json
{
  "total_timeline_steps_checked": 283,
  "remaining_eligible_flat_rows": 0,
  "legacy_sections_rows": 14,
  "audit_rows_content_range": "0-13/14",
  "audit_rows": 14,
  "remaining_eligible_ids": [],
  "legacy_sections_ids": [
    "39fe4757-56e4-475a-9923-92ad4d4914b8",
    "c971abbd-56fc-4058-8beb-0aa6266ba190",
    "de914768-dfc2-4c34-8def-962427579633",
    "68c448cd-4d03-4cd5-8e4d-9d1b8144afb0",
    "92b510b7-4875-42ed-b101-4b0513ec9957",
    "bb4c3b33-3bdd-4091-b6b1-76369f3ce682",
    "862dc0bd-e234-4d9f-9afd-c8883b2f40b9",
    "461646ee-48da-4333-920f-16540b5c806e",
    "fc951452-452c-48fb-ac07-ce9bbfe3f9cd",
    "f8917dd3-f3d2-44c4-80f0-3a340a86e4f2",
    "32702144-be73-499a-9e20-927083952bd0",
    "d897117b-1014-4d0b-9803-1a40c6d9bb3d",
    "774f46d4-2f9c-4ccb-9056-24eaddb206a7",
    "0bea0a57-1ec8-4248-b22e-2d00d81f3548"
  ]
}
```

Verdict: `APPLIED-EQUIVALENT`. There are no remaining eligible legacy-flat review rows, and the 14 legacy-composed review rows match the 14 audit rows. This is eligible for bookkeeping repair:

```bash
supabase migration repair --status reverted 20260512140000
```

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
supabase migration repair --status reverted 20260410120000
supabase migration repair --status reverted 20260511110000
supabase migration repair --status reverted 20260512120000
supabase migration repair --status reverted 20260512130000
supabase migration repair --status reverted 20260512140000
supabase migration repair --status reverted 20260513090000
supabase migration repair --status reverted 20260513120000
supabase migration repair --status reverted 20260514110000
supabase migration repair --status reverted 20260514120000
supabase migration repair --status reverted 20260514130000
supabase migration repair --status reverted 20260515120000
```

No local-only migrations remain in the ambiguous bucket after the read-only data probes.
