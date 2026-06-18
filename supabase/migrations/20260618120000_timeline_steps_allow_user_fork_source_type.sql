-- "Redo step" (Duplicate a step for another attempt) inserts a new
-- timeline_steps row with source_type = 'user_fork' (see redoStepAsNewStep in
-- services/TimelineStepService.ts). But the timeline_steps_source_type_check
-- constraint last set by 20260524120000_phase_4y_marketplace_step_materialization
-- omitted 'user_fork', so every redo failed with a check_violation and surfaced
-- "Could not create a redo step." (There are 0 user_fork rows in the table — it
-- has never once succeeded.) This adds 'user_fork' to the allowed set.
ALTER TABLE public.timeline_steps
  DROP CONSTRAINT IF EXISTS timeline_steps_source_type_check;

ALTER TABLE public.timeline_steps
  ADD CONSTRAINT timeline_steps_source_type_check
  CHECK (source_type IN (
    'manual',
    'template',
    'copied',
    'program_session',
    'blueprint',
    'suggestion',
    'marketplace_copy',
    'user_fork'
  ));
