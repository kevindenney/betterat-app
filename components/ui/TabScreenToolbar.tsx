/**
 * TabScreenToolbar
 *
 * Reusable toolbar for tab screens with a large title on the left
 * and action icons grouped in a white capsule pill on the right.
 * Includes an Apple HIG-style profile avatar button (rightmost).
 * Inspired by the Apple Health "Records" screen pattern.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { SFSymbolIcon } from './SFSymbolIcon';
import {
  IOS_COLORS,
  IOS_SHADOWS,
  IOS_ANIMATIONS,
  IOS_TYPOGRAPHY,
} from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { triggerHaptic } from '@/lib/haptics';
import { AppChromeRow } from '@/components/ui/AppChromeRow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolbarAction {
  /** Ionicons name (e.g. 'search-outline') */
  icon: string;
  /** SF Symbol name for iOS (e.g. 'person.badge.plus') - falls back to icon on other platforms */
  sfSymbol?: string;
  /** Accessibility label */
  label: string;
  onPress: () => void;
  /** When true the icon renders filled + blue tint */
  isActive?: boolean;
  /** Override tint color when active (default: systemBlue) */
  activeTint?: string;
  /** Optional badge rendered in the top-right corner of the icon button */
  badgeCount?: number;
}

export interface TabScreenToolbarProps {
  /**
   * Large title shown in the nav row (or below it if `largeTitleBelow` is
   * set). Omit / pass empty string when the consumer is rendering its own
   * heading inside a `children` card (e.g. Library's lib-hero pattern).
   */
  title?: string;
  subtitle?: string;
  /** Custom subtitle content — replaces the default text rendering */
  subtitleContent?: React.ReactNode;
  onSubtitlePress?: () => void;
  actions?: ToolbarAction[];
  /**
   * Custom right-side content that replaces the default actions capsule.
   * Use this when you need a ref or custom layout for the right element.
   */
  rightContent?: React.ReactNode;
  /** Safe area top inset from useSafeAreaInsets().top */
  topInset?: number;
  /** Background color (default: systemGroupedBackground) */
  backgroundColor?: string;
  /** Show hairline border at bottom (default: true) */
  showBorder?: boolean;
  /** Show a spinner next to the title */
  isLoading?: boolean;
  /** Show the profile avatar button in the trailing position (default: true) */
  showProfileAvatar?: boolean;
  /** Extra content below the nav row (e.g. segmented controls, search bar) */
  children?: React.ReactNode;
  /** Callback reporting the measured height of the toolbar (for content paddingTop) */
  onMeasuredHeight?: (height: number) => void;
  /** When true the toolbar slides up off-screen */
  hidden?: boolean;
  /**
   * iOS Large Title pattern. When true the `title` does NOT render in the
   * top nav row alongside the interest switcher / actions — instead it
   * renders on its own full-width row BELOW the nav row, above the
   * subtitle. Matches Apple HIG "Large Title" navigation. See
   * `docs/redesign/ios-register/library-tab-canonical.html` §2 for the
   * Library landing layout this enables.
   */
  largeTitleBelow?: boolean;
  /**
   * Render the unified inbox bell in the right cluster (between the
   * actions capsule / rightContent and the profile avatar). On by
   * default — it's part of the cross-tab chrome contract. Suppress
   * with false when a surface intentionally hides inbox (e.g. the
   * Inbox tab itself).
   */
  showInboxBell?: boolean;
}

// ---------------------------------------------------------------------------
// Internal: shared animated pressable
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PROFILE_AVATAR_SIZE = 30;

// ---------------------------------------------------------------------------
// Internal: animated action button
// ---------------------------------------------------------------------------

function ActionButton({ action }: { action: ToolbarAction }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tint = action.isActive
    ? action.activeTint ?? IOS_COLORS.systemBlue
    : IOS_COLORS.secondaryLabel;

  // Resolve filled icon name when active (convention: remove '-outline' suffix)
  const iconName = action.isActive
    ? action.icon.replace('-outline', '')
    : action.icon;

  return (
    <AnimatedPressable
      style={[styles.actionButton, animStyle]}
      accessibilityLabel={action.label}
      accessibilityRole="button"
      onPress={() => {
        triggerHaptic('selection');
        action.onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.9, IOS_ANIMATIONS.spring.stiff);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
      }}
    >
      <View style={styles.actionIconWrap}>
        {action.sfSymbol ? (
          <SFSymbolIcon
            name={action.sfSymbol}
            fallback={iconName}
            size={20}
            color={tint}
            weight="medium"
          />
        ) : (
          <Ionicons name={iconName as any} size={20} color={tint} />
        )}
        {action.badgeCount != null && action.badgeCount > 0 ? (
          <View style={styles.actionBadge}>
            <Text style={styles.actionBadgeText}>
              {action.badgeCount > 99 ? '99+' : action.badgeCount}
            </Text>
          </View>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TabScreenToolbar({
  title,
  subtitle,
  subtitleContent,
  onSubtitlePress,
  actions,
  rightContent,
  topInset = 0,
  backgroundColor,
  showBorder = false,
  isLoading = false,
  showProfileAvatar = true,
  children,
  onMeasuredHeight,
  hidden = false,
  largeTitleBelow = false,
  showInboxBell = true,
}: TabScreenToolbarProps) {
  const hasActions = actions && actions.length > 0;

  // Measured height for hide animation - use state to trigger re-renders
  const [measuredHeight, setMeasuredHeight] = React.useState(0);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const h = event.nativeEvent.layout.height;
      setMeasuredHeight(h);
      onMeasuredHeight?.(h);
    },
    [onMeasuredHeight],
  );

  // Scroll-to-hide animation
  const hideTranslateY = useSharedValue(0);

  // Re-run animation when hidden changes OR when height is measured
  // This fixes the race condition where hidden changes before layout fires
  React.useEffect(() => {
    if (measuredHeight > 0) {
      hideTranslateY.value = withTiming(
        hidden ? -measuredHeight : 0,
        { duration: 250 },
      );
    }
  }, [hidden, measuredHeight, hideTranslateY]);

  const hideAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hideTranslateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: topInset },
        backgroundColor ? { backgroundColor } : undefined,
        showBorder && styles.border,
        hideAnimatedStyle,
      ]}
      onLayout={handleLayout}
    >
      {/* Nav row — delegates Identity (interest pill) and the right-side
          global cluster (inbox, avatar) to the shared AppChromeRow. The
          tab-local action capsule + the large title sit on top via the
          slots AppChromeRow exposes. We force showPlus={false} because
          tab-local `+` actions (Add to Practice, Add to Library, etc.)
          come in through the `actions` array, not the UniversalPlus
          provider — wiring both would double-stamp the + glyph. */}
      <AppChromeRow
        showPlus={false}
        showInboxBell={showInboxBell}
        showAvatar={showProfileAvatar}
        avatarSize={PROFILE_AVATAR_SIZE}
        trailingActions={
          rightContent
            ? rightContent
            : hasActions
              ? (
                  <View style={styles.capsule}>
                    {actions!.map((action, idx) => (
                      <React.Fragment key={action.label}>
                        {idx > 0 && <View style={styles.capsuleDivider} />}
                        <ActionButton action={action} />
                      </React.Fragment>
                    ))}
                  </View>
                )
              : null
        }
      >
        {!largeTitleBelow && title ? (
          <View style={styles.titleSection}>
            <Text
              style={styles.largeTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {title}
            </Text>
            {isLoading && (
              <ActivityIndicator
                size="small"
                color={IOS_COLORS.secondaryLabel}
                style={styles.loadingSpinner}
              />
            )}
          </View>
        ) : null}
      </AppChromeRow>

      {/* Large-title row (iOS HIG Large Title pattern). When largeTitleBelow
          is set AND a title is supplied, the title renders on its own
          full-width row below the nav row, mirroring the canonical Library
          hero layout. */}
      {largeTitleBelow && title ? (
        <View style={styles.largeTitleRow}>
          <Text
            style={styles.largeTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {title}
          </Text>
          {isLoading && (
            <ActivityIndicator
              size="small"
              color={IOS_COLORS.secondaryLabel}
              style={styles.loadingSpinner}
            />
          )}
        </View>
      ) : null}

      {/* Subtitle row — below the nav row so it doesn't compete for horizontal space */}
      {subtitleContent ? (
        <View style={styles.subtitleRow}>
          {subtitleContent}
        </View>
      ) : subtitle ? (
        <Pressable
          style={styles.subtitleRow}
          onPress={onSubtitlePress ? () => onSubtitlePress() : undefined}
          disabled={!onSubtitlePress}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Text
            style={[
              styles.subtitleText,
              onSubtitlePress && styles.subtitleLink,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </Pressable>
      ) : null}

      {/* Children slot for tab-specific extras */}
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'rgba(242, 242, 247, 0.92)',
  },
  border: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },

  // Nav row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    // On web, add extra top padding since there's no safe area inset
    paddingTop: Platform.OS === 'web' ? 20 : 12,
    paddingBottom: Platform.OS === 'web' ? 12 : 4,
    paddingHorizontal: 20,
  },

  // Interest switcher when hoisted to the LEFT side of the nav row
  // (canonical Library layout). Stays separate from the right cluster
  // so the search/add/avatar capsule can still right-align.
  leftSwitcherSection: {
    marginRight: 'auto',
  },

  // Apple HIG-style sidebar toggle button (matches macOS window chrome)
  sidebarToggle: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
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
  // Custom sidebar icon (rectangle with left panel - matches Apple's sidebar.left)
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

  // Title
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 60,
  },
  largeTitle: {
    // Newsreader serif Large Title per the v4 reflection-network register —
    // screen titles are display moments. Reintroduces the serif treatment
    // (reverses the Phase-1 SF-Pro flip from ee631e61) across every screen
    // mounting TabScreenToolbar (Library/Watch/Atlas/Inbox/Reflect/…).
    fontFamily: fontFamily.serif,
    fontSize: IOS_TYPOGRAPHY.largeTitle.fontSize,
    fontWeight: '500',
    lineHeight: IOS_TYPOGRAPHY.largeTitle.lineHeight,
    letterSpacing: -0.4,
    color: IOS_COLORS.label,
  },
  loadingSpinner: {
    marginLeft: 0,
  },

  // Large-title row (iOS HIG Large Title) — full-width row below the nav
  // row, used when `largeTitleBelow` is set so the interest switcher and
  // action capsule sit on their own row above and the title gets its
  // full leading width.
  largeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },

  // Subtitle row (below nav row)
  subtitleRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.2,
  },
  subtitleLink: {
    color: IOS_COLORS.systemBlue,
  },

  // Right section (capsule + avatar)
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },

  // Wrapper for the always-on inbox bell so it visually sizes like
  // an action button (same 36×36 box as the bell glyphs inside the
  // capsule). Without the wrap the bell sat at its intrinsic icon
  // size and pulled the avatar inward.
  inboxBellSlot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Capsule pill
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 9999,
    ...IOS_SHADOWS.sm,
    // Web-specific shadow fallback
    ...Platform.select({
      web: {
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
      } as any,
      default: {},
    }),
  },
  capsuleDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: IOS_COLORS.separator,
  },

  // Action button inside capsule
  actionButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadge: {
    position: 'absolute',
    top: -7,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.systemRed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: IOS_COLORS.systemBackground,
  },
  actionBadgeText: {
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

/**
 * Exported capsule styles for consumers that build custom right content
 * matching the capsule look (e.g. RacesFloatingHeader).
 */
export const capsuleStyles = {
  capsule: styles.capsule,
  capsuleDivider: styles.capsuleDivider,
  actionButton: styles.actionButton,
};

export default TabScreenToolbar;
