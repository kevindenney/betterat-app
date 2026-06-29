/**
 * NotificationBell - Header bell icon with combined unread badge
 *
 * Shows the global Inbox count and opens the Inbox route.
 */

import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInboxCount } from '@/hooks/useInboxCount';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';

interface NotificationBellProps {
  size?: number;
  color?: string;
}

export function NotificationBell({
  size = 24,
  color = IOS_COLORS.label,
}: NotificationBellProps) {
  const router = useRouter();
  const { data: unreadCount = 0 } = useInboxCount();

  const handlePress = () => {
    router.push('/(tabs)/inbox' as any);
  };

  const formatBadge = (count: number): string => {
    if (count > 99) return '99+';
    return count.toString();
  };

  // Build a hover tooltip / screen reader label that names what the count is.
  // Without this, the red bubble looks like any generic number (users were
  // confused whether it was notifications, upcoming races, or something else).
  const tooltip = unreadCount === 0
    ? 'Inbox'
    : unreadCount === 1
      ? '1 inbox item waiting'
      : `${formatBadge(unreadCount)} inbox items waiting`;

  return (
    <Pressable
      style={styles.container}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={tooltip}
      accessibilityHint="Opens suggested steps, comments, invites, and updates"
      // @ts-expect-error — RN Web passes unknown DOM props through as attributes
      title={tooltip}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="notifications-outline" size={size} color={color} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formatBadge(unreadCount)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: IOS_SPACING.xs,
    position: 'relative',
  },
  // Wrap the glyph so the absolutely-positioned badge anchors to the
  // icon's bounding box, not the touch-target. Without the wrap the
  // badge sat on top of the icon and at higher unread counts the
  // count digits eclipsed the envelope entirely.
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: IOS_COLORS.systemRed,
    borderRadius: IOS_RADIUS.full,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    ...IOS_TYPOGRAPHY.caption2,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 12,
  },
});
