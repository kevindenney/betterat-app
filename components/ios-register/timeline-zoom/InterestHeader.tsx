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
  level: ZoomLevel;
  stepCounter?: { current: number; total: number };
  weekCounter?: { current: number; total: number };
  seasonCounter?: { current: number; total: number };
  user: { initials: string; color: string };
}

export function InterestHeader({
  interestLabel,
  level,
  stepCounter,
  weekCounter,
  seasonCounter,
  user,
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
      <Pressable style={styles.interestPill}>
        <View style={styles.interestDot} />
        <Text style={styles.interestLabel}>{interestLabel}</Text>
        <Ionicons name="chevron-down" size={14} color={IOS_REGISTER.label} />
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
    gap: 6,
  },
  interestDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8E8E93',
  },
  interestLabel: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: IOS_REGISTER.label,
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
