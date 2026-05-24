/**
 * useOrgSsoDirectory — list the org's SSO-synced users + filter out
 * those who've already joined. Backed by org_sso_directory_cache; in
 * production a background SCIM sync writes to this table.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface DirectoryEntry {
  id: string;
  ssoUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  initials: string;
  roleHint: 'student' | 'faculty' | 'preceptor' | 'admin' | null;
  department: string | null;
  title: string | null;
  alreadyMember: boolean;
}

interface Row {
  id: string;
  sso_user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role_hint: string | null;
  department: string | null;
  title: string | null;
}

function initialsFor(first: string | null, last: string | null, email: string): string {
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export function useOrgSsoDirectory(orgId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['org-sso-directory', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<{
      entries: DirectoryEntry[];
      lastSyncedAt: string | null;
    }> => {
      const [{ data: rows }, { data: members }] = await Promise.all([
        supabase
          .from('org_sso_directory_cache')
          .select(
            'id, sso_user_id, email, first_name, last_name, role_hint, department, title, last_synced_at',
          )
          .eq('org_id', orgId)
          .eq('is_active', true)
          .order('last_name'),
        supabase
          .from('organization_memberships')
          .select('user_id')
          .eq('organization_id', orgId),
      ]);
      // organization_memberships.user_id → auth.users — PostgREST embed
      // across schemas silently returns nothing, so do a second look-up
      // in public.users to resolve emails.
      const memberUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
      let memberEmails = new Set<string>();
      if (memberUserIds.length > 0) {
        const { data: usersRows } = await supabase
          .from('users')
          .select('email')
          .in('id', memberUserIds);
        memberEmails = new Set(
          ((usersRows ?? []) as { email: string | null }[])
            .map((u) => (u.email ?? '').toLowerCase())
            .filter(Boolean),
        );
      }
      const entries = ((rows ?? []) as (Row & { last_synced_at: string })[])
        .map((r) => ({
          id: r.id,
          ssoUserId: r.sso_user_id,
          email: r.email,
          firstName: r.first_name,
          lastName: r.last_name,
          displayName: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.email,
          initials: initialsFor(r.first_name, r.last_name, r.email),
          roleHint: (r.role_hint as DirectoryEntry['roleHint']) ?? null,
          department: r.department,
          title: r.title,
          alreadyMember: memberEmails.has(r.email.toLowerCase()),
        }))
        .sort((a, b) => {
          if (a.alreadyMember !== b.alreadyMember) return a.alreadyMember ? 1 : -1;
          return a.displayName.localeCompare(b.displayName);
        });
      const lastSyncedAt = (rows ?? [])
        .map((r: any) => r.last_synced_at as string)
        .sort()
        .pop() ?? null;
      return { entries, lastSyncedAt };
    },
  });

  return useMemo(
    () => ({
      entries: data?.entries ?? [],
      lastSyncedAt: data?.lastSyncedAt ?? null,
      loading: isLoading,
    }),
    [data, isLoading],
  );
}
