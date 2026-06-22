import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockStep: { current: Record<string, unknown> | undefined } = { current: undefined };
const mockMutateMetadata = jest.fn();
const mockMutateMetadataAsync = jest.fn();
const mockMutateStepAsync = jest.fn(() => Promise.resolve({ id: 'step-1', status: 'settled' }));
const mockDraft = jest.fn(() => Promise.resolve('AI draft from captures.'));
const mockWriteEvidence = jest.fn(() => Promise.resolve());
const mockSuggestCapabilities = jest.fn(() => Promise.resolve([]));
const mockAutoTagAndWriteEvidence = jest.fn();
const mockSettleStepAndPlaceBeforeNow = jest.fn(() => Promise.resolve());

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/hooks/useStepDetail', () => ({
  useStepDetail: () => ({ data: mockStep.current, isLoading: false }),
  useUpdateStepMetadata: () => ({
    mutate: mockMutateMetadata,
    mutateAsync: mockMutateMetadataAsync,
    isPending: false,
  }),
}));

jest.mock('@/hooks/useTimelineSteps', () => ({
  useUpdateStep: () => ({ mutateAsync: mockMutateStepAsync, isPending: false }),
}));

jest.mock('@/providers/InterestProvider', () => ({
  useInterest: () => ({
    currentInterest: { id: 'interest-1', slug: 'clinical-nursing', name: 'Clinical' },
    allInterests: [{ id: 'interest-1', slug: 'clinical-nursing', name: 'Clinical' }],
  }),
}));

jest.mock('@/services/SynthesisService', () => ({
  draftReflectSynthesis: (...args: unknown[]) => mockDraft(...args),
}));

jest.mock('@/services/CapabilityEvidenceService', () => ({
  autoTagAndWriteStepCapabilityEvidence: (...args: unknown[]) => mockAutoTagAndWriteEvidence(...args),
  buildCapabilityEvidenceRows: () => [
    {
      capabilityId: 'cap-1',
      capabilityName: 'Sterile technique',
      confirmed: true,
      strength: 'material',
      pipLevel: 3,
      evidenceCount: 2,
    },
  ],
  writeStepCapabilityEvidence: (...args: unknown[]) => mockWriteEvidence(...args),
}));

jest.mock('@/services/CapabilityTagService', () => ({
  suggestCapabilityTags: (...args: unknown[]) => mockSuggestCapabilities(...args),
}));

jest.mock('@/services/AIMemoryService', () => ({
  extractInsightsFromStepReflection: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/hooks/useAIUsage', () => ({
  useAIUsage: () => ({
    isPaid: true,
    counts: {},
    limits: {},
    canUse: () => true,
    remaining: () => null,
    refresh: () => {},
  }),
}));

jest.mock('@/services/TimelineStepService', () => ({
  settleStepAndPlaceBeforeNow: (...args: unknown[]) => mockSettleStepAndPlaceBeforeNow(...args),
}));

jest.mock('@/services/QuickCaptureService', () => ({
  dropInsight: jest.fn(),
}));

jest.mock('@/services/PlaybookService', () => ({
  addConceptTrailQuote: jest.fn(() => Promise.resolve()),
  getStepConceptLinks: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/services/HingeBuildService', () => ({
  encodeHingeId: () => 'hinge-id',
}));

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(() => Promise.resolve({ data: null })),
    })),
  },
}));

jest.mock('@/components/ui/AppToast', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

jest.mock('@/lib/utils/crossPlatformAlert', () => ({
  showAlert: jest.fn(),
}));

jest.mock('@/lib/featureFlags', () => ({
  FEATURE_FLAGS: { PRACTICE_STEP_LOOP_IOS_REGISTER: false },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// eslint-disable-next-line import/first
import { useStepReflectController } from '../useStepReflectController';
// eslint-disable-next-line import/first
import type { StepReflectControllerView } from '../useStepReflectController';

function Capture({ sink }: { sink: (view: StepReflectControllerView) => void }) {
  const view = useStepReflectController({ stepId: 'step-1' });
  sink(view);
  return null;
}

function renderHook(step: Record<string, unknown> | undefined) {
  mockStep.current = step;
  let captured!: StepReflectControllerView;
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Capture sink={(view) => { captured = view; }} />);
  });
  return {
    view: captured,
    rerender(nextStep = step) {
      mockStep.current = nextStep;
      act(() => {
        tree.update(<Capture sink={(view) => { captured = view; }} />);
      });
      return captured;
    },
    unmount() {
      act(() => tree.unmount());
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockMutateMetadata.mockReset();
  mockMutateMetadataAsync.mockReset();
  mockMutateMetadataAsync.mockImplementation(async (partial) => ({
    ...(mockStep.current ?? {}),
    metadata: {
      ...((mockStep.current?.metadata as Record<string, unknown> | undefined) ?? {}),
      ...(partial as Record<string, unknown>),
    },
  }));
  mockMutateStepAsync.mockClear();
  mockDraft.mockClear();
  mockWriteEvidence.mockClear();
  mockSuggestCapabilities.mockReset();
  mockSuggestCapabilities.mockResolvedValue([]);
  mockAutoTagAndWriteEvidence.mockReset();
  mockAutoTagAndWriteEvidence.mockImplementation(async ({ baseRows }) => baseRows);
  mockSettleStepAndPlaceBeforeNow.mockClear();
});

describe('useStepReflectController — Phase 4 shape', () => {
  it('uses nursing four-question reflection copy and disables settle while empty', () => {
    const { view, unmount } = renderHook({
      id: 'step-1',
      title: 'Clinical shift',
      interest_id: 'interest-1',
      status: 'in_progress',
      metadata: {},
    });

    expect(view.reflectViewProps.fields.map((field) => field.prompt)).toEqual([
      'What worked well?',
      'Where do you need more practice?',
      'The one thing to remember.',
      'If you taught this to someone, what evidence would you ask them to show?',
    ]);
    expect(view.reflectViewProps.saveEnabled).toBe(false);
    unmount();
  });

  it('pulls forward Do captures as optional seeds without replacing answers', () => {
    const { view, unmount } = renderHook({
      id: 'step-1',
      title: 'Clinical shift',
      interest_id: 'interest-1',
      status: 'in_progress',
      metadata: {
        plan: {
          where_location: { name: 'Johns Hopkins Hospital — East Baltimore' },
          how_sub_steps: [{ id: 'a', text: 'Focused neuro assessment', completed: false, sort_order: 0 }],
        },
        act: {
          observations: [{ id: '1', text: 'Left-grip change caught before round 2.', timestamp: 'now' }],
        },
      },
    });

    expect(view.reflectViewProps.fields[0].value).toBe('');
    expect(view.reflectViewProps.fields[0].seedSuggestion).toContain('Left-grip change');
    expect(view.reflectViewProps.fields[3].seedSuggestion).toContain('Johns Hopkins Hospital');
    unmount();
  });

  it('debounces field edits into review sections and enables settle', () => {
    const hook = renderHook({
      id: 'step-1',
      title: 'Clinical shift',
      interest_id: 'interest-1',
      status: 'in_progress',
      metadata: {},
    });

    act(() => {
      hook.view.reflectViewProps.onChangeField('what_worked', 'Patient handoff was clearer.');
    });
    const next = hook.rerender();
    expect(next.reflectViewProps.saveEnabled).toBe(true);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(mockMutateMetadata).toHaveBeenCalledWith({
      review: expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            prompt: 'what_worked',
            source: 'in_app',
            content: 'Patient handoff was clearer.',
          }),
        ]),
      }),
    }, expect.objectContaining({
      onSuccess: expect.any(Function),
    }));
    hook.unmount();
  });

  it('drafts synthesis into the first question card as AI-drafted text', async () => {
    const hook = renderHook({
      id: 'step-1',
      title: 'Clinical shift',
      interest_id: 'interest-1',
      status: 'in_progress',
      metadata: { act: { observations: [{ id: '1', text: 'obs', timestamp: 'now' }] } },
    });

    await act(async () => {
      await hook.view.reflectViewProps.onDraftSynthesis();
    });
    const next = hook.rerender();
    expect(next.reflectViewProps.synthesisState).toBe('drafted');
    expect(next.reflectViewProps.fields[0].value).toBe('AI draft from captures.');
    expect(next.reflectViewProps.fields[0].isDrafted).toBe(true);
    hook.unmount();
  });

  it('auto-tags capability evidence and settles on Save & settle', async () => {
    const hook = renderHook({
      id: 'step-1',
      title: 'Clinical shift',
      interest_id: 'interest-1',
      status: 'in_progress',
      metadata: { review: { sections: [{ prompt: 'what_worked', prompt_label: 'What worked?', content: 'Clear handoff.', source: 'in_app', captured_at: 'now' }] } },
    });

    await act(async () => {
      await hook.view.reflectViewProps.onSettle();
    });

    expect(mockMutateMetadataAsync).toHaveBeenCalledWith({
      review: expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({ content: 'Clear handoff.' }),
        ]),
      }),
    });
    expect(mockAutoTagAndWriteEvidence).toHaveBeenCalledWith(expect.objectContaining({
      step: expect.objectContaining({ id: 'step-1' }),
      baseRows: expect.arrayContaining([expect.objectContaining({ capabilityId: 'cap-1' })]),
    }));
    expect(mockSettleStepAndPlaceBeforeNow).toHaveBeenCalledWith('step-1');
    hook.unmount();
  });

  it('keeps auto-tagged capability rows in local reflect state when settling', async () => {
    mockAutoTagAndWriteEvidence.mockResolvedValueOnce([
      {
        capabilityId: 'cap-1',
        capabilityName: 'Sterile technique',
        confirmed: true,
        strength: 'material',
        pipLevel: 3,
        evidenceCount: 2,
      },
      {
        capabilityId: 'jhu-cap-1',
        capabilityName: 'Prioritizes nursing interventions',
        confirmed: true,
        strength: 'strong',
        pipLevel: 5,
        evidenceCount: 1,
        source: 'ai',
      },
    ]);
    const hook = renderHook({
      id: 'step-1',
      title: 'Clinical shift',
      interest_id: 'interest-1',
      status: 'in_progress',
      metadata: {
        act: {
          observations: [{ id: 'obs-1', text: 'Prioritized hypoglycemia check before med pass.', timestamp: 'now' }],
        },
        review: {
          sections: [
            {
              prompt: 'what_worked',
              prompt_label: 'What worked?',
              content: 'I escalated the sliding scale issue quickly.',
              source: 'in_app',
              captured_at: 'now',
            },
          ],
        },
      },
    });

    await act(async () => {
      await hook.view.reflectViewProps.onSettle();
    });

    const next = hook.rerender();
    expect(next.reflectViewProps.capabilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ capabilityId: 'jhu-cap-1', confirmed: true, source: 'ai' }),
    ]));
    hook.unmount();
  });
});
