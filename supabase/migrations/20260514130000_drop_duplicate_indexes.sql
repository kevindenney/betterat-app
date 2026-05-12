-- Drop redundant duplicate indexes flagged by Supabase advisor 0009
-- (duplicate_index). For each pair, keep the index that follows the
-- *_column_id naming convention (or is backed by a UNIQUE constraint)
-- and drop the older shorthand alias.

-- ai_coach_analysis(timer_session_id): keep `idx_ai_coach_analysis_timer_session_id`.
DROP INDEX IF EXISTS public.idx_ai_coach_analysis_session;

-- boat_classes(name): `boat_classes_name_key` backs the UNIQUE constraint;
-- `boat_classes_name_unique` is a redundant standalone index.
DROP INDEX IF EXISTS public.boat_classes_name_unique;

-- crew_members(class_id): keep `idx_crew_members_class_id`.
DROP INDEX IF EXISTS public.idx_crew_members_class;

-- crew_members(sailor_id): keep `idx_crew_members_sailor_id`.
DROP INDEX IF EXISTS public.idx_crew_members_sailor;
