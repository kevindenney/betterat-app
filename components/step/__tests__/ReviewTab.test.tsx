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
    return { PRACTICE_STEP_LOOP_IOS_REGISTER: mockFlag };
  },
}));

// Stub the reflect-tab barrel so the test doesn't instantiate the controller
// hook (which would otherwise pull in Supabase + every transitive service).
// ReviewTab's branching is the only thing under test here; the shell + hook
// have their own suites.
jest.mock('../reflect-tab', () => ({
  ReflectTabIOSRegisterShell: 'ReflectTabIOSRegisterShell',
}));

jest.mock('../StepCritiqueContent', () => ({ StepCritiqueContent: 'StepCritiqueContent' }));
jest.mock('../StepFocusConcepts', () => ({ StepFocusConcepts: 'StepFocusConcepts' }));

// useStepDetail powers the InstructorFeedbackCard. Stubbing it to return no
// metadata keeps the flag-off branch rendering deterministic and lets us
// assert StepCritiqueContent / StepFocusConcepts are mounted without setting
// up the React Query provider.
jest.mock('@/hooks/useTimelineSteps', () => ({
  useStepDetail: () => ({ data: undefined }),
}));

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
import { ReviewTab } from '../ReviewTab';

const render = (props: Partial<React.ComponentProps<typeof ReviewTab>> = {}) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ReviewTab stepId="step-1" {...props} />);
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

describe('ReviewTab — flag branching', () => {
  it('renders the legacy StepCritiqueContent path when the flag is OFF', () => {
    mockFlag = false;
    const tree = render();
    const names = componentNames(tree.root);
    expect(names).toContain('StepCritiqueContent');
    expect(names).toContain('StepFocusConcepts');
    expect(names).not.toContain('ReflectTabIOSRegisterShell');
  });

  it('mounts ReflectTabIOSRegisterShell when the flag is ON', () => {
    mockFlag = true;
    const tree = render();
    const names = componentNames(tree.root);
    expect(names).toContain('ReflectTabIOSRegisterShell');
    expect(names).not.toContain('StepCritiqueContent');
    expect(names).not.toContain('StepFocusConcepts');
  });

  it('forwards readOnly + footer to the shell when the flag is ON', () => {
    mockFlag = true;
    const footer = TestRenderer.create(<></>);
    const tree = render({ readOnly: true, footer });
    const shell = tree.root.findByType('ReflectTabIOSRegisterShell' as unknown as React.ComponentType);
    expect(shell.props.readOnly).toBe(true);
    expect(shell.props.footer).toBe(footer);
    expect(shell.props.stepId).toBe('step-1');
  });
});
