# Race Log + Shift Log Commit 1 Spec: Mappers

## Discrepancies

No schema migration is required. The existing sources are `RaceLogEntry` from `hooks/useReflectData.ts` and `TimelineStepRecord` from `types/timeline-steps.ts`.

## Files

Add:

- `lib/reflect-log/mapReflectLog.ts`
- `lib/reflect-log/__tests__/mapReflectLog.test.ts`

No UI files change in this commit.

## TypeScript

```ts
import type {
  RaceLogFilterChip,
  RaceLogSeason,
  RaceLogEntryItem,
} from '@/components/ios-register/RaceLogScreen';
import type { RaceLogEntry } from '@/hooks/useReflectData';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { InterestEventConfig } from '@/types/interestEventConfig';

export type ReflectLogSourceKind = 'sailing' | 'timeline';

export interface ReflectLogEmptyStateCopy {
  glyph: 'boat-outline' | 'medkit-outline' | 'calendar-outline';
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

## Function Bodies

```ts
const SAILING_SLUGS = new Set(['sail-racing', 'sailing']);

export function isSailingReflectLog(interestSlug: string | undefined): boolean {
  return SAILING_SLUGS.has(interestSlug ?? '');
}

export function mapRaceLogEntriesToSeasons(
  entries: RaceLogEntry[],
  input: ReflectLogMapperInput,
): ReflectLogMappedData {
  const now = input.now ?? new Date();
  const sorted = [...entries].sort((a, b) => dateValue(b.date) - dateValue(a.date));
  const grouped = groupBySeason(sorted, (entry) => entry.date);

  const seasons = grouped.map(([seasonId, seasonEntries], seasonIndex) => {
    const chronological = [...seasonEntries].sort((a, b) => dateValue(a.date) - dateValue(b.date));
    const mappedEntries = chronological.map((entry, index) =>
      mapRaceEntry(entry, index, now),
    );
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
    filterChips: buildFilterChips({
      interestSlug: input.interestSlug,
      eventConfig: input.eventConfig,
      scopeLabel: inferSailingScope(entries),
    }),
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
  const sorted = [...steps].sort((a, b) => dateValue(sourceDateForStep(b)) - dateValue(sourceDateForStep(a)));
  const grouped = groupBySeason(sorted, sourceDateForStep);
  const isNursing = input.interestSlug === 'nursing';

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
    filterChips: buildFilterChips({
      interestSlug: input.interestSlug,
      eventConfig: input.eventConfig,
      scopeLabel: isNursing ? 'Clinical · Nursing' : input.eventConfig.eventNoun,
    }),
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

function buildFilterChips({
  scopeLabel,
}: {
  interestSlug: string;
  eventConfig: InterestEventConfig;
  scopeLabel: string;
}): RaceLogFilterChip[] {
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
  const plural = total === 1 ? noun : `${noun}s`;
  return `${total} ${plural} · ${done} debriefed`;
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
  const metadata = step.metadata ?? {};
  const plan = typeof metadata.plan === 'object' && metadata.plan ? metadata.plan as Record<string, unknown> : {};
  return step.location_name
    || stringValue(plan.where_location)
    || stringValue(plan.duration)
    || step.category
    || undefined;
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

## Tests

Add Jest tests covering:

```ts
describe('reflect log mappers', () => {
  it('maps sailing entries into seasonal RaceLogScreen props');
  it('maps nursing completed timeline steps to debriefed shift rows');
  it('maps nursing in-progress timeline steps to current shift rows');
  it('returns nursing-specific empty-state copy for empty timelines');
  it('builds interest-aware scope chips instead of hard-coded Dragon/Hong Kong');
  it('collapses older seasons by default');
});
```

Use local inline fixtures. Do not import preview fixtures from `app/race-log-ios.tsx`.

## Performance Assertion

The mapper is O(n log n) from sorting and performs no network calls. It must handle 200 rows, matching `getUserTimeline`/`useReflectData` current limits, in under 10 ms in unit tests on local Node.

## Commit Message

```text
feat(redesign): add real-data mappers for Reflect log surfaces

Add pure mapping utilities that adapt sailing race entries and generic
timeline steps into the RaceLogScreen prop shape.

- maps sailing RaceLogEntry rows into season groups
- maps nursing timeline_steps into Shift Log rows
- produces interest-aware chips and empty-state copy
- leaves preview fixtures isolated to preview routes
```

