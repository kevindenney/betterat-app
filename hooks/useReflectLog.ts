import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useInterestEventConfig } from '@/hooks/useInterestEventConfig';
import {
  getSailingReflectLogEntries,
  getTimelineReflectLogSteps,
} from '@/services/ReflectLogService';
import {
  isSailingReflectLog,
  mapRaceLogEntriesToSeasons,
  mapTimelineStepsToLogSeasons,
  type ReflectLogEmptyStateCopy,
} from '@/lib/reflect/mapReflectLog';

export function useReflectLog() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const eventConfig = useInterestEventConfig();
  const interestSlug = currentInterest?.slug ?? 'sail-racing';
  const isSailing = isSailingReflectLog(interestSlug);
  const userId = user?.id;

  const sailingQuery = useQuery({
    queryKey: ['reflect-log', 'sailing', userId],
    queryFn: () => getSailingReflectLogEntries(userId!),
    enabled: Boolean(userId && isSailing),
    staleTime: 30_000,
  });

  const timelineQuery = useQuery({
    queryKey: ['reflect-log', 'timeline', userId, currentInterest?.id],
    queryFn: () => getTimelineReflectLogSteps(userId!, currentInterest!.id),
    enabled: Boolean(userId && !isSailing && currentInterest?.id),
    staleTime: 30_000,
  });

  const mapped = useMemo(() => (
    isSailing
      ? mapRaceLogEntriesToSeasons(sailingQuery.data ?? [], { interestSlug, eventConfig })
      : mapTimelineStepsToLogSeasons(timelineQuery.data ?? [], { interestSlug, eventConfig })
  ), [eventConfig, interestSlug, isSailing, sailingQuery.data, timelineQuery.data]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    if (isSailing) {
      await sailingQuery.refetch();
      return;
    }
    await timelineQuery.refetch();
  }, [isSailing, sailingQuery, timelineQuery, userId]);

  return {
    ...mapped,
    loading: isSailing ? sailingQuery.isLoading : timelineQuery.isLoading,
    error: isSailing ? sailingQuery.error ?? null : timelineQuery.error ?? null,
    refresh,
  };
}

export type UseReflectLogResult = ReturnType<typeof useReflectLog>;
export type { ReflectLogEmptyStateCopy };
