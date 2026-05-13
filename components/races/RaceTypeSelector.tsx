/**
 * RaceTypeSelector Component
 *
 * Apple Human Interface Guidelines (HIG) compliant design:
 * - iOS system colors from shared constants
 * - Toggle selector for choosing between different racing formats
 * - Used in Add Race flow and potentially for filtering
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Sailboat, Navigation, Target, Users } from 'lucide-react-native';
import { IOS_COLORS } from '@/components/cards/constants';

export type RaceType = 'fleet' | 'distance' | 'match' | 'team';

// Race type theme colors (iOS semantic colors)
export const RACE_TYPE_COLORS = {
  fleet: {
    primary: IOS_COLORS.blue,
    badge: `${IOS_COLORS.blue}15`,
  },
  distance: {
    primary: IOS_COLORS.purple,
    badge: `${IOS_COLORS.purple}15`,
  },
  match: {
    primary: IOS_COLORS.orange,
    badge: `${IOS_COLORS.orange}15`,
  },
  team: {
    primary: IOS_COLORS.teal,
    badge: `${IOS_COLORS.teal}15`,
  },
} as const;

interface RaceTypeSelectorProps {
  value: RaceType;
  onChange: (type: RaceType) => void;
  disabled?: boolean;
  size?: 'normal' | 'compact';
  /** Show all 4 race types (default: false shows only fleet/distance) */
  showAllTypes?: boolean;
}

const RACE_TYPE_OPTIONS: {
  type: RaceType;
  icon: typeof Sailboat;
  label: string;
  subtitle: string;
}[] = [
  { type: 'fleet', icon: Sailboat, label: 'Fleet Racing', subtitle: 'Buoy courses' },
  { type: 'distance', icon: Navigation, label: 'Distance Racing', subtitle: 'Offshore / passage' },
  { type: 'match', icon: Target, label: 'Match Racing', subtitle: '1v1 competition' },
  { type: 'team', icon: Users, label: 'Team Racing', subtitle: 'Multi-boat teams' },
];

export function RaceTypeSelector({
  value,
  onChange,
  disabled = false,
  size = 'normal',
  showAllTypes = false,
}: RaceTypeSelectorProps) {
  const isCompact = size === 'compact';
  const typesToShow = showAllTypes
    ? RACE_TYPE_OPTIONS
    : RACE_TYPE_OPTIONS.filter(opt => opt.type === 'fleet' || opt.type === 'distance');

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isCompact && styles.labelCompact]}>Race Type</Text>
      <View style={[
        styles.toggleContainer,
        isCompact && styles.toggleContainerCompact,
        showAllTypes && styles.toggleContainerGrid,
      ]}>
        {typesToShow.map(({ type, icon: Icon, label, subtitle }) => (
          <Pressable
            key={type}
            style={[
              styles.option,
              isCompact && styles.optionCompact,
              showAllTypes && styles.optionGrid,
              value === type && styles.optionSelected,
              value === type && { backgroundColor: RACE_TYPE_COLORS[type].primary },
              disabled && styles.optionDisabled,
            ]}
            onPress={() => !disabled && onChange(type)}
            disabled={disabled}
          >
            <View style={styles.optionContent}>
              <Icon
                size={isCompact ? 18 : 24}
                color={value === type ? IOS_COLORS.systemBackground : IOS_COLORS.gray}
              />
              <Text style={[
                styles.optionText,
                isCompact && styles.optionTextCompact,
                value === type && styles.optionTextSelected,
              ]}>
                {isCompact ? label.replace(' Racing', '') : label}
              </Text>
              {!isCompact && (
                <Text style={[
                  styles.optionSubtext,
                  value === type && styles.optionSubtextSelected,
                ]}>
                  {subtitle}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Inline badge version for displaying race type on cards
 */
interface RaceTypeBadgeProps {
  type: RaceType;
  size?: 'small' | 'normal';
}

const RACE_TYPE_CONFIG = {
  fleet: {
    icon: Sailboat,
    label: 'Fleet',
  },
  distance: {
    icon: Navigation,
    label: 'Distance',
  },
  match: {
    icon: Target,
    label: 'Match',
  },
  team: {
    icon: Users,
    label: 'Team',
  },
} as const;

export function RaceTypeBadge({ type, size = 'normal' }: RaceTypeBadgeProps) {
  const isSmall = size === 'small';
  const config = RACE_TYPE_CONFIG[type];
  const colors = RACE_TYPE_COLORS[type];
  const IconComponent = config.icon;

  return (
    <View style={[
      styles.badge,
      isSmall && styles.badgeSmall,
      { backgroundColor: colors.badge },
    ]}>
      <IconComponent size={isSmall ? 10 : 12} color={colors.primary} />
      <Text style={[
        styles.badgeText,
        isSmall && styles.badgeTextSmall,
        { color: colors.primary },
      ]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 8,
  },
  labelCompact: {
    fontSize: 12,
    marginBottom: 6,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleContainerCompact: {
    gap: 8,
  },
  toggleContainerGrid: {
    flexWrap: 'wrap',
  },
  option: {
    flex: 1,
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: IOS_COLORS.gray5,
    padding: 16,
    alignItems: 'center',
  },
  optionCompact: {
    padding: 10,
    borderRadius: 8,
  },
  optionGrid: {
    flexBasis: '48%',
    flexGrow: 0,
  },
  optionSelected: {
    backgroundColor: IOS_COLORS.blue,
    borderColor: IOS_COLORS.blue,
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionContent: {
    alignItems: 'center',
    gap: 6,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },
  optionTextCompact: {
    fontSize: 12,
    marginTop: 2,
  },
  optionTextSelected: {
    color: IOS_COLORS.systemBackground,
  },
  optionSubtext: {
    fontSize: 11,
    color: IOS_COLORS.gray,
    marginTop: 2,
  },
  optionSubtextSelected: {
    color: `${IOS_COLORS.systemBackground}CC`,
  },
  // Badge styles
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextSmall: {
    fontSize: 10,
  },
});

export default RaceTypeSelector;

