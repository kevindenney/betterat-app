/* eslint-disable import/first */

const mockInvoke = jest.fn();
const mockRecordUsage = jest.fn();

jest.mock('@/services/supabase', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

jest.mock('@/services/ai/AIUsageService', () => ({
  AIUsageService: {
    recordUsage: mockRecordUsage,
  },
}));

jest.mock('@/services/ai/StepPlanAIService', () => ({
  gatherPlaybookLayers: jest.fn(),
  getUserCapabilityProgress: jest.fn(),
  getUserOrgPrograms: jest.fn(),
  getFollowedUsersActivity: jest.fn(),
  getGroupmateActivity: jest.fn(),
}));

jest.mock('@/services/BlueprintService', () => ({
  getSuggestedNextSteps: jest.fn(),
}));

jest.mock('@/lib/interest-config', () => ({
  getInterestBeatsConfig: jest.fn(({ interestName }) => ({
    sectionLabel:
      interestName === 'Nursing'
        ? 'Shift run-through'
        : interestName === 'Golf'
          ? 'Round run-through'
          : 'Run-through',
  })),
}));

import {
  generateWorkedExample,
  parseWorkedExampleResponse,
  type WorkedExampleResult,
} from '../WorkedExampleService';

function responseFor(domain: string): WorkedExampleResult {
  return {
    title: `${domain} Worked Example`,
    why: `This builds a concrete ${domain.toLowerCase()} execution habit.`,
    how: [
      {
        title: 'Set the baseline',
        body: `Prepare the key ${domain.toLowerCase()} inputs before the timed work starts.`,
      },
      {
        title: 'Name the decision point',
        body: `Write down the one ${domain.toLowerCase()} cue that should trigger action.`,
      },
    ],
    runthrough: [
      {
        time_label: '-30 min',
        title: 'Check the first constraint',
        body: `Confirm the first ${domain.toLowerCase()} constraint and choose the opening move.`,
      },
      {
        time_label: 'T+0',
        title: 'Execute the opening',
        body: `Start the ${domain.toLowerCase()} sequence and watch for the first feedback signal.`,
      },
    ],
    buildsCapability: null,
  };
}

describe('WorkedExampleService', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockRecordUsage.mockReset();
  });

  it('salvages complete sections from a truncated nursing response', () => {
    const parsed = parseWorkedExampleResponse(`{
      "title": "Med-Surg Shift Prioritization Run",
      "why": "Practice turning competing patient needs into a safe first-hour sequence.",
      "how": [
        { "title": "Mark acuity first", "body": "Circle airway, breathing, circulation, neuro change, sepsis screen, and time-critical meds before looking at routine tasks." },
        { "title": "Batch supplies", "body": "Pull flushes, alcohol caps, IV tubing, PPE, and wound-care supplies for the first room entry so you do not keep re-crossing the unit." }
      ],
      "runthrough": [
        { "time_label": "06:45", "title": "Take focused report", "body": "Ask off-going nurses for instability, pending labs, pain outliers, lines/drains, and family pressure points." },
        { "time_label": "07:15", "title": "Run safety sweep", "body": "Check oxygen, IV access, fall risk, bed alarms, and med timing before committing to the rest of the morning." },
        { "time_label": "08:00", "title": "Start med pass", "body": "Prioritize antibiotics, insulin, anticoagulants, and pain medications before routine vitamins`);

    expect(parsed?.title).toBe('Med-Surg Shift Prioritization Run');
    expect(parsed?.why).toContain('first-hour sequence');
    expect(parsed?.how).toHaveLength(2);
    expect(parsed?.runthrough).toHaveLength(2);
    expect(parsed?.runthrough[1].time_label).toBe('07:15');
  });

  it.each([
    ['nursing', 'Nursing', 'run a med-surg day shift'],
    ['sail racing', 'Sail Racing', 'race a windward-leeward in shifty breeze'],
    ['entrepreneur', 'Entrepreneurship', 'run a customer discovery sprint'],
    ['golf', 'Golf', 'play a pressure nine holes'],
  ])('generates a worked example for %s', async (_label, interestName, intent) => {
    const serviceResponse = responseFor(interestName);
    mockInvoke.mockResolvedValueOnce({
      data: {
        text: JSON.stringify({
          title: serviceResponse.title,
          why: serviceResponse.why,
          how: serviceResponse.how,
          runthrough: serviceResponse.runthrough,
          builds_capability: '',
        }),
      },
      error: null,
    });

    const result = await generateWorkedExample({
      intent,
      interestName,
      interestSlug: interestName.toLowerCase().replace(/\s+/g, '-'),
    });

    expect(result.title).toBe(serviceResponse.title);
    expect(result.how).toHaveLength(2);
    expect(result.runthrough).toHaveLength(2);
    expect(mockInvoke).toHaveBeenCalledWith(
      'step-plan-suggest',
      expect.objectContaining({
        body: expect.objectContaining({
          max_tokens: 3072,
          prompt: expect.stringContaining(`INTENT: ${intent}`),
          system: expect.stringContaining(`expert ${interestName} coach`),
        }),
      }),
    );
    expect(mockRecordUsage).toHaveBeenCalledWith('plan_generation');
  });
});
