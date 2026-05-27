/**
 * SeasonCalendarSheet — calendar-grid date picker for the L3 date chip.
 *
 * Anchors weeks against today: we know the current week's index from
 * `weekOfTotal.current`, so week N's Sunday is today's Sunday shifted by
 * (N - current) * 7 days. Each week's date span is marked; tapping a date
 * resolves which week it falls in and bubbles `onPickWeek(weekIndex)`.
 *
 * Note: the underlying season dataset stores `dateRange` as a display
 * string (e.g. "Oct 31 — Mar 30") rather than parseable dates, so this
 * anchor-by-today approach is what keeps the picker honest without
 * touching the data layer.
 */

import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, type DateData } from 'react-native-calendars';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface Props {
  visible: boolean;
  seasonTitle: string;
  dateRange: string;
  currentWeek: number;
  totalWeeks: number;
  onPickWeek: (weekIndex: number) => void;
  onClose: () => void;
}

interface WeekSpan {
  index: number;
  start: Date;
  end: Date;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d;
}

function isoDay(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function SeasonCalendarSheet({
  visible,
  seasonTitle,
  dateRange,
  currentWeek,
  totalWeeks,
  onPickWeek,
  onClose,
}: Props) {
  const { weeks, markedDates, minDate, maxDate, todayKey } = useMemo(() => {
    const today = new Date();
    const todayStart = startOfWeek(today);
    const seasonWeekOneStart = addDays(todayStart, -(currentWeek - 1) * 7);

    const wks: WeekSpan[] = [];
    for (let i = 0; i < totalWeeks; i++) {
      const start = addDays(seasonWeekOneStart, i * 7);
      const end = addDays(start, 6);
      wks.push({ index: i + 1, start, end });
    }

    const marked: Record<string, object> = {};
    wks.forEach((w) => {
      const isCurrent = w.index === currentWeek;
      const startKey = isoDay(w.start);
      const endKey = isoDay(w.end);
      const periodColor = isCurrent
        ? IOS_REGISTER.accentUserAction
        : 'rgba(0,122,255,0.18)';
      // Build a period span across 7 days so the bar is visible.
      for (let d = 0; d < 7; d++) {
        const dayKey = isoDay(addDays(w.start, d));
        marked[dayKey] = {
          color: periodColor,
          textColor: isCurrent ? '#FFFFFF' : IOS_REGISTER.label,
          startingDay: dayKey === startKey,
          endingDay: dayKey === endKey,
        };
      }
    });

    // Guard against an empty wks array — totalWeeks can be 0 during
    // initial render before the season's analysis settles, and the
    // calendar's hooks must still run when the modal is closed.
    return {
      weeks: wks,
      markedDates: marked,
      minDate: wks[0] ? isoDay(wks[0].start) : isoDay(today),
      maxDate:
        wks[wks.length - 1]
          ? isoDay(wks[wks.length - 1]!.end)
          : isoDay(addDays(today, 7)),
      todayKey: isoDay(today),
    };
  }, [currentWeek, totalWeeks]);

  const handleDayPress = (day: DateData) => {
    const picked = new Date(day.year, day.month - 1, day.day);
    const hit = weeks.find((w) => picked >= w.start && picked <= w.end);
    if (hit) onPickWeek(hit.index);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handleBar} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {seasonTitle}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {dateRange}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close"
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Ionicons name="close" size={22} color={IOS_REGISTER.labelSecondary} />
          </Pressable>
        </View>

        <Calendar
          minDate={minDate}
          maxDate={maxDate}
          initialDate={todayKey}
          markingType="period"
          markedDates={markedDates}
          onDayPress={handleDayPress}
          firstDay={0}
          theme={{
            todayTextColor: IOS_REGISTER.accentUserAction,
            arrowColor: IOS_REGISTER.accentUserAction,
            monthTextColor: IOS_REGISTER.label,
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textSectionTitleColor: IOS_REGISTER.labelSecondary,
          }}
        />

        <View style={styles.footer}>
          <View style={styles.legendRow}>
            <View
              style={[
                styles.legendSwatch,
                { backgroundColor: IOS_REGISTER.accentUserAction },
              ]}
            />
            <Text style={styles.legendText}>This week</Text>
            <View
              style={[
                styles.legendSwatch,
                { backgroundColor: 'rgba(0,122,255,0.18)', marginLeft: 16 },
              ]}
            />
            <Text style={styles.legendText}>Arc weeks</Text>
          </View>
          <Text style={styles.hint}>
            Tap any day to jump to that week.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: IOS_REGISTER.cardBg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 28,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: IOS_REGISTER.separator,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
  },
  hint: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
  },
  pressed: {
    opacity: 0.55,
  },
});
