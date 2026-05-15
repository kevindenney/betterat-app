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
