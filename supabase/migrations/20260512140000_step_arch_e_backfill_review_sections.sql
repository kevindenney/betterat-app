-- Step Arch E — backfill metadata.review.sections[] from legacy flat fields.
--
-- See: docs/audit/step-architecture-migration-plan.md §4 Step E
--
-- This migration:
--   1. Creates step_review_backfill_audit so the raw pre-transform blob is
--      preserved before we write the synthesized sections[] back into the row
--      (D7 decision: snapshot before transform).
--   2. Adds a helper that parses the bot's "[YYYY-MM-DD via Telegram]" stamps
--      out of flat-field content (D7 decision: parse stamp into captured_at +
--      source).
--   3. Adds step_arch_e_backfill_batch(batch_size int) returning the row count
--      it processed. Uses FOR UPDATE SKIP LOCKED so it's safe to run alongside
--      live traffic. Idempotent: rows that already carry a non-empty
--      sections[] are skipped (predicate matches Step A getReviewSections).
--   4. Runs the batch in a DO loop of 1k pages until 0 rows remain (per
--      migration plan §6: "chunked update ... pages of 1k").
--
-- D6 decision: next_step_notes folds into the `anything_else` prompt.
-- D7 decision: stamps map to source='telegram' + captured_at=parsed date;
--              un-stamped legacy content keeps source='legacy' and falls back
--              to step.completed_at, then step.updated_at.
--
-- Flat fields are NOT cleared. Step F (a later release, two cycles out per
-- the plan) will drop the flat columns from metadata once all clients have
-- shipped the selector-based read path.

-- ---------------------------------------------------------------------------
-- 1. Audit table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS step_review_backfill_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  step_id uuid NOT NULL,
  metadata_review_before jsonb NOT NULL,
  metadata_review_after jsonb NOT NULL,
  backfilled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS step_review_backfill_audit_step_id_idx
  ON step_review_backfill_audit (step_id);

COMMENT ON TABLE step_review_backfill_audit IS
  'Step Arch E (2026-05-12) — pre-transform snapshot of metadata.review for each row touched by the legacy-flat-field → sections[] backfill. Per D7, raw blob preserved before transform.';

-- ---------------------------------------------------------------------------
-- 2. Stamp parser
-- ---------------------------------------------------------------------------

-- The bot stamps every appended segment with "[YYYY-MM-DD via Telegram] ...".
-- We collapse multi-stamp content into a single section but use the LATEST
-- date as captured_at so the After tab orders sensibly. If no stamp matches,
-- the caller falls back to step.completed_at / step.updated_at and sets
-- source='legacy'.
CREATE OR REPLACE FUNCTION step_review_parse_telegram_stamp(content text)
RETURNS TABLE (captured_date date, has_stamp boolean)
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  best date := NULL;
BEGIN
  IF content IS NULL OR length(content) = 0 THEN
    captured_date := NULL;
    has_stamp := false;
    RETURN NEXT;
    RETURN;
  END IF;

  BEGIN
    SELECT MAX((m)[1]::date) INTO best
    FROM regexp_matches(content, '\[(\d{4}-\d{2}-\d{2}) via Telegram\]', 'g') AS m;
  EXCEPTION WHEN OTHERS THEN
    -- Malformed date inside a stamp — treat row as un-stamped rather than
    -- aborting the batch.
    best := NULL;
  END;

  captured_date := best;
  has_stamp := best IS NOT NULL;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill batch
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION step_arch_e_backfill_batch(batch_size int DEFAULT 1000)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  step_row record;
  review jsonb;
  new_sections jsonb;
  fallback_at timestamptz;
  fallback_iso text;
  cap_date date;
  has_stamp boolean;
  source_tag text;
  cap_at_iso text;
  field_content text;
  processed int := 0;
  mapping_field text;
  mapping_prompt text;
  prompt_label_map jsonb := jsonb_build_object(
    'what_happened', 'What happened?',
    'what_worked', 'What worked?',
    'what_didnt', 'What didn''t?',
    'what_did_you_learn', 'What did you learn?',
    'anything_else', 'Anything else worth noting?'
  );
  field_mapping text[][] := ARRAY[
    ARRAY['what_learned', 'what_did_you_learn'],
    ARRAY['deviation_reason', 'what_didnt'],
    ARRAY['next_step_notes', 'anything_else']
  ];
  i int;
BEGIN
  FOR step_row IN
    SELECT id, metadata, completed_at, updated_at
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
    ORDER BY id
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    review := step_row.metadata->'review';
    fallback_at := COALESCE(step_row.completed_at, step_row.updated_at);
    fallback_iso := CASE
      WHEN fallback_at IS NOT NULL
      THEN to_char(fallback_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ELSE NULL
    END;
    new_sections := '[]'::jsonb;

    FOR i IN 1 .. array_length(field_mapping, 1) LOOP
      mapping_field := field_mapping[i][1];
      mapping_prompt := field_mapping[i][2];
      field_content := review->>mapping_field;
      CONTINUE WHEN field_content IS NULL OR length(trim(field_content)) = 0;

      SELECT p.captured_date, p.has_stamp
        INTO cap_date, has_stamp
      FROM step_review_parse_telegram_stamp(field_content) AS p;

      IF has_stamp THEN
        source_tag := 'telegram';
        cap_at_iso := to_char(
          (cap_date::timestamp AT TIME ZONE 'UTC'),
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        );
      ELSE
        source_tag := 'legacy';
        cap_at_iso := fallback_iso;
      END IF;

      new_sections := new_sections || jsonb_build_object(
        'prompt', mapping_prompt,
        'prompt_label', prompt_label_map->>mapping_prompt,
        'content', field_content,
        'source', source_tag,
        'captured_at', cap_at_iso
      );
    END LOOP;

    CONTINUE WHEN jsonb_array_length(new_sections) = 0;

    -- D7 snapshot — always written before the row is mutated.
    INSERT INTO step_review_backfill_audit (step_id, metadata_review_before, metadata_review_after)
    VALUES (
      step_row.id,
      review,
      review || jsonb_build_object(
        'sections', new_sections,
        'composed_via', 'legacy',
        'composed_at', fallback_iso
      )
    );

    UPDATE timeline_steps
    SET metadata = metadata || jsonb_build_object(
      'review', review || jsonb_build_object(
        'sections', new_sections,
        'composed_via', 'legacy',
        'composed_at', fallback_iso
      )
    )
    WHERE id = step_row.id;

    processed := processed + 1;
  END LOOP;

  RETURN processed;
END;
$$;

COMMENT ON FUNCTION step_arch_e_backfill_batch(int) IS
  'Step Arch E — processes one page of legacy-flat-field rows into v2 sections[]. Idempotent. Run repeatedly until it returns 0.';

-- ---------------------------------------------------------------------------
-- 4. Execute the backfill in 1k-row batches.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  processed int;
  total int := 0;
BEGIN
  LOOP
    SELECT step_arch_e_backfill_batch(1000) INTO processed;
    total := total + processed;
    EXIT WHEN processed = 0;
  END LOOP;
  RAISE NOTICE 'step_arch_e_backfill: % rows migrated', total;
END;
$$;
