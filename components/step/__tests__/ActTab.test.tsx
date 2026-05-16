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

// Stub out the do-tab barrel so we don't pull in @expo/vector-icons or
// instantiate the controller hook inside DoTabIOSRegisterShell. ActTab's
// branching is the only thing under test here; the shell's wiring lives
// in its own suite.
jest.mock('../do-tab', () => ({
  DoTabIOSRegisterShell: 'DoTabIOSRegisterShell',
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
});

describe('ActTab — flag branching', () => {
  it('renders the pre-Phase-B.7 StepDrawContent path when the flag is OFF', () => {
    mockFlag = false;
    const tree = render({ onNextTab: jest.fn() });
    const names = componentNames(tree.root);
    expect(names).toContain('StepDrawContent');
    expect(names).toContain('StepFocusConcepts');
    expect(names).not.toContain('DoTabIOSRegisterShell');
  });

  it('does NOT mount the shell when the flag is OFF', () => {
    mockFlag = false;
    const tree = render();
    const names = componentNames(tree.root);
    expect(names).not.toContain('DoTabIOSRegisterShell');
  });

  it('mounts DoTabIOSRegisterShell when the flag is ON and hides the legacy stack', () => {
    mockFlag = true;
    const tree = render();
    const names = componentNames(tree.root);
    expect(names).toContain('DoTabIOSRegisterShell');
    expect(names).not.toContain('StepDrawContent');
    expect(names).not.toContain('StepFocusConcepts');
  });

  it('passes stepId, readOnly, onNextTab, and footer through to the shell when the flag is ON', () => {
    mockFlag = true;
    const onNextTab = jest.fn();
    const footer = 'footer-token';
    const tree = render({ onNextTab, readOnly: true, footer });
    const shell = tree.root.find(
      (n: ReactTestInstance) =>
        typeof n.type === 'string' && n.type === 'DoTabIOSRegisterShell',
    );
    expect(shell.props.stepId).toBe('step-1');
    expect(shell.props.readOnly).toBe(true);
    expect(shell.props.onMoveToReflect).toBe(onNextTab);
    expect(shell.props.footer).toBe(footer);
  });
});
