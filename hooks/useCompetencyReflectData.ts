/**
 * useCompetencyReflectData — Filtering layer for the Reflect → Progress tab.
 *
 * Wraps useAllInterestCompetencies() and derives:
 *  - workingOn:      active competencies (learning/practicing/checkoff_ready) + step-linked
 *  - needsAttention: not_started or stalled (learning with no activity in 14+ days)
 *  - lastPracticed:  most recently practiced competency
 *  - actionableSummary: counts for the summary bar
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { supabase } from '@/services/supabase';
import {
  useAllInterestCompetencies,
  type UseAllInterestCompetenciesResult,
} from '@/hooks/useAllInterestCompetencies';
import type { CompetencyWithProgress } from '@/types/competency';

const STALE_DAYS = 14;
const RECENT_STEP_DAYS = 30;
const EMPTY_COMPETENCY_ID_SET = new Set<string>();

export type CompetencyReflectView = 'working_on' | 'all' | 'needs_attention';

export interface ActionableSummary {
  inProgress: number;
  checkoffReady: number;
  lastPracticedName: string | null;
  lastPracticedDaysAgo: number | null;
}

export interface UseCompetencyReflectDataResult extends UseAllInterestCompetenciesResult {
  allCompetencies: CompetencyWithProgress[];
  workingOn: CompetencyWithProgress[];
  needsAttention: CompetencyWithProgress[];
  lastPracticed: CompetencyWithProgress | null;
  actionableSummary: ActionableSummary;
  recentStepCompetencyIds: Set<string>;
  stepsLoading: boolean;
}

/** Fetch recent steps and extract their planned competency IDs */
function useRecentStepCompetencyIds() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const userId = user?.id;
  const interestId = currentInterest?.id;

  return useQuery({
    queryKey: ['recent-step-competency-ids', userId, interestId],
    queryFn: async (): Promise<Set<string>> => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RECENT_STEP_DAYS);

      const { data, error } = await supabase
        .from('timeline_steps')
        .select('metadata')
        .eq('user_id', userId!)
        .eq('interest_id', interestId!)
        .gte('created_at', cutoff.toISOString());

      if (error) {
        console.warn('[useCompetencyReflectData] Failed to fetch recent steps:', error.message);
        return new Set();
      }

      const ids = new Set<string>();
      for (const row of data ?? []) {
        const metadata =
          row && typeof row === 'object' && 'metadata' in row
            ? (row.metadata as Record<string, unknown> | null)
            : null;
        const plan =
          metadata && typeof metadata.plan === 'object'
            ? (metadata.plan as Record<string, unknown>)
            : null;
        const compIds = plan?.competency_ids;
        if (Array.isArray(compIds)) {
          for (const id of compIds) {
            if (typeof id === 'string') ids.add(id);
          }
        }
      }
      return ids;
    },
    enabled: Boolean(userId && interestId),
    staleTime: 1000 * 60 * 5,
  });
}

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const ACTIVE_STATUSES = new Set(['learning', 'practicing', 'checkoff_ready']);

export function useCompetencyReflectData(): UseCompetencyReflectDataResult {
  const base = useAllInterestCompetencies();
  const { data: recentIds, isLoading: stepsLoading } = useRecentStepCompetencyIds();
  const recentStepCompetencyIds = useMemo(
    () => recentIds ?? EMPTY_COMPETENCY_ID_SET,
    [recentIds],
  );

  // Flatten all competencies from all interests
  const allCompetencies = useMemo(() => {
    return base.data.flatMap((d) => d.competencies);
  }, [base.data]);

  // Working On: active status OR linked to a recent step
  const workingOn = useMemo(() => {
    return allCompetencies
      .filter((c) => {
        const status = c.progress?.status;
        if (status && ACTIVE_STATUSES.has(status)) return true;
        if (recentStepCompetencyIds.has(c.id)) return true;
        return false;
      })
      .sort((a, b) => {
        // Most recently practiced first
        const aDate = a.progress?.last_attempt_at ?? '';
        const bDate = b.progress?.last_attempt_at ?? '';
        return bDate.localeCompare(aDate);
      });
  }, [allCompetencies, recentStepCompetencyIds]);

  // Needs Attention: not_started OR stalled learning
  const needsAttention = useMemo(() => {
    const now = Date.now();
    const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;

    return allCompetencies.filter((c) => {
      const status = c.progress?.status ?? 'not_started';
      if (status === 'not_started') return true;
      if (status === 'learning') {
        const lastAt = c.progress?.last_attempt_at;
        if (!lastAt) return true; // learning with no attempt = stalled
        return now - new Date(lastAt).getTime() > staleMs;
      }
      return false;
    });
  }, [allCompetencies]);

  // Last practiced: competency with most recent last_attempt_at
  const lastPracticed = useMemo(() => {
    let best: CompetencyWithProgress | null = null;
    let bestDate = '';
    for (const c of allCompetencies) {
      const d = c.progress?.last_attempt_at;
      if (d && d > bestDate) {
        bestDate = d;
        best = c;
      }
    }
    return best;
  }, [allCompetencies]);

  // Summary stats
  const actionableSummary = useMemo<ActionableSummary>(() => {
    const byStatus = base.aggregate.byStatus;
    const inProgress =
      (byStatus.learning ?? 0) + (byStatus.practicing ?? 0) + (byStatus.checkoff_ready ?? 0);

    return {
      inProgress,
      checkoffReady: byStatus.checkoff_ready ?? 0,
      lastPracticedName: lastPracticed?.title ?? null,
      lastPracticedDaysAgo: daysAgo(lastPracticed?.progress?.last_attempt_at ?? null),
    };
  }, [base.aggregate.byStatus, lastPracticed]);

  return {
    ...base,
    allCompetencies,
    workingOn,
    needsAttention,
    lastPracticed,
    actionableSummary,
    recentStepCompetencyIds,
    stepsLoading,
  };
}
