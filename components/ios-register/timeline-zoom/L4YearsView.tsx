/**
 * L4 — every season as a lane of capability-tinted bricks. The archive
 * lives here.
 *
 * Frame 4/8. "All your steps" headline + N seasons · M steps · since DATE.
 * Search field. Filter chips (All + capability shortcuts). Lanes per
 * season — current season in full color, archived seasons dimmed but
 * tappable. Each step is a small capability-tinted brick. Tap any brick →
 * zoom to L1 with that step focused.
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { TimelineDataset, TimelineSeason } from './types';

interface L4YearsViewProps {
  dataset: TimelineDataset;
  onOpenStep: (stepId: string) => void;
}

export function L4YearsView({ dataset, onOpenStep }: L4YearsViewProps) {
  const [activeFilter, setActiveFilter] = useState('all');

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.title}>All your steps</Text>
        <Text style={styles.subtitle}>
          {dataset.totalSeasons} seasons · {dataset.totalSteps} steps · since {dataset.sinceDate}
        </Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={15} color={IOS_REGISTER.labelTertiary} />
        <Text style={styles.searchPlaceholder}>Search steps, capabilities, blueprints…</Text>
        <Ionicons
          name="mic-outline"
          size={15}
          color={IOS_REGISTER.labelTertiary}
          style={styles.searchMic}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {dataset.capabilityFilters.map((filter) => {
          const active = filter.id === activeFilter;
          return (
            <Pressable
              key={filter.id}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter.id)}
            >
              {filter.icon ? (
                <Ionicons
                  name={filter.icon as keyof typeof Ionicons.glyphMap}
                  size={12}
                  color={
                    active
                      ? '#FFFFFF'
                      : filter.color ?? IOS_REGISTER.labelSecondary
                  }
                />
              ) : null}
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {dataset.seasons.map((season, idx) => (
        <SeasonLane
          key={season.id}
          season={season}
          isCurrent={idx === 0}
          onOpenStep={() => onOpenStep(dataset.focusStepId)}
        />
      ))}
    </ScrollView>
  );
}

function SeasonLane({
  season,
  isCurrent,
  onOpenStep,
}: {
  season: TimelineSeason;
  isCurrent: boolean;
  onOpenStep: () => void;
}) {
  return (
    <View style={[styles.lane, season.archived && styles.laneArchived]}>
      <View style={styles.laneHeadRow}>
        <View style={styles.laneTitleRow}>
          {season.archived ? (
            <Ionicons name="archive-outline" size={14} color={IOS_REGISTER.labelSecondary} />
          ) : null}
          <Text style={[styles.laneTitle, season.archived && styles.laneTitleArchived]}>
            {season.title}
          </Text>
          <Text style={styles.laneDates}>
            {isCurrent ? `${season.dateRange.split('—')[0].trim()} — present` : season.dateRange}
          </Text>
        </View>
        <Text style={styles.laneCount}>{season.bricks.length}</Text>
      </View>

      <View style={styles.bricksWrap}>
        {season.bricks.map((b, i) => (
          <Pressable
            key={i}
            onPress={onOpenStep}
            style={[
              styles.brick,
              { backgroundColor: season.archived ? withAlpha(b.capabilityColor, 0.45) : b.capabilityColor },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const BRICK_SIZE = 22;
const BRICK_GAP = 4;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    height: 36,
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: IOS_REGISTER.labelTertiary,
  },
  searchMic: {
    marginLeft: 'auto',
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
  },
  filterChipActive: {
    backgroundColor: '#1F1F1F',
    borderColor: '#1F1F1F',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  lane: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  laneArchived: {
    opacity: 0.95,
  },
  laneHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  laneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  laneTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
  },
  laneTitleArchived: {
    color: IOS_REGISTER.labelSecondary,
    fontWeight: '500',
  },
  laneDates: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    marginLeft: 4,
  },
  laneCount: {
    fontSize: 13,
    color: IOS_REGISTER.labelTertiary,
    fontWeight: '500',
  },
  bricksWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BRICK_GAP,
  },
  brick: {
    width: BRICK_SIZE,
    height: BRICK_SIZE,
    borderRadius: 3,
  },
});
