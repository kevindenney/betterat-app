import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';
import { DoLiveCard, type DoLiveCardProps } from '../DoLiveCard';
import type { DoCaptureItem } from '../doCaptureModel';

// React 19's act() requires this flag; without it TestRenderer prints a noisy
// warning even though every render is wrapped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'Animated.View' },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedStyle: () => ({}),
  withTiming: (toValue: number) => toValue,
  withRepeat: (anim: unknown) => anim,
  cancelAnimation: () => undefined,
  Easing: { out: () => (v: number) => v, ease: (v: number) => v },
}));

jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_, key) => String(key) }),
);

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
    Platform: {
      OS: 'ios',
      select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
    },
  };
});

const baseCapture = (over: Partial<DoCaptureItem>): DoCaptureItem => ({
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

const renderCard = (overrides: Partial<DoLiveCardProps> = {}) => {
  const props: DoLiveCardProps = {
    captures: [],
    stepTitle: 'Light-air starts in shifty breeze',
    contextSegments: ['Race 4', 'beat 2'],
    elapsedMs: 14 * 60 * 1000 + 52 * 1000,
    nowMs: Date.parse('2026-05-16T14:30:00Z'),
    interestSlug: 'sail-racing',
    ...overrides,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DoLiveCard {...props} />);
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

describe('DoLiveCard — Frame 2 surface', () => {
  it('renders the live header (mm:ss elapsed) and the context strip with step title', () => {
    const tree = renderCard({
      captures: [
        baseCapture({ id: 'a', body: 'one' }),
        baseCapture({ id: 'b', body: 'two', capturedAt: '2026-05-16T14:22:00Z' }),
      ],
    });
    const names = componentNames(tree.root);
    expect(names).toContain('DoLiveHeader');
    expect(names).toContain('DoStepContextStrip');
    const text = allText(tree.root);
    expect(text).toContain('Live · capturing');
    expect(text).toContain('14:52');
    expect(text).toContain('Light-air starts in shifty breeze');
  });

  it('renders captures via DoCaptureRow in reverse-chronological order (newest first)', () => {
    const captures: DoCaptureItem[] = [
      baseCapture({ id: 'old', body: 'oldest', capturedAt: '2026-05-16T13:00:00Z' }),
      baseCapture({ id: 'mid', body: 'middle', capturedAt: '2026-05-16T14:00:00Z' }),
      baseCapture({ id: 'new', body: 'newest', capturedAt: '2026-05-16T14:25:00Z' }),
    ];
    const tree = renderCard({ captures });
    const rows = tree.root.findAll(
      (n: ReactTestInstance) =>
        typeof n.type !== 'string' &&
        ((n.type as { name?: string }).name === 'DoCaptureRow' ||
          (n.type as { displayName?: string }).displayName === 'DoCaptureRow'),
    );
    expect(rows).toHaveLength(3);
    expect((rows[0].props as { capture: DoCaptureItem }).capture.id).toBe('new');
    expect((rows[1].props as { capture: DoCaptureItem }).capture.id).toBe('mid');
    expect((rows[2].props as { capture: DoCaptureItem }).capture.id).toBe('old');
  });

  it('marks only the topmost non-marker capture as fresh', () => {
    const captures: DoCaptureItem[] = [
      baseCapture({ id: 'old', body: 'oldest', capturedAt: '2026-05-16T13:00:00Z' }),
      baseCapture({ id: 'new', body: 'newest', capturedAt: '2026-05-16T14:25:00Z' }),
    ];
    const tree = renderCard({ captures });
    const rows = tree.root.findAll(
      (n: ReactTestInstance) =>
        typeof n.type !== 'string' &&
        ((n.type as { name?: string }).name === 'DoCaptureRow' ||
          (n.type as { displayName?: string }).displayName === 'DoCaptureRow'),
    );
    expect((rows[0].props as { fresh?: boolean }).fresh).toBe(true);
    expect((rows[1].props as { fresh?: boolean }).fresh).toBe(false);
  });

  it('renders the composer and stop-capturing button', () => {
    const tree = renderCard();
    const names = componentNames(tree.root);
    expect(names).toContain('StreamComposer');
    expect(names).toContain('StopCapturingCTA');
  });

  it('forwards composer callbacks for all three first-class affordances', () => {
    const onAddQuickNote = jest.fn();
    const onAddPhoto = jest.fn();
    const onAddVoiceNote = jest.fn();
    const tree = renderCard({ onAddQuickNote, onAddPhoto, onAddVoiceNote });
    const composer = tree.root.find(
      (n: ReactTestInstance) =>
        typeof n.type !== 'string' &&
        ((n.type as { name?: string }).name === 'StreamComposer' ||
          (n.type as { displayName?: string }).displayName === 'StreamComposer'),
    );
    expect(composer.props.onAddQuickNote).toBe(onAddQuickNote);
    expect(composer.props.onAddPhoto).toBe(onAddPhoto);
    expect(composer.props.onAddVoiceNote).toBe(onAddVoiceNote);
  });

  it('forwards the stop-capturing callback to DoStopCapturingButton', () => {
    const onStopCapturing = jest.fn();
    const tree = renderCard({ onStopCapturing });
    const btn = tree.root.find(
      (n: ReactTestInstance) =>
        typeof n.type !== 'string' &&
        ((n.type as { name?: string }).name === 'StopCapturingCTA' ||
          (n.type as { displayName?: string }).displayName === 'StopCapturingCTA'),
    );
    expect(btn.props.onStop).toBe(onStopCapturing);
  });

  it('shows the empty-stream message when there are no captures and hides the freshest indicator', () => {
    const tree = renderCard({ captures: [] });
    const text = allText(tree.root);
    expect(text).toContain('Captures will appear here as you record them.');
    expect(text).not.toContain('Just now');
  });

  it('hides edit/delete affordances when readOnly is true (no callbacks passed to rows)', () => {
    const tree = renderCard({
      captures: [baseCapture({ id: 'a' })],
      readOnly: true,
      onEditCapture: jest.fn(),
      onDeleteCapture: jest.fn(),
    });
    const row = tree.root.find(
      (n: ReactTestInstance) =>
        typeof n.type !== 'string' &&
        ((n.type as { name?: string }).name === 'DoCaptureRow' ||
          (n.type as { displayName?: string }).displayName === 'DoCaptureRow'),
    );
    expect(row.props.onEdit).toBeUndefined();
    expect(row.props.onDelete).toBeUndefined();
  });

  it('passes edit/delete callbacks through to capture rows when not readOnly', () => {
    const onEditCapture = jest.fn();
    const onDeleteCapture = jest.fn();
    const tree = renderCard({
      captures: [baseCapture({ id: 'a' })],
      onEditCapture,
      onDeleteCapture,
    });
    const row = tree.root.find(
      (n: ReactTestInstance) =>
        typeof n.type !== 'string' &&
        ((n.type as { name?: string }).name === 'DoCaptureRow' ||
          (n.type as { displayName?: string }).displayName === 'DoCaptureRow'),
    );
    expect(row.props.onEdit).toBe(onEditCapture);
    expect(row.props.onDelete).toBe(onDeleteCapture);
  });

  it('excludes time_marker rows from the live header capture count', () => {
    const captures: DoCaptureItem[] = [
      baseCapture({ id: 'a', body: 'one' }),
      baseCapture({
        id: 'marker',
        kind: 'time_marker',
        capturedAt: '2026-05-16T14:08:00Z',
        body: 'Beat 2 begins',
        markerLabel: 'Beat 2 begins',
        source: 'time_marker',
      }),
      baseCapture({ id: 'b', body: 'two', capturedAt: '2026-05-16T14:22:00Z' }),
    ];
    const tree = renderCard({ captures });
    const header = tree.root.find(
      (n: ReactTestInstance) =>
        typeof n.type !== 'string' &&
        ((n.type as { name?: string }).name === 'DoLiveHeader' ||
          (n.type as { displayName?: string }).displayName === 'DoLiveHeader'),
    );
    expect(header.props.captureCount).toBe(2);
  });

  it('uses nursing-specific state, stop copy, and count-only timer default', () => {
    const tree = renderCard({
      interestSlug: 'nursing',
      captures: [],
      elapsedMs: 90_000,
    });
    const text = allText(tree.root);
    expect(text).toContain('On shift · capturing');
    expect(text).toContain('End shift');
    expect(text).toContain('Observations will appear here as you capture them.');
    expect(text).not.toContain('1:30');
  });
});
