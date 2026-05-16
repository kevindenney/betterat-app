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

jest.mock('../DoTabInterior', () => ({ DoTabInterior: 'DoTabInterior' }));
jest.mock('../DoQuickNoteModal', () => ({ DoQuickNoteModal: 'DoQuickNoteModal' }));
jest.mock('../MarkAsEvidenceSheet', () => ({
  MarkAsEvidenceSheet: 'MarkAsEvidenceSheet',
}));

jest.mock('react-native', () => {
  const StyleSheet = {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  };
  return {
    StyleSheet,
    View: 'View',
  };
});

// eslint-disable-next-line import/first
import { DoTabIOSRegisterShell } from '../DoTabIOSRegisterShell';

const render = (props: { stepId: string; readOnly?: boolean; onMoveToReflect?: () => void; footer?: React.ReactNode }) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DoTabIOSRegisterShell {...props} />);
  });
  return tree;
};

const findByName = (root: ReactTestInstance, name: string) =>
  root.find((n: ReactTestInstance) => typeof n.type === 'string' && n.type === name);

beforeEach(() => {
  useStepActCaptureControllerMock.mockClear();
  useStepActCaptureControllerMock.mockReturnValue(controllerStub);
});

describe('DoTabIOSRegisterShell — flag-on Do surface', () => {
  it('calls the controller with stepId / readOnly / onMoveToReflect', () => {
    const onMoveToReflect = jest.fn();
    render({ stepId: 'step-1', readOnly: true, onMoveToReflect });
    expect(useStepActCaptureControllerMock).toHaveBeenCalledWith({
      stepId: 'step-1',
      readOnly: true,
      onMoveToReflect,
    });
  });

  it('mounts DoTabInterior + MarkAsEvidenceSheet + DoQuickNoteModal', () => {
    const tree = render({ stepId: 'step-1' });
    expect(findByName(tree.root, 'DoTabInterior')).toBeDefined();
    expect(findByName(tree.root, 'MarkAsEvidenceSheet')).toBeDefined();
    expect(findByName(tree.root, 'DoQuickNoteModal')).toBeDefined();
  });

  it('hides the sheet by default with an empty capabilities list', () => {
    const tree = render({ stepId: 'step-1' });
    const sheet = findByName(tree.root, 'MarkAsEvidenceSheet');
    expect(sheet.props.visible).toBe(false);
    expect(sheet.props.capabilities).toEqual([]);
    expect(sheet.props.selectedCapabilityIds).toEqual([]);
    expect(sheet.props.strength).toBeNull();
  });

  it('opens the sheet with the matching capture when controller.markingCaptureId is set', () => {
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
    const tree = render({ stepId: 'step-1' });
    const sheet = findByName(tree.root, 'MarkAsEvidenceSheet');
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.capture).toEqual(fakeCapture);
  });

  it('forwards quickNoteVisible + submitQuickNote to DoQuickNoteModal', () => {
    useStepActCaptureControllerMock.mockReturnValueOnce({
      ...controllerStub,
      quickNoteVisible: true,
    });
    const tree = render({ stepId: 'step-1' });
    const modal = findByName(tree.root, 'DoQuickNoteModal');
    expect(modal.props.visible).toBe(true);
    expect(modal.props.onSubmit).toBe(controllerStub.submitQuickNote);
  });

  it('forwards footer down to DoTabInterior', () => {
    const tree = render({ stepId: 'step-1', footer: 'footer-token' });
    const interior = findByName(tree.root, 'DoTabInterior');
    expect(interior.props.footer).toBe('footer-token');
  });
});
