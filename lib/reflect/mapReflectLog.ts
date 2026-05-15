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

function groupBySeason<T>(items: T[], getDate: (item: T) => string | null | undefined): [string, T[]][] {
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
