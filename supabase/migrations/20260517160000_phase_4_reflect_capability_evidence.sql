-- Phase 4 Reflect tab refresh: capability evidence and settled status.

create table if not exists public.step_capability_evidence (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.timeline_steps(id) on delete cascade,
  capability_id text not null,
  capability_name text not null,
  confirmed boolean not null default true,
  strength text not null default 'material'
    check (strength in ('worth-noting', 'material', 'strong')),
  pip_level integer not null default 3
    check (pip_level between 0 and 5),
  evidence_count integer not null default 0
    check (evidence_count >= 0),
  evidence_capture_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (step_id, capability_id)
);

create index if not exists idx_step_capability_evidence_step_id
  on public.step_capability_evidence(step_id);

alter table public.step_capability_evidence enable row level security;

drop policy if exists "step_capability_evidence_select_own_or_collab"
  on public.step_capability_evidence;
create policy "step_capability_evidence_select_own_or_collab"
  on public.step_capability_evidence
  for select
  using (
    exists (
      select 1
      from public.timeline_steps ts
      where ts.id = step_capability_evidence.step_id
        and (
          ts.user_id = auth.uid()
          or ts.collaborator_user_ids @> array[auth.uid()]
        )
    )
  );

drop policy if exists "step_capability_evidence_mutate_own"
  on public.step_capability_evidence;
create policy "step_capability_evidence_mutate_own"
  on public.step_capability_evidence
  for all
  using (
    exists (
      select 1
      from public.timeline_steps ts
      where ts.id = step_capability_evidence.step_id
        and ts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.timeline_steps ts
      where ts.id = step_capability_evidence.step_id
        and ts.user_id = auth.uid()
    )
  );

alter table public.timeline_steps
  drop constraint if exists timeline_steps_status_check;

alter table public.timeline_steps
  add constraint timeline_steps_status_check
  check (status in ('pending', 'in_progress', 'completed', 'settled', 'skipped'));

update public.timeline_steps
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{review,overall_rating}',
  'null'::jsonb,
  true
)
where metadata #> '{review,overall_rating}' is not null;
