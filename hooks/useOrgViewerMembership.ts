import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { isAdminRole } from '@/hooks/useMyOrgs';

/**
 * useOrgViewerMembership — the viewer's membership in one organization,
 * for the org detail page (member vs non-member branching + join state).
 *
 * `null` once resolved means non-member. Active members get
 * `status: 'active'`; pending/rejected requests carry their status so
 * the page can show "Request pending" / "request again" affordances.
 *
 * Gotchas baked in:
 *  - prefer `membership_status` over the legacy `status` column (they
 *    can diverge); the domain is pending|active|rejected only.
 *  - admin is `owner|admin|manager` (isAdminRole), matching the rest of
 *    the app — the client flag is presentation-only; admin actions are
 *    RLS-gated server-side regardless.
 *  - no auth.users embed here — that FK is cross-schema and silently
 *    returns 0 rows.
 */

export interface ViewerMembership {
  role: string | null;
  status: string;
  isAdmin: boolean;
}

export function useOrgViewerMembership(orgId: string | undefined): {
  membership: ViewerMembership | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading, refetch } = useQuery<ViewerMembership | null>({
    queryKey: ['org-viewer-membership', orgId, userId],
    enabled: !!orgId && !!userId,
    queryFn: async () => {
      const { data: row } = await supabase
        .from('organization_memberships')
        .select('role, membership_status, status')
        .eq('user_id', userId as string)
        .eq('organization_id', orgId as string)
        .maybeSingle();
      if (!row) return null;
      const r = row as { role: string | null; membership_status: string | null; status: string | null };
      const role = r.role ?? null;
      return {
        role,
        status: r.membership_status || r.status || 'pending',
        isAdmin: role ? isAdminRole(role) : false,
      };
    },
  });

  return {
    membership: data ?? null,
    isLoading,
    refetch: () => {
      void refetch();
    },
  };
}
