/**
 * useFollowedPeopleForLibrary — hydrated people rows for the Library People zone.
 *
 * For each person the current user follows, returns:
 *   - display name + avatar initials/color
 *   - one-line role/affiliation (club name + boat where available)
 *   - last-activity line ("Settled Step 7 of X · this morning" /
 *     "Posted a debrief · 3 days ago")
 *   - mutual-signal badge (suggestions sent to you, mentor designation,
 *     shared plan count)
 *
 * Last-activity line is pulled from each followee's most recent
 * completed/in-progress timeline_step. If a followee has no visible
 * activity, we fall back to "Following since X" so the row still has
 * something to show.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { initialsOf } from '@/lib/utils/initials';

export interface FollowedPersonRow {
  userId: string;
  displayName: string;
  initials: string;
  avatarEmoji?: string;
  avatarColor?: string;
  role?: string;
  lastActivity?: string;
  pendingSuggestions: number;
}

function shortAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const secs = Math.max(0, (Date.now() - ts) / 1000);
  if (secs < 60) return 'just now';
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  const days = hrs / 24;
  if (days < 7) return `${Math.round(days)}d ago`;
  const weeks = days / 7;
  if (weeks < 5) return `${Math.round(weeks)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export function useFollowedPeopleForLibrary() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<FollowedPersonRow[]>({
    queryKey: ['library-people', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return [];

      // 1. who I follow
      const { data: follows, error: followsErr } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', userId);
      if (followsErr) throw followsErr;
      if (!follows || follows.length === 0) return [];

      const ids = (follows as { following_id: string }[]).map((r) => r.following_id);

      // 2. profiles (display name, email fallback)
      const { data: profiles } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', ids);
      const profileMap = new Map<string, { name: string }>(
        ((profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]).map(
          (p) => [p.id, { name: p.full_name || p.email || 'Unknown' }],
        ),
      );

      // 3. sailor profiles (avatar, club, location)
      const { data: sailors } = await supabase
        .from('sailor_profiles')
        .select('user_id, avatar_emoji, avatar_color, home_club, location')
        .in('user_id', ids);
      const sailorMap = new Map<
        string,
        {
          avatar_emoji?: string;
          avatar_color?: string;
          home_club?: string;
          location?: string;
        }
      >(
        ((sailors ?? []) as {
          user_id: string;
          avatar_emoji: string | null;
          avatar_color: string | null;
          home_club: string | null;
          location: string | null;
        }[]).map((s) => [
          s.user_id,
          {
            avatar_emoji: s.avatar_emoji ?? undefined,
            avatar_color: s.avatar_color ?? undefined,
            home_club: s.home_club ?? undefined,
            location: s.location ?? undefined,
          },
        ]),
      );

      // 4. most recent completed step per followee (for last-activity line)
      const { data: recentSteps } = await supabase
        .from('timeline_steps')
        .select('user_id, title, status, completed_at, updated_at')
        .in('user_id', ids)
        .in('status', ['completed', 'settled', 'in_progress'])
        .order('updated_at', { ascending: false })
        .limit(ids.length * 3);
      const lastByUser = new Map<
        string,
        { title: string; status: string; at: string }
      >();
      for (const r of (recentSteps ?? []) as {
        user_id: string;
        title: string;
        status: string;
        completed_at: string | null;
        updated_at: string | null;
      }[]) {
        if (lastByUser.has(r.user_id)) continue;
        lastByUser.set(r.user_id, {
          title: r.title,
          status: r.status,
          at: r.completed_at || r.updated_at || '',
        });
      }

      // 5. pending step suggestions from each followee → me
      const { data: sugRows } = await supabase
        .from('step_suggestions')
        .select('source_user_id')
        .eq('target_user_id', userId)
        .eq('status', 'pending')
        .in('source_user_id', ids);
      const sugCountByUser = new Map<string, number>();
      for (const s of (sugRows ?? []) as { source_user_id: string }[]) {
        sugCountByUser.set(s.source_user_id, (sugCountByUser.get(s.source_user_id) ?? 0) + 1);
      }

      return ids.map<FollowedPersonRow>((id) => {
        const profile = profileMap.get(id);
        const sailor = sailorMap.get(id);
        const last = lastByUser.get(id);
        const name = profile?.name || 'Unknown';
        const roleParts: string[] = [];
        if (sailor?.home_club) roleParts.push(sailor.home_club);
        if (sailor?.location) roleParts.push(sailor.location);

        let activity: string | undefined;
        if (last) {
          const verb =
            last.status === 'completed' || last.status === 'settled' ? 'Settled' : 'Working on';
          activity = `${verb} "${last.title}" · ${shortAgo(last.at)}`;
        }

        return {
          userId: id,
          displayName: name,
          initials: initialsOf(name),
          avatarEmoji: sailor?.avatar_emoji,
          avatarColor: sailor?.avatar_color,
          role: roleParts.length > 0 ? roleParts.join(' · ') : undefined,
          lastActivity: activity,
          pendingSuggestions: sugCountByUser.get(id) ?? 0,
        };
      });
    },
  });
}
