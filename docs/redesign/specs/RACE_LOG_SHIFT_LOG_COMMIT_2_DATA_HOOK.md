# Race Log + Shift Log Commit 2 Spec: Data Hook

## Discrepancies

`useReflectData()` is sailing-specific and current-year-limited. It is acceptable for v1 Race Log wiring because it is already the Reflect tab's production data source, but a multi-season archive expansion remains a follow-up.

## Files

Add:

- `services/ReflectLogService.ts`
- `hooks/useReflectLog.ts`

Change:

- none outside exports/imports required by the new hook.

## Hook Signature

```ts
export interface UseReflectLogResult {
  seasons: RaceLogSeason[];
  filterChips: RaceLogFilterChip[];
  feedFootHint?: string;
  emptyState: ReflectLogEmptyStateCopy;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  sourceKind: 'sailing' | 'timeline';
}

export function useReflectLog(): UseReflectLogResult
```

## Service Functions

Add `services/ReflectLogService.ts`:

```ts
import { supabase } from '@/services/supabase';
import { getUserTimeline } from '@/services/TimelineStepService';
import type { RaceLogEntry } from '@/hooks/useReflectData';
import type { TimelineStepRecord } from '@/types/timeline-steps';

export async function getSailingReflectLogEntries(userId: string): Promise<RaceLogEntry[]> {
  const { data: participants, error: participantsError } = await supabase
    .from('race_participants')
    .select('regatta_id, finish_position, points_scored, status')
    .eq('user_id', userId)
    .neq('status', 'withdrawn');

  if (participantsError) throw participantsError;

  const participantRegattaIds = (participants ?? [])
    .map((participant: any) => participant.regatta_id)
    .filter(Boolean);
  const ownedOrParticipatedFilter = participantRegattaIds.length > 0
    ? `created_by.eq.${userId},id.in.(${participantRegattaIds.join(',')})`
    : `created_by.eq.${userId}`;

  const { data: regattas, error: regattasError } = await supabase
    .from('regattas')
    .select('*')
    .or(ownedOrParticipatedFilter)
    .order('start_date', { ascending: false })
    .limit(200);

  if (regattasError) throw regattasError;

  const participantByRegatta = new Map(
    (participants ?? []).map((participant: any) => [participant.regatta_id, participant]),
  );
  const raceStatuses = new Set(['finished', 'dnf', 'dns', 'dsq', 'ocs', 'ret']);
  const now = new Date();

  return (regattas ?? []).map((regatta: any): RaceLogEntry => {
    const participant = participantByRegatta.get(regatta.id);
    const startDate = regatta.start_date ?? regatta.date ?? regatta.created_at;
    const raceDate = new Date(startDate);
    const isUpcoming = raceDate > now;
    const participantStatus = String(participant?.status ?? '');
    const status = isUpcoming
      ? 'upcoming'
      : raceStatuses.has(participantStatus)
        ? participantStatus as RaceLogEntry['status']
        : 'finished';

    return {
      id: regatta.id,
      regattaId: regatta.id,
      name: regatta.race_name || regatta.name || 'Untitled Race',
      date: startDate,
      venueName: regatta.metadata?.venue_name || regatta.venue_name || null,
      venueLocation: regatta.metadata?.location || null,
      fleetSize: regatta.metadata?.fleet_size || 0,
      position: participant?.finish_position || null,
      status,
      conditions: regatta.metadata?.conditions || null,
      boatClass: regatta.metadata?.boat_class || null,
      isOwner: regatta.created_by === userId,
    };
  });
}

export async function getTimelineReflectLogSteps(
  userId: string,
  interestId: string,
): Promise<TimelineStepRecord[]> {
  return getUserTimeline(userId, interestId);
}
```

This service intentionally fetches all owned-or-participated regattas up to the existing 200-row cap, not just current-year rows. The iOS-register Race Log is an archive surface; limiting it to the current year repeats the old `useReflectData()` progress-view constraint.

## Hook Function Body

```ts
import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RaceLogFilterChip, RaceLogSeason } from '@/components/ios-register/RaceLogScreen';
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
} from '@/lib/reflect-log/mapReflectLog';

export interface UseReflectLogResult {
  seasons: RaceLogSeason[];
  filterChips: RaceLogFilterChip[];
  feedFootHint?: string;
  emptyState: ReflectLogEmptyStateCopy;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  sourceKind: 'sailing' | 'timeline';
}

const DEFAULT_EMPTY: ReflectLogEmptyStateCopy = {
  glyph: 'calendar-outline',
  headline: 'No activities yet',
  supportingText: 'Add an activity to start your archive. Completed work appears here once you reflect on it.',
  primaryActionLabel: 'Add activity',
};

export function useReflectLog(): UseReflectLogResult {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const eventConfig = useInterestEventConfig();
  const userId = user?.id;
  const interestSlug = currentInterest?.slug ?? 'sail-racing';
  const isSailing = isSailingReflectLog(interestSlug);

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

  const mapped = useMemo(() => {
    if (isSailing) {
      return mapRaceLogEntriesToSeasons(sailingQuery.data ?? [], {
        interestSlug,
        eventConfig,
      });
    }
    return mapTimelineStepsToLogSeasons(timelineQuery.data ?? [], {
      interestSlug,
      eventConfig,
    });
  }, [eventConfig, interestSlug, isSailing, sailingQuery.data, timelineQuery.data]);

  const refresh = useCallback(async () => {
    if (isSailing) {
      await sailingQuery.refetch();
      return;
    }
    await timelineQuery.refetch();
  }, [isSailing, sailingQuery, timelineQuery]);

  return {
    seasons: mapped?.seasons ?? [],
    filterChips: mapped?.filterChips ?? [],
    feedFootHint: mapped?.feedFootHint,
    emptyState: mapped?.emptyState ?? DEFAULT_EMPTY,
    loading: isSailing ? sailingQuery.isLoading : timelineQuery.isLoading,
    error: isSailing ? (sailingQuery.error ?? null) : (timelineQuery.error ?? null),
    refresh,
    sourceKind: isSailing ? 'sailing' : 'timeline',
  };
}
```

## Query Behavior

- Sailing path: performs two round-trips, `regattas` then `race_participants` scoped to returned regatta ids. It does not call `useReflectData()` because that hook fetches progress metrics and is current-year-limited.
- Timeline path: reuses `getUserTimeline(currentInterest.id)` under React Query and therefore performs the existing `timeline_steps` owned/collaborated/pinned fanout.
- Disabled path queries must not fire. Nursing must not fetch sailing regattas; sailing must not fetch all timeline steps.

## Empty-State Behavior

- If the query succeeds with zero rows, return `seasons: []` and interest-aware empty copy.
- If `currentInterest` is absent, fall back to sailing to match `useInterestEventConfig`.
- If the query is loading, return `seasons: []`, `loading: true`, and stable empty copy. The consumer decides whether to show the empty state or a loading affordance.
- If the query errors, return `error` and leave `seasons: []`; Commit 3 decides the UI treatment.

## N+1 Risk

Absent. The hook delegates to service-level batched queries and adds no row-by-row network calls. The current worst case is two sailing round-trips or the existing `getUserTimeline()` fanout.

## Performance Assertion

One active Reflect Log render must perform:

- Sailing: no more than 2 round-trips for the Race Log segment.
- Timeline: no more than the existing `getUserTimeline` fanout (own, collaborated, pinned).
- Mapping must stay local and deterministic; no Supabase calls inside `mapReflectLog`.

## Tests

Add a hook-level contract test only if the repo already has a stable React Query hook test harness available. Otherwise unit-test Commit 1's mapper and manually verify this hook through TypeScript and Reflect runtime.

Consumer scenarios:

- Sailing active: returns `sourceKind: 'sailing'` and maps `getSailingReflectLogEntries(userId)`.
- Nursing active: returns `sourceKind: 'timeline'` and maps `useMyTimeline(currentInterest.id)`.
- Nursing with no steps: returns `No shifts yet`.
- Generic interest with no steps: returns `No activities yet`.
- Query error: returns non-null `error` and empty seasons.

## Commit Message

```text
feat(redesign): add Reflect log data hook

Add useReflectLog as the production adapter for the iOS-register Reflect
log segment.

- sailing reads existing race-domain Reflect data
- nursing and other interests read timeline_steps through useMyTimeline
- adapter returns RaceLogScreen props with interest-aware chips and empty copy
- no preview fixtures are consumed in the production hook
```
