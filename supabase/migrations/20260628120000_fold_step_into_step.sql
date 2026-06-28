-- Fold Step Into Step
-- =============================================================================
-- "Folding" moves a source step's work into a canonical target step (e.g. a
-- prep step folded into the race it was preparing for). The source is NOT
-- deleted — it becomes a reversible folded reference (status = 'folded') that
-- the arc renders as a read-only tombstone. Every fold can be reversed with
-- unfold_step().
--
-- Why an RPC instead of client-side: a fold touches timeline_steps (x2),
-- step_beats, step_flag_events, step_library_before and step_capability_evidence.
-- A partial client-side failure would orphan or duplicate rows. Running it in a
-- single function body keeps the whole move atomic. SECURITY DEFINER (to bypass
-- the 10-policy RLS OR-expansion on timeline_steps) with a manual ownership
-- check: both steps must belong to the caller and share an interest.
--
-- The completion trigger (notify_followers_on_step_completed) fires only on a
-- transition *to* 'completed'; fold never sets that, so no guard is needed.

-- 1. Widen the status CHECK to admit 'folded' (pattern reused from the
--    Phase-4 'settled' widening).
ALTER TABLE public.timeline_steps
  DROP CONSTRAINT IF EXISTS timeline_steps_status_check;

ALTER TABLE public.timeline_steps
  ADD CONSTRAINT timeline_steps_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'settled', 'skipped', 'folded'));

-- 2. Helpers ------------------------------------------------------------------

-- Tag every element of a jsonb array with its source step id so unfold can
-- remove exactly the items this fold appended.
CREATE OR REPLACE FUNCTION public.jsonb_tag_folded(arr jsonb, source_id uuid)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(elem || jsonb_build_object('_folded_from', source_id)),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(arr, '[]'::jsonb)) elem;
$$;

-- Ordinal rank for capability-evidence strength, so a merge keeps the strongest.
CREATE OR REPLACE FUNCTION public.step_strength_rank(s text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE s
    WHEN 'strong' THEN 3
    WHEN 'material' THEN 2
    WHEN 'worth-noting' THEN 1
    ELSE 0
  END;
$$;

-- 3. fold_step_into_step ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fold_step_into_step(
  p_source_id uuid,
  p_target_id uuid
)
RETURNS SETOF public.timeline_steps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_source public.timeline_steps;
  v_target public.timeline_steps;
  v_src_meta jsonb;
  v_tgt_meta jsonb;
  v_src_act jsonb;
  v_tgt_act jsonb;
  v_src_review jsonb;
  v_tgt_review jsonb;
  v_now timestamptz := now();
  v_beat_offset integer;
  v_moved_beats uuid[];
  v_moved_flags uuid[];
  v_moved_library uuid[];
  v_moved_evidence uuid[];
  v_prov jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot fold a step into itself';
  END IF;

  SELECT * INTO v_source FROM public.timeline_steps WHERE id = p_source_id;
  SELECT * INTO v_target FROM public.timeline_steps WHERE id = p_target_id;

  IF v_source.id IS NULL THEN RAISE EXCEPTION 'Source step not found'; END IF;
  IF v_target.id IS NULL THEN RAISE EXCEPTION 'Target step not found'; END IF;
  IF v_source.user_id <> v_uid OR v_target.user_id <> v_uid THEN
    RAISE EXCEPTION 'Both steps must belong to the caller';
  END IF;
  IF v_source.interest_id IS DISTINCT FROM v_target.interest_id THEN
    RAISE EXCEPTION 'Steps must share an interest';
  END IF;
  IF v_source.status = 'folded' THEN
    RAISE EXCEPTION 'Source step is already folded';
  END IF;

  -- A race/anchor step owns its own timing, course and Atlas context: it may be
  -- a fold target but never a source. Detected via race_plan / race target_event.
  IF COALESCE(v_source.metadata->'race_plan', 'null'::jsonb) <> 'null'::jsonb
     OR COALESCE(v_source.metadata #>> '{plan,target_event_kind}', '')
        IN ('regatta', 'race_event') THEN
    RAISE EXCEPTION 'A race/anchor step cannot be folded into another step';
  END IF;

  v_src_meta   := COALESCE(v_source.metadata, '{}'::jsonb);
  v_tgt_meta   := COALESCE(v_target.metadata, '{}'::jsonb);
  v_src_act    := COALESCE(v_src_meta->'act', '{}'::jsonb);
  v_tgt_act    := COALESCE(v_tgt_meta->'act', '{}'::jsonb);
  v_src_review := COALESCE(v_src_meta->'review', '{}'::jsonb);
  v_tgt_review := COALESCE(v_tgt_meta->'review', '{}'::jsonb);

  -- 3a. Merge act arrays: target's own entries first, then the (tagged)
  --     folded-in source entries appended. Measurements shallow-merge with the
  --     target authoritative.
  v_tgt_act := v_tgt_act || jsonb_build_object(
    'observations',
      COALESCE(v_tgt_act->'observations', '[]'::jsonb)
        || jsonb_tag_folded(v_src_act->'observations', p_source_id),
    'media_uploads',
      COALESCE(v_tgt_act->'media_uploads', '[]'::jsonb)
        || jsonb_tag_folded(v_src_act->'media_uploads', p_source_id),
    'media_links',
      COALESCE(v_tgt_act->'media_links', '[]'::jsonb)
        || jsonb_tag_folded(v_src_act->'media_links', p_source_id),
    'measurements',
      COALESCE(v_src_act->'measurements', '{}'::jsonb)
        || COALESCE(v_tgt_act->'measurements', '{}'::jsonb)
  );

  -- act.notes: append the source's notes as an attributed block.
  IF COALESCE(v_src_act->>'notes', '') <> '' THEN
    v_tgt_act := jsonb_set(
      v_tgt_act,
      '{notes}',
      to_jsonb(
        CASE WHEN COALESCE(v_tgt_act->>'notes', '') <> ''
          THEN (v_tgt_act->>'notes') || E'\n\n'
          ELSE ''
        END
        || 'From "' || COALESCE(v_source.title, 'a folded step') || '":' || E'\n'
        || (v_src_act->>'notes')
      )
    );
  END IF;

  -- 3b. Merge review.sections (tagged). key_takeaway / teaching_reflection are
  --     preserved on the source AND surfaced in the provenance entry below;
  --     the target's own key_takeaway is never overwritten.
  v_tgt_review := jsonb_set(
    v_tgt_review,
    '{sections}',
    COALESCE(v_tgt_review->'sections', '[]'::jsonb)
      || jsonb_tag_folded(v_src_review->'sections', p_source_id)
  );

  -- 3c. Move child rows -------------------------------------------------------

  -- step_beats: append after the target's current max position.
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_beat_offset
    FROM public.step_beats WHERE step_id = p_target_id;
  WITH moved AS (
    UPDATE public.step_beats
       SET step_id = p_target_id,
           position = position + v_beat_offset,
           updated_at = v_now
     WHERE step_id = p_source_id
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}') INTO v_moved_beats FROM moved;

  -- step_flag_events: straight move.
  WITH moved AS (
    UPDATE public.step_flag_events
       SET step_id = p_target_id
     WHERE step_id = p_source_id
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}') INTO v_moved_flags FROM moved;

  -- step_library_before: UNIQUE(step_id, library_item_id). Drop source rows the
  -- target already links, then move the rest.
  DELETE FROM public.step_library_before s
   WHERE s.step_id = p_source_id
     AND EXISTS (
       SELECT 1 FROM public.step_library_before t
        WHERE t.step_id = p_target_id
          AND t.library_item_id = s.library_item_id
     );
  WITH moved AS (
    UPDATE public.step_library_before
       SET step_id = p_target_id
     WHERE step_id = p_source_id
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}') INTO v_moved_library FROM moved;

  -- step_capability_evidence: UNIQUE(step_id, capability_id). For capabilities
  -- present on BOTH, merge into the target row — union the evidence captures
  -- (so the same attempt is never double-counted), keep the strongest strength
  -- and highest pip. Then move the non-overlapping rows.
  UPDATE public.step_capability_evidence t
     SET evidence_capture_ids = (
           SELECT COALESCE(array_agg(DISTINCT x), '{}')
             FROM unnest(t.evidence_capture_ids || s.evidence_capture_ids) x
         ),
         evidence_count = GREATEST(
           t.evidence_count,
           (SELECT count(DISTINCT x)
              FROM unnest(t.evidence_capture_ids || s.evidence_capture_ids) x)
         ),
         pip_level = GREATEST(t.pip_level, s.pip_level),
         strength = CASE
           WHEN step_strength_rank(s.strength) > step_strength_rank(t.strength)
             THEN s.strength ELSE t.strength
         END,
         updated_at = v_now
    FROM public.step_capability_evidence s
   WHERE t.step_id = p_target_id
     AND s.step_id = p_source_id
     AND t.capability_id = s.capability_id;

  DELETE FROM public.step_capability_evidence s
   WHERE s.step_id = p_source_id
     AND EXISTS (
       SELECT 1 FROM public.step_capability_evidence t
        WHERE t.step_id = p_target_id
          AND t.capability_id = s.capability_id
     );
  WITH moved AS (
    UPDATE public.step_capability_evidence
       SET step_id = p_target_id, updated_at = v_now
     WHERE step_id = p_source_id
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}') INTO v_moved_evidence FROM moved;

  -- 3d. Provenance: append the source to the target's folded_sources, carrying
  --     everything unfold needs plus display fields for the "From X" block.
  v_prov := jsonb_build_object(
    'step_id', p_source_id,
    'title', v_source.title,
    'folded_at', v_now,
    'prior_status', v_source.status,
    'key_takeaway', v_src_review->'key_takeaway',
    'teaching_reflection', v_src_review->'teaching_reflection',
    'counts', jsonb_build_object(
      'observations', jsonb_array_length(COALESCE(v_src_act->'observations', '[]'::jsonb)),
      'media_uploads', jsonb_array_length(COALESCE(v_src_act->'media_uploads', '[]'::jsonb)),
      'media_links', jsonb_array_length(COALESCE(v_src_act->'media_links', '[]'::jsonb)),
      'sections', jsonb_array_length(COALESCE(v_src_review->'sections', '[]'::jsonb))
    ),
    'moved_beat_ids', to_jsonb(v_moved_beats),
    'moved_flag_ids', to_jsonb(v_moved_flags),
    'moved_library_ids', to_jsonb(v_moved_library),
    'moved_evidence_ids', to_jsonb(v_moved_evidence)
  );

  v_tgt_meta := v_tgt_meta
    || jsonb_build_object('act', v_tgt_act, 'review', v_tgt_review)
    || jsonb_build_object(
         'folded_sources',
         COALESCE(v_tgt_meta->'folded_sources', '[]'::jsonb) || jsonb_build_array(v_prov)
       );

  UPDATE public.timeline_steps
     SET metadata = v_tgt_meta, updated_at = v_now
   WHERE id = p_target_id;

  -- 3e. Tombstone the source. Its own act/review stay intact (so the read-only
  --     view still shows what it was); folded_into points at the target.
  UPDATE public.timeline_steps
     SET status = 'folded',
         updated_at = v_now,
         metadata = v_src_meta || jsonb_build_object(
           'folded_into',
           jsonb_build_object(
             'step_id', p_target_id,
             'title', v_target.title,
             'folded_at', v_now,
             'prior_status', v_source.status
           )
         )
   WHERE id = p_source_id;

  RETURN QUERY SELECT * FROM public.timeline_steps WHERE id = p_target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fold_step_into_step(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.fold_step_into_step(uuid, uuid) IS
  'Atomically folds a source step into a target step: merges act/review metadata, moves child rows (beats, flag events, library links, capability evidence), records provenance, and tombstones the source as status=folded. Reversible via unfold_step.';

-- 4. unfold_step --------------------------------------------------------------
-- Reverses a fold: moves the recorded child rows back to the source, strips the
-- folded-in items (matched by their _folded_from tag) and the provenance entry
-- off the target, and restores the source to its prior status. Capability rows
-- that were merge-on-conflict into an existing target capability are NOT
-- un-merged (rare; the union is additive and harmless) — only cleanly-moved
-- evidence rows return to the source.

CREATE OR REPLACE FUNCTION public.unfold_step(p_source_id uuid)
RETURNS SETOF public.timeline_steps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_source public.timeline_steps;
  v_target_id uuid;
  v_prior_status text;
  v_tgt_meta jsonb;
  v_tgt_act jsonb;
  v_tgt_review jsonb;
  v_prov jsonb;
  v_src text := p_source_id::text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_source FROM public.timeline_steps WHERE id = p_source_id;
  IF v_source.id IS NULL THEN RAISE EXCEPTION 'Source step not found'; END IF;
  IF v_source.user_id <> v_uid THEN
    RAISE EXCEPTION 'Step does not belong to the caller';
  END IF;
  IF v_source.status <> 'folded' THEN
    RAISE EXCEPTION 'Step is not folded';
  END IF;

  v_target_id   := (v_source.metadata #>> '{folded_into,step_id}')::uuid;
  v_prior_status := COALESCE(v_source.metadata #>> '{folded_into,prior_status}', 'pending');

  IF v_target_id IS NOT NULL THEN
    SELECT metadata INTO v_tgt_meta FROM public.timeline_steps WHERE id = v_target_id;
    IF v_tgt_meta IS NOT NULL THEN
      SELECT e INTO v_prov
        FROM jsonb_array_elements(COALESCE(v_tgt_meta->'folded_sources', '[]'::jsonb)) e
       WHERE e->>'step_id' = v_src
       LIMIT 1;

      -- Move recorded child rows back to the source.
      IF v_prov IS NOT NULL THEN
        UPDATE public.step_beats SET step_id = p_source_id
         WHERE id IN (SELECT (jsonb_array_elements_text(v_prov->'moved_beat_ids'))::uuid);
        UPDATE public.step_flag_events SET step_id = p_source_id
         WHERE id IN (SELECT (jsonb_array_elements_text(v_prov->'moved_flag_ids'))::uuid);
        UPDATE public.step_library_before SET step_id = p_source_id
         WHERE id IN (SELECT (jsonb_array_elements_text(v_prov->'moved_library_ids'))::uuid);
        UPDATE public.step_capability_evidence SET step_id = p_source_id
         WHERE id IN (SELECT (jsonb_array_elements_text(v_prov->'moved_evidence_ids'))::uuid);
      END IF;

      -- Strip folded-in array items + provenance off the target.
      v_tgt_act := COALESCE(v_tgt_meta->'act', '{}'::jsonb);
      v_tgt_review := COALESCE(v_tgt_meta->'review', '{}'::jsonb);

      v_tgt_act := v_tgt_act || jsonb_build_object(
        'observations', (
          SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
            FROM jsonb_array_elements(COALESCE(v_tgt_act->'observations', '[]'::jsonb)) e
           WHERE COALESCE(e->>'_folded_from', '') <> v_src),
        'media_uploads', (
          SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
            FROM jsonb_array_elements(COALESCE(v_tgt_act->'media_uploads', '[]'::jsonb)) e
           WHERE COALESCE(e->>'_folded_from', '') <> v_src),
        'media_links', (
          SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
            FROM jsonb_array_elements(COALESCE(v_tgt_act->'media_links', '[]'::jsonb)) e
           WHERE COALESCE(e->>'_folded_from', '') <> v_src)
      );

      v_tgt_review := jsonb_set(
        v_tgt_review,
        '{sections}',
        (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
           FROM jsonb_array_elements(COALESCE(v_tgt_review->'sections', '[]'::jsonb)) e
          WHERE COALESCE(e->>'_folded_from', '') <> v_src)
      );

      v_tgt_meta := v_tgt_meta
        || jsonb_build_object('act', v_tgt_act, 'review', v_tgt_review)
        || jsonb_build_object('folded_sources', (
             SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
               FROM jsonb_array_elements(COALESCE(v_tgt_meta->'folded_sources', '[]'::jsonb)) e
              WHERE e->>'step_id' <> v_src));

      UPDATE public.timeline_steps
         SET metadata = v_tgt_meta, updated_at = now()
       WHERE id = v_target_id;
    END IF;
  END IF;

  -- Restore the source step.
  UPDATE public.timeline_steps
     SET status = v_prior_status,
         updated_at = now(),
         metadata = (v_source.metadata - 'folded_into')
   WHERE id = p_source_id;

  RETURN QUERY SELECT * FROM public.timeline_steps WHERE id = p_source_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unfold_step(uuid) TO authenticated;

COMMENT ON FUNCTION public.unfold_step(uuid) IS
  'Reverses fold_step_into_step: returns moved child rows to the source, strips folded-in metadata + provenance from the target, and restores the source to its prior status.';
