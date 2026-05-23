/**
 * CanvasTopBar — shared chrome above the zoom canvas at L2/L3/L4.
 *
 * Brings back the affordance set the user is used to seeing at the top
 * of the practice surface, in one row:
 *
 *   [interest pill ▼]                [+]  [messages]  [bell]  [avatar]
 *
 * L1 deliberately skips this bar — the embedded <StepDetailContent />
 * already renders its own TopHeader with the interest pill + plus.
 *
 * The bar is intentionally dense and unopinionated about ordering;
 * once the design pass lands we'll re-arrange according to Claude
 * design's recommendation.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { openInterestSwitcher } from '@/components/InterestSwitcher';
import { useUniversalPlus } from '@/components/capture';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useCrewThreadsUnreadCount } from '@/hooks/useCrewThreads';

interface CanvasTopBarProps {
  interestLabel: string;
  user: { initials: string; color: string };
  onPressBell: () => void;
}

export function CanvasTopBar({
  interestLabel,
  user,
  onPressBell,
}: CanvasTopBarProps) {
  const universalPlus = useUniversalPlus();
  const { unreadCount: notifUnread } = useUnreadNotificationCount();
  const { unreadCount: msgsUnread } = useCrewThreadsUnreadCount();

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.interestPill}
        onPress={openInterestSwitcher}
        hitSlop={6}
      >
        <View style={styles.interestDot} />
        <Text style={styles.interestLabel} numberOfLines={1}>
          {interestLabel}
        </Text>
        <Ionicons name="chevron-down" size={14} color={IOS_REGISTER.label} />
      </Pressable>

      <View style={styles.rightCluster}>
        {universalPlus.isAvailable ? (
          <IconButton
            icon="add"
            size={22}
            onPress={universalPlus.open}
            accessibilityLabel="Add"
          />
        ) : null}

        <IconButton
          icon="chatbubble-ellipses-outline"
          size={18}
          badge={msgsUnread}
          onPress={() => router.push('/messages' as never)}
          accessibilityLabel="Messages"
        />

        <IconButton
          icon="notifications-outline"
          size={18}
          badge={notifUnread}
          onPress={onPressBell}
          accessibilityLabel="Notifications"
        />

        <Pressable
          style={[styles.avatar, { backgroundColor: user.color }]}
          onPress={() => router.push('/profile' as never)}
          accessibilityLabel="Profile"
          hitSlop={6}
        >
          <Text style={styles.avatarText}>{user.initials}</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  size: number;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: number;
}

function IconButton({ icon, size, onPress, accessibilityLabel, badge }: IconButtonProps) {
  const badgeText = badge && badge > 99 ? '99+' : String(badge ?? 0);
  return (
    <Pressable
      style={styles.iconBtn}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
    >
      <Ionicons name={icon} size={size} color={IOS_REGISTER.label} />
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    gap: 8,
  },
  interestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    paddingVertical: 4,
    paddingRight: 4,
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
    flexShrink: 1,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: IOS_REGISTER.groundBg,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
