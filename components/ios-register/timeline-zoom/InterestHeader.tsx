/**
 * Shared header that appears above every zoom level — interest pill on the
 * left, contextual subtitle in the middle (e.g. "Step 27 of 41" / "Week 7
 * of 14" / "23 steps · 41 total" / "All time"), avatar on the right.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import type { ZoomLevel } from './types';

interface InterestHeaderProps {
  interestLabel: string;
  /** Per-interest accent for the breadcrumb identity dot. Defaults to neutral. */
  accentColor?: string;
  level: ZoomLevel;
  stepCounter?: { current: number; total: number };
  weekCounter?: { current: number; total: number };
  seasonCounter?: { current: number; total: number };
  user: { initials: string; color: string };
  /**
   * Tap handler for the interest pill. When provided, the pill chevron
   * actually opens an interest switcher. When omitted (preview routes),
   * the pill is non-interactive — chevron stays visible for visual
   * continuity with the design.
   */
  onPressInterest?: () => void;
}

export function InterestHeader({
  interestLabel,
  accentColor = IOS_REGISTER.labelTertiary,
  level,
  stepCounter,
  weekCounter,
  seasonCounter,
  user,
  onPressInterest,
}: InterestHeaderProps) {
  let subtitle = '';
  if (level === 1 && stepCounter) {
    subtitle = `Step ${stepCounter.current} of ${stepCounter.total}`;
  } else if (level === 2 && weekCounter) {
    subtitle = `Week ${weekCounter.current} of ${weekCounter.total}`;
  } else if (level === 3 && seasonCounter) {
    subtitle = `${seasonCounter.current} steps · ${seasonCounter.total} total`;
  } else if (level === 4) {
    subtitle = 'All time';
  }

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.interestPill}
        onPress={onPressInterest}
        disabled={!onPressInterest}
        hitSlop={6}
      >
        <View style={styles.interestDotWrap}>
          <View style={[styles.interestDotRing, { backgroundColor: accentColor }]} />
          <View style={[styles.interestDot, { backgroundColor: accentColor }]} />
        </View>
        <Text style={styles.interestLabel} numberOfLines={1}>{interestLabel}</Text>
        <Ionicons name="chevron-down" size={13} color={IOS_REGISTER.labelTertiary} />
      </Pressable>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : <View />}
      <View style={[styles.avatar, { backgroundColor: user.color }]}>
        <Text style={styles.avatarText}>{user.initials}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  interestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    maxWidth: 248,
    paddingLeft: 13,
    paddingRight: 11,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
    backgroundColor: IOS_REGISTER.cardBg,
    flexShrink: 1,
    minWidth: 0,
  },
  interestDotWrap: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  interestDotRing: {
    position: 'absolute',
    width: 15,
    height: 15,
    borderRadius: 7.5,
    opacity: 0.2,
  },
  interestDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  interestLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
