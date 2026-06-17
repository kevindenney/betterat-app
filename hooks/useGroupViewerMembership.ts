import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

/**
 * useGroupViewerMembership — the viewer's membership in one affinity
 * group, for the group detail page (member vs non-member branching +
 * join/leave state). Sibling of useOrgViewerMembership.
 *
 * `null` once resolved means non-member. Affinity groups are open-join,
 * so the only meaningful member state is 'active'; role distinguishes
 * member vs leader/coach (the latter set by a future admin roster flow).
 *
 * RLS gotcha: affinity_group_members SELECT is gated by
 * is_active_group_member, so a non-member's own (absent) row simply
 * returns nothing — exactly the null we want.
 */

export interface GroupViewerMembership {
  role: string;
  status: string;
  isMember: boolean;
}

export function useGroupViewerMembership(groupId: string | undefined): {
  membership: GroupViewerMembership | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading, refetch } = useQuery<GroupViewerMembership | null>({
    queryKey: ['group-viewer-membership', groupId, userId],
    enabled: !!groupId && !!userId,
    queryFn: async () => {
      const { data: row } = await supabase
        .from('affinity_group_members')
        .select('role, status')
        .eq('user_id', userId as string)
        .eq('group_id', groupId as string)
        .maybeSingle();
      if (!row) return null;
      const r = row as { role: string | null; status: string | null };
      const status = r.status ?? 'active';
      return {
        role: r.role ?? 'member',
        status,
        isMember: status === 'active',
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
