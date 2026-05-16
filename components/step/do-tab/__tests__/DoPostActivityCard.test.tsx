import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';
import { DoPostActivityCard, type DoPostActivityCardProps } from '../DoPostActivityCard';
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
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    StyleSheet,
    Text: 'Text',
    View: 'View',
  };
});

const cap = (over: Partial<DoCaptureItem>): DoCaptureItem => ({
  id: over.id ?? 'cap',
  kind: over.kind ?? 'note',
  capturedAt: over.capturedAt ?? '2026-05-16T14:20:00Z',
  body: over.body ?? 'note body',
  capabilityIds: [],
  capabilityLabels: [],
  flaggedForDebrief: false,
  source: 'act_observation',
  ...over,
});

const renderCard = (overrides: Partial<DoPostActivityCardProps> = {}) => {
  const props: DoPostActivityCardProps = {
    captures: [],
    stepTitle: 'Light-air starts in shifty breeze',
    contextSegments: ['Race 4', 'finished'],
    elapsedMs: 18 * 60 * 1000 + 24 * 1000,
    nowMs: Date.parse('2026-05-16T14:38:00Z'),
    ...overrides,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DoPostActivityCard {...props} />);
  });
  return tree;
};

const componentNames = (root: ReactTestInstance): string[] =>
  root.findAll(() => true).map((n: ReactTestInstance) => {
    const t = n.type as { name?: string; displayName?: string } | string;
    if (typeof t === 'string') return t;
    return t.displayName ?? t.name ?? '';
  });

const findByName = (root: ReactTestInstance, name: string): ReactTestInstance | undefined => {
  try {
    return root.find(
      (n: ReactTestInstance) =>
        typeof n.type !== 'string' &&
        ((n.type as { name?: string }).name === name ||
          (n.type as { displayName?: string }).displayName === name),
    );
  } catch {
    return undefined;
  }
};

const findAllByName = (root: ReactTestInstance, name: string): ReactTestInstance[] =>
  root.findAll(
    (n: ReactTestInstance) =>
      typeof n.type !== 'string' &&
      ((n.type as { name?: string }).name === name ||
        (n.type as { displayName?: string }).displayName === name),
  );

const allText = (root: ReactTestInstance): string =>
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

describe('DoPostActivityCard — Frame 3 surface', () => {
  it('renders the activity-complete pill, context strip, and auto-summary card', () => {
    const tree = renderCard({
      captures: [
        cap({ id: 'v', kind: 'voice', body: '"voice"', capturedAt: '2026-05-16T14:23:00Z' }),
        cap({ id: 'n', kind: 'note', body: 'typed', capturedAt: '2026-05-16T14:20:00Z' }),
      ],
      summaryText: 'You logged 2 moments.',
      summaryStepChipLabel: 'Light-air starts',
    });
    const names = componentNames(tree.root);
    expect(names).toContain('DoActivityCompletePill');
    expect(names).toContain('DoStepContextStrip');
    expect(names).toContain('DoAutoSummaryCard');

    const text = allText(tree.root);
    expect(text).toContain('Light-air starts in shifty breeze');
    expect(text).toContain('You logged 2 moments.');
    expect(text).toContain('Auto-summary');
    expect(text).toContain('18:24');
  });

  it('forwards refine summary callback to DoAutoSummaryCard', () => {
    const onRefineSummary = jest.fn();
    const tree = renderCard({
      captures: [cap({ id: 'a' })],
      summaryText: 'short',
      onRefineSummary,
    });
    const summary = findByName(tree.root, 'DoAutoSummaryCard');
    expect(summary?.props.onRefineSummary).toBe(onRefineSummary);
  });

  it('renders captures via DoCaptureRow with frozen=true (no fresh wash)', () => {
    const tree = renderCard({
      captures: [
        cap({ id: 'old', body: 'oldest', capturedAt: '2026-05-16T14:00:00Z' }),
        cap({ id: 'new', body: 'newest', capturedAt: '2026-05-16T14:25:00Z' }),
      ],
    });
    const rows = findAllByName(tree.root, 'DoCaptureRow');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.props.frozen).toBe(true);
    }
  });

  it('renders captures in reverse-chronological order (newest first)', () => {
    const captures: DoCaptureItem[] = [
      cap({ id: 'old', capturedAt: '2026-05-16T13:00:00Z' }),
      cap({ id: 'mid', capturedAt: '2026-05-16T14:00:00Z' }),
      cap({ id: 'new', capturedAt: '2026-05-16T14:25:00Z' }),
    ];
    const tree = renderCard({ captures });
    const rows = findAllByName(tree.root, 'DoCaptureRow');
    expect((rows[0].props as { capture: DoCaptureItem }).capture.id).toBe('new');
    expect((rows[1].props as { capture: DoCaptureItem }).capture.id).toBe('mid');
    expect((rows[2].props as { capture: DoCaptureItem }).capture.id).toBe('old');
  });

  it('forwards the Move-to-Reflect callback to DoMoveToReflectCTA', () => {
    const onMoveToReflect = jest.fn();
    const tree = renderCard({ onMoveToReflect });
    const cta = findByName(tree.root, 'DoMoveToReflectCTA');
    expect(cta?.props.onPress).toBe(onMoveToReflect);
  });

  it('forwards both secondary actions to DoSecondaryActions', () => {
    const onAddAnotherCapture = jest.fn();
    const onDiscardActivity = jest.fn();
    const tree = renderCard({ onAddAnotherCapture, onDiscardActivity });
    const sec = findByName(tree.root, 'DoSecondaryActions');
    expect(sec?.props.onAddAnotherCapture).toBe(onAddAnotherCapture);
    expect(sec?.props.onDiscardActivity).toBe(onDiscardActivity);
  });

  it('disables CTA and secondary actions when readOnly is true', () => {
    const tree = renderCard({
      readOnly: true,
      onMoveToReflect: jest.fn(),
      onAddAnotherCapture: jest.fn(),
      onDiscardActivity: jest.fn(),
    });
    const cta = findByName(tree.root, 'DoMoveToReflectCTA');
    const sec = findByName(tree.root, 'DoSecondaryActions');
    expect(cta?.props.disabled).toBe(true);
    expect(sec?.props.readOnly).toBe(true);
  });

  it('excludes time_marker rows from the capture-count stat and reports markers separately', () => {
    const captures: DoCaptureItem[] = [
      cap({ id: 'a', kind: 'voice', capturedAt: '2026-05-16T14:00:00Z' }),
      cap({ id: 'b', kind: 'note', capturedAt: '2026-05-16T14:05:00Z' }),
      cap({
        id: 'm',
        kind: 'time_marker',
        body: 'Beat 2 begins',
        markerLabel: 'Beat 2 begins',
        source: 'time_marker',
        capturedAt: '2026-05-16T14:08:00Z',
      }),
    ];
    const tree = renderCard({ captures });
    const text = allText(tree.root);
    // Stat reads "2" for non-marker captures
    expect(text).toContain('2 | Captures');
    // Eyebrow total reports markers separately
    expect(text).toContain('1');
    expect(text).toContain('marker');
  });

  it('renders the empty-stream message when there are no captures', () => {
    const tree = renderCard({ captures: [] });
    const text = allText(tree.root);
    expect(text).toContain('No captures from this activity.');
  });
});
