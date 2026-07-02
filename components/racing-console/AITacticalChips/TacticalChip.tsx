/**
 * Tactical Chip Component
 *
 * Displays a single AI-generated tactical recommendation
 * with theory, execution, and timing information
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AIChip } from '@/stores/raceConditionsStore';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  getChipColors
} from '@/constants/RacingDesignSystem';

interface TacticalChipProps {
  chip: AIChip;
  onPin: (chipId: string) => void;
  onDismiss: (chipId: string) => void;
  onSetAlert: (chipId: string, time: Date) => void;
  onExpand: (chip: AIChip) => void;
  isPinned?: boolean;
}

export function TacticalChip({
  chip,
  onPin,
  onDismiss,
  onSetAlert,
  onExpand,
  isPinned = false
}: TacticalChipProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = getChipColors(chip.type);

  const getIcon = () => {
    switch (chip.type) {
      case 'opportunity':
        return 'lightbulb-on';
      case 'caution':
        return 'alert';
      case 'alert':
        return 'alert-circle';
      case 'strategic':
        return 'brain';
      default:
        return 'information';
    }
  };

  const getIconColor = () => {
    return colors.text;
  };

  const handlePress = () => {
    setIsExpanded(!isExpanded);
  };

  const handleExpand = () => {
    onExpand(chip);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border
        }
      ]}
    >
      <TouchableOpacity
        style={styles.mainContent}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons
            name={getIcon()}
            size={16}
            color={getIconColor()}
            style={styles.headerIcon}
          />

          <Text style={[styles.theoryText, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 2}>
            {chip.theory}
          </Text>

          {isPinned && (
            <MaterialCommunityIcons
              name="pin"
              size={14}
              color={colors.text}
              style={styles.pinIndicator}
            />
          )}
        </View>

        {/* Execution (if expanded) */}
        {isExpanded && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name="book-open-variant"
                  size={14}
                  color={Colors.text.secondary}
                  style={styles.sectionIcon}
                />
                <Text style={styles.sectionLabel}>BetterAt Coach Execution</Text>
              </View>
              <Text style={styles.executionText}>{chip.execution}</Text>
            </View>

            {/* Timing */}
            {chip.timing && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={14}
                    color={Colors.text.secondary}
                    style={styles.sectionIcon}
                  />
                  <Text style={styles.sectionLabel}>Timing</Text>
                </View>
                <Text style={styles.timingText}>{chip.timing}</Text>
              </View>
            )}

            {/* Confidence */}
            <View style={styles.confidenceBadge}>
              <MaterialCommunityIcons
                name={
                  chip.confidence === 'high'
                    ? 'signal-cellular-3'
                    : chip.confidence === 'moderate'
                      ? 'signal-cellular-2'
                      : 'signal-cellular-1'
                }
                size={12}
                color={Colors.text.tertiary}
              />
              <Text style={styles.confidenceText}>
                {chip.confidence.toUpperCase()} CONFIDENCE
              </Text>
            </View>
          </>
        )}
      </TouchableOpacity>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {chip.timing && !chip.alert && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              // Parse timing and set alert
              // For now, just trigger callback
              onSetAlert(chip.id, new Date(Date.now() + 300000)); // 5 min from now
            }}
          >
            <MaterialCommunityIcons name="alarm" size={16} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>Alert</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onPin(chip.id)}
        >
          <MaterialCommunityIcons
            name={isPinned ? 'pin-off' : 'pin'}
            size={16}
            color={colors.text}
          />
          <Text style={[styles.actionText, { color: colors.text }]}>
            {isPinned ? 'Unpin' : 'Pin'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleExpand}
        >
          <MaterialCommunityIcons name="arrow-expand" size={16} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>Detail</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onDismiss(chip.id)}
        >
          <MaterialCommunityIcons name="close" size={16} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
      },
      android: {
        elevation: 2
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }
    })
  },

  mainContent: {
    padding: Spacing.md
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm
  },

  headerIcon: {
    marginRight: Spacing.sm,
    marginTop: 2
  },

  pinIndicator: {
    marginLeft: 'auto',
    marginTop: 2
  },

  theoryText: {
    flex: 1,
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semiBold,
    lineHeight: Typography.lineHeight.normal * Typography.fontSize.body
  },

  section: {
    marginTop: Spacing.md
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs
  },

  sectionIcon: {
    marginRight: Spacing.xs
  },

  sectionLabel: {
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.semiBold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide
  },

  executionText: {
    fontSize: Typography.fontSize.body,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.relaxed * Typography.fontSize.body
  },

  timingText: {
    fontSize: Typography.fontSize.bodySmall,
    color: Colors.text.secondary,
    fontWeight: Typography.fontWeight.medium
  },

  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.ui.surface,
    borderRadius: BorderRadius.sm
  },

  confidenceText: {
    fontSize: Typography.fontSize.micro,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.tertiary,
    marginLeft: Spacing.xs,
    letterSpacing: Typography.letterSpacing.wide
  },

  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.ui.borderLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginRight: Spacing.sm
  },

  actionText: {
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.medium,
    marginLeft: Spacing.xs
  }
});
