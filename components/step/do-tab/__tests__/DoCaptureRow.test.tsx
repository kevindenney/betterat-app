import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';
import { DoCaptureRow, type DoCaptureRowProps } from '../DoCaptureRow';
import { formatClockTime, type DoCaptureItem } from '../doCaptureModel';

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
  body: over.body ?? '',
  capabilityIds: [],
  capabilityLabels: [],
  flaggedForDebrief: false,
  source: 'act_observation',
  ...over,
});

const renderRow = (props: DoCaptureRowProps) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DoCaptureRow {...props} />);
  });
  return tree;
};

const componentNames = (root: ReactTestInstance): string[] =>
  root.findAll(() => true).map((n: ReactTestInstance) => {
    const t = n.type as { name?: string; displayName?: string } | string;
    if (typeof t === 'string') return t;
    return t.displayName ?? t.name ?? '';
  });

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

describe('DoCaptureRow — Frame 2 dispatch', () => {
  it('mounts VoiceCapturePreview for voice kind', () => {
    const tree = renderRow({
      capture: cap({ kind: 'voice', body: '"Test"', voicePeaks: [0.5, 0.5], voiceDurationSec: 7 }),
    });
    expect(componentNames(tree.root)).toContain('VoiceCapturePreview');
  });

  it('mounts PhotoCapturePreview for photo kind', () => {
    const tree = renderRow({
      capture: cap({
        kind: 'photo',
        body: 'caption',
        mediaUri: 'https://example.com/p.jpg',
        source: 'media_upload',
      }),
    });
    expect(componentNames(tree.root)).toContain('PhotoCapturePreview');
  });

  it('mounts QuickNoteCapturePreview for note kind', () => {
    const tree = renderRow({ capture: cap({ kind: 'note', body: 'typed' }) });
    expect(componentNames(tree.root)).toContain('QuickNoteCapturePreview');
  });

  it('short-circuits to TimeMarkerCapturePreview for time_marker kind', () => {
    const tree = renderRow({
      capture: cap({
        kind: 'time_marker',
        body: 'Beat 2 begins',
        markerLabel: 'Beat 2 begins',
        source: 'time_marker',
      }),
    });
    const names = componentNames(tree.root);
    expect(names).toContain('TimeMarkerCapturePreview');
    expect(names).not.toContain('QuickNoteCapturePreview');
  });

  it('renders the live coral chip with a pulsing ring when chipLive is true', () => {
    const tree = renderRow({
      capture: cap({ kind: 'voice', chipLabel: 'Weather', chipLive: true }),
    });
    expect(
      tree.root.findAllByType('AnimatedView' as unknown as React.ComponentType).length,
    ).toBeGreaterThan(0);
  });

  it('omits edit/delete pressables for a typed note when no callbacks provided', () => {
    const tree = renderRow({ capture: cap({ kind: 'note', body: 'no actions' }) });
    expect(
      tree.root.findAllByType('Pressable' as unknown as React.ComponentType),
    ).toHaveLength(0);
  });

  it('renders both edit and delete pressables when callbacks are provided', () => {
    const tree = renderRow({
      capture: cap({ kind: 'note', body: 'has actions' }),
      onEdit: jest.fn(),
      onDelete: jest.fn(),
    });
    expect(
      tree.root.findAllByType('Pressable' as unknown as React.ComponentType).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('renders the clock time without the removed relative-ago label', () => {
    const now = Date.parse('2026-05-16T14:30:00Z');
    const capturedAt = '2026-05-16T14:27:00Z';
    const tree = renderRow({
      capture: cap({ kind: 'note', body: 'x', capturedAt }),
      nowMs: now,
    });
    const text = allText(tree.root);
    expect(text).toContain(formatClockTime(capturedAt));
    expect(text).not.toContain('3m');
  });

  it('suppresses the fresh wash when frozen is true even if fresh is requested (Frame 3)', () => {
    const tree = renderRow({
      capture: cap({ kind: 'note', body: 'frozen row' }),
      fresh: true,
      frozen: true,
    });
    // No Animated.View should render for a typed frozen row with no chip.
    expect(
      tree.root.findAllByType('AnimatedView' as unknown as ComponentType),
    ).toHaveLength(0);
  });

  it('renders a neutral chip (no Animated.View pulse) when frozen, even if chipLive is true', () => {
    const tree = renderRow({
      capture: cap({ kind: 'voice', chipLabel: 'Weather', chipLive: true }),
      frozen: true,
    });
    // chipLive's pulsing ring is an Animated.View; frozen suppresses it.
    expect(
      tree.root.findAllByType('AnimatedView' as unknown as ComponentType),
    ).toHaveLength(0);
    expect(allText(tree.root)).toContain('Weather');
  });

  it('wraps the row in a Pressable that fires onMarkAsEvidence when frozen + callback provided', () => {
    const onMarkAsEvidence = jest.fn();
    const tree = renderRow({
      capture: cap({ kind: 'note', body: 'tap me', id: 'obs:obs-1' }),
      frozen: true,
      onMarkAsEvidence,
    });
    const pressables = tree.root.findAllByType('Pressable' as unknown as ComponentType);
    expect(pressables.length).toBeGreaterThan(0);
    const outer = pressables[0];
    outer.props.onPress?.();
    expect(onMarkAsEvidence).toHaveBeenCalledWith('obs:obs-1');
  });

  it('does NOT wrap the row in a Pressable when not frozen even if onMarkAsEvidence is provided (Frame 2 stays non-interactive)', () => {
    const onMarkAsEvidence = jest.fn();
    const tree = renderRow({
      capture: cap({ kind: 'note', body: 'live row' }),
      frozen: false,
      onMarkAsEvidence,
    });
    expect(
      tree.root.findAllByType('Pressable' as unknown as ComponentType),
    ).toHaveLength(0);
  });
});
