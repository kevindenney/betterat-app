/**
 * CanvasBellButton — small floating notifications affordance for the
 * timeline-zoom canvas (Frame 17 entry).
 *
 * Reads the unread count from useUnreadNotificationCount() so it
 * shares cache with NotificationsInboxSheet's useNotifications().
 * Positioned absolutely top-right of the canvas so it stays at the
 * same place across all four zoom levels.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';

interface CanvasBellButtonProps {
  onPress: () => void;
}

export function CanvasBellButton({ onPress }: CanvasBellButtonProps) {
  const { unreadCount } = useUnreadNotificationCount();
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <Pressable style={styles.wrap} onPress={onPress} hitSlop={8}>
      <Ionicons name="notifications-outline" size={20} color={IOS_REGISTER.label} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 10,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 50,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.cardBg,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
