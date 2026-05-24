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
import { useCrewThreadsUnreadCount } from '@/hooks/useCrewThreads';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';

interface CanvasTopBarProps {
  interestLabel: string;
}

export function CanvasTopBar({
  interestLabel,
}: CanvasTopBarProps) {
  const universalPlus = useUniversalPlus();
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

        {/* Bell removed per Option-4 plan — system notifications and
            blueprint activity will live inside the bottom Inbox tab.
            DMs (chat) stay here because they're a 1:1 threaded channel,
            not the broadcast/system grammar Inbox owns. */}

        {/* Role-aware popover (Frames 1–3 of the institutions pass) —
            handles its own avatar + dropdown menu (Profile/Notifications/
            Subscribed/Authoring/Help/Sign out, with role-specific sections
            for faculty/admin). Avatar is sized 28px to match the rest of
            the cluster. */}
        <ProfileDropdown size={28} />
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
    // Lift the bar so the ProfileDropdown popover (rendered absolutely
    // below the avatar) stacks above sibling canvas content beneath us
    // in the flex column. Without this, L2's day strip / L3's headers
    // render on top of the dropdown.
    zIndex: 1000,
    elevation: 20,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // Match the row's lift so the dropdown anchor's absolute child
    // inherits the elevated stacking context.
    zIndex: 1001,
    elevation: 21,
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
});
