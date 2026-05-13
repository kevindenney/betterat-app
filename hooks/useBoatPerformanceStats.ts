import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

interface BoatPerformanceStats {
  totalRaces: number;
  avgFinish: number | null;
  winRate: number | null;
  topThreeRate: number | null;
  avgDelta: number | null;
  lastRaceDate: string | null;
}

interface UseBoatPerformanceStatsParams {
  sailorId?: string;
  sailNumber?: string;
  className?: string;
}

const logger = createLogger('useBoatPerformanceStats');

export function useBoatPerformanceStats({
  sailorId,
  sailNumber,
  className,
}: UseBoatPerformanceStatsParams) {
  const [stats, setStats] = useState<BoatPerformanceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!sailorId) {
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('regatta_results')
        .select(
          'finish_position, total_boats, race_date, created_at',
          { count: 'exact' }
        )
        .eq('sailor_id', sailorId)
        .order('race_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (sailNumber) {
        query = query.eq('sail_number', sailNumber);
      } else if (className) {
        query = query.ilike('boat_class', `%${className}%`);
      }

      const { data, error: supabaseError } = await query;

      if (supabaseError) {
        throw supabaseError;
      }

      const results = (data || []).filter(
        (result) => typeof result.finish_position === 'number'
      ) as {
        finish_position: number;
        total_boats?: number | null;
        race_date?: string | null;
        created_at?: string | null;
      }[];

      const totalRaces = results.length;

      if (totalRaces === 0) {
        setStats({
          totalRaces: 0,
          avgFinish: null,
          winRate: null,
          topThreeRate: null,
          avgDelta: null,
          lastRaceDate: null,
        });
        return;
      }

      const finishSum = results.reduce(
        (sum, result) => sum + (result.finish_position || 0),
        0
      );

      const wins = results.filter((result) => result.finish_position === 1).length;
      const podiums = results.filter((result) => result.finish_position <= 3).length;

      const avgFinish =
        Math.round((finishSum / totalRaces) * 10) / 10;

      const winRate =
        Math.round(((wins / totalRaces) * 100) * 10) / 10;

      const topThreeRate =
        Math.round(((podiums / totalRaces) * 100) * 10) / 10;

      const lastFive = results.slice(0, 5);
      const prevFive = results.slice(5, 10);

      const lastFiveAvg = lastFive.length
        ? lastFive.reduce((sum, result) => sum + result.finish_position, 0) /
          lastFive.length
        : null;

      const prevFiveAvg = prevFive.length
        ? prevFive.reduce((sum, result) => sum + result.finish_position, 0) /
          prevFive.length
        : null;

      const avgDelta =
        lastFiveAvg !== null && prevFiveAvg !== null
          ? Math.round((prevFiveAvg - lastFiveAvg) * 10) / 10
          : null;

      const lastRaceDate = results[0]?.race_date || results[0]?.created_at || null;

      setStats({
        totalRaces,
        avgFinish,
        winRate,
        topThreeRate,
        avgDelta,
        lastRaceDate,
      });
    } catch (err: any) {
      logger.error('[useBoatPerformanceStats] Failed to load stats', err);
      setError(err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [sailorId, sailNumber, className]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

export type { BoatPerformanceStats };
