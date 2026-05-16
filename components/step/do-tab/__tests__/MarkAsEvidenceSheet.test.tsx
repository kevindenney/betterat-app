import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';
import {
  MarkAsEvidenceSheet,
  type EvidenceCapabilityOption,
  type MarkAsEvidenceSheetProps,
} from '../MarkAsEvidenceSheet';
import type { DoCaptureItem } from '../doCaptureModel';

// React 19's act() requires this flag; without it TestRenderer prints a noisy
// warning even though every render is wrapped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native', () => {
  const StyleSheet = {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
    absoluteFillObject: {},
  };
  return {
    Animated: {
      Value: class {
        constructor(public v: number) {}
        interpolate() {
          return this;
        }
      },
      View: 'AnimatedView',
      timing: () => ({ start: jest.fn(), stop: jest.fn() }),
      loop: () => ({ start: jest.fn(), stop: jest.fn() }),
    },
    Image: 'Image',
    Modal: 'Modal',
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    StyleSheet,
    Text: 'Text',
    View: 'View',
  };
});

const promotedCapture: DoCaptureItem = {
  id: 'cap-1',
  kind: 'voice',
  capturedAt: '2026-05-16T14:23:00Z',
  body: 'Left filled in at eight degrees. Not committing yet — rule said ten.',
  capabilityIds: [],
  capabilityLabels: [],
  flaggedForDebrief: false,
  source: 'act_observation',
  chipLabel: 'Weather',
  beatLabel: 'beat 2',
  metaSubtitle: 'Auto-transcribed',
  voicePeaks: [0.4, 0.7, 0.5, 0.9, 1, 0.8, 0.5, 0.9],
  voiceDurationSec: 7,
};

const baseCapabilities: EvidenceCapabilityOption[] = [
  {
    id: 'cap.read-shifts',
    name: 'Read wind shifts on the water',
    description:
      'Catch a building shift before the puff arrives — call it within five seconds.',
    progressDone: 3,
    progressTotal: 5,
    stageLabel: 'Building',
    stagePercent: 0.6,
  },
  {
    id: 'cap.pre-start',
    name: 'Pre-start positioning & lane choice',
    description: 'Pick the favored end, hold a clear lane, bail without losing a length.',
    progressDone: 2,
    progressTotal: 5,
    stageLabel: 'Early',
    stagePercent: 0.4,
  },
];

const renderSheet = (overrides: Partial<MarkAsEvidenceSheetProps> = {}) => {
  const props: MarkAsEvidenceSheetProps = {
    visible: true,
    onClose: jest.fn(),
    capture: promotedCapture,
    blueprintTitle: 'Light-air starts in shifty breeze',
    capabilities: baseCapabilities,
    selectedCapabilityIds: [],
    onToggleCapability: jest.fn(),
    strength: null,
    onChangeStrength: jest.fn(),
    onSave: jest.fn(),
    nowMs: Date.parse('2026-05-16T14:38:00Z'),
    ...overrides,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<MarkAsEvidenceSheet {...props} />);
  });
  return { tree, props };
};

const collectText = (root: ReactTestInstance): string =>
  root
    .findAll((n: ReactTestInstance) => n.type === 'Text')
    .map((n: ReactTestInstance) => {
      const children = React.Children.toArray(n.props.children as React.ReactNode);
      return children
        .map((c: React.ReactNode) =>
          typeof c === 'string' || typeof c === 'number' ? String(c) : '',
        )
        .join('');
    })
    .join(' | ');

const findByLabel = (root: ReactTestInstance, label: string): ReactTestInstance =>
  root.find(
    (n: ReactTestInstance) =>
      n.props && (n.props as { accessibilityLabel?: string }).accessibilityLabel === label,
  );

describe('MarkAsEvidenceSheet — Frame 4 surface', () => {
  it('renders the title, capture body, blueprint line, and capability rows', () => {
    const { tree } = renderSheet();
    const text = collectText(tree.root);
    expect(text).toContain('Mark as evidence');
    expect(text).toContain('Tag this capture as proof');
    expect(text).toContain('Left filled in at eight degrees');
    expect(text).toContain('From your active blueprint ·');
    expect(text).toContain('Light-air starts in shifty breeze');
    expect(text).toContain('Read wind shifts on the water');
    expect(text).toContain('Pre-start positioning & lane choice');
  });

  it('shows "0 selected" with disabled save when nothing is selected', () => {
    const { tree, props } = renderSheet();
    const text = collectText(tree.root);
    expect(text).toContain('0 selected');
    const save = findByLabel(tree.root, 'Save evidence');
    expect(
      (save.props as { accessibilityState?: { disabled?: boolean } }).accessibilityState
        ?.disabled,
    ).toBe(true);
    // The save count pill is hidden when 0 are selected.
    expect(text).not.toMatch(/Save evidence \| 0/);
    // onSave is not invoked when pressed in the disabled state.
    act(() => {
      (save.props as { onPress?: () => void }).onPress?.();
    });
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('renders the selected count and enables save when capabilities are selected', () => {
    const { tree, props } = renderSheet({
      selectedCapabilityIds: ['cap.read-shifts', 'cap.pre-start'],
    });
    const text = collectText(tree.root);
    expect(text).toContain('2 selected');
    const save = findByLabel(tree.root, 'Save evidence');
    expect(
      (save.props as { accessibilityState?: { disabled?: boolean } }).accessibilityState
        ?.disabled,
    ).toBe(false);
    act(() => {
      (save.props as { onPress?: () => void }).onPress?.();
    });
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('invokes onToggleCapability with the row id when a capability is tapped', () => {
    const { tree, props } = renderSheet();
    const row = findByLabel(tree.root, 'Pre-start positioning & lane choice');
    act(() => {
      (row.props as { onPress?: () => void }).onPress?.();
    });
    expect(props.onToggleCapability).toHaveBeenCalledWith('cap.pre-start');
  });

  it('marks the active strength option as selected and forwards the choice', () => {
    const { tree, props } = renderSheet({ strength: 'solid' });
    const solid = findByLabel(tree.root, 'Solid');
    expect(
      (solid.props as { accessibilityState?: { selected?: boolean } }).accessibilityState
        ?.selected,
    ).toBe(true);

    const breakthrough = findByLabel(tree.root, 'Breakthrough');
    act(() => {
      (breakthrough.props as { onPress?: () => void }).onPress?.();
    });
    expect(props.onChangeStrength).toHaveBeenCalledWith('breakthrough');
  });

  it('invokes onClose when the dismiss X is pressed', () => {
    const { tree, props } = renderSheet();
    const dismiss = findByLabel(tree.root, 'Close');
    act(() => {
      (dismiss.props as { onPress?: () => void }).onPress?.();
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to onClose when no onCancel is supplied', () => {
    const { tree, props } = renderSheet();
    const cancel = findByLabel(tree.root, 'Cancel');
    act(() => {
      (cancel.props as { onPress?: () => void }).onPress?.();
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('routes Cancel to a dedicated onCancel handler when supplied', () => {
    const onCancel = jest.fn();
    const { tree, props } = renderSheet({ onCancel });
    const cancel = findByLabel(tree.root, 'Cancel');
    act(() => {
      (cancel.props as { onPress?: () => void }).onPress?.();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
