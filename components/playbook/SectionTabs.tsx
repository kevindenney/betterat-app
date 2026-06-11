/**
 * SectionTabs — 5-tab navigation for the Playbook home (Concepts / Resources /
 * Patterns / Reviews / Q&A). Tapping a tab pushes the corresponding sub-route.
 * Counts come from `usePlaybookSectionCounts`.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { PlaybookSectionCounts } from '@/services/PlaybookService';

interface SectionTabsProps {
  counts: PlaybookSectionCounts | undefined;
}

type Tab = {
  key: keyof PlaybookSectionCounts;
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TABS: Tab[] = [
  { key: 'concepts', label: 'Concepts', route: '/library/concepts', icon: 'bulb-outline' },
  { key: 'resources', label: 'Resources', route: '/library/resources', icon: 'library-outline' },
  { key: 'patterns', label: 'Patterns', route: '/library/patterns', icon: 'analytics-outline' },
  { key: 'reviews', label: 'Reviews', route: '/library/reviews', icon: 'calendar-outline' },
  { key: 'qa', label: 'Q&A', route: '/library/qa', icon: 'help-circle-outline' },
];

export function SectionTabs({ counts }: SectionTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {TABS.map((tab) => {
        const count = counts?.[tab.key] ?? 0;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => router.push(tab.route as any)}
            style={styles.tab}
            activeOpacity={0.85}
          >
            <Ionicons name={tab.icon} size={16} color={IOS_COLORS.systemBlue} />
            <Text style={styles.label}>{tab.label}</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginHorizontal: 2,
  },
  countPill: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
});
