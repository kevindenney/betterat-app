import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';
import { DoAutoSummaryCard, type DoAutoSummaryCardProps } from '../DoAutoSummaryCard';
import type { DoCaptureItem } from '../doCaptureModel';

// React 19's act() requires this flag; without it TestRenderer prints a noisy warning.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('react-native', () => {
  const StyleSheet = { create: (styles: unknown) => styles, hairlineWidth: 1 };
  return {
    Pressable: 'Pressable',
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

const render = (props: DoAutoSummaryCardProps) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DoAutoSummaryCard {...props} />);
  });
  return tree;
};

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

describe('DoAutoSummaryCard — Frame 3 · C + D', () => {
  it('renders the Auto-summary eyebrow with a sparkle glyph', () => {
    const tree = render({ captures: [], narrative: 'short' });
    expect(allText(tree.root)).toContain('Auto-summary');
    const icons = tree.root.findAll(
      (n: ReactTestInstance) => typeof n.type === 'string' && n.type === 'Ionicons',
    );
    expect(icons.some((i: ReactTestInstance) => i.props.name === 'sparkles')).toBe(true);
  });

  it('renders the narrative when provided and omits it when absent', () => {
    const withNarr = render({ captures: [], narrative: 'You logged 9 moments.' });
    expect(allText(withNarr.root)).toContain('You logged 9 moments.');

    const noNarr = render({ captures: [] });
    expect(allText(noNarr.root)).not.toContain('You logged 9 moments.');
  });

  it('counts captures by display kind and only renders non-zero items (singular labels)', () => {
    const tree = render({
      captures: [
        cap({ id: 'v1', kind: 'voice' }),
        cap({ id: 'n1', kind: 'note' }),
        cap({
          id: 'm1',
          kind: 'time_marker',
          body: 'Beat 2 begins',
          markerLabel: 'Beat 2 begins',
          source: 'time_marker',
        }),
      ],
    });
    const text = allText(tree.root);
    expect(text).toContain('1');
    expect(text).toContain('voice');
    expect(text).toContain('note');
    expect(text).toContain('marker');
    expect(text).not.toContain('photo');
  });

  it('pluralises labels when the count is > 1', () => {
    const tree = render({
      captures: [
        cap({ id: 'v1', kind: 'voice' }),
        cap({ id: 'v2', kind: 'voice' }),
        cap({ id: 'n1', kind: 'note' }),
        cap({ id: 'n2', kind: 'note' }),
        cap({ id: 'p1', kind: 'photo', source: 'media_upload' }),
        cap({
          id: 'm1',
          kind: 'time_marker',
          body: 'a',
          markerLabel: 'a',
          source: 'time_marker',
        }),
        cap({
          id: 'm2',
          kind: 'time_marker',
          body: 'b',
          markerLabel: 'b',
          source: 'time_marker',
        }),
      ],
    });
    const text = allText(tree.root);
    expect(text).toContain('voice');
    expect(text).toContain('notes');
    expect(text).toContain('photo');
    expect(text).toContain('markers');
  });

  it('renders the step-context chip when stepChipLabel is provided', () => {
    const tree = render({
      captures: [],
      narrative: 'x',
      stepChipLabel: 'Light-air starts',
    });
    expect(allText(tree.root)).toContain('Light-air starts');
  });

  it('renders the refine pressable only when onRefineSummary is provided', () => {
    const without = render({ captures: [], narrative: 'x' });
    expect(allText(without.root)).not.toContain('Refine summary');

    const onRefineSummary = jest.fn();
    const withCb = render({ captures: [], narrative: 'x', onRefineSummary });
    expect(allText(withCb.root)).toContain('Refine summary');
    expect(
      withCb.root.findAll(
        (n: ReactTestInstance) => typeof n.type === 'string' && n.type === 'Pressable',
      ),
    ).toHaveLength(1);
  });
});
