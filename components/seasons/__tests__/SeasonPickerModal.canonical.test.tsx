import React from 'react';
import { SeasonPickerModal } from '../SeasonPickerModal';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
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
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

jest.mock('@/components/cards/constants', () => ({
  IOS_COLORS: {
    label: '#000',
    secondaryLabel: '#666',
    tertiaryLabel: '#999',
    blue: '#007AFF',
    green: '#34C759',
    systemBackground: '#fff',
    tertiarySystemBackground: '#f5f5f7',
    separator: '#e5e5e5',
  },
  TUFTE_BACKGROUND: '#fff',
}));

const flatten = (node: any): any[] => {
  if (!node || typeof node !== 'object') return [];
  // Expand function components by calling them with their props. Each component
  // in this file is hookless; this works for the canonical sheet sub-tree.
  if (typeof node.type === 'function') {
    const rendered = node.type(node.props);
    return [node, ...flatten(rendered)];
  }
  const children = React.Children.toArray(node.props?.children);
  return [node, ...children.flatMap(flatten)];
};

const mkSeason = (overrides: any = {}): any => ({
  id: overrides.id || 'season-id',
  name: overrides.name || 'Winter 2025–2026',
  short_name: null,
  year: 2025,
  status: overrides.status || 'completed',
  start_date: overrides.start_date || '2025-11-01',
  end_date: overrides.end_date || '2026-05-31',
  regatta_count: 0,
  race_count: overrides.race_count ?? 12,
  completed_count: overrides.completed_count ?? 12,
  user_position: null,
  user_points: null,
});

const mkActiveSeason = (overrides: any = {}): any => ({
  id: overrides.id || 'active-id',
  name: overrides.name || 'Winter 2025–2026',
  year: 2025,
  status: 'active',
  start_date: overrides.start_date || '2025-11-01',
  end_date: overrides.end_date || '2026-05-31',
  created_at: '',
  updated_at: '',
  summary: {
    regatta_count: 0,
    total_races: overrides.total ?? 14,
    completed_races: overrides.completed ?? 6,
    upcoming_races: 8,
  },
});

const render = (
  overrides: Partial<React.ComponentProps<typeof SeasonPickerModal>> = {},
) => {
  const onSelectSeason = jest.fn();
  const onManageSeasons = jest.fn();
  const onClose = jest.fn();
  const element = SeasonPickerModal({
    visible: true,
    selectedSeasonId: null,
    currentSeason: mkActiveSeason(),
    allSeasons: [],
    onClose,
    onSelectSeason,
    onManageSeasons,
    periodTerm: 'Season',
    useCanonicalLayout: true,
    ...overrides,
  }) as React.ReactElement<any>;
  return { element, nodes: flatten(element), onSelectSeason, onManageSeasons, onClose };
};

const findByTestID = (nodes: any[], id: string) =>
  nodes.find((n) => n.props?.testID === id);

const findAllByTestID = (nodes: any[], id: string) =>
  nodes.filter((n) => n.props?.testID === id);

describe('SeasonPickerModal canonical layout', () => {
  it('renders the "Switch <period>" title using the periodTerm prop', () => {
    const sailing = render({ periodTerm: 'Season' });
    const nursing = render({ periodTerm: 'Rotation' });
    const concatText = (nodes: any[]) =>
      nodes
        .filter((n) => n?.type === 'Text')
        .map((n) =>
          React.Children
            .toArray(n.props?.children)
            .map((c) => String(c))
            .join(''),
        );
    expect(concatText(sailing.nodes)).toEqual(expect.arrayContaining(['Switch season']));
    expect(concatText(nursing.nodes)).toEqual(expect.arrayContaining(['Switch rotation']));
  });

  it('always renders the active row with check icon when currentSeason exists', () => {
    const { nodes } = render();
    const activeRow = findByTestID(nodes, 'series-picker-row-active');
    expect(activeRow).toBeDefined();
  });

  it('partitions past vs upcoming based on status', () => {
    const past = mkSeason({ id: 'p1', name: 'Summer 2025', status: 'completed' });
    const archived = mkSeason({ id: 'p2', name: 'Winter 2024–2025', status: 'archived' });
    const upcoming = mkSeason({
      id: 'u1',
      name: 'Summer 2026',
      status: 'upcoming',
      race_count: 0,
      completed_count: 0,
    });
    const { nodes } = render({
      allSeasons: [past, archived, upcoming],
    });
    const pastRows = findAllByTestID(nodes, 'series-picker-row-past');
    const upcomingRows = findAllByTestID(nodes, 'series-picker-row-upcoming');
    expect(pastRows.length).toBe(2);
    expect(upcomingRows.length).toBe(1);
  });

  it('skips the past/upcoming sections entirely when no rows fall in them', () => {
    const { nodes } = render({ allSeasons: [] });
    expect(findAllByTestID(nodes, 'series-picker-row-past').length).toBe(0);
    expect(findAllByTestID(nodes, 'series-picker-row-upcoming').length).toBe(0);
  });

  it('Create + Manage actions both call onManageSeasons after the close delay', () => {
    jest.useFakeTimers();
    try {
      const { nodes, onManageSeasons, onClose } = render();
      findByTestID(nodes, 'series-picker-action-sparkles')?.props.onPress();
      findByTestID(nodes, 'series-picker-action-settings-sharp')?.props.onPress();
      // Both actions close the sheet synchronously, then fire onManageSeasons
      // on a 100ms timer so the modal animation can finish first.
      expect(onClose).toHaveBeenCalled();
      jest.runAllTimers();
      expect(onManageSeasons).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('Cancel button closes the sheet', () => {
    const { nodes, onClose } = render();
    findByTestID(nodes, 'series-picker-cancel')?.props.onPress();
    expect(onClose).toHaveBeenCalled();
  });

  it('tapping a season row calls onSelectSeason with that id', () => {
    const past = mkSeason({ id: 'past-id', name: 'Summer 2025', status: 'completed' });
    const { nodes, onSelectSeason } = render({ allSeasons: [past] });
    findByTestID(nodes, 'series-picker-row-past')?.props.onPress();
    expect(onSelectSeason).toHaveBeenCalledWith('past-id');
  });
});

describe('SeasonPickerModal legacy layout', () => {
  it('renders the legacy "Select <period>" title when useCanonicalLayout is false', () => {
    const element = SeasonPickerModal({
      visible: true,
      selectedSeasonId: null,
      currentSeason: mkActiveSeason(),
      allSeasons: [],
      onClose: jest.fn(),
      onSelectSeason: jest.fn(),
      onManageSeasons: jest.fn(),
      periodTerm: 'Season',
      useCanonicalLayout: false,
    }) as React.ReactElement<any>;
    const nodes = flatten(element);
    const concatText = (xs: any[]) =>
      xs
        .filter((n) => n?.type === 'Text')
        .map((n) =>
          React.Children
            .toArray(n.props?.children)
            .map((c) => String(c))
            .join(''),
        );
    const texts = concatText(nodes);
    expect(texts).toEqual(expect.arrayContaining(['Select Season']));
    expect(texts).not.toEqual(expect.arrayContaining(['Switch season']));
  });
});
