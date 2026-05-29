-- Beats double as a checklist on the Do tab: each beat can be checked off
-- as it's completed during the activity. Default false so existing beats
-- read as "not yet done".
alter table public.step_beats
  add column if not exists done boolean not null default false;
