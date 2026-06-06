import {
  mapCalendarRow,
  scheduledCount,
  raceCount,
  groupByMonth,
  composeEventTimes,
  UNSCHEDULED,
  CalendarRpcRow,
  AdminCalendarEvent,
} from '../admin/adminCalendar';

function rpcRow(overrides: Partial<CalendarRpcRow> = {}): CalendarRpcRow {
  return {
    step_id: 'step-1',
    title: 'Dragon Saturday Series — Race Briefing',
    starts_at: '2026-06-08T09:00:00Z',
    ends_at: '2026-06-08T13:00:00Z',
    status: 'pending',
    is_race: true,
    category: 'race',
    place_name: 'Kellett Island Clubhouse',
    regatta_race_id: 'race-99',
    owner_name: 'Kevin Denney',
    ...overrides,
  };
}

function event(overrides: Partial<AdminCalendarEvent> = {}): AdminCalendarEvent {
  return {
    id: 'e',
    title: 't',
    startsAt: '2026-06-08T09:00:00Z',
    endsAt: null,
    status: 'pending',
    isRace: false,
    category: null,
    placeName: null,
    regattaRaceId: null,
    ownerName: null,
    ...overrides,
  };
}

describe('mapCalendarRow', () => {
  it('renames the snake_case RPC columns to the camelCase event shape', () => {
    expect(mapCalendarRow(rpcRow())).toEqual({
      id: 'step-1',
      title: 'Dragon Saturday Series — Race Briefing',
      startsAt: '2026-06-08T09:00:00Z',
      endsAt: '2026-06-08T13:00:00Z',
      status: 'pending',
      isRace: true,
      category: 'race',
      placeName: 'Kellett Island Clubhouse',
      regattaRaceId: 'race-99',
      ownerName: 'Kevin Denney',
    });
  });

  it('preserves nulls for an unscheduled, non-race step with no scoring row', () => {
    const mapped = mapCalendarRow(
      rpcRow({
        starts_at: null,
        ends_at: null,
        is_race: false,
        regatta_race_id: null,
        place_name: null,
        owner_name: null,
      }),
    );
    expect(mapped.startsAt).toBeNull();
    expect(mapped.isRace).toBe(false);
    expect(mapped.regattaRaceId).toBeNull();
    expect(mapped.ownerName).toBeNull();
  });
});

describe('scheduledCount / raceCount', () => {
  const events = [
    event({ id: 'a', startsAt: '2026-06-08T09:00:00Z', isRace: true }),
    event({ id: 'b', startsAt: '2026-06-15T10:00:00Z', isRace: false }),
    event({ id: 'c', startsAt: null, isRace: true }),
  ];

  it('counts only events with a start date as scheduled', () => {
    expect(scheduledCount(events)).toBe(2);
  });

  it('counts every is_race event regardless of scheduling', () => {
    expect(raceCount(events)).toBe(2);
  });

  it('returns zero for an empty calendar', () => {
    expect(scheduledCount([])).toBe(0);
    expect(raceCount([])).toBe(0);
  });
});

describe('groupByMonth', () => {
  it('buckets events into one group per month and preserves input order', () => {
    const groups = groupByMonth([
      event({ id: 'jun-a', startsAt: '2026-06-08T09:00:00Z' }),
      event({ id: 'jun-b', startsAt: '2026-06-22T14:00:00Z' }),
      event({ id: 'jul', startsAt: '2026-07-03T10:00:00Z' }),
    ]);
    expect(groups.map((g) => g.events.length)).toEqual([2, 1]);
    expect(groups[0].events.map((e) => e.id)).toEqual(['jun-a', 'jun-b']);
    expect(groups[1].events.map((e) => e.id)).toEqual(['jul']);
  });

  it('drops events with no start date into a trailing Unscheduled group', () => {
    const groups = groupByMonth([
      event({ id: 'dated', startsAt: '2026-06-08T09:00:00Z' }),
      event({ id: 'undated', startsAt: null }),
    ]);
    const last = groups[groups.length - 1];
    expect(last.key).toBe(UNSCHEDULED);
    expect(last.label).toBe(UNSCHEDULED);
    expect(last.events.map((e) => e.id)).toEqual(['undated']);
  });

  it('returns an empty array for no events', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe('composeEventTimes', () => {
  it('treats an empty date as an unscheduled event (both null)', () => {
    expect(composeEventTimes('', '09:00', '11:00')).toEqual({
      startsAt: null,
      endsAt: null,
    });
    expect(composeEventTimes('   ', '', '')).toEqual({ startsAt: null, endsAt: null });
  });

  it('composes ISO timestamps from date + times in the local timezone', () => {
    const { startsAt, endsAt } = composeEventTimes('2026-06-08', '09:30', '11:45');
    expect(startsAt).not.toBeNull();
    expect(endsAt).not.toBeNull();
    // Local wall-clock hours round-trip regardless of the machine's offset.
    const start = new Date(startsAt as string);
    const end = new Date(endsAt as string);
    expect(start.getHours()).toBe(9);
    expect(start.getMinutes()).toBe(30);
    expect(end.getHours()).toBe(11);
    expect(end.getMinutes()).toBe(45);
  });

  it('defaults a missing start time to midnight and leaves end null', () => {
    const { startsAt, endsAt } = composeEventTimes('2026-06-08', '', '');
    expect(endsAt).toBeNull();
    expect(new Date(startsAt as string).getHours()).toBe(0);
  });

  it('rejects a malformed date', () => {
    expect(() => composeEventTimes('06/08/2026', '09:00', '11:00')).toThrow(/YYYY-MM-DD/);
  });

  it('rejects malformed times', () => {
    expect(() => composeEventTimes('2026-06-08', '25:00', '')).toThrow(/Start time/);
    expect(() => composeEventTimes('2026-06-08', '09:00', '9pm')).toThrow(/End time/);
  });

  it('rejects an end time at or before the start time', () => {
    expect(() => composeEventTimes('2026-06-08', '11:00', '11:00')).toThrow(/after the start/);
    expect(() => composeEventTimes('2026-06-08', '11:00', '09:00')).toThrow(/after the start/);
  });
});
