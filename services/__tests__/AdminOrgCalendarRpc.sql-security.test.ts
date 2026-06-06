import fs from 'fs';
import path from 'path';

describe('admin_org_calendar RPC + race-model migration', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260606170000_org_admin_calendar.sql',
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const normalized = sql.replace(/\s+/g, ' ').toLowerCase();

  it('bridges a race step to its scoring row via a nullable FK (D32)', () => {
    expect(normalized).toContain('alter table public.timeline_steps');
    expect(normalized).toContain('add column if not exists regatta_race_id uuid');
    expect(normalized).toContain('references public.regatta_races(id) on delete set null');
  });

  it('creates a SECURITY DEFINER RPC gated by is_org_admin_member', () => {
    expect(normalized).toContain('create or replace function public.admin_org_calendar');
    expect(normalized).toContain('security definer');
    expect(normalized).toContain('if not public.is_org_admin_member(p_org_id) then');
    expect(normalized).toContain('raise exception');
    expect(normalized).toContain("errcode = 'insufficient_privilege'");
  });

  it('scopes the read to the org by organization_id, not per-user', () => {
    expect(normalized).toContain('from public.timeline_steps ts');
    expect(normalized).toContain('where ts.organization_id = p_org_id');
  });

  it('locks the grant to authenticated and revokes public', () => {
    expect(normalized).toContain('revoke all on function public.admin_org_calendar(uuid) from public');
    expect(normalized).toContain(
      'grant execute on function public.admin_org_calendar(uuid) to authenticated',
    );
  });

  it('reloads the PostgREST schema cache so the RPC is callable immediately', () => {
    expect(normalized).toContain("notify pgrst, 'reload schema'");
  });
});
