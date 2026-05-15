# Concept Detail Commit 1 Spec: Migration

## Discrepancies

No repo contradiction found. Existing migrations use timestamp-prefixed SQL files under `supabase/migrations/`, UUID foreign keys to `auth.users(id)`, RLS policies scoped by `auth.uid()`, and per-table authenticated grants where explicit grants are useful.

## Migration Filename

`supabase/migrations/20260515120000_create_playbook_concept_user_state.sql`

## Full Migration SQL

```sql
-- Concept detail iOS: per-user concept state for variant routing.
-- Supports new / dormant / breakthrough routing without storing user state
-- on shared baseline playbook_concepts rows.

CREATE TABLE IF NOT EXISTS public.playbook_concept_user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  concept_id UUID NOT NULL REFERENCES public.playbook_concepts(id) ON DELETE CASCADE,
  progression_state TEXT NOT NULL DEFAULT 'learning'
    CHECK (progression_state IN ('forming', 'learning', 'practicing', 'breakthrough')),
  breakthrough_detected_at TIMESTAMPTZ,
  breakthrough_dismissed_at TIMESTAMPTZ,
  breakthrough_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_state_computed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT playbook_concept_user_state_unique
    UNIQUE (user_id, playbook_id, concept_id)
);

CREATE INDEX IF NOT EXISTS idx_playbook_concept_user_state_user_playbook
  ON public.playbook_concept_user_state(user_id, playbook_id);

CREATE INDEX IF NOT EXISTS idx_playbook_concept_user_state_concept
  ON public.playbook_concept_user_state(concept_id);

CREATE INDEX IF NOT EXISTS idx_playbook_concept_user_state_breakthrough
  ON public.playbook_concept_user_state(user_id, playbook_id, breakthrough_detected_at DESC)
  WHERE breakthrough_detected_at IS NOT NULL
    AND breakthrough_dismissed_at IS NULL;

ALTER TABLE public.playbook_concept_user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own concept state"
  ON public.playbook_concept_user_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own concept state"
  ON public.playbook_concept_user_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own concept state"
  ON public.playbook_concept_user_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own concept state"
  ON public.playbook_concept_user_state FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_playbook_concept_user_state_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_playbook_concept_user_state_updated_at
  ON public.playbook_concept_user_state;

CREATE TRIGGER trigger_playbook_concept_user_state_updated_at
  BEFORE UPDATE ON public.playbook_concept_user_state
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_playbook_concept_user_state_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.playbook_concept_user_state
  TO authenticated;
```

## Field-by-Field Rationale

| Field | Type | Nullable | Default | Rationale |
|---|---|---:|---|---|
| `progression_state` | `TEXT` with check constraint | no | `'learning'` | Stores the user-specific concept progression signal consumed by the state pill and variant router. `learning` is the safe default for inherited concepts before linked reflection evidence is derived. |
| `breakthrough_detected_at` | `TIMESTAMPTZ` | yes | none | Marks that a breakthrough signal exists. `breakthrough` wins variant routing when this is set and not dismissed. |
| `breakthrough_dismissed_at` | `TIMESTAMPTZ` | yes | none | Lets the user clear the breakthrough treatment without deleting the evidence or resetting state history. |
| `breakthrough_evidence` | `JSONB` | no | `'[]'::jsonb` | Stores source step/reflection ids, excerpts, and rationale for the breakthrough offer. JSONB matches existing suggestion/provenance patterns. |
| `last_state_computed_at` | `TIMESTAMPTZ` | yes | none | Audit/debug field for future recompute jobs and stale-state detection; not user-visible in v1. |

## RLS Policy

Policy pattern: direct per-user ownership, matching tables such as `user_interest_manifesto`, `ai_interest_insights`, and `user_skill_goals`.

Exact policy rule:

- Select/update/delete use `USING (auth.uid() = user_id)`.
- Insert/update use `WITH CHECK (auth.uid() = user_id)`.
- No coach/shared read policy in v1 because this table drives the current user's private UI state, not shared concept content.

## Indexes

- Unique constraint on `(user_id, playbook_id, concept_id)` prevents duplicate state rows and supports the read path's exact lookup.
- `idx_playbook_concept_user_state_user_playbook` supports future shelf/list queries that hydrate state for all concepts in a playbook.
- `idx_playbook_concept_user_state_concept` supports cleanup/debug queries and possible future concept merge flows.
- `idx_playbook_concept_user_state_breakthrough` supports future queries for active breakthrough concepts without scanning all state rows.

## Foreign Keys

- `user_id → auth.users(id) ON DELETE CASCADE`: delete user state when the user is deleted.
- `playbook_id → public.playbooks(id) ON DELETE CASCADE`: delete user state when the playbook is deleted.
- `concept_id → public.playbook_concepts(id) ON DELETE CASCADE`: delete state when a personal/forked concept is deleted. Baseline concept deletion also removes derived per-user state for that baseline.

## Rollback Plan

```sql
DROP TRIGGER IF EXISTS trigger_playbook_concept_user_state_updated_at
  ON public.playbook_concept_user_state;

DROP FUNCTION IF EXISTS public.touch_playbook_concept_user_state_updated_at();

DROP TABLE IF EXISTS public.playbook_concept_user_state;
```

## Test Queries

Run against a local Supabase database after applying the migration. Replace UUID literals with real user/playbook/concept ids.

```sql
-- 1. Insert + select shape.
INSERT INTO public.playbook_concept_user_state (
  user_id,
  playbook_id,
  concept_id,
  progression_state,
  breakthrough_evidence
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000201',
  'practicing',
  '[{"stepId":"00000000-0000-0000-0000-000000000301","rationale":"clustered reflections"}]'::jsonb
);

SELECT progression_state, breakthrough_evidence, created_at, updated_at
FROM public.playbook_concept_user_state
WHERE user_id = '00000000-0000-0000-0000-000000000001';

-- 2. Unique constraint rejects duplicates.
INSERT INTO public.playbook_concept_user_state (
  user_id,
  playbook_id,
  concept_id
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000201'
);
-- Expected: duplicate key violates playbook_concept_user_state_unique.

-- 3. RLS owner can read own row.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT id
FROM public.playbook_concept_user_state
WHERE user_id = '00000000-0000-0000-0000-000000000001';
-- Expected: one row.

-- 4. RLS isolates other users.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT id
FROM public.playbook_concept_user_state
WHERE user_id = '00000000-0000-0000-0000-000000000001';
-- Expected: zero rows.

-- 5. Cascade delete from concept removes state.
DELETE FROM public.playbook_concepts
WHERE id = '00000000-0000-0000-0000-000000000201';

SELECT id
FROM public.playbook_concept_user_state
WHERE concept_id = '00000000-0000-0000-0000-000000000201';
-- Expected: zero rows.
```

## Commit Message

```text
feat(db): add per-user concept state

Create playbook_concept_user_state for Concept detail iOS variant routing.

- store progression_state and breakthrough signal fields per user/playbook/concept
- keep shared playbook_concepts free of user-specific state
- add RLS policies scoped to auth.uid() = user_id
- add indexes for exact concept-detail lookup and future playbook-level hydration

This unblocks the Concept detail read path from deriving new / dormant /
breakthrough routing without fixture data.
```
