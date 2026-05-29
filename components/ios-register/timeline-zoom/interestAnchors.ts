/**
 * D6 — external anchor overlays for the timeline-zoom canvas.
 *
 * Anchors are non-user time pegs that shape *when* the work happens:
 * race calendars, semester boundaries, festival days, exam windows.
 * Sailors race when fleets race; nurses rotate when semesters run;
 * Indian-market entrepreneurs ship hardest in the days before a
 * festival. Surfacing these as overlays lets the L3 view name what
 * the season is bending around, without the user having to log it.
 *
 * Recurring anchors (month-day patterns) get auto-rolled to whichever
 * year falls inside the queried range; one-off anchors carry an
 * explicit YYYY-MM-DD. Persona-tuned: each interest carries its own
 * set, falling back to no overlays for personas we haven't tuned.
 *
 * v1 is hardcoded; D4 will replace with an `interest_anchors` table
 * so users / orgs can add their own. Until then the demo set covers
 * sailing (HK Dragon calendar + a few global anchors), nursing
 * (JHU academic + NCLEX windows), and Ranchi-class entrepreneurship
 * (Diwali + Holi + wedding season + GST quarterly).
 */

export type AnchorKind =
  | 'race'
  | 'exam'
  | 'festival'
  | 'semester'
  | 'season'
  | 'fiscal';

export interface InterestAnchor {
  /** Stable id so React keys stay sane across re-renders. */
  id: string;
  /** User-facing short label ("HKDW", "NCLEX", "Diwali"). */
  label: string;
  kind: AnchorKind;
  /** Either a recurring (MM-DD) pattern or an explicit YYYY-MM-DD. */
  pattern: { type: 'recurring'; monthDay: string } | { type: 'oneoff'; isoDate: string };
  /** Optional ISO end date for windowed anchors (race weeks, exam
   *  periods, semester runs). When set, the anchor "occupies" a span
   *  rather than a single day. */
  endMonthDay?: string;
  /** Optional sub-label rendered as a small italic role line. */
  detail?: string;
}

const SAILING_ANCHORS: InterestAnchor[] = [
  {
    id: 'sailing-hkdw',
    label: 'HKDW',
    kind: 'race',
    pattern: { type: 'recurring', monthDay: '03-05' },
    endMonthDay: '03-09',
    detail: 'Hong Kong Dragon Worlds week',
  },
  {
    id: 'sailing-frostbite',
    label: 'Frostbite',
    kind: 'season',
    pattern: { type: 'recurring', monthDay: '12-01' },
    endMonthDay: '02-28',
    detail: 'Winter series',
  },
  {
    id: 'sailing-spring-series',
    label: 'Spring Series',
    kind: 'race',
    pattern: { type: 'recurring', monthDay: '04-01' },
    endMonthDay: '05-15',
  },
  {
    id: 'sailing-easter-regatta',
    label: 'Easter Regatta',
    kind: 'race',
    pattern: { type: 'recurring', monthDay: '03-29' },
    endMonthDay: '04-01',
  },
  {
    id: 'sailing-autumn-regatta',
    label: 'Autumn Regatta',
    kind: 'race',
    pattern: { type: 'recurring', monthDay: '10-10' },
    endMonthDay: '10-12',
  },
  {
    id: 'sailing-typhoon-season',
    label: 'Typhoon season',
    kind: 'season',
    pattern: { type: 'recurring', monthDay: '06-01' },
    endMonthDay: '10-15',
    detail: 'HK reduced racing window',
  },
];

const NURSING_ANCHORS: InterestAnchor[] = [
  {
    id: 'nursing-spring-start',
    label: 'Spring semester',
    kind: 'semester',
    pattern: { type: 'recurring', monthDay: '01-22' },
    endMonthDay: '05-10',
  },
  {
    id: 'nursing-summer-break',
    label: 'Summer break',
    kind: 'semester',
    pattern: { type: 'recurring', monthDay: '05-15' },
    endMonthDay: '08-25',
  },
  {
    id: 'nursing-fall-start',
    label: 'Fall semester',
    kind: 'semester',
    pattern: { type: 'recurring', monthDay: '08-26' },
    endMonthDay: '12-15',
  },
  {
    id: 'nursing-ati-fall',
    label: 'ATI window',
    kind: 'exam',
    pattern: { type: 'recurring', monthDay: '11-05' },
    endMonthDay: '11-20',
    detail: 'Comprehensive predictor',
  },
  {
    id: 'nursing-nclex-window',
    label: 'NCLEX window',
    kind: 'exam',
    pattern: { type: 'recurring', monthDay: '06-01' },
    endMonthDay: '08-31',
    detail: 'Open scheduling',
  },
  {
    id: 'nursing-capstone-defense',
    label: 'Capstone defense',
    kind: 'exam',
    pattern: { type: 'recurring', monthDay: '04-25' },
    detail: 'Final week of spring',
  },
];

const ENTREPRENEUR_ANCHORS: InterestAnchor[] = [
  {
    id: 'ent-diwali',
    label: 'Diwali',
    kind: 'festival',
    pattern: { type: 'recurring', monthDay: '11-01' },
    detail: 'Peak retail demand',
  },
  {
    id: 'ent-holi',
    label: 'Holi',
    kind: 'festival',
    pattern: { type: 'recurring', monthDay: '03-14' },
  },
  {
    id: 'ent-raksha-bandhan',
    label: 'Raksha Bandhan',
    kind: 'festival',
    pattern: { type: 'recurring', monthDay: '08-19' },
  },
  {
    id: 'ent-wedding-season',
    label: 'Wedding season',
    kind: 'season',
    pattern: { type: 'recurring', monthDay: '11-15' },
    endMonthDay: '02-28',
    detail: 'Sustained orders',
  },
  {
    id: 'ent-gst-q1',
    label: 'GST Q1 filing',
    kind: 'fiscal',
    pattern: { type: 'recurring', monthDay: '07-20' },
  },
  {
    id: 'ent-gst-q3',
    label: 'GST Q3 filing',
    kind: 'fiscal',
    pattern: { type: 'recurring', monthDay: '01-20' },
  },
];

const ANCHORS_BY_VOCAB_ID: Record<string, InterestAnchor[]> = {
  sailing: SAILING_ANCHORS,
  nursing: NURSING_ANCHORS,
  entrepreneur: ENTREPRENEUR_ANCHORS,
};

/** Resolved anchor — recurring patterns roll to the in-range year so
 *  callers can render a real ISO date + days-to. */
export interface ResolvedAnchor {
  id: string;
  label: string;
  kind: AnchorKind;
  startISO: string;
  endISO?: string;
  detail?: string;
  /** Days from `referenceISO` (negative = past). */
  daysAway: number;
}

function parseISO(iso: string): Date | null {
  // Accept YYYY-MM-DD strictly; treat as UTC midnight so date math
  // doesn't drift across the local timezone of the renderer.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

function rollMonthDayIntoRange(
  monthDay: string,
  rangeStart: Date,
  rangeEnd: Date,
): Date | null {
  const m = /^(\d{2})-(\d{2})$/.exec(monthDay);
  if (!m) return null;
  const month = Number(m[1]) - 1;
  const day = Number(m[2]);
  // Try every year that the range spans, plus the year after rangeEnd
  // to cover wrap-around windows like Nov → Feb.
  const startYear = rangeStart.getUTCFullYear();
  const endYear = rangeEnd.getUTCFullYear() + 1;
  for (let y = startYear; y <= endYear; y++) {
    const candidate = new Date(Date.UTC(y, month, day));
    if (candidate >= rangeStart && candidate <= rangeEnd) return candidate;
  }
  return null;
}

/**
 * Return persona anchors that fall inside [startISO, endISO], with
 * recurring patterns rolled to whichever year keeps them in-window.
 * Sorted by start date ascending. Returns [] for personas without
 * configured anchors or when the range is invalid.
 *
 * `referenceISO` defaults to today; drives the `daysAway` calculation
 * the L3 strip uses for "in 12 weeks" copy.
 */
export function getAnchorsForRange(
  vocabId: string,
  startISO: string | undefined,
  endISO: string | undefined,
  referenceISO?: string,
): ResolvedAnchor[] {
  const pool = ANCHORS_BY_VOCAB_ID[vocabId];
  if (!pool || !startISO || !endISO) return [];
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (!start || !end || start >= end) return [];
  const ref = referenceISO ? parseISO(referenceISO) ?? new Date() : new Date();
  const refUTC = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));

  const resolved: ResolvedAnchor[] = [];
  for (const anchor of pool) {
    let anchorStart: Date | null = null;
    if (anchor.pattern.type === 'oneoff') {
      anchorStart = parseISO(anchor.pattern.isoDate);
    } else {
      anchorStart = rollMonthDayIntoRange(anchor.pattern.monthDay, start, end);
    }
    if (!anchorStart) continue;
    let anchorEnd: Date | undefined;
    if (anchor.endMonthDay) {
      // End wraps when its month-day is earlier in the calendar than the
      // start's month-day (e.g. wedding season Nov 15 → Feb 28).
      const sameYearEnd = new Date(
        Date.UTC(
          anchorStart.getUTCFullYear(),
          Number(anchor.endMonthDay.split('-')[0]) - 1,
          Number(anchor.endMonthDay.split('-')[1]),
        ),
      );
      anchorEnd =
        sameYearEnd >= anchorStart
          ? sameYearEnd
          : new Date(
              Date.UTC(
                anchorStart.getUTCFullYear() + 1,
                Number(anchor.endMonthDay.split('-')[0]) - 1,
                Number(anchor.endMonthDay.split('-')[1]),
              ),
            );
    }
    resolved.push({
      id: anchor.id,
      label: anchor.label,
      kind: anchor.kind,
      startISO: anchorStart.toISOString().slice(0, 10),
      endISO: anchorEnd?.toISOString().slice(0, 10),
      detail: anchor.detail,
      daysAway: diffDays(anchorStart, refUTC),
    });
  }
  resolved.sort((a, b) => (a.startISO < b.startISO ? -1 : a.startISO > b.startISO ? 1 : 0));
  return resolved;
}

/** Persona-aware icon name (Ionicons) for an anchor kind — keeps the
 *  L3 strip readable at a glance without leaning on color alone. */
export function anchorIconName(kind: AnchorKind): string {
  switch (kind) {
    case 'race':
      return 'trophy-outline';
    case 'exam':
      return 'school-outline';
    case 'festival':
      return 'sparkles-outline';
    case 'semester':
      return 'calendar-outline';
    case 'season':
      return 'partly-sunny-outline';
    case 'fiscal':
      return 'document-text-outline';
  }
}
