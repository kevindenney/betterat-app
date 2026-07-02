/**
 * FloatingTabBar - Floating pill-shaped tab bar for sailor users
 *
 * A custom bottom tab bar that renders as a floating pill/capsule shape
 * with blur background on iOS, solid on Android, and backdrop-filter on web.
 * Includes active indicator pill, press animation, and keyboard hiding.
 */


import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useCallback, useEffect } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarVisibility } from './TabBarVisibilityContext';

// Exported constants for layout calculations
export const FLOATING_TAB_BAR_HEIGHT = 64;
export const FLOATING_TAB_BAR_BOTTOM_MARGIN = 0;

type TabItemConfig = {
  name: string;
  title: string;
  icon: string;
  iconFocused?: string;
  isMenuTrigger?: boolean;
};

interface FloatingTabBarProps extends BottomTabBarProps {
  visibleTabs: TabItemConfig[];
  onOpenMenu: () => void;
  pathname: string;
  onTabVisited?: (tabName: string) => void;
  /** Position at 'top' or 'bottom' of the screen (default: 'bottom') */
  position?: 'top' | 'bottom';
  /** Badge counts keyed by tab name (e.g. { learn: 3 }) */
  badgeCounts?: Record<string, number>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Individual tab item with press scale animation and animated active capsule
 */
function TabItem({
  tab,
  isActive,
  onPress,
  badgeCount,
}: {
  tab: TabItemConfig;
  isActive: boolean;
  onPress: () => void;
  badgeCount?: number;
}) {
  const scale = useSharedValue(1);
  const activeProgress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    activeProgress.value = withTiming(isActive ? 1 : 0, { duration: 200 });
  }, [isActive, activeProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const innerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 1)']
    ),
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const iconName = isActive
    ? (tab.iconFocused || tab.icon)
    : tab.icon;

  return (
    <AnimatedPressable
      testID={`tab-${tab.name.replace(/[^a-z0-9]+/gi, '-')}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.title}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.tabItem, animatedStyle]}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Animated.View style={[styles.tabItemInner, innerAnimatedStyle, isActive && styles.tabItemActiveShadow]}>
        <View>
          <Ionicons
            name={iconName as any}
            size={20}
            color={isActive ? IOS_COLORS.systemBlue : IOS_COLORS.systemGray}
          />
          {badgeCount != null && badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.tabLabel,
            isActive && styles.tabLabelActive,
          ]}
          numberOfLines={1}
        >
          {tab.title}
        </Text>
      </Animated.View>
    </AnimatedPressable>
  );
}

export default function FloatingTabBar({
  state,
  navigation,
  visibleTabs,
  onOpenMenu,
  pathname,
  onTabVisited,
  position = 'bottom',
  badgeCounts,
}: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const isTop = position === 'top';
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  // Scroll-driven hide progress (0→1) written by the timeline scroll handler.
  const { scrollHidden } = useTabBarVisibility();
  // Distance the bar slides off-screen when fully hidden. Bottom slides down,
  // top slides up. Matches the keyboard-hide distance below.
  const scrollHideDistance = isTop
    ? -(FLOATING_TAB_BAR_HEIGHT + 40)
    : FLOATING_TAB_BAR_HEIGHT + 40;

  // Hide tab bar when keyboard is open
  useEffect(() => {
    const hideDistance = isTop
      ? -(FLOATING_TAB_BAR_HEIGHT + 40)  // slide up when at top
      : FLOATING_TAB_BAR_HEIGHT + 40;     // slide down when at bottom

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        translateY.value = withTiming(hideDistance, { duration: 250 });
        opacity.value = withTiming(0, { duration: 150 });
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        translateY.value = withTiming(0, { duration: 250 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [translateY, opacity, isTop]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    // Combine keyboard-hide (translateY/opacity) with scroll-hide so the bar
    // stays off-screen whenever either source wants it gone.
    transform: [
      { translateY: translateY.value + scrollHidden.value * scrollHideDistance },
    ],
    opacity: opacity.value * (1 - scrollHidden.value),
  }));

  // Helper to check if a tab is active based on pathname
  const isTabActive = (tabName: string): boolean => {
    const normalizedTabName = tabName === 'boat/index' ? 'boat' : tabName;
    return pathname === `/${normalizedTabName}` || pathname.startsWith(`/${normalizedTabName}/`);
  };

  const handleTabPress = (tab: TabItemConfig) => {
    onTabVisited?.(tab.name);
    triggerHaptic('selection');

    if (tab.isMenuTrigger) {
      onOpenMenu();
      return;
    }

    // Navigate to the tab route
    const route = state.routes.find(r => r.name === tab.name);
    if (route) {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    }
  };

  // Position close to screen edge.
  // Bottom: ensure clearance from home indicator / gesture bar
  // Top: safe-area top for iPad portrait mode
  // Android needs more space to avoid overlapping the gesture navigation bar
  const androidBottomExtra = Platform.OS === 'android' ? 12 : 0;
  const edgePosition = isTop
    ? Math.max(insets.top, 12)
    : Math.max(insets.bottom, 8) + FLOATING_TAB_BAR_BOTTOM_MARGIN + androidBottomExtra;

  const renderTabItem = (tab: TabItemConfig) => {
    return (
      <TabItem
        key={tab.name}
        tab={tab}
        isActive={isTabActive(tab.name)}
        onPress={() => handleTabPress(tab)}
        badgeCount={badgeCounts?.[tab.name]}
      />
    );
  };

  const barContent = (
    <View
      accessibilityRole="tablist"
      style={styles.tabRow}
    >
      {visibleTabs.map(renderTabItem)}
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        isTop ? { top: edgePosition } : { bottom: edgePosition },
        containerAnimatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.pillContainer}>
        {barContent}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    ...Platform.select({
      web: {
        position: 'fixed',
      } as any,
      default: {},
    }),
  },
  pillContainer: {
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
        // Ensure proper sizing on Android
        minHeight: 64,
      },
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
      } as any,
    }),
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Platform.OS === 'android' ? 8 : 4,
    paddingVertical: 4,
    height: Platform.OS === 'android' ? 60 : 56,
  },
  tabItem: {
    minWidth: Platform.OS === 'android' ? 52 : 48,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Platform.OS === 'android' ? 4 : 2,
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Platform.OS === 'android' ? 12 : 10,
    paddingVertical: Platform.OS === 'android' ? 6 : 5,
    borderRadius: 14,
  },
  tabItemActiveShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      } as any,
    }),
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: IOS_COLORS.systemGray,
    marginTop: 2,
  },
  tabLabelActive: {
    color: IOS_COLORS.systemBlue,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: IOS_COLORS.systemRed,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
