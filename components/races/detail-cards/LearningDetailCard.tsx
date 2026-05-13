/**
 * Learning Detail Card
 * Expandable card showing the key takeaway from the race
 * Collapsed: Header + quote preview + source indicator
 * Expanded: Full quote, focus next race section
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';
import { CARD_EXPAND_DURATION, CARD_COLLAPSE_DURATION } from '@/constants/navigationAnimations';
import { IOS_COLORS } from '@/components/cards/constants';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface LearningDetailCardProps {
  raceId: string;
  keyLearning?: string | null;
  focusNextRace?: string | null;
  source?: 'ai' | 'coach' | 'pattern' | null;
  isExpanded?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
}

function getSourceLabel(source?: string | null): { icon: string; label: string; color: string } {
  switch (source) {
    case 'ai':
      return { icon: 'sparkles', label: 'Analysis', color: IOS_COLORS.purple };
    case 'coach':
      return { icon: 'whistle', label: 'Coach Feedback', color: IOS_COLORS.cyan };
    case 'pattern':
      return { icon: 'chart-timeline-variant', label: 'Pattern Detected', color: IOS_COLORS.green };
    default:
      return { icon: 'lightbulb-outline', label: 'Insight', color: IOS_COLORS.orange };
  }
}

export function LearningDetailCard({
  raceId: _raceId,
  keyLearning,
  focusNextRace,
  source,
  isExpanded = false,
  onToggle,
  onPress,
}: LearningDetailCardProps) {
  const hasLearning = !!keyLearning;
  const sourceInfo = getSourceLabel(source);
  const rotation = useSharedValue(isExpanded ? 1 : 0);

  React.useEffect(() => {
    rotation.value = withTiming(isExpanded ? 1 : 0, {
      duration: isExpanded ? CARD_EXPAND_DURATION : CARD_COLLAPSE_DURATION,
    });
  }, [isExpanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => {
    'worklet';
    const rotationValue = rotation.value ?? 0;
    return {
      transform: [{ rotate: `${interpolate(rotationValue, [0, 1], [0, 90])}deg` }],
    };
  });

  const handlePress = useCallback(() => {
    LayoutAnimation.configureNext({
      duration: isExpanded ? CARD_COLLAPSE_DURATION : CARD_EXPAND_DURATION,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });

    if (onToggle) {
      onToggle();
    } else if (onPress) {
      onPress();
    }
  }, [isExpanded, onToggle, onPress]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Header - Always visible */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${sourceInfo.color}15` }]}>
          <MaterialCommunityIcons
            name={sourceInfo.icon as any}
            size={18}
            color={sourceInfo.color}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Key Takeaway</Text>
          <Text style={styles.headerSubtitle}>Race learning & focus</Text>
        </View>
        <Animated.View style={chevronStyle}>
          <MaterialCommunityIcons name="chevron-right" size={20} color={IOS_COLORS.gray} />
        </Animated.View>
      </View>

      {hasLearning ? (
        <>
          {/* Collapsed: Quote preview */}
          {!isExpanded && (
            <View style={styles.collapsedContent}>
              <View style={styles.quotePreview}>
                <MaterialCommunityIcons name="format-quote-open" size={16} color={IOS_COLORS.gray3} />
                <Text style={styles.quotePreviewText} numberOfLines={2}>
                  {keyLearning}
                </Text>
              </View>
              <View style={styles.collapsedFooter}>
                <View style={[styles.sourceChip, { backgroundColor: `${sourceInfo.color}15` }]}>
                  <MaterialCommunityIcons name={sourceInfo.icon as any} size={12} color={sourceInfo.color} />
                  <Text style={[styles.sourceChipText, { color: sourceInfo.color }]}>{sourceInfo.label}</Text>
                </View>
                {focusNextRace && (
                  <View style={styles.hasFocusChip}>
                    <MaterialCommunityIcons name="target" size={12} color={IOS_COLORS.blue} />
                    <Text style={styles.hasFocusText}>Has focus</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Expanded: Full content */}
          {isExpanded && (
            <View style={styles.expandedContent}>
              {/* Main Learning - Quote Style */}
              <View style={styles.quoteContainer}>
                <View style={styles.quoteMark}>
                  <MaterialCommunityIcons name="format-quote-open" size={28} color={IOS_COLORS.gray5} />
                </View>
                <Text style={styles.learningText}>{keyLearning}</Text>
              </View>

              {/* Focus Next Race */}
              {focusNextRace && (
                <View style={styles.focusContainer}>
                  <View style={styles.focusHeader}>
                    <MaterialCommunityIcons name="target" size={16} color={IOS_COLORS.blue} />
                    <Text style={styles.focusLabel}>Focus Next Race</Text>
                  </View>
                  <Text style={styles.focusText}>{focusNextRace}</Text>
                </View>
              )}

              {/* Source Indicator */}
              <View style={styles.sourceContainer}>
                <MaterialCommunityIcons name={sourceInfo.icon as any} size={14} color={sourceInfo.color} />
                <Text style={[styles.sourceText, { color: sourceInfo.color }]}>{sourceInfo.label}</Text>
              </View>
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyContent}>
          <View style={styles.emptyIconContainer}>
            <MaterialCommunityIcons name="school-outline" size={32} color={IOS_COLORS.gray3} />
          </View>
          <Text style={styles.emptyTitle}>No Learnings Yet</Text>
          <Text style={styles.emptySubtitle}>
            Complete a race debrief to get personalized insights
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: IOS_COLORS.gray5,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerSubtitle: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 1,
  },

  // Collapsed content
  collapsedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.gray6,
    gap: 10,
  },
  quotePreview: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  quotePreviewText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    color: IOS_COLORS.label,
    lineHeight: 18,
  },
  collapsedFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sourceChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  hasFocusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${IOS_COLORS.blue}15`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hasFocusText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.blue,
  },

  // Expanded content
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.gray6,
    gap: 16,
  },
  quoteContainer: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderRadius: 12,
    padding: 14,
    paddingLeft: 10,
  },
  quoteMark: {
    marginRight: 4,
    marginTop: -6,
  },
  learningText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: IOS_COLORS.label,
    fontStyle: 'italic',
  },
  focusContainer: {
    backgroundColor: `${IOS_COLORS.blue}10`,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: IOS_COLORS.blue,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  focusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  focusText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.blue,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    paddingTop: 4,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Empty state
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  emptySubtitle: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
