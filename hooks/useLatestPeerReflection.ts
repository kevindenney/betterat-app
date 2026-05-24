/**
 * useLatestPeerReflection — newest unread/read peer_reflection for a step,
 * with the source author's name + initials + avatar tint hydrated.
 *
 * Drives the lilac italic-serif quote on the step cover (Phase B of the v3
 * screen designs · The reflecting & suggesting system). Replaces the earlier
 * placeholder that pulled from useStepDiscussionPeek; peer_reflections is the
 * canonical source per the brief.
 *
 * Schema lives in migration 20260524220000_v3_peer_reflections_and_freeform_suggestions.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface LatestPeerReflection {
  id: string;
  body: string;
  createdAt: string;
  /** Relative time string like "this morning" / "2 days ago". */
  when: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorTint?: string;
}

interface ReflectionRow {
  id: string;
  source_user_id: string;
  body: string;
  created_at: string;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface SailorRow {
  user_id: string;
  avatar_color: string | null;
}

function whenLabel(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const hours = diffMs / 36e5;
  if (hours < 1) return 'just now';
  if (hours < 6) {
    const h = Math.max(1, Math.round(hours));
    return h === 1 ? 'this morning' : `${h}h ago`;
  }
  const days = hours / 24;
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return `${Math.floor(days)} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function initialsFor(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function useLatestPeerReflection(stepId: string | null | undefined) {
  return useQuery<LatestPeerReflection | null>({
    queryKey: ['latest-peer-reflection', stepId],
    enabled: Boolean(stepId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!stepId) return null;

      const { data: row, error } = await supabase
        .from('peer_reflections')
        .select('id, source_user_id, body, created_at')
        .eq('target_step_id', stepId)
        .in('status', ['unread', 'read'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !row) return null;
      const reflection = row as ReflectionRow;

      // Hydrate the author — same two-table pattern useInboxItems uses
      // (users for name/email, sailor_profiles for the tint).
      const [{ data: userRows }, { data: sailorRows }] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, email')
          .eq('id', reflection.source_user_id)
          .limit(1),
        supabase
          .from('sailor_profiles')
          .select('user_id, avatar_color')
          .eq('user_id', reflection.source_user_id)
          .limit(1),
      ]);

      const user = (userRows?.[0] as UserRow | undefined) ?? null;
      const sailor = (sailorRows?.[0] as SailorRow | undefined) ?? null;
      const authorName =
        user?.full_name?.trim() || user?.email?.split('@')[0] || 'A peer';

      return {
        id: reflection.id,
        body: reflection.body,
        createdAt: reflection.created_at,
        when: whenLabel(reflection.created_at),
        authorId: reflection.source_user_id,
        authorName,
        authorInitials: initialsFor(authorName, '·'),
        authorTint: sailor?.avatar_color ?? undefined,
      };
    },
  });
}
