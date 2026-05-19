import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockStep: { current: Record<string, unknown> | undefined } = { current: undefined };
const mockMutateMetadata = jest.fn();
const mockMutateStepAsync = jest.fn(() => Promise.resolve({ id: 'step-1', status: 'settled' }));
const mockDraft = jest.fn(() => Promise.resolve('AI draft from captures.'));
const mockWriteEvidence = jest.fn(() => Promise.resolve());

jest.mock('@/hooks/useStepDetail', () => ({
  useStepDetail: () => ({ data: mockStep.current, isLoading: false }),
  useUpdateStepMetadata: () => ({ mutate: mockMutateMetadata, isPending: false }),
}));

jest.mock('@/hooks/useTimelineSteps', () => ({
  useUpdateStep: () => ({ mutateAsync: mockMutateStepAsync, isPending: false }),
}));

jest.mock('@/providers/InterestProvider', () => ({
  useInterest: () => ({ currentInterest: { id: 'interest-1', slug: 'clinical-nursing', name: 'Clinical' } }),
}));

jest.mock('@/services/SynthesisService', () => ({
  draftReflectSynthesis: (...args: unknown[]) => mockDraft(...args),
}));

jest.mock('@/services/CapabilityEvidenceService', () => ({
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

jest.mock('@tanstack/react-query', () => ({
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
  mockMutateStepAsync.mockClear();
  mockDraft.mockClear();
  mockWriteEvidence.mockClear();
});

describe('useStepReflectController — Phase 4 shape', () => {
  it('uses nursing-specific question copy and disables settle while empty', () => {
    const { view, unmount } = renderHook({
      id: 'step-1',
      title: 'Clinical shift',
      interest_id: 'interest-1',
      status: 'in_progress',
      metadata: {},
    });

    expect(view.reflectViewProps.fields.map((field) => field.prompt)).toEqual([
      'What worked well today?',
      'Where do you need more practice?',
    ]);
    expect(view.reflectViewProps.saveEnabled).toBe(false);
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
    });
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

  it('writes capability evidence and sets status settled on Save & settle', async () => {
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

    expect(mockWriteEvidence).toHaveBeenCalledWith({
      stepId: 'step-1',
      rows: expect.arrayContaining([expect.objectContaining({ capabilityId: 'cap-1' })]),
    });
    expect(mockMutateStepAsync).toHaveBeenCalledWith({
      stepId: 'step-1',
      input: { status: 'settled' },
    });
    hook.unmount();
  });
});
