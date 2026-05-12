import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_ANIMATIONS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';

interface Tab<T extends string> {
  value: T;
  label: string;
  badge?: number;
  /** Show a completion checkmark icon before the label */
  completed?: boolean;
}

interface IOSPillTabsProps<T extends string> {
  /** Array of tabs with value and label */
  tabs: Tab<T>[];
  /** Currently selected tab value */
  selectedValue: T;
  /** Callback when tab changes */
  onChange: (value: T) => void;
  /** Whether to scroll horizontally (for many tabs) */
  scrollable?: boolean;
  /** Accent color for the selected pill */
  accentColor?: string;
  /** Whether to show compact styling */
  compact?: boolean;
  /** Background color for unselected pills */
  unselectedBgColor?: string;
  /** Border color for unselected pills (shows outline style) */
  unselectedBorderColor?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Individual pill tab - extracted as a proper component so hooks are valid
 */
function PillTab<T extends string>({
  tab,
  isSelected,
  onPress,
  accentColor,
  unselectedBgColor,
  unselectedBorderColor,
  compact,
}: {
  tab: Tab<T>;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  unselectedBgColor: string;
  unselectedBorderColor?: string;
  compact: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedTabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      testID={`pill-tab-${tab.value}`}
      style={[
        styles.pill,
        compact && styles.pillCompact,
        {
          backgroundColor: isSelected ? accentColor : unselectedBgColor,
          ...(unselectedBorderColor && !isSelected
            ? { borderWidth: 1, borderColor: unselectedBorderColor }
            : { borderWidth: 1, borderColor: 'transparent' }),
        },
        animatedTabStyle,
      ]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.95, IOS_ANIMATIONS.spring.stiff);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
      }}
    >
      <View style={styles.pillContent}>
        {tab.completed && !isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={compact ? 14 : 16}
            color={IOS_COLORS.systemGreen}
          />
        )}
        <Text
          style={[
            styles.pillLabel,
            compact && styles.pillLabelCompact,
            isSelected && styles.pillLabelSelected,
            tab.completed && !isSelected && styles.pillLabelCompleted,
          ]}
        >
          {tab.label}
        </Text>
        {tab.badge !== undefined && tab.badge > 0 && (
          <View
            style={[
              styles.badge,
              isSelected && { backgroundColor: 'rgba(255,255,255,0.3)' },
            ]}
          >
            <Text style={[styles.badgeText, isSelected && { color: '#FFFFFF' }]}>
              {tab.badge > 99 ? '99+' : tab.badge}
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

/**
 * iOS-style pill tabs component
 * Following Apple Human Interface Guidelines
 *
 * Features:
 * - Pill-shaped buttons with filled background for selected
 * - Haptic feedback on tab change
 * - Scrollable for many tabs
 * - Badge support
 */
export function IOSPillTabs<T extends string>({
  tabs,
  selectedValue,
  onChange,
  scrollable = false,
  accentColor = IOS_COLORS.systemBlue,
  compact = false,
  unselectedBgColor = IOS_COLORS.systemGray6,
  unselectedBorderColor,
}: IOSPillTabsProps<T>) {
  const handleTabPress = useCallback((value: T) => {
    if (value !== selectedValue) {
      triggerHaptic('selection');
      onChange(value);
    }
  }, [selectedValue, onChange]);

  const TabsContent = (
    <View style={styles.tabsRow}>
      {tabs.map((tab) => (
        <PillTab
          key={tab.value}
          tab={tab}
          isSelected={tab.value === selectedValue}
          onPress={() => handleTabPress(tab.value)}
          accentColor={accentColor}
          unselectedBgColor={unselectedBgColor}
          unselectedBorderColor={unselectedBorderColor}
          compact={compact}
        />
      ))}
    </View>
  );

  if (scrollable) {
    return (
      <View style={styles.container}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {TabsContent}
        </ScrollView>
      </View>
    );
  }

  return <View style={styles.container}>{TabsContent}</View>;
}

/**
 * Convenience hook for managing tab state
 */
export function usePillTabs<T extends string>(
  initialValue: T
): [T, (value: T) => void] {
  const [value, setValue] = React.useState<T>(initialValue);
  return [value, setValue];
}

const styles = StyleSheet.create({
  container: {
    marginBottom: IOS_SPACING.md,
  },
  scrollContent: {
    paddingHorizontal: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: IOS_SPACING.xs,
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
  },
  pill: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: 16,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  pillCompact: {
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs + 2,
    borderRadius: 14,
    minWidth: 44,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  pillLabel: {
    fontSize: IOS_TYPOGRAPHY.subhead.fontSize,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  pillLabelCompact: {
    fontSize: IOS_TYPOGRAPHY.footnote.fontSize,
  },
  pillLabelSelected: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pillLabelCompleted: {
    color: IOS_COLORS.systemGreen,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: IOS_COLORS.systemGray4,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
});

export default IOSPillTabs;
