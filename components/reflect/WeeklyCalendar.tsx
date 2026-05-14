/**
 * WeeklyCalendar - Shows a 7-day row of sailing activity
 *
 * Similar to Strava's weekly activity calendar, displays dots
 * for days with sailing activity.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IOS_COLORS, IOS_SHADOWS } from '@/lib/design-tokens-ios';
import { STEP_PALETTE } from '@/lib/step-theme';
import type { SailingDay } from '@/hooks/useReflectData';

interface WeeklyCalendarProps {
  sailingDays: SailingDay[];
  onDayPress?: (date: string) => void;
  onSeeMore?: () => void;
  seeMoreText?: string;
  primaryLegend?: string;
  secondaryLegend?: string;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getWeekDates(): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  // Adjust for Monday start (0 = Sunday in JS)
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

export function WeeklyCalendar({
  sailingDays,
  onDayPress,
  onSeeMore,
  seeMoreText = 'See more of your sailing',
  primaryLegend = 'Race',
  secondaryLegend = 'Training',
}: WeeklyCalendarProps) {
  const weekDates = useMemo(() => getWeekDates(), []);
  const today = new Date().toISOString().split('T')[0];

  // Create a map for quick lookup
  const sailingDayMap = useMemo(() => {
    const map = new Map<string, SailingDay>();
    sailingDays.forEach((day) => map.set(day.date, day));
    return map;
  }, [sailingDays]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>This Week</Text>
        {onSeeMore && (
          <Pressable onPress={onSeeMore} hitSlop={8}>
            <Text style={styles.seeMore}>{seeMoreText}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.calendarRow}>
        {weekDates.map((date, index) => {
          const sailingDay = sailingDayMap.get(date);
          const isToday = date === today;
          const hasSailed = !!sailingDay;
          const isPast = date < today;

          return (
            <Pressable
              key={date}
              style={styles.dayContainer}
              onPress={() => onDayPress?.(date)}
              disabled={!onDayPress}
            >
              <Text
                style={[
                  styles.dayLabel,
                  isToday && styles.dayLabelToday,
                  !isPast && !isToday && styles.dayLabelFuture,
                ]}
              >
                {DAYS[index]}
              </Text>
              <View
                style={[
                  styles.dotContainer,
                  isToday && styles.dotContainerToday,
                ]}
              >
                {hasSailed ? (
                  <View
                    style={[
                      styles.dot,
                      sailingDay.type === 'race' && styles.dotRace,
                      sailingDay.type === 'training' && styles.dotTraining,
                      sailingDay.type === 'leisure' && styles.dotLeisure,
                      sailingDay.count > 1 && styles.dotMultiple,
                    ]}
                  />
                ) : isPast ? (
                  <View style={styles.dotEmpty} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotRace]} />
          <Text style={styles.legendText}>{primaryLegend}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotTraining]} />
          <Text style={styles.legendText}>{secondaryLegend}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...IOS_SHADOWS.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
  },
  seeMore: {
    fontSize: 13,
    fontWeight: '500',
    color: STEP_PALETTE.textPrimary,
    letterSpacing: -0.08,
    textDecorationLine: 'underline',
    textDecorationColor: STEP_PALETTE.textTertiary,
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayLabelToday: {
    color: STEP_PALETTE.textPrimary,
  },
  dayLabelFuture: {
    color: STEP_PALETTE.textTertiary,
  },
  dotContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotContainerToday: {
    backgroundColor: STEP_PALETTE.bgInfo,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  // Activity-type dots — three distinct ink shades (info violet / charcoal /
  // tertiary tan) instead of blue/green/teal. Communicates type by tone density
  // rather than chromatic color per redesign §11.6.
  dotRace: {
    backgroundColor: STEP_PALETTE.textInfo,
  },
  dotTraining: {
    backgroundColor: STEP_PALETTE.textPrimary,
  },
  dotLeisure: {
    backgroundColor: STEP_PALETTE.textTertiary,
  },
  dotMultiple: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: STEP_PALETTE.bgPrimary,
  },
  dotEmpty: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: STEP_PALETTE.borderTertiary,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: STEP_PALETTE.borderTertiary,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
    color: STEP_PALETTE.textTertiary,
  },
});

export default WeeklyCalendar;
