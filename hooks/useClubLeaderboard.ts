/**
 * useClubLeaderboard - Hook for fetching club member leaderboard data
 *
 * Aggregates member activity data to show rankings within a club,
 * similar to Strava's club leaderboard feature.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { startOfMonth, format } from 'date-fns';

export interface ClubMemberRanking {
  userId: string;
  displayName: string;
  avatarEmoji?: string;
  avatarColor?: string;
  rank: number;
  raceCount: number;
  wins: number;
  podiums: number;
  points: number; // Weighted score for ranking
}

export interface ClubLeaderboardData {
  members: ClubMemberRanking[];
  totalMembers: number;
  totalRaces: number;
  totalWins: number;
  periodLabel: string;
}

/**
 * Calculate member points for ranking
 * Points system: 10 per race, 25 per podium, 50 per win
 */
function calculatePoints(raceCount: number, wins: number, podiums: number): number {
  return (raceCount * 10) + (wins * 50) + ((podiums - wins) * 25);
}

/**
 * Fetch club leaderboard data
 */
async function fetchClubLeaderboard(
  clubId: string,
  period: 'month' | 'season' | 'all' = 'season'
): Promise<ClubLeaderboardData> {
  // Determine date range based on period
  const now = new Date();
  let startDate: Date;
  let periodLabel: string;

  switch (period) {
    case 'month':
      startDate = startOfMonth(now);
      periodLabel = format(now, 'MMMM yyyy');
      break;
    case 'season':
      // Assume sailing season is April-October
      const currentMonth = now.getMonth();
      if (currentMonth >= 3 && currentMonth <= 9) {
        // In season
        startDate = new Date(now.getFullYear(), 3, 1); // April 1st
      } else {
        // Off season - show last season
        startDate = new Date(now.getFullYear() - 1, 3, 1);
      }
      periodLabel = 'This Season';
      break;
    case 'all':
    default:
      startDate = new Date(2000, 0, 1); // All time
      periodLabel = 'All Time';
      break;
  }

  // Get club members
  const { data: members, error: membersError } = await supabase
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId);

  if (membersError) {
    throw membersError;
  }

  if (!members || members.length === 0) {
    return {
      members: [],
      totalMembers: 0,
      totalRaces: 0,
      totalWins: 0,
      periodLabel,
    };
  }

  const memberIds = members.map((m: any) => m.user_id);

  // Get races for all members in the period
  const { data: regattas, error: regattasError } = await supabase
    .from('regattas')
    .select('id, created_by, result_position, fleet_size, start_date')
    .in('created_by', memberIds)
    .gte('start_date', startDate.toISOString())
    .lte('start_date', now.toISOString());

  if (regattasError) {
    throw regattasError;
  }

  // Aggregate stats per member
  const statsMap = new Map<string, { races: number; wins: number; podiums: number }>();

  memberIds.forEach((id) => {
    statsMap.set(id, { races: 0, wins: 0, podiums: 0 });
  });

  let totalRaces = 0;
  let totalWins = 0;

  for (const regatta of regattas || []) {
    const stats = statsMap.get(regatta.created_by);
    if (stats) {
      stats.races += 1;
      totalRaces += 1;

      if (regatta.result_position === 1) {
        stats.wins += 1;
        totalWins += 1;
      }

      if (regatta.result_position && regatta.result_position <= 3) {
        stats.podiums += 1;
      }
    }
  }

  // Get member profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', memberIds);

  const { data: sailorProfiles } = await supabase
    .from('sailor_profiles')
    .select('user_id, avatar_emoji, avatar_color')
    .in('user_id', memberIds);

  const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  const sailorProfilesMap = new Map(
    (sailorProfiles || []).map((sp: any) => [sp.user_id, sp])
  );

  // Build rankings
  const rankings: ClubMemberRanking[] = memberIds.map((userId) => {
    const stats = statsMap.get(userId) || { races: 0, wins: 0, podiums: 0 };
    const profile = profilesMap.get(userId);
    const sailorProfile = sailorProfilesMap.get(userId);

    return {
      userId,
      displayName: profile?.full_name || 'Sailor',
      avatarEmoji: sailorProfile?.avatar_emoji,
      avatarColor: sailorProfile?.avatar_color,
      rank: 0, // Will be set after sorting
      raceCount: stats.races,
      wins: stats.wins,
      podiums: stats.podiums,
      points: calculatePoints(stats.races, stats.wins, stats.podiums),
    };
  });

  // Sort by points (descending) and assign ranks
  rankings.sort((a, b) => b.points - a.points);
  rankings.forEach((member, index) => {
    member.rank = index + 1;
  });

  return {
    members: rankings,
    totalMembers: memberIds.length,
    totalRaces,
    totalWins,
    periodLabel,
  };
}

/**
 * Hook for fetching club leaderboard data
 */
export function useClubLeaderboard(
  clubId: string,
  period: 'month' | 'season' | 'all' = 'season'
) {
  return useQuery({
    queryKey: ['club-leaderboard', clubId, period],
    queryFn: () => fetchClubLeaderboard(clubId, period),
    enabled: !!clubId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
