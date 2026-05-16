import React from 'react';
import { JumpToPickerSheet, type JumpToPickerItem } from '../JumpToPickerSheet';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native', () => ({
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  },
  Text: 'Text',
  View: 'View',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

const flatten = (node: any): any[] => {
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') {
    const rendered = node.type(node.props);
    return [node, ...flatten(rendered)];
  }
  const children = React.Children.toArray(node.props?.children);
  return [node, ...children.flatMap(flatten)];
};

const findByTestID = (nodes: any[], id: string) =>
  nodes.find((n) => n.props?.testID === id);

const findAllByTestIDPrefix = (nodes: any[], prefix: string) =>
  nodes.filter((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith(prefix));

const concatText = (nodes: any[]) =>
  nodes
    .filter((n) => n?.type === 'Text')
    .map((n) =>
      React.Children
        .toArray(n.props?.children)
        .map((c) => String(c))
        .join(''),
    );

const items: JumpToPickerItem[] = [
  { id: 's1', index: 1, title: 'Boat preparation', kind: 'completed', dateLabel: 'Mon May 5' },
  { id: 's2', index: 2, title: 'Heavy-air rig tuning', kind: 'completed', dateLabel: 'Thu May 8' },
  { id: 's3', index: 3, title: 'Light-air starts in shifty breeze', kind: 'current', dateLabel: 'Sat May 17' },
  { id: 's4', index: 4, title: 'Heavy-air starts', kind: 'upcoming', dateLabel: 'Mon May 18' },
];

const renderSheet = (
  props: Partial<React.ComponentProps<typeof JumpToPickerSheet>> = {},
) => {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  const element = JumpToPickerSheet({
    visible: true,
    seriesLabel: 'Season',
    seriesName: 'Winter 2025–2026',
    currentIndex: 3,
    totalSteps: 4,
    progress: 3 / 4,
    items,
    onSelect,
    onClose,
    ...props,
  }) as React.ReactElement<any>;
  return { element, nodes: flatten(element), onSelect, onClose };
};

describe('JumpToPickerSheet', () => {
  it('renders the canonical title "Jump to" plus the series-name subhead with step count', () => {
    const { nodes } = renderSheet();
    const texts = concatText(nodes);
    expect(texts).toEqual(expect.arrayContaining(['Jump to']));
    expect(texts).toEqual(expect.arrayContaining(['Winter 2025–2026 · 4 steps']));
  });

  it('drops the step count from the subhead when totalSteps is 0', () => {
    const { nodes } = renderSheet({ currentIndex: 0, totalSteps: 0, items: [] });
    expect(concatText(nodes)).toEqual(expect.arrayContaining(['Winter 2025–2026']));
    expect(concatText(nodes)).not.toEqual(expect.arrayContaining(['Winter 2025–2026 · 0 steps']));
  });

  it('progress fill width matches the clamped progress fraction', () => {
    const fill = findByTestID(renderSheet({ progress: 0.428 }).nodes, 'jump-to-progress');
    const width = (fill.props.style as any[]).find(
      (s: any) => s && typeof s.width === 'string',
    ).width;
    expect(width).toBe('42.8%');
  });

  it('clamps out-of-range progress to [0, 1]', () => {
    const over = findByTestID(renderSheet({ progress: 2 }).nodes, 'jump-to-progress');
    expect((over.props.style as any[]).find((s: any) => s.width).width).toBe('100%');
    const under = findByTestID(renderSheet({ progress: -0.5 }).nodes, 'jump-to-progress');
    expect((under.props.style as any[]).find((s: any) => s.width).width).toBe('0%');
  });

  it('renders one row per item with testID jump-to-row-<id>', () => {
    const { nodes } = renderSheet();
    expect(findAllByTestIDPrefix(nodes, 'jump-to-row-').length).toBe(items.length);
  });

  it('tapping a row calls onSelect with the row id and then onClose', () => {
    const { nodes, onSelect, onClose } = renderSheet();
    findByTestID(nodes, 'jump-to-row-s2')?.props.onPress();
    expect(onSelect).toHaveBeenCalledWith('s2');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel, Back, and X all call onClose', () => {
    const { nodes, onClose } = renderSheet();
    findByTestID(nodes, 'jump-to-cancel')?.props.onPress();
    findByTestID(nodes, 'jump-to-back')?.props.onPress();
    findByTestID(nodes, 'jump-to-close')?.props.onPress();
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
