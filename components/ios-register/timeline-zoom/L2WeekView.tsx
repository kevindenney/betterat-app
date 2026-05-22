/**
 * L2 — three step cards across, day strip on top. Swipe scrolls in weeks.
 *
 * Frame 2/6. "This week" big headline + Mon → Sun date range. Day strip
 * M T W T F S S with today highlighted iOS-blue and dots under days that
 * have steps. The day strip is tappable — jump the carousel to Friday and
 * the carousel scrolls to it (per Frame 2 description). The card the user
 * came from is outlined iOS blue.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { StepDigestCard } from './StepDigestCard';
import type { DayKey, TimelineDataset, TimelineStep } from './types';

interface L2WeekViewProps {
  dataset: TimelineDataset;
  focusStepId: string;
  onOpenStep: (stepId: string) => void;
}

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<DayKey, string> = {
  mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S',
};
const DAY_DATES = [13, 14, 15, 16, 17, 18, 19] as const;

export function L2WeekView({ dataset, focusStepId, onOpenStep }: L2WeekViewProps) {
  const currentSeason = dataset.seasons.find((s) => s.id === dataset.currentSeasonId);
  const currentWeek = currentSeason?.weeks.find((w) => w.isCurrent);
  const steps: TimelineStep[] = currentWeek?.steps ?? [];

  const focusedStep = steps.find((s) => s.id === focusStepId) ?? steps[steps.length - 1];
  const todayDay: DayKey = focusedStep?.dayOfWeek ?? 'wed';

  // Day-of-week → step (first wins) for the dot row.
  const stepsByDay = new Map<DayKey, TimelineStep>();
  steps.forEach((s) => {
    if (!stepsByDay.has(s.dayOfWeek)) stepsByDay.set(s.dayOfWeek, s);
  });

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>This week</Text>
        <Text style={styles.titleRight}>Mon 13 → Sun 19</Text>
      </View>

      <View style={styles.dayStrip}>
        {DAY_KEYS.map((d, idx) => {
          const isToday = d === todayDay;
          const hasStep = stepsByDay.has(d);
          return (
            <Pressable
              key={d}
              style={styles.dayCell}
              onPress={() => {
                const step = stepsByDay.get(d);
                if (step) onOpenStep(step.id);
              }}
            >
              <Text style={[styles.dayLetter, isToday && styles.dayLetterToday]}>
                {DAY_LABELS[d]}
              </Text>
              <View
                style={[
                  styles.dayNumberWrap,
                  isToday && styles.dayNumberWrapToday,
                ]}
              >
                <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>
                  {DAY_DATES[idx]}
                </Text>
              </View>
              <View
                style={[
                  styles.dayDot,
                  hasStep && !isToday && styles.dayDotActive,
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardCarousel}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
      >
        {steps.map((step) => (
          <View key={step.id} style={styles.cardSlot}>
            <StepDigestCard
              step={step}
              highlighted={step.id === focusStepId}
              onPress={() => onOpenStep(step.id)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const CARD_WIDTH = 230;
const CARD_GAP = 12;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
  },
  titleRight: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    paddingBottom: 4,
  },
  dayStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  dayCell: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dayLetter: {
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: 0.2,
  },
  dayLetterToday: {
    color: '#FFFFFF',
  },
  dayNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberWrapToday: {
    backgroundColor: IOS_REGISTER.accentUserAction,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.label,
  },
  dayNumberToday: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  dayDotActive: {
    backgroundColor: '#FF3B30',
  },
  cardCarousel: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: CARD_GAP,
  },
  cardSlot: {
    width: CARD_WIDTH,
  },
});
