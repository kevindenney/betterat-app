/**
 * Smoke render tests for the step-loop primitives.
 *
 * Phase 0 of the iOS register migration is shell-only — no behavioral
 * logic — so these tests verify each primitive can be constructed and
 * rendered to completion across the states the brief documents. This
 * catches breakage of the public component APIs without locking in
 * pixel-perfect snapshots that would churn during Phase 1+ visual work.
 */

import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PhaseTabs } from '../PhaseTabs';
import { StatePill, type StatePillVariant } from '../StatePill';
import { StepCard } from '../StepCard';
import { StepStrip } from '../StepStrip';
import { TopHeader } from '../TopHeader';

// React 19's act() requires this flag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Stub react-native — host primitives become opaque strings (React renders
// them as <View>, <Text>, etc.) which TestRenderer treats as untyped host
// components. Avoids pulling in the real react-native module under the
// node-only jest env.
jest.mock('react-native', () => {
  const StyleSheet = {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  };
  return {
    StyleSheet,
    View: 'View',
    Text: 'Text',
    Pressable: 'Pressable',
    Platform: {
      OS: 'ios',
      select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
    },
  };
});

// Stub reanimated — StatePill uses withRepeat / useSharedValue / Easing /
// cancelAnimation; the smoke tests don't need real animation.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (c: unknown) => c, View: 'Animated.View' },
  View: 'Animated.View',
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  withTiming: (toValue: number) => toValue,
  withRepeat: (anim: unknown) => anim,
  cancelAnimation: () => undefined,
  Easing: { out: () => (v: number) => v, ease: (v: number) => v },
}));

// Stub lucide so we don't pull native SVG bindings into the unit-test
// environment. Each named export becomes a host component string.
jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_, key) => String(key) }),
);

function render(node: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(node);
  });
  return renderer;
}

describe('<StatePill>', () => {
  const variants: StatePillVariant[] = [
    'planned',
    'current',
    'live',
    'complete',
    'reflect',
    'settled',
    'between',
  ];

  test.each(variants)('renders %s variant', (variant) => {
    const r = render(<StatePill variant={variant} label={`${variant} label`} />);
    expect(r.toJSON()).toBeTruthy();
  });

  test('renders with stats group', () => {
    const r = render(
      <StatePill
        variant="reflect"
        label="Reflect"
        stats={[
          { num: '24', label: 'Wks' },
          { num: '3', label: 'Races' },
        ]}
      />,
    );
    expect(r.toJSON()).toBeTruthy();
  });
});

describe('<StepStrip>', () => {
  test('renders with primary only', () => {
    const r = render(<StepStrip primary="Light-air starts" />);
    expect(r.toJSON()).toBeTruthy();
  });

  test('renders with primary + secondary + icon', () => {
    const r = render(
      <StepStrip icon="trophy" primary="Spring Series" secondary="week 7 of 12" />,
    );
    expect(r.toJSON()).toBeTruthy();
  });
});

describe('<TopHeader>', () => {
  test('renders interest mode', () => {
    const r = render(<TopHeader interestName="Sail Racing" stepCounter="Step 4 of 10" />);
    expect(r.toJSON()).toBeTruthy();
  });

  test('renders back mode (precedence over interestName)', () => {
    const r = render(<TopHeader interestName="Ignored" backLabel="Race 4" />);
    expect(r.toJSON()).toBeTruthy();
  });
});

describe('<PhaseTabs>', () => {
  test('renders default Plan/Do/Reflect tabs', () => {
    const r = render(
      <PhaseTabs
        plan="ready"
        do="pending"
        reflect="pending"
        active="plan"
        onTabPress={() => undefined}
      />,
    );
    expect(r.toJSON()).toBeTruthy();
  });

  test('renders live state', () => {
    const r = render(
      <PhaseTabs
        plan="ready"
        do="live"
        reflect="pending"
        active="do"
        onTabPress={() => undefined}
      />,
    );
    expect(r.toJSON()).toBeTruthy();
  });

  test('renders with custom labels', () => {
    const r = render(
      <PhaseTabs
        plan="pending"
        do="pending"
        reflect="pending"
        active="plan"
        onTabPress={() => undefined}
        labels={{ plan: 'Prep', do: 'Check', reflect: 'Debrief' }}
      />,
    );
    expect(r.toJSON()).toBeTruthy();
  });
});

describe('<StepCard>', () => {
  test('renders with all slots populated', () => {
    const r = render(
      <StepCard
        pill={<StatePill variant="planned" label="Planned" />}
        onMenuPress={() => undefined}
        stepStrip={<StepStrip primary="Spring Series" />}
        titleBlock={null}
        phaseTabs={
          <PhaseTabs
            plan="pending"
            do="pending"
            reflect="pending"
            active="plan"
            onTabPress={() => undefined}
          />
        }
        footer={null}
      >
        {null}
      </StepCard>,
    );
    expect(r.toJSON()).toBeTruthy();
  });

  test('renders with only pill + body (minimal)', () => {
    const r = render(
      <StepCard pill={<StatePill variant="complete" label="Complete" />}>
        {null}
      </StepCard>,
    );
    expect(r.toJSON()).toBeTruthy();
  });
});
