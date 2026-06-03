-- N2 (nursing Atlas) — Log-a-shift loop write path.
--
-- `clinical_shifts` shipped with only SELECT policies (student_read + org_read),
-- so RLS blocked every INSERT/UPDATE — the table could never be written from the
-- client. A nursing student logs their OWN completed clinical shifts, so add
-- self-scoped INSERT + UPDATE policies. Reads are unchanged.
--
-- auth.uid() is wrapped as (SELECT auth.uid()) per the project RLS convention
-- (bare auth.uid() in USING/CHECK re-decodes the JWT per row).

alter table public.clinical_shifts enable row level security;

drop policy if exists clinical_shifts_student_insert on public.clinical_shifts;
create policy clinical_shifts_student_insert
  on public.clinical_shifts
  for insert
  to authenticated
  with check (student_id = (select auth.uid()));

drop policy if exists clinical_shifts_student_update on public.clinical_shifts;
create policy clinical_shifts_student_update
  on public.clinical_shifts
  for update
  to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));
