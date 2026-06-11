/**
 * RaceTimeBar — top-chrome race-time strip (Phase V.1, mock parity).
 * Pinned under the lens chips whenever the viewer's next race has an
 * open forecast window: race name + countdown, an hourly scrubber
 * across the race window, the scrubbed wind/stream readout, and the
 * amber tide-flip warning. Shares scrub state with the map overlays,
 * so dragging here re-renders the same wind/current field the map
 * shows — same contract as the bottom WindTideScrubber it replaces
 * in race mode.
 */

import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { CourseStrategy } from '@/lib/courseStrategy';
import { CourseStrategyCard, strategyHeadline } from './CourseStrategyCard';
import { compassFromDegrees } from './VenueMasterySheet';

function readoutFromLine(line: string | null | undefined, unit: string): string | null {
  if (!line) return null;
  const [degRaw, knRaw] = line.split('|');
  const deg = Number(degRaw);
  const kn = Number(knRaw);
  if (!Number.isFinite(deg) || !Number.isFinite(kn)) return null;
  return `${kn % 1 === 0 ? kn : kn.toFixed(1)} kn ${compassFromDegrees(deg)}${unit ? ` ${unit}` : ''}`;
}

export function RaceTimeBar({
  raceLabel,
  countdownLabel,
  windows,
  value,
  onChange,
  wind,
  windTrend,
  tide,
  flipNote,
  strategy,
}: {
  raceLabel: string;
  /** "38 h out" / "3 d out" — urgency next to the race name. */
  countdownLabel: string | null;
  /** Hourly tick labels across the race window ("3pm" … "Start" … "8pm"). */
  windows: string[];
  value: number;
  onChange: (value: number) => void;
  /** `"deg|knots"` condition lines for the scrubbed hour. */
  wind: string | null;
  /** "building" / "easing" vs later in the window. */
  windTrend?: string | null;
  tide: string | null;
  flipNote: string | null;
  strategy: CourseStrategy | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  // RN Slider emits onValueChange(0) during mount/layout, which would
  // stomp the snap-to-race-start scrub index — only forward values from
  // an actual drag.
  const draggingRef = useRef(false);
  if (windows.length === 0) return null;

  const windText = readoutFromLine(wind, '');
  const tideText = readoutFromLine(tide, 'stream');
  const tickLabel = windows[Math.min(value, windows.length - 1)] ?? '';

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setCollapsed((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Expand race-time bar' : 'Collapse race-time bar'}
        hitSlop={6}
      >
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>RACE TIME</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tickLabel ? `${tickLabel} · ` : ''}
            {raceLabel}
          </Text>
          {countdownLabel ? <Text style={styles.countdown}>{countdownLabel}</Text> : null}
          <Ionicons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={14}
            color={IOS_REGISTER.labelTertiary}
          />
        </View>
      </Pressable>
      {collapsed ? null : (
        <>
          <View style={styles.readoutRow}>
            <Text style={styles.readout} numberOfLines={1}>
              {!windText && !tideText ? '—' : null}
              {windText}
              {windText && windTrend ? <Text style={styles.trend}> {windTrend}</Text> : null}
              {windText && tideText ? ' · ' : null}
              {tideText}
            </Text>
            {flipNote ? (
              <View style={styles.flipPill}>
                <Ionicons name="warning-outline" size={10} color="#B25E09" />
                <Text style={styles.flipText} numberOfLines={1}>
                  {flipNote}
                </Text>
              </View>
            ) : null}
          </View>
          <Slider
            minimumValue={0}
            maximumValue={Math.max(0, windows.length - 1)}
            step={1}
            value={value}
            minimumTrackTintColor="#C2410C"
            maximumTrackTintColor="rgba(60, 60, 67, 0.18)"
            thumbTintColor="#C2410C"
            onSlidingStart={() => {
              draggingRef.current = true;
            }}
            onValueChange={(next) => {
              if (draggingRef.current) onChange(Math.round(next));
            }}
            onSlidingComplete={(next) => {
              draggingRef.current = false;
              onChange(Math.round(next));
            }}
            style={styles.slider}
          />
          <View style={styles.ticksRow}>
            {windows.map((w) => (
              <Text
                key={w}
                style={[styles.tick, w === 'Start' ? styles.tickStart : null]}
              >
                {w}
              </Text>
            ))}
          </View>
          {strategy ? (
            <>
              <Pressable
                onPress={() => setStrategyOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={strategyOpen ? 'Hide strategy' : 'Show strategy'}
                hitSlop={6}
              >
                <View style={styles.strategyToggle}>
                  <Text style={styles.strategyLabel}>STRATEGY</Text>
                  <Text style={styles.strategyHeadline} numberOfLines={1}>
                    {strategyHeadline(strategy)}
                  </Text>
                  <Ionicons
                    name={strategyOpen ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={IOS_REGISTER.labelTertiary}
                  />
                </View>
              </Pressable>
              {strategyOpen ? (
                <ScrollView
                  style={styles.strategyScroll}
                  contentContainerStyle={styles.strategyScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <CourseStrategyCard strategy={strategy} />
                </ScrollView>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#C2410C',
  },
  headerTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  countdown: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readout: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  trend: {
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  flipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  flipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B25E09',
  },
  slider: {
    marginVertical: -4,
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  tick: {
    fontSize: 9,
    color: IOS_REGISTER.labelTertiary,
  },
  tickStart: {
    fontWeight: '700',
    color: '#C2410C',
  },
  strategyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  strategyLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelTertiary,
  },
  strategyHeadline: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
  },
  strategyScroll: {
    maxHeight: 180,
  },
  strategyScrollContent: {
    paddingTop: 4,
  },
});

export default RaceTimeBar;
