import {
  WORKED_EXAMPLE_FAILURE_MESSAGE,
  buildStepAddPayload,
  emptyBlankValues,
  getWorkedExampleButtonLabel,
  shouldShowWorkedExampleTrigger,
} from '../StepAddSheet.logic';

describe('StepAddSheet composer logic', () => {
  it('shows the worked-example trigger only when the WHAT field has unsaved intent', () => {
    expect(shouldShowWorkedExampleTrigger({whatText: '', workedApplied: false})).toBe(false);
    expect(shouldShowWorkedExampleTrigger({whatText: '   ', workedApplied: false})).toBe(false);
    expect(shouldShowWorkedExampleTrigger({whatText: 'run a med-surg day shift', workedApplied: false})).toBe(true);
    expect(shouldShowWorkedExampleTrigger({whatText: 'run a med-surg day shift', workedApplied: true})).toBe(false);
  });

  it('keeps the worked-example loading and failure copy stable', () => {
    expect(getWorkedExampleButtonLabel({workedGenerating: false})).toBe('Build a worked example');
    expect(getWorkedExampleButtonLabel({workedGenerating: true})).toBe('Building a worked example…');
    expect(WORKED_EXAMPLE_FAILURE_MESSAGE).toBe('Could not build a worked example. Try again.');
  });

  it('builds the minimal text payload without blank optional fields', () => {
    expect(
      buildStepAddPayload({
        trimmed: 'Practice telemetry handoff',
        fieldValues: emptyBlankValues(),
        whenISO: null,
        whereLocation: undefined,
        showRaceSelector: false,
        isRace: false,
        racePlan: {},
        photoUri: undefined,
        viewedSeasonId: null,
        visibility: 'private',
        workedBeats: [],
      }),
    ).toEqual({
      kind: 'text',
      content: 'Practice telemetry handoff',
      why: undefined,
      how: undefined,
      scheduledAt: undefined,
      location: undefined,
      isRace: undefined,
      racePlan: undefined,
      imageUri: undefined,
      viewedSeasonId: null,
      visibility: 'private',
      runthroughBeats: undefined,
    });
  });

  it('includes race plan, schedule, location, visibility, and worked beats when supplied', () => {
    const location = {
      name: 'Johns Hopkins Hospital',
      latitude: 39.2963,
      longitude: -76.5927,
    };
    const beat = {
      time_label: '0:00',
      title: 'Prioritize',
      body: 'Scan orders and unstable patients first.',
    };

    expect(
      buildStepAddPayload({
        trimmed: 'Run a med-surg day shift',
        fieldValues: {
          why: ' Build safer prioritization ',
          how: ' Start with unstable patients ',
          when: '',
          where: '',
        },
        whenISO: '2026-06-23T13:00:00.000Z',
        whereLocation: location,
        showRaceSelector: true,
        isRace: true,
        racePlan: {courseId: 'course-1'},
        photoUri: 'file://photo.jpg',
        viewedSeasonId: 'season-1',
        visibility: 'collaborators',
        workedBeats: [beat],
      }),
    ).toEqual({
      kind: 'text',
      content: 'Run a med-surg day shift',
      why: 'Build safer prioritization',
      how: 'Start with unstable patients',
      scheduledAt: '2026-06-23T13:00:00.000Z',
      location,
      isRace: true,
      racePlan: {courseId: 'course-1'},
      imageUri: 'file://photo.jpg',
      viewedSeasonId: 'season-1',
      visibility: 'collaborators',
      runthroughBeats: [beat],
    });
  });
});
