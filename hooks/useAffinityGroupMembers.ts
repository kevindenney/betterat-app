/**
 * useAffinityGroupMembers — given a set of affinity_group ids, return
 * the union of their active member user_ids.
 *
 * Used by Atlas's chip-row contextual groups: when one or more group
 * sub-chips are active, peer pins are filtered to step authors that
 * appear in this set. Empty input → null (caller treats as "no group
 * filter active, show all peers"). Empty result → empty Set (filter
 * active but no matches).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

interface GroupMemberRow {
  user_id: string;
}

async function fetchGroupMembers(groupIds: string[]): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('affinity_group_members')
    .select('user_id')
    .in('group_id', groupIds)
    .eq('status', 'active');

  if (error) throw error;
  const ids = (data as GroupMemberRow[] | null)?.map((r) => r.user_id) ?? [];
  return new Set(ids);
}

export function useAffinityGroupMembers(groupIds: string[]): Set<string> | null {
  const key = [...groupIds].sort().join(',');
  const { data } = useQuery({
    queryKey: ['affinity-group-members', key],
    queryFn: () => fetchGroupMembers(groupIds),
    enabled: groupIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  if (groupIds.length === 0) return null;
  return data ?? new Set();
}
