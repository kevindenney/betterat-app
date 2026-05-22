/**
 * L3 — current season in full, weeks as section heads, vertical scroll.
 *
 * Frame 3/7. Season title (e.g. "Spring '26 clinical"), org chip, date
 * range and "Week N of M". Sticky toolbar: Sort / Capability / Select.
 * Vertical sections per week with WEEK header + 2-up step cards.
 * Today's card is outlined iOS blue.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { StepDigestCard } from './StepDigestCard';
import type { TimelineDataset } from './types';

interface L3SeasonViewProps {
  dataset: TimelineDataset;
  focusStepId: string;
  onOpenStep: (stepId: string) => void;
  onEnterSelectMode?: () => void;
}

export function L3SeasonView({
  dataset,
  focusStepId,
  onOpenStep,
  onEnterSelectMode,
}: L3SeasonViewProps) {
  const season = dataset.seasons.find((s) => s.id === dataset.currentSeasonId);
  if (!season) return null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.title}>{season.title}</Text>
        <View style={styles.metaRow}>
          {season.orgChip ? (
            <View style={styles.orgChip}>
              <View style={styles.orgMonogram}>
                <Text style={styles.orgMonogramText}>{season.orgChip.monogram}</Text>
              </View>
              <Text style={styles.orgLabel}>{season.orgChip.label}</Text>
            </View>
          ) : null}
          <Text style={styles.dateRange}>{season.dateRange}</Text>
        </View>
        {season.weekOfTotal ? (
          <Text style={styles.weekOf}>
            Week {season.weekOfTotal.current} of {season.weekOfTotal.total}
          </Text>
        ) : null}
      </View>

      <View style={styles.toolbar}>
        <ToolbarButton icon="swap-vertical-outline" label="Sort" />
        <ToolbarButton icon="filter-outline" label="Capability" />
        <ToolbarButton
          icon="checkmark-circle-outline"
          label="Select"
          onPress={onEnterSelectMode}
        />
      </View>

      {season.weeks.map((week) => (
        <View key={week.id} style={styles.weekBlock}>
          <View style={styles.weekHeadRow}>
            <Text style={styles.weekHead}>
              WEEK {week.number}
              {week.isCurrent ? '  ·  THIS WEEK' : ''}
            </Text>
            <Text style={styles.weekRange}>{week.dateRange}</Text>
          </View>
          <View style={styles.cardPair}>
            {week.steps.slice(0, 2).map((step) => (
              <StepDigestCard
                key={step.id}
                step={step}
                compact
                highlighted={step.id === focusStepId}
                onPress={() => onOpenStep(step.id)}
              />
            ))}
            {week.steps.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function ToolbarButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.toolBtn} onPress={onPress}>
      <Ionicons name={icon} size={14} color={IOS_REGISTER.accentUserAction} />
      <Text style={styles.toolLabel}>{label}</Text>
    </Pressable>
  );
}

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
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 14,
    paddingLeft: 2,
    paddingRight: 10,
    paddingVertical: 2,
    gap: 6,
  },
  orgMonogram: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6E2E8B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgMonogramText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  orgLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
  dateRange: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  weekOf: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 6,
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    borderRadius: 10,
    paddingVertical: 10,
  },
  toolLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  weekBlock: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  weekHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  weekHead: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
  },
  weekRange: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
  },
  cardPair: {
    flexDirection: 'row',
    gap: 10,
  },
});
