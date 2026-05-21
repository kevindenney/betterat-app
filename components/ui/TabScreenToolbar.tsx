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
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { triggerHaptic } from '@/lib/haptics';
import { useWebDrawer } from '@/providers/WebDrawerProvider';
import { InterestSwitcher } from '@/components/InterestSwitcher';
import { ProfileDropdown } from '@/components/ui/ProfileDropdown';

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
}

export interface TabScreenToolbarProps {
  title: string;
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
}: TabScreenToolbarProps) {
  const { isDrawerOpen, openDrawer } = useWebDrawer();

  // Show sidebar toggle on web ONLY when sidebar is closed (so user can re-open it)
  // When sidebar is open, the toggle inside the sidebar handles closing
  const showWebSidebarToggle = Platform.OS === 'web' && FEATURE_FLAGS.USE_WEB_SIDEBAR_LAYOUT && !isDrawerOpen;

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
      {/* Nav row: title left  |  capsule right */}
      <View style={styles.navRow}>
        {/* Web: Apple HIG-style sidebar toggle button (only shown when sidebar is closed) */}
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
            {/* Apple-style sidebar icon: rectangle with left panel */}
            <View style={styles.sidebarIcon}>
              <View style={styles.sidebarIconLeft} />
              <View style={styles.sidebarIconRight} />
            </View>
          </Pressable>
        )}
        {/* Left: title (hidden in largeTitleBelow mode — rendered as its own
            row below the nav row instead, so the interest switcher gets
            the full leading edge). */}
        {!largeTitleBelow && (
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
        )}

        {/* Right: interest switcher + custom content or default action capsule + profile avatar */}
        <View style={styles.rightSection}>
          <InterestSwitcher />
          {rightContent
            ? rightContent
            : hasActions && (
                <View style={styles.capsule}>
                  {actions!.map((action, idx) => (
                    <React.Fragment key={action.label}>
                      {idx > 0 && <View style={styles.capsuleDivider} />}
                      <ActionButton action={action} />
                    </React.Fragment>
                  ))}
                </View>
              )}
          {showProfileAvatar && <ProfileDropdown size={PROFILE_AVATAR_SIZE} />}
        </View>
      </View>

      {/* Large-title row (iOS HIG Large Title pattern). When largeTitleBelow
          is set, the title renders on its own full-width row below the nav
          row, mirroring the canonical Library hero layout. */}
      {largeTitleBelow && (
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
      )}

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
    paddingHorizontal: 16,
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
    // SF Pro Large Title per iOS register (Phase 1, supersedes the serif
    // treatment from audit commit ee631e61). Applies to Session/Playbook/
    // Discover/Reflect headers (every screen mounting TabScreenToolbar).
    fontSize: IOS_TYPOGRAPHY.largeTitle.fontSize,
    fontWeight: IOS_TYPOGRAPHY.largeTitle.fontWeight,
    lineHeight: IOS_TYPOGRAPHY.largeTitle.lineHeight,
    letterSpacing: IOS_TYPOGRAPHY.largeTitle.letterSpacing,
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
