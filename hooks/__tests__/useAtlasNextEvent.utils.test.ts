/**
 * Tests for the pure helpers in useAtlasNextEvent.utils. Locks in the
 * mapping shape, the venue-shape resilience (string vs jsonb), the
 * conditions-too-long guard, and the multi-source earliest-wins merge.
 */

import {
  buildConditions,
  formatWhen,
  mapRaceEventToNextEvent,
  mapRaceStepToNextEvent,
  mapRegattaToNextEvent,
  pickEarliest,
  readMetadataString,
  readVenue,
} from '@/hooks/useAtlasNextEvent.utils';

describe('useAtlasNextEvent.utils', () => {
  describe('readMetadataString', () => {
    it('returns undefined for null / non-object metadata', () => {
      expect(readMetadataString(null, 'wind')).toBeUndefined();
      expect(readMetadataString(undefined, 'wind')).toBeUndefined();
    });

    it('returns trimmed string when key holds a non-empty string', () => {
      expect(readMetadataString({ wind: '  12kn ESE  ' }, 'wind')).toBe('12kn ESE');
    });

    it('returns undefined when key holds empty / non-string / missing value', () => {
      expect(readMetadataString({ wind: '' }, 'wind')).toBeUndefined();
      expect(readMetadataString({ wind: '   ' }, 'wind')).toBeUndefined();
      expect(readMetadataString({ wind: 12 }, 'wind')).toBeUndefined();
      expect(readMetadataString({}, 'wind')).toBeUndefined();
    });
  });

  describe('readVenue', () => {
    it('handles string venues', () => {
      expect(readVenue('Victoria Harbour')).toBe('Victoria Harbour');
      expect(readVenue('  RHKYC  ')).toBe('RHKYC');
    });

    it('handles jsonb object venues with name field', () => {
      expect(readVenue({ name: 'Victoria Harbour' })).toBe('Victoria Harbour');
      expect(readVenue({ name: '  RHKYC  ' })).toBe('RHKYC');
    });

    it('returns undefined for empty / nullish / unsupported shapes', () => {
      expect(readVenue(null)).toBeUndefined();
      expect(readVenue(undefined)).toBeUndefined();
      expect(readVenue('')).toBeUndefined();
      expect(readVenue('   ')).toBeUndefined();
      expect(readVenue({ name: '' })).toBeUndefined();
      expect(readVenue({ name: 42 })).toBeUndefined();
      expect(readVenue({})).toBeUndefined();
      expect(readVenue(42)).toBeUndefined();
    });
  });

  describe('buildConditions', () => {
    it('joins wind + tide with the canonical separator', () => {
      expect(buildConditions({ wind: '12kn ESE', tide: 'ebb 0.4kn' })).toBe(
        '12kn ESE · ebb 0.4kn',
      );
    });

    it('falls back to *_summary keys when primary keys are absent', () => {
      expect(
        buildConditions({ wind_summary: '15kn N', tide_summary: 'flood 0.6kn' }),
      ).toBe('15kn N · flood 0.6kn');
    });

    it('returns just one part when only one is present', () => {
      expect(buildConditions({ wind: '10kn S' })).toBe('10kn S');
      expect(buildConditions({ tide: 'slack' })).toBe('slack');
    });

    it('drops parts that exceed the 24-char overlay budget', () => {
      // The tag's second line is small — overly long strings would
      // overflow. Reject them rather than truncate.
      const tooLong = 'gusting to 35 with williwaws';
      expect(buildConditions({ wind: tooLong })).toBeUndefined();
    });

    it('returns undefined when metadata is empty / missing', () => {
      expect(buildConditions(null)).toBeUndefined();
      expect(buildConditions(undefined)).toBeUndefined();
      expect(buildConditions({})).toBeUndefined();
    });
  });

  describe('formatWhen', () => {
    // Anchor "now" so the test is deterministic regardless of when it runs.
    const now = new Date('2026-05-22T12:00:00Z');

    it('returns undefined for invalid / missing input', () => {
      expect(formatWhen(undefined, now)).toBeUndefined();
      expect(formatWhen(null, now)).toBeUndefined();
      expect(formatWhen('not-a-date', now)).toBeUndefined();
    });

    it('renders "Today <time>" for same-day events', () => {
      // 6 hours from now in local time
      const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      const out = formatWhen(sixHoursLater.toISOString(), now);
      expect(out).toMatch(/^Today /);
    });

    it('renders "Tomorrow <time>" for next-day events', () => {
      const tomorrow = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const out = formatWhen(tomorrow.toISOString(), now);
      expect(out).toMatch(/^Tomorrow /);
    });

    it('renders weekday short for events within the week', () => {
      // 3 days out
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const out = formatWhen(threeDays.toISOString(), now);
      expect(out).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) /);
    });

    it('renders "Mon DD" for events more than 6 days out', () => {
      const fortnight = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const out = formatWhen(fortnight.toISOString(), now);
      expect(out).toMatch(/^[A-Z][a-z]{2} \d+ /);
    });

    it('uses "am/pm" without minutes for top-of-hour times', () => {
      // Build a date that hits a top-of-hour in local time.
      const today = new Date(now);
      today.setHours(10, 0, 0, 0);
      const out = formatWhen(today.toISOString(), now);
      expect(out).toMatch(/\d+(am|pm)$/);
    });

    it('renders 12 → "12pm" not "0pm" for noon', () => {
      const noon = new Date(now);
      noon.setHours(12, 0, 0, 0);
      const out = formatWhen(noon.toISOString(), noon);
      expect(out).toContain('12pm');
    });
  });

  describe('mapRegattaToNextEvent', () => {
    it('maps a full regatta row to an AtlasNextEvent', () => {
      const event = mapRegattaToNextEvent({
        id: 'r1',
        name: 'Easter Regatta',
        start_date: '2026-05-23T10:00:00Z',
        location: { name: 'Markermeer' },
        metadata: { wind: '12kn ESE', tide: 'ebb 0.4kn' },
      });
      expect(event).not.toBeNull();
      expect(event!.label).toBe('Easter Regatta');
      expect(event!.where).toBe('Markermeer');
      expect(event!.conditions).toBe('12kn ESE · ebb 0.4kn');
    });

    it('falls back to "Next race" when name is missing', () => {
      const event = mapRegattaToNextEvent({
        id: 'r1',
        name: null,
        start_date: '2026-06-01T10:00:00Z',
      });
      expect(event!.label).toBe('Next race');
    });

    it('falls back to metadata.venue_name when venue is empty', () => {
      const event = mapRegattaToNextEvent({
        id: 'r1',
        name: 'Race',
        start_date: '2026-06-01T10:00:00Z',
        location: null,
        metadata: { venue_name: 'Victoria Harbour' },
      });
      expect(event!.where).toBe('Victoria Harbour');
    });
  });

  describe('mapRaceEventToNextEvent', () => {
    it('reads from start_time (not start_date) and string venue', () => {
      const event = mapRaceEventToNextEvent({
        id: 're1',
        name: 'Wednesday night',
        start_time: '2026-05-27T18:30:00Z',
        location: 'Causeway Bay',
        metadata: null,
      });
      expect(event!.label).toBe('Wednesday night');
      expect(event!.where).toBe('Causeway Bay');
      expect(event!.conditions).toBeUndefined();
    });
  });

  describe('mapRaceStepToNextEvent', () => {
    it('carries race_plan.course_id and area_name from a race step', () => {
      const event = mapRaceStepToNextEvent({
        id: 's1',
        title: 'Race 4',
        starts_at: '2026-05-23T10:00:00Z',
        season_id: 'season-xyz',
        metadata: {
          race_plan: {
            course_id: 'course-abc',
            area_name: 'Victoria Harbour',
            center: { lat: 22.28, lng: 114.18 },
          },
        },
      });
      expect(event).not.toBeNull();
      expect(event!.label).toBe('Race 4');
      expect(event!.event_kind).toBe('race_step');
      expect(event!.event_id).toBe('s1');
      expect(event!.course_id).toBe('course-abc');
      expect(event!.season_id).toBe('season-xyz');
      expect(event!.where).toBe('Victoria Harbour');
      expect(event!.lat).toBe(22.28);
      expect(event!.lng).toBe(114.18);
    });

    it('prefers race_plan.center then falls back to step location coords', () => {
      const event = mapRaceStepToNextEvent({
        id: 's2',
        title: 'Race 5',
        starts_at: '2026-05-24T10:00:00Z',
        location_lat: 1.1,
        location_lng: 2.2,
        location_name: 'Mid-harbour',
        metadata: { race_plan: { course_id: 'c2' } },
      });
      expect(event!.lat).toBe(1.1);
      expect(event!.lng).toBe(2.2);
      expect(event!.where).toBe('Mid-harbour');
      expect(event!.course_id).toBe('c2');
    });

    it('omits course_id when the race step has no race_plan link, falls back to "Next race"', () => {
      const event = mapRaceStepToNextEvent({
        id: 's3',
        title: null,
        starts_at: '2026-05-25T10:00:00Z',
        metadata: null,
      });
      expect(event!.label).toBe('Next race');
      expect(event!.course_id).toBeUndefined();
      expect(event!.season_id).toBeUndefined();
      expect(event!.lat).toBeUndefined();
      expect(event!.lng).toBeUndefined();
    });
  });

  describe('pickEarliest', () => {
    it('returns null on empty', () => {
      expect(pickEarliest([])).toBeNull();
    });

    it('picks the earliest by ISO timestamp', () => {
      const out = pickEarliest([
        { ts: '2026-06-15T10:00:00Z', event: { label: 'Later' } },
        { ts: '2026-05-23T10:00:00Z', event: { label: 'Earliest' } },
        { ts: '2026-06-01T10:00:00Z', event: { label: 'Middle' } },
      ]);
      expect(out!.label).toBe('Earliest');
    });

    it('is stable when timestamps tie — first wins via stable sort', () => {
      const a = { label: 'A' };
      const b = { label: 'B' };
      const out = pickEarliest([
        { ts: '2026-05-23T10:00:00Z', event: a },
        { ts: '2026-05-23T10:00:00Z', event: b },
      ]);
      expect(out).toBe(a);
    });
  });
});
