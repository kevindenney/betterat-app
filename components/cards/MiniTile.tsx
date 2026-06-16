/**
 * MiniTile — Compact tile used in non-"me" swim lanes (subscribed blueprints
 * and followed peers). Small footprint so many tiles fit across the shared
 * date axis. Tapping fires `onPress`; tiles can expose an optional action
 * button (e.g. "Adopt" for blueprint steps, "Pin" for peer headers).
 *
 * The "me" lane renders RaceSummaryCard (collapsed variant) instead — this
 * component is deliberately simpler and does NOT show phase tabs or skill
 * dots. It's a scannable reference, not an interactive detail card.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type MiniTileStatus = 'upcoming' | 'now' | 'overdue' | 'done';

export interface MiniTileProps {
  id: string;
  title: string;
  /** Optional date badge, e.g. 'Mar 10', 'Due 3d', 'Done Mar 14'. */
  dateLabel?: string;
  status: MiniTileStatus;
  onPress?: () => void;
  /** Optional trailing action (e.g. "Adopt"). Renders as a small inline button. */
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  width?: number;
  style?: ViewStyle;
  testID?: string;
}

const STATUS_COLORS: Record<MiniTileStatus, { fg: string; bg: string; dot: string }> = {
  upcoming: { fg: '#3C3C43', bg: '#F2F2F7', dot: '#8E8E93' },
  now: { fg: '#007AFF', bg: 'rgba(0,122,255,0.1)', dot: '#007AFF' },
  overdue: { fg: '#B45309', bg: 'rgba(180,83,9,0.1)', dot: '#B45309' },
  done: { fg: '#34C759', bg: 'rgba(52,199,89,0.1)', dot: '#34C759' },
};

const STATUS_LABELS: Record<MiniTileStatus, string> = {
  upcoming: 'Planned',
  now: 'Now',
  overdue: 'Overdue',
  done: 'Done',
};

export function MiniTile({
  title,
  status,
  dateLabel,
  onPress,
  actionLabel,
  actionIcon,
  onAction,
  width = 140,
  style,
  testID,
}: MiniTileProps) {
  const colors = STATUS_COLORS[status];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { width },
        pressed && styles.pressed,
        style,
      ]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
          <View style={[styles.dot, { backgroundColor: colors.dot }]} />
          <Text style={[styles.badgeText, { color: colors.fg }]}>
            {STATUS_LABELS[status]}
          </Text>
        </View>
        {dateLabel ? (
          <Text style={styles.dateLabel} numberOfLines={1}>
            {dateLabel}
          </Text>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onAction();
          }}
          style={styles.action}
          hitSlop={6}
        >
          {actionIcon ? (
            <Ionicons name={actionIcon} size={12} color="#007AFF" />
          ) : null}
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E4E1',
    gap: 6,
    minHeight: 68,
  },
  pressed: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  dateLabel: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000',
    lineHeight: 15,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
  },
});
