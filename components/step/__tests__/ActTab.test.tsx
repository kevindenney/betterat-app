import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';

// React 19's act() requires this flag; without it TestRenderer prints a noisy
// warning even though every render is wrapped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------------------
// Mock chain — flag value is controlled by mockFlag, hook returns a stub
// ---------------------------------------------------------------------------

let mockFlag = false;
jest.mock('@/lib/featureFlags', () => ({
  get FEATURE_FLAGS() {
    return { PRACTICE_DO_TAB_IOS_REGISTER: mockFlag };
  },
}));

const controllerStub = {
  state: 'pre_activity' as const,
  activityEndedAt: null as string | null,
  markingCaptureId: null as string | null,
  quickNoteVisible: false,
  captures: [],
  planData: {},
  stepTitle: 'Stub step',
  doTabInteriorProps: {
    state: 'pre_activity' as const,
    planData: {},
    captures: [],
    elapsedMs: 0,
    nowMs: 0,
  },
  markingCapture: null,
  closeMarkAsEvidence: jest.fn(),
  closeQuickNoteModal: jest.fn(),
  submitQuickNote: jest.fn(),
};
const useStepActCaptureControllerMock = jest.fn(() => controllerStub);
jest.mock('@/hooks/useStepActCaptureController', () => ({
  useStepActCaptureController: (...args: unknown[]) =>
    useStepActCaptureControllerMock(...args),
}));

jest.mock('./StepDrawContent' as never, () => ({ StepDrawContent: 'StepDrawContent' }), {
  virtual: true,
});

// Stub out the do-tab barrel so we don't pull in @expo/vector-icons.
jest.mock('../do-tab', () => ({
  DoTabInterior: 'DoTabInterior',
  DoQuickNoteModal: 'DoQuickNoteModal',
  MarkAsEvidenceSheet: 'MarkAsEvidenceSheet',
}));

jest.mock('../StepDrawContent', () => ({ StepDrawContent: 'StepDrawContent' }));
jest.mock('../StepFocusConcepts', () => ({ StepFocusConcepts: 'StepFocusConcepts' }));
jest.mock('../DateEnrichmentCard', () => ({ DateEnrichmentCard: 'DateEnrichmentCard' }));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('react-native', () => {
  const StyleSheet = {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  };
  return {
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    StyleSheet,
    Text: 'Text',
    View: 'View',
  };
});

// eslint-disable-next-line import/first
import { ActTab } from '../ActTab';

const render = (props: Partial<React.ComponentProps<typeof ActTab>> = {}) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ActTab stepId="step-1" {...props} />);
  });
  return tree;
};

const componentNames = (root: ReactTestInstance): string[] =>
  root.findAll(() => true).map((n: ReactTestInstance) => {
    const t = n.type as { name?: string; displayName?: string } | string;
    if (typeof t === 'string') return t;
    return t.displayName ?? t.name ?? '';
  });

beforeEach(() => {
  mockFlag = false;
  useStepActCaptureControllerMock.mockClear();
});

describe('ActTab — flag branching', () => {
  it('renders the pre-Phase-B.7 StepDrawContent path when the flag is OFF', () => {
    mockFlag = false;
    const tree = render({ onNextTab: jest.fn() });
    const names = componentNames(tree.root);
    expect(names).toContain('StepDrawContent');
    expect(names).toContain('StepFocusConcepts');
    expect(names).not.toContain('DoTabInterior');
    expect(useStepActCaptureControllerMock).not.toHaveBeenCalled();
  });

  it('does NOT mount any do-tab/* component when the flag is OFF', () => {
    mockFlag = false;
    const tree = render();
    const names = componentNames(tree.root);
    expect(names).not.toContain('DoTabInterior');
    expect(names).not.toContain('MarkAsEvidenceSheet');
    expect(names).not.toContain('DoQuickNoteModal');
  });

  it('mounts DoTabInterior + MarkAsEvidenceSheet + DoQuickNoteModal when the flag is ON', () => {
    mockFlag = true;
    const tree = render();
    const names = componentNames(tree.root);
    expect(names).toContain('DoTabInterior');
    expect(names).toContain('MarkAsEvidenceSheet');
    expect(names).toContain('DoQuickNoteModal');
    expect(names).not.toContain('StepDrawContent');
  });

  it('passes onNextTab through to the controller as onMoveToReflect when the flag is ON', () => {
    mockFlag = true;
    const onNextTab = jest.fn();
    render({ onNextTab, readOnly: true });
    expect(useStepActCaptureControllerMock).toHaveBeenCalledWith({
      stepId: 'step-1',
      readOnly: true,
      onMoveToReflect: onNextTab,
    });
  });

  it('mounts MarkAsEvidenceSheet hidden by default (visible derived from controller.markingCaptureId)', () => {
    mockFlag = true;
    const tree = render();
    const sheet = tree.root.find(
      (n: ReactTestInstance) =>
        typeof n.type === 'string' && n.type === 'MarkAsEvidenceSheet',
    );
    expect(sheet.props.visible).toBe(false);
    expect(sheet.props.capabilities).toEqual([]);
  });

  it('mounts MarkAsEvidenceSheet visible when controller.markingCaptureId is set', () => {
    mockFlag = true;
    const fakeCapture = {
      id: 'obs:obs-1',
      kind: 'note',
      capturedAt: '2026-05-16T14:00:00Z',
      body: 'x',
      capabilityIds: [],
      capabilityLabels: [],
      flaggedForDebrief: false,
      source: 'act_observation',
    };
    useStepActCaptureControllerMock.mockReturnValueOnce({
      ...controllerStub,
      markingCaptureId: 'obs:obs-1',
      markingCapture: fakeCapture as never,
    });
    const tree = render();
    const sheet = tree.root.find(
      (n: ReactTestInstance) =>
        typeof n.type === 'string' && n.type === 'MarkAsEvidenceSheet',
    );
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.capture).toEqual(fakeCapture);
  });
});
