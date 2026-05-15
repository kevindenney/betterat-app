# Reflect Data Wiring Commit 1 Spec: Log Adapter

## Files

Add:

- `lib/reflect/mapReflectLog.ts`
- `services/ReflectLogService.ts`
- `hooks/useReflectLog.ts`
- `lib/reflect/__tests__/mapReflectLog.test.ts`

## Types

```ts
import type { Ionicons } from '@expo/vector-icons';
import type { RaceLogEntry } from '@/hooks/useReflectData';
import type {
  RaceLogFilterChip,
  RaceLogSeason,
  RaceLogEntryItem,
} from '@/components/ios-register/RaceLogScreen';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { InterestEventConfig } from '@/types/interestEventConfig';

export type ReflectLogSourceKind = 'sailing' | 'timeline';

export interface ReflectLogEmptyStateCopy {
  glyph: keyof typeof Ionicons.glyphMap;
  headline: string;
  supportingText: string;
  primaryActionLabel: string;
}

export interface ReflectLogMappedData {
  sourceKind: ReflectLogSourceKind;
  seasons: RaceLogSeason[];
  filterChips: RaceLogFilterChip[];
  feedFootHint?: string;
  emptyState: ReflectLogEmptyStateCopy;
}

export interface ReflectLogMapperInput {
  interestSlug: string;
  eventConfig: InterestEventConfig;
  now?: Date;
}
```

## Mapper Code

Add `lib/reflect/mapReflectLog.ts`:

```ts
import type { Ionicons } from '@expo/vector-icons';
import type { RaceLogEntry } from '@/hooks/useReflectData';
import type {
  RaceLogEntryItem,
  RaceLogFilterChip,
  RaceLogSeason,
} from '@/components/ios-register/RaceLogScreen';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { InterestEventConfig } from '@/types/interestEventConfig';

export type ReflectLogSourceKind = 'sailing' | 'timeline';

export interface ReflectLogEmptyStateCopy {
  glyph: keyof typeof Ionicons.glyphMap;
  headline: string;
  supportingText: string;
  primaryActionLabel: string;
}

export interface ReflectLogMappedData {
  sourceKind: ReflectLogSourceKind;
  seasons: RaceLogSeason[];
  filterChips: RaceLogFilterChip[];
  feedFootHint?: string;
  emptyState: ReflectLogEmptyStateCopy;
}

export interface ReflectLogMapperInput {
  interestSlug: string;
  eventConfig: InterestEventConfig;
  now?: Date;
}

const SAILING_SLUGS = new Set(['sail-racing', 'sailing']);

export function isSailingReflectLog(interestSlug: string | undefined): boolean {
  return SAILING_SLUGS.has(interestSlug ?? '');
}

export function mapRaceLogEntriesToSeasons(
  entries: RaceLogEntry[],
  input: ReflectLogMapperInput,
): ReflectLogMappedData {
  const now = input.now ?? new Date();
  const grouped = groupBySeason(
    [...entries].sort((a, b) => dateValue(b.date) - dateValue(a.date)),
    (entry) => entry.date,
  );
  const seasons = grouped.map(([seasonId, seasonEntries], seasonIndex) => {
    const chronological = [...seasonEntries].sort((a, b) => dateValue(a.date) - dateValue(b.date));
    const mappedEntries = chronological.map((entry, index) => mapRaceEntry(entry, index, now));
    return {
      id: seasonId,
      name: seasonNameFromId(seasonId),
      summary: summarizeSeason(mappedEntries, 'race'),
      defaultCollapsed: seasonIndex > 0,
      entries: mappedEntries,
    };
  });

  return {
    sourceKind: 'sailing',
    seasons,
    filterChips: buildFilterChips(inferSailingScope(entries)),
    feedFootHint: buildFeedFootHint(seasons),
    emptyState: {
      glyph: 'boat-outline',
      headline: 'No races yet',
      supportingText: "Add a race to start your season arc. Logged races appear here once you've debriefed them.",
      primaryActionLabel: 'Add a race',
    },
  };
}

export function mapTimelineStepsToLogSeasons(
  steps: TimelineStepRecord[],
  input: ReflectLogMapperInput,
): ReflectLogMappedData {
  const isNursing = input.interestSlug === 'nursing';
  const grouped = groupBySeason(
    [...steps].sort((a, b) => dateValue(sourceDateForStep(b)) - dateValue(sourceDateForStep(a))),
    sourceDateForStep,
  );
  const seasons = grouped.map(([seasonId, seasonSteps], seasonIndex) => {
    const chronological = [...seasonSteps].sort((a, b) => dateValue(sourceDateForStep(a)) - dateValue(sourceDateForStep(b)));
    const mappedEntries = chronological.map((step, index) =>
      mapTimelineStepEntry(step, index, input.eventConfig, isNursing),
    );
    return {
      id: seasonId,
      name: seasonNameFromId(seasonId),
      summary: summarizeSeason(mappedEntries, isNursing ? 'shift' : 'activity'),
      defaultCollapsed: seasonIndex > 0,
      entries: mappedEntries,
    };
  });

  return {
    sourceKind: 'timeline',
    seasons,
    filterChips: buildFilterChips(isNursing ? 'Clinical · Nursing' : input.eventConfig.eventNoun),
    feedFootHint: buildFeedFootHint(seasons),
    emptyState: isNursing
      ? {
          glyph: 'medkit-outline',
          headline: 'No shifts yet',
          supportingText: 'Add a shift to start your clinical archive. Completed shifts appear here once you debrief them.',
          primaryActionLabel: 'Add a shift',
        }
      : {
          glyph: 'calendar-outline',
          headline: 'No activities yet',
          supportingText: 'Add an activity to start your archive. Completed work appears here once you reflect on it.',
          primaryActionLabel: `Add ${input.eventConfig.eventNoun.toLowerCase()}`,
        },
  };
}

function mapRaceEntry(entry: RaceLogEntry, index: number, now: Date): RaceLogEntryItem {
  const raceDate = new Date(entry.date);
  const isToday = raceDate.toDateString() === now.toDateString();
  const planned = raceDate > now;
  return {
    id: entry.id,
    num: ordinal(index),
    name: entry.name || 'Untitled Race',
    dateLabel: formatDateLabel(entry.date, now),
    conditionsLabel: raceConditionsLabel(entry),
    status: isToday ? 'current' : planned ? 'planned' : 'debriefed',
    trailing: planned ? { notStarted: true } : undefined,
    conceptDots: [],
  };
}

function mapTimelineStepEntry(
  step: TimelineStepRecord,
  index: number,
  eventConfig: InterestEventConfig,
  isNursing: boolean,
): RaceLogEntryItem {
  const status = step.status === 'completed'
    ? 'debriefed'
    : step.status === 'in_progress'
      ? 'current'
      : 'planned';
  return {
    id: step.id,
    num: ordinal(index),
    name: step.title || eventConfig.eventNoun,
    dateLabel: formatDateLabel(sourceDateForStep(step), new Date()),
    conditionsLabel: timelineConditionsLabel(step),
    status,
    trailing: status === 'planned'
      ? { notStarted: true }
      : status === 'current'
        ? { plan: isNursing ? 'shift in progress' : `${eventConfig.eventNoun.toLowerCase()} in progress` }
        : undefined,
    conceptDots: [],
  };
}

function buildFilterChips(scopeLabel: string): RaceLogFilterChip[] {
  return [
    { id: 'all', label: 'All', active: true },
    { id: 'this-year', label: 'This year' },
    { id: 'scope', label: scopeLabel },
    { id: 'season-picker', label: 'Season', picker: true, icon: 'calendar' },
  ];
}

function groupBySeason<T>(items: T[], getDate: (item: T) => string | null | undefined): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const id = seasonIdForDate(getDate(item));
    const list = groups.get(id) ?? [];
    list.push(item);
    groups.set(id, list);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function seasonIdForDate(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  if (month <= 1) return `winter-${year - 1}-${year}`;
  if (month === 11) return `winter-${year}-${year + 1}`;
  if (month >= 2 && month <= 4) return `spring-${year}`;
  if (month >= 5 && month <= 7) return `summer-${year}`;
  return `autumn-${year}`;
}

function seasonNameFromId(id: string): string {
  const [season, a, b] = id.split('-');
  const label = season.charAt(0).toUpperCase() + season.slice(1);
  return b ? `${label} ${a}–${b}` : `${label} ${a}`;
}

function summarizeSeason(entries: RaceLogEntryItem[], noun: 'race' | 'shift' | 'activity'): string {
  const done = entries.filter((entry) => entry.status === 'debriefed').length;
  const total = entries.length;
  return `${total} ${total === 1 ? noun : `${noun}s`} · ${done} debriefed`;
}

function buildFeedFootHint(seasons: RaceLogSeason[]): string | undefined {
  if (seasons.length <= 2) return undefined;
  return `${seasons.slice(2).map((season) => season.name).join(', ')} — continues below`;
}

function inferSailingScope(entries: RaceLogEntry[]): string {
  const boatClass = entries.find((entry) => entry.boatClass)?.boatClass;
  const location = entries.find((entry) => entry.venueLocation)?.venueLocation;
  if (boatClass && location) return `${boatClass} · ${location}`;
  return boatClass || location || 'Sail racing';
}

function raceConditionsLabel(entry: RaceLogEntry): string | undefined {
  if (entry.conditions?.windDirection && entry.conditions?.windSpeed) {
    return `${entry.conditions.windDirection} · ${entry.conditions.windSpeed} kn`;
  }
  return entry.venueName || entry.venueLocation || undefined;
}

function timelineConditionsLabel(step: TimelineStepRecord): string | undefined {
  const plan = typeof step.metadata?.plan === 'object' && step.metadata.plan
    ? step.metadata.plan as Record<string, unknown>
    : {};
  return step.location_name || stringValue(plan.where_location) || stringValue(plan.duration) || step.category || undefined;
}

function sourceDateForStep(step: TimelineStepRecord): string {
  return step.starts_at || step.completed_at || step.due_at || step.created_at;
}

function dateValue(value: string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

function formatDateLabel(value: string | null | undefined, now: Date): string {
  if (!value) return 'No date';
  const date = new Date(value);
  if (date.toDateString() === now.toDateString()) return 'Today';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ordinal(index: number): string {
  return String(index + 1).padStart(2, '0');
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}
```

## Service Code

Add `services/ReflectLogService.ts`:

```ts
import { supabase } from '@/services/supabase';
import { getUserTimeline } from '@/services/TimelineStepService';
import type { RaceLogEntry } from '@/hooks/useReflectData';
import type { TimelineStepRecord } from '@/types/timeline-steps';

const RACE_STATUSES = new Set(['finished', 'dnf', 'dns', 'dsq', 'ocs', 'ret']);

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
  const now = new Date();

  return (regattas ?? []).map((regatta: any): RaceLogEntry => {
    const participant = participantByRegatta.get(regatta.id);
    const startDate = regatta.start_date ?? regatta.date ?? regatta.created_at;
    const isUpcoming = new Date(startDate) > now;
    const participantStatus = String(participant?.status ?? '');
    const status = isUpcoming
      ? 'upcoming'
      : RACE_STATUSES.has(participantStatus)
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

This service intentionally does not call `useReflectData()`: that hook is progress-view shaped and current-year-limited. The iOS-register Race Log is an archive surface.

## Hook Code

Add `hooks/useReflectLog.ts`:

```ts
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
```

## Tests

Add `lib/reflect/__tests__/mapReflectLog.test.ts`:

```ts
import {
  mapRaceLogEntriesToSeasons,
  mapTimelineStepsToLogSeasons,
} from '../mapReflectLog';
import type { RaceLogEntry } from '@/hooks/useReflectData';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import { NURSING_EVENT_CONFIG } from '@/configs/nursing';
import { SAILING_EVENT_CONFIG } from '@/configs/sailing';

const now = new Date('2026-05-15T12:00:00Z');

it('maps sailing entries without preview fixture copy', () => {
  const entries: RaceLogEntry[] = [{
    id: 'r1',
    regattaId: 'r1',
    name: 'Real Club Race',
    date: '2026-01-18T09:00:00Z',
    venueName: 'RHKYC',
    venueLocation: 'Hong Kong',
    fleetSize: 12,
    position: 4,
    status: 'finished',
    conditions: { windDirection: 'NE', windSpeed: 12 },
    boatClass: 'Dragon',
    isOwner: true,
  }];
  const result = mapRaceLogEntriesToSeasons(entries, {
    interestSlug: 'sail-racing',
    eventConfig: SAILING_EVENT_CONFIG,
    now,
  });
  expect(result.seasons[0].entries[0].name).toBe('Real Club Race');
  expect(result.filterChips.map((chip) => chip.label)).toContain('Dragon · Hong Kong');
});

it('maps nursing timeline steps to Shift Log rows', () => {
  const steps = [{
    id: 's1',
    user_id: 'u1',
    interest_id: 'nursing',
    organization_id: null,
    program_session_id: null,
    source_type: 'manual',
    source_id: null,
    title: 'Med-surg shift',
    description: null,
    category: 'clinical_shift',
    status: 'completed',
    starts_at: '2026-03-03T08:00:00Z',
    ends_at: null,
    location_name: 'Sibley',
    location_lat: null,
    location_lng: null,
    location_place_id: null,
    visibility: 'followers',
    share_approximate_location: false,
    copied_from_user_id: null,
    source_blueprint_id: null,
    sort_order: 0,
    metadata: {},
    collaborator_user_ids: [],
    completed_at: '2026-03-03T16:00:00Z',
    due_at: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-03T16:00:00Z',
  }] satisfies TimelineStepRecord[];

  const result = mapTimelineStepsToLogSeasons(steps, {
    interestSlug: 'nursing',
    eventConfig: NURSING_EVENT_CONFIG,
    now,
  });

  expect(result.emptyState.headline).toBe('No shifts yet');
  expect(result.seasons[0].summary).toBe('1 shift · 1 debriefed');
  expect(result.seasons[0].entries[0]).toMatchObject({
    name: 'Med-surg shift',
    status: 'debriefed',
    conditionsLabel: 'Sibley',
  });
});
```

## Performance Assertion

No mapper may issue network calls. Runtime is O(n log n) from sorting and grouping; 200 entries should map in under 10 ms locally.

The hook must not fetch both sailing and timeline data for the same active interest. Query `enabled` gates are part of the spec.

## Commit Message

```text
feat(redesign): add Reflect log real-data adapter

Add the production adapter for the iOS-register Reflect log segment.

- maps sailing Reflect race data into RaceLogScreen seasons
- maps non-sailing timeline_steps into Shift/Activity Log rows
- returns interest-aware filter chips and empty-state copy
- keeps preview fixtures isolated to preview routes
```
