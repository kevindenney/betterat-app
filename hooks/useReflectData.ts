/**
 * useReflectData - Hook for fetching sailor's reflection/progress data
 *
 * Provides sailing statistics, race history, and performance metrics
 * for the Reflect tab (similar to Strava's "You" tab).
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

const logger = createLogger('useReflectData');

// =============================================================================
// TYPES
// =============================================================================

export interface SailingDay {
  date: string; // ISO date string (YYYY-MM-DD)
  type: 'race' | 'training' | 'leisure';
  count: number; // Number of activities that day
}

export interface MonthlyStats {
  month: string; // e.g., "January 2026"
  monthKey: string; // e.g., "2026-01"
  racesSailed: number;
  podiums: number; // 1st, 2nd, or 3rd place finishes
  timeOnWater: number; // Minutes
  averageFinish: number | null;
  bestFinish: number | null;
  comparedToLastMonth: {
    racesSailed: number; // Difference (+/-)
    podiums: number;
  };
}

export interface RaceLogEntry {
  id: string;
  regattaId: string;
  name: string;
  date: string;
  venueName: string | null;
  venueLocation: string | null;
  fleetSize: number;
  position: number | null;
  status: 'finished' | 'dnf' | 'dns' | 'dsq' | 'ocs' | 'ret' | 'upcoming';
  conditions: {
    windSpeed?: number;
    windDirection?: string;
  } | null;
  boatClass: string | null;
  isOwner: boolean;
}

export interface PerformanceTrend {
  week: string; // ISO week start date
  label: string; // e.g., "Jan 6"
  avgPosition: number | null;
  raceCount: number;
}

export interface RelativeEffort {
  weekStart: string;
  score: number; // 0-100 effort score
  raceCount: number;
  activities: {
    id: string;
    name: string;
    contribution: number;
  }[];
}

export interface ReflectData {
  // Weekly calendar data
  sailingDays: SailingDay[];

  // Monthly summary
  currentMonthStats: MonthlyStats;

  // Race log
  raceLog: RaceLogEntry[];

  // Performance trend (last 12 weeks)
  performanceTrend: PerformanceTrend[];

  // Relative effort
  relativeEffort: RelativeEffort[];

  // Aggregate stats
  stats: {
    totalRacesThisYear: number;
    totalPodiumsThisYear: number;
    totalTimeOnWaterThisYear: number; // Minutes
    racesThisMonth: number;
    currentStreak: number; // Consecutive weeks with racing
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useReflectData() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<ReflectData | null>(null);

  const userId = user?.id;

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const twelveWeeksAgo = new Date(now);
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

      // Fetch user's regattas
      const { data: regattas, error: regattasError } = await supabase
        .from('regattas')
        .select('*')
        .or(`created_by.eq.${userId}`)
        .gte('start_date', yearStart.toISOString())
        .order('start_date', { ascending: false })
        .limit(200);

      if (regattasError) throw regattasError;

      // Fetch race participants for this user
      const { data: participants, error: participantsError } = await supabase
        .from('race_participants')
        .select('regatta_id, finish_position, points_scored, status')
        .eq('user_id', userId)
        .neq('status', 'withdrawn');

      if (participantsError) {
        logger.warn('Unable to load race participants:', participantsError);
      }

      // Fetch timer sessions for time on water
      let sessions: { id: string; regatta_id?: string | null; race_id?: string | null; start_time: string; end_time?: string | null }[] | null = null;
      let sessionsError: any = null;
      const sessionsPrimary = await supabase
        .from('race_timer_sessions')
        .select('id, regatta_id, start_time, end_time')
        .eq('sailor_id', userId)
        .gte('start_time', yearStart.toISOString());
      sessions = sessionsPrimary.data as any;
      sessionsError = sessionsPrimary.error;

      if (sessionsError && isMissingIdColumn(sessionsError, 'race_timer_sessions', 'regatta_id')) {
        const sessionsFallback = await supabase
          .from('race_timer_sessions')
          .select('id, race_id, start_time, end_time')
          .eq('sailor_id', userId)
          .gte('start_time', yearStart.toISOString());
        sessions = (sessionsFallback.data as any[] | null)?.map((row: any) => ({
          id: row.id,
          regatta_id: row.race_id,
          race_id: row.race_id,
          start_time: row.start_time,
          end_time: row.end_time,
        })) || null;
        sessionsError = sessionsFallback.error;
      }

      if (sessionsError) {
        logger.warn('Unable to load timer sessions:', sessionsError);
      }

      // Build race log entries
      const raceLog: RaceLogEntry[] = (regattas || []).map((regatta: any) => {
        const participant = (participants || []).find(
          (p) => p.regatta_id === regatta.id
        );
        const raceDate = new Date(regatta.start_date);
        const isUpcoming = raceDate > now;

        return {
          id: regatta.id,
          regattaId: regatta.id,
          name: regatta.race_name || regatta.name || 'Untitled Race',
          date: regatta.start_date,
          venueName: regatta.metadata?.venue_name || regatta.venue_name || null,
          venueLocation: regatta.metadata?.location || null,
          fleetSize: regatta.metadata?.fleet_size || 0,
          position: participant?.finish_position || null,
          status: isUpcoming
            ? 'upcoming'
            : participant?.finish_position
              ? 'finished'
              : 'finished',
          conditions: regatta.metadata?.conditions || null,
          boatClass: regatta.metadata?.boat_class || null,
          isOwner: regatta.created_by === userId,
        };
      });

      // Build sailing days for calendar
      const sailingDaysMap = new Map<string, SailingDay>();
      (regattas || []).forEach((regatta: any) => {
        const dateKey = regatta.start_date?.split('T')[0];
        if (dateKey) {
          const existing = sailingDaysMap.get(dateKey);
          if (existing) {
            existing.count += 1;
          } else {
            sailingDaysMap.set(dateKey, {
              date: dateKey,
              type: 'race',
              count: 1,
            });
          }
        }
      });
      const sailingDays = Array.from(sailingDaysMap.values());

      // Calculate monthly stats
      const currentMonthRaces = raceLog.filter((r) => {
        const raceDate = new Date(r.date);
        return raceDate >= monthStart && raceDate <= now;
      });

      const lastMonthRaces = raceLog.filter((r) => {
        const raceDate = new Date(r.date);
        return raceDate >= lastMonthStart && raceDate <= lastMonthEnd;
      });

      const currentMonthPodiums = currentMonthRaces.filter(
        (r) => r.position && r.position <= 3
      ).length;
      const lastMonthPodiums = lastMonthRaces.filter(
        (r) => r.position && r.position <= 3
      ).length;

      const currentMonthPositions = currentMonthRaces
        .filter((r) => r.position)
        .map((r) => r.position!);
      const avgPosition =
        currentMonthPositions.length > 0
          ? currentMonthPositions.reduce((a, b) => a + b, 0) /
            currentMonthPositions.length
          : null;
      const bestPosition =
        currentMonthPositions.length > 0
          ? Math.min(...currentMonthPositions)
          : null;

      // Calculate time on water from sessions
      let totalTimeThisMonth = 0;
      let totalTimeThisYear = 0;
      (sessions || []).forEach((session: any) => {
        if (session.start_time && session.end_time) {
          const start = new Date(session.start_time);
          const end = new Date(session.end_time);
          const duration = (end.getTime() - start.getTime()) / 60000; // Minutes
          totalTimeThisYear += duration;
          if (start >= monthStart) {
            totalTimeThisMonth += duration;
          }
        }
      });

      const currentMonthStats: MonthlyStats = {
        month: getMonthName(now),
        monthKey: getMonthKey(now),
        racesSailed: currentMonthRaces.length,
        podiums: currentMonthPodiums,
        timeOnWater: Math.round(totalTimeThisMonth),
        averageFinish: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
        bestFinish: bestPosition,
        comparedToLastMonth: {
          racesSailed: currentMonthRaces.length - lastMonthRaces.length,
          podiums: currentMonthPodiums - lastMonthPodiums,
        },
      };

      // Calculate performance trend (weekly averages for last 12 weeks)
      const weeklyData = new Map<
        string,
        { positions: number[]; raceCount: number }
      >();
      raceLog
        .filter((r) => {
          const raceDate = new Date(r.date);
          return raceDate >= twelveWeeksAgo && raceDate <= now;
        })
        .forEach((race) => {
          const weekStart = getWeekStart(new Date(race.date));
          const existing = weeklyData.get(weekStart) || {
            positions: [],
            raceCount: 0,
          };
          existing.raceCount += 1;
          if (race.position) {
            existing.positions.push(race.position);
          }
          weeklyData.set(weekStart, existing);
        });

      // Generate all weeks for the last 12 weeks
      const performanceTrend: PerformanceTrend[] = [];
      const weekCursor = new Date(twelveWeeksAgo);
      while (weekCursor <= now) {
        const weekStart = getWeekStart(weekCursor);
        const weekData = weeklyData.get(weekStart);
        performanceTrend.push({
          week: weekStart,
          label: formatWeekLabel(weekStart),
          avgPosition:
            weekData && weekData.positions.length > 0
              ? Math.round(
                  (weekData.positions.reduce((a, b) => a + b, 0) /
                    weekData.positions.length) *
                    10
                ) / 10
              : null,
          raceCount: weekData?.raceCount || 0,
        });
        weekCursor.setDate(weekCursor.getDate() + 7);
      }

      // Calculate relative effort (simplified scoring)
      const relativeEffort: RelativeEffort[] = performanceTrend
        .slice(-4)
        .map((week) => ({
          weekStart: week.week,
          score: Math.min(100, week.raceCount * 25), // Simple scoring: 25 points per race
          raceCount: week.raceCount,
          activities: raceLog
            .filter((r) => getWeekStart(new Date(r.date)) === week.week)
            .map((r) => ({
              id: r.id,
              name: r.name,
              contribution: 25,
            })),
        }));

      // Calculate aggregate stats
      const totalRacesThisYear = raceLog.filter((r) => {
        const raceDate = new Date(r.date);
        return raceDate >= yearStart && raceDate <= now;
      }).length;

      const totalPodiumsThisYear = raceLog.filter((r) => {
        const raceDate = new Date(r.date);
        return (
          raceDate >= yearStart && raceDate <= now && r.position && r.position <= 3
        );
      }).length;

      // Calculate current streak (consecutive weeks with racing)
      let currentStreak = 0;
      for (let i = performanceTrend.length - 1; i >= 0; i--) {
        if (performanceTrend[i].raceCount > 0) {
          currentStreak++;
        } else {
          break;
        }
      }

      setData({
        sailingDays,
        currentMonthStats,
        raceLog,
        performanceTrend,
        relativeEffort,
        stats: {
          totalRacesThisYear,
          totalPodiumsThisYear,
          totalTimeOnWaterThisYear: Math.round(totalTimeThisYear),
          racesThisMonth: currentMonthRaces.length,
          currentStreak,
        },
      });
    } catch (err) {
      logger.error('Error loading reflect data:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refresh: loadData,
  };
}

// =============================================================================
// MOCK DATA HOOK (for demo purposes)
// =============================================================================

export function useReflectDataMock(): {
  data: ReflectData;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  const now = new Date();

  // Generate mock sailing days for the last 60 days
  const sailingDays: SailingDay[] = [];
  for (let i = 0; i < 60; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    // Random chance of having sailed that day
    if (Math.random() > 0.7) {
      sailingDays.push({
        date: date.toISOString().split('T')[0],
        type: Math.random() > 0.3 ? 'race' : 'training',
        count: Math.floor(Math.random() * 3) + 1,
      });
    }
  }

  // Generate mock performance trend
  const performanceTrend: PerformanceTrend[] = [];
  for (let i = 11; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - i * 7);
    const weekStart = getWeekStart(weekDate);
    const raceCount = Math.floor(Math.random() * 4);
    performanceTrend.push({
      week: weekStart,
      label: formatWeekLabel(weekStart),
      avgPosition: raceCount > 0 ? Math.floor(Math.random() * 10) + 1 : null,
      raceCount,
    });
  }

  // Generate mock race log
  const raceLog: RaceLogEntry[] = [
    {
      id: 'mock-1',
      regattaId: 'mock-1',
      name: 'RHKYC Winter Series Race 5',
      date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      venueName: 'Royal Hong Kong Yacht Club',
      venueLocation: 'Victoria Harbour',
      fleetSize: 24,
      position: 3,
      status: 'finished',
      conditions: { windSpeed: 12, windDirection: 'NE' },
      boatClass: 'J/80',
      isOwner: true,
    },
    {
      id: 'mock-2',
      regattaId: 'mock-2',
      name: 'Wednesday Night Racing',
      date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      venueName: 'Aberdeen Boat Club',
      venueLocation: 'Aberdeen',
      fleetSize: 18,
      position: 5,
      status: 'finished',
      conditions: { windSpeed: 8, windDirection: 'E' },
      boatClass: 'J/80',
      isOwner: false,
    },
    {
      id: 'mock-3',
      regattaId: 'mock-3',
      name: 'Around the Island Race',
      date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      venueName: 'RHKYC',
      venueLocation: 'Hong Kong Island',
      fleetSize: 45,
      position: 8,
      status: 'finished',
      conditions: { windSpeed: 15, windDirection: 'NW' },
      boatClass: 'IRC',
      isOwner: true,
    },
    {
      id: 'mock-4',
      regattaId: 'mock-4',
      name: 'Spring Regatta',
      date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      venueName: 'Hebe Haven Yacht Club',
      venueLocation: 'Sai Kung',
      fleetSize: 30,
      position: null,
      status: 'upcoming',
      conditions: null,
      boatClass: 'J/80',
      isOwner: true,
    },
  ];

  const mockData: ReflectData = {
    sailingDays,
    currentMonthStats: {
      month: getMonthName(now),
      monthKey: getMonthKey(now),
      racesSailed: 4,
      podiums: 1,
      timeOnWater: 480,
      averageFinish: 5.3,
      bestFinish: 3,
      comparedToLastMonth: {
        racesSailed: 2,
        podiums: 1,
      },
    },
    raceLog,
    performanceTrend,
    relativeEffort: performanceTrend.slice(-4).map((week) => ({
      weekStart: week.week,
      score: Math.min(100, week.raceCount * 25),
      raceCount: week.raceCount,
      activities: [],
    })),
    stats: {
      totalRacesThisYear: 12,
      totalPodiumsThisYear: 3,
      totalTimeOnWaterThisYear: 1920,
      racesThisMonth: 4,
      currentStreak: 3,
    },
  };

  return {
    data: mockData,
    loading: false,
    error: null,
    refresh: () => {},
  };
}
