/**
 * CanvasTopBar — shared chrome above the zoom canvas at L2/L3/L4.
 *
 * Brings back the affordance set the user is used to seeing at the top
 * of the practice surface, in one row:
 *
 *   [interest pill ▼]                [+]  [avatar]
 *
 * L1 deliberately skips this bar — the embedded <StepDetailContent />
 * already renders its own TopHeader with the interest pill + plus.
 *
 * The bar is intentionally dense and unopinionated about ordering;
 * once the design pass lands we'll re-arrange according to Claude
 * design's recommendation.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { InterestSwitcher } from '@/components/InterestSwitcher';
import { useUniversalPlus } from '@/components/capture';
import { LocationAnchor } from '@/components/ui/LocationAnchor';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';
import { NotificationBell } from '@/components/social/NotificationBell';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useWebDrawer } from '@/providers/WebDrawerProvider';

interface CanvasTopBarProps {
  interestLabel: string;
}

export function CanvasTopBar({
  interestLabel: _interestLabel,
}: CanvasTopBarProps) {
  const universalPlus = useUniversalPlus();
  const homeVenue = useUserHomeVenue();
  const { isDrawerOpen, openDrawer } = useWebDrawer();
  const showWebSidebarToggle =
    Platform.OS === 'web' && FEATURE_FLAGS.USE_WEB_SIDEBAR_LAYOUT && !isDrawerOpen;

  return (
    <View style={styles.row}>
      <View style={styles.leftCluster}>
        {showWebSidebarToggle && (
          <Pressable
            onPress={openDrawer}
            style={({ pressed, hovered }) => [
              styles.sidebarToggle,
              (hovered as boolean) && styles.sidebarToggleHover,
              pressed && styles.sidebarTogglePressed,
            ]}
            accessibilityLabel="Show sidebar"
            accessibilityRole="button"
          >
            <View style={styles.sidebarIcon}>
              <View style={styles.sidebarIconLeft} />
              <View style={styles.sidebarIconRight} />
            </View>
          </Pressable>
        )}
        <InterestSwitcher />
        <LocationAnchor region={homeVenue?.region} venue={homeVenue?.venue} />
      </View>

      <View style={styles.rightCluster}>
        {universalPlus.isAvailable ? (
          <IconButton
            icon="add"
            size={22}
            onPress={universalPlus.open}
            accessibilityLabel="Add"
          />
        ) : null}

        {/* Inbox glyph — mail icon + unread count. Restored here after
            the v3 Inbox plan: while the Inbox tab still owns the full
            list, the chrome needs a quick affordance so users on
            Practice/Library/etc. can see new arrivals without tab-
            switching. Same NotificationBell component used on Atlas. */}
        <NotificationBell size={20} color={IOS_REGISTER.label} />

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
}

function IconButton({ icon, size, onPress, accessibilityLabel }: IconButtonProps) {
  return (
    <Pressable
      style={styles.iconBtn}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
    >
      <Ionicons name={icon} size={size} color={IOS_REGISTER.label} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 2,
    minHeight: 30,
    gap: 6,
    // Lift the bar so the ProfileDropdown popover (rendered absolutely
    // below the avatar) stacks above sibling canvas content beneath us
    // in the flex column. Without this, L2's day strip / L3's headers
    // render on top of the dropdown.
    zIndex: 1000,
    elevation: 20,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
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
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  sidebarToggle: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: IOS_COLORS.separator,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  sidebarToggleHover: {
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderColor: IOS_COLORS.opaqueSeparator,
  },
  sidebarTogglePressed: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  sidebarIcon: {
    width: 16,
    height: 12,
    flexDirection: 'row',
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: IOS_COLORS.secondaryLabel,
    overflow: 'hidden',
  },
  sidebarIconLeft: {
    width: 5,
    height: '100%',
    backgroundColor: IOS_COLORS.secondaryLabel,
  },
  sidebarIconRight: {
    flex: 1,
  },
});
