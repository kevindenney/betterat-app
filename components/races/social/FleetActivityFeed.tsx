import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface FleetActivityItem {
  id: string;
  sailorName: string;
  message: string;
  timestamp: string;
  type: 'strategy' | 'comment' | 'conditions' | 'result';
}

interface FleetActivityFeedProps {
  items?: FleetActivityItem[];
  onSelectItem?: (item: FleetActivityItem) => void;
}

const DEFAULT_ITEMS: FleetActivityItem[] = [
  {
    id: '1',
    sailorName: 'Alex M.',
    message: 'Expecting stronger pressure on the right side after the shift.',
    timestamp: '5m ago',
    type: 'strategy',
  },
  {
    id: '2',
    sailorName: 'Jamie R.',
    message: 'Seeing current build near leeward gate.',
    timestamp: '12m ago',
    type: 'conditions',
  },
  {
    id: '3',
    sailorName: 'Taylor P.',
    message: 'Good lane at pin in last sequence, worth watching.',
    timestamp: '18m ago',
    type: 'comment',
  },
];

export function FleetActivityFeed({
  items = DEFAULT_ITEMS,
  onSelectItem,
}: FleetActivityFeedProps) {
  const [collapsed, setCollapsed] = useState(false);

  const sorted = useMemo(
    () => [...items],
    [items]
  );

  return (
    <View style={styles.container}>
      <Pressable style={styles.header} onPress={() => setCollapsed((prev) => !prev)}>
        <Text style={styles.title}>Fleet Activity</Text>
        <Text style={styles.toggle}>{collapsed ? 'Show' : 'Hide'}</Text>
      </Pressable>

      {!collapsed && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {sorted.map((item) => (
            <Pressable key={item.id} style={styles.card} onPress={() => onSelectItem?.(item)}>
              <Text style={styles.meta}>{item.sailorName} · {item.timestamp}</Text>
              <Text style={styles.message}>{item.message}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  toggle: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  row: {
    paddingHorizontal: 12,
    gap: 10,
  },
  card: {
    width: 250,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  meta: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    color: '#1F2937',
  },
});
