-- Author-side RLS for the Creator Studio blueprint editor.
--
-- Until now public.blueprints had no INSERT policy (client inserts blocked)
-- and authors could not SELECT their own independent draft before it had a
-- stripe_price_id (the marketplace read policy gates on stripe_price_id, and
-- the org-member read policy needs membership — neither matches a brand-new
-- independent blueprint with org_id = null). These two policies let an author
-- create and load their own blueprints.

create policy blueprints_author_insert on public.blueprints
  for insert to authenticated
  with check (author_user_id = (select auth.uid()));

create policy blueprints_author_read on public.blueprints
  for select to authenticated
  using (author_user_id = (select auth.uid()));
