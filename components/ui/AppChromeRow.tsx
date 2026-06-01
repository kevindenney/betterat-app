/**
 * AppChromeRow — the shared first row of every tab's top bar.
 *
 *   [sidebar toggle? · InterestSwitcher · leftExtras] · {children} · [trailingActions · + · bell · avatar]
 *
 * Every tab's chrome reads the same way: who am I (interest pill, left)
 * and what can I do globally (+ inbox avatar, right). The middle slot is
 * the only thing that varies — title text on tabs with large titles, a
 * scope row on scoped surfaces, search pills on Atlas, nothing on the
 * cleanest tabs.
 *
 * Consumers compose around it:
 *   - CanvasTopBar (Practice): just `<AppChromeRow leftExtras={<LocationAnchor />} />`.
 *   - TabScreenToolbar's nav row: `<AppChromeRow>{titleSection}</AppChromeRow>`
 *     plus its own action-capsule pill is passed via `trailingActions`.
 *   - Atlas TopChrome keeps its floating-capsule visual but uses the same
 *     ordering convention — it doesn't import AppChromeRow itself because
 *     its container chrome (translucent glass capsule) is bespoke. The
 *     contract (Identity left, +/bell/avatar right) is shared by hand.
 */

import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { InterestSwitcher } from '@/components/InterestSwitcher';
import { NotificationBell } from '@/components/social/NotificationBell';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';
import { useUniversalPlus } from '@/components/capture';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useWebDrawer } from '@/providers/WebDrawerProvider';

export interface AppChromeRowProps {
  /** Middle slot — title section, scope row, etc. */
  children?: React.ReactNode;
  /**
   * Leading content rendered immediately after the InterestSwitcher
   * (e.g. <LocationAnchor /> on Practice). Stays inside the identity
   * cluster on the left of the row.
   */
  leftExtras?: React.ReactNode;
  /**
   * Trailing actions rendered just before `+`/bell/avatar (e.g. a
   * tab-local action capsule from TabScreenToolbar, or a Search /
   * Layers cluster on Atlas-style surfaces).
   */
  trailingActions?: React.ReactNode;
  /** Suppress the universal-plus button (default true). */
  showPlus?: boolean;
  /** Suppress the inbox bell (default true). */
  showInboxBell?: boolean;
  /** Suppress the avatar (default true). */
  showAvatar?: boolean;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
  /** Bell size — default 20. Atlas uses 16 inside its floating capsule. */
  bellSize?: number;
  /** Avatar size — default 30. Practice's CanvasTopBar used 28; close enough that we standardise on 30. */
  avatarSize?: number;
  /** Bell + plus colour. Defaults to label colour. */
  iconColor?: string;
}

export function AppChromeRow({
  children,
  leftExtras,
  trailingActions,
  showPlus = true,
  showInboxBell = true,
  showAvatar = true,
  style,
  bellSize = 20,
  avatarSize = 30,
  iconColor = IOS_REGISTER.label,
}: AppChromeRowProps) {
  const universalPlus = useUniversalPlus();
  const { isDrawerOpen, openDrawer } = useWebDrawer();
  const showWebSidebarToggle =
    Platform.OS === 'web' && FEATURE_FLAGS.USE_WEB_SIDEBAR_LAYOUT && !isDrawerOpen;

  return (
    <View style={[styles.row, style]}>
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
        {leftExtras}
      </View>

      {children ? <View style={styles.middle}>{children}</View> : null}

      <View style={styles.rightCluster}>
        {trailingActions}
        {showPlus && universalPlus.isAvailable ? (
          <Pressable
            style={styles.iconBtn}
            onPress={universalPlus.open}
            accessibilityLabel="Add"
            hitSlop={6}
          >
            <Ionicons name="add" size={22} color={iconColor} />
          </Pressable>
        ) : null}
        {showInboxBell ? (
          <View style={styles.iconBtn}>
            <NotificationBell size={bellSize} color={iconColor} />
          </View>
        ) : null}
        {showAvatar ? <ProfileDropdown size={avatarSize} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 2,
    minHeight: 36,
    gap: 6,
    zIndex: 1000,
    elevation: 20,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  middle: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    // 10px so the inbox bell's unread badge (a corner badge hugging the
    // mail glyph) keeps clear air to the avatar even at 2-digit counts.
    // Otherwise the red bubble crowds the avatar's left edge.
    gap: 10,
    marginLeft: 'auto',
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

export default AppChromeRow;
