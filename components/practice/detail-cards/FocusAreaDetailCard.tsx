/**
 * Focus Area Detail Card
 *
 * Apple HIG compliant card showing:
 * - Skill area focus with level progress
 * - Pre/post session confidence ratings
 * - Trend indicator (improving/declining)
 * - AI suggestion reason if applicable
 *
 * Tufte design: Maximum data density with minimal decoration.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Brain, TrendingUp as _TrendingUp, TrendingDown as _TrendingDown, Minus as _Minus, Sparkles } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/components/cards/constants';
import { CARD_EXPAND_DURATION, CARD_COLLAPSE_DURATION } from '@/constants/navigationAnimations';
import { PracticeFocusArea, SKILL_AREA_CONFIG, SkillArea } from '@/types/practice';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Practice-specific colors
const PRACTICE_COLORS = {
  focus: IOS_COLORS.indigo,
  focusBg: `${IOS_COLORS.indigo}15`,
} as const;

/**
 * Skill level indicator (5 dots)
 */
function SkillLevelDots({
  level,
  size = 8,
  color = PRACTICE_COLORS.focus,
}: {
  level: number;
  size?: number;
  color?: string;
}) {
  const dots = [];
  for (let i = 1; i <= 5; i++) {
    dots.push(
      <View
        key={i}
        style={[
          styles.skillDot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i <= level ? color : `${color}30`,
          },
        ]}
      />
    );
  }
  return <View style={styles.skillDots}>{dots}</View>;
}

interface FocusAreaDetailCardProps {
  focusAreas: PracticeFocusArea[];
  isExpanded?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  onSelectFocusArea?: (skillArea: SkillArea) => void;
}

export function FocusAreaDetailCard({
  focusAreas,
  isExpanded = false,
  onToggle,
  onPress,
  onSelectFocusArea,
}: FocusAreaDetailCardProps) {
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

  const handlePress = () => {
    LayoutAnimation.configureNext({
      duration: isExpanded ? CARD_COLLAPSE_DURATION : CARD_EXPAND_DURATION,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    if (onToggle) {
      onToggle();
    } else if (onPress) {
      onPress();
    }
  };

  const primaryFocus = focusAreas.find((fa) => fa.priority === 1) || focusAreas[0];
  const secondaryFocuses = focusAreas.filter((fa) => fa.id !== primaryFocus?.id);

  if (!primaryFocus) {
    return (
      <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.emptyContent}>
          <Brain size={32} color={IOS_COLORS.gray3} />
          <Text style={styles.emptyTitle}>No Focus Areas Set</Text>
          <Text style={styles.emptySubtext}>Add focus areas to track your practice goals</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const config = SKILL_AREA_CONFIG[primaryFocus.skillArea];

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      {/* Collapsed View */}
      {!isExpanded && (
        <View style={styles.tufteGrid}>
          {/* Primary focus row */}
          <View style={styles.tufteRow}>
            <Brain size={18} color={PRACTICE_COLORS.focus} />
            <Text style={styles.tufteValue}>{config?.label || primaryFocus.skillArea}</Text>
            <SkillLevelDots level={primaryFocus.preSessionConfidence || 3} />
            {primaryFocus.aiSuggested && (
              <View style={styles.aiChip}>
                <Sparkles size={10} color={IOS_COLORS.cyan} />
              </View>
            )}
            <Animated.View style={chevronStyle}>
              <MaterialCommunityIcons name="chevron-right" size={18} color={IOS_COLORS.gray3} />
            </Animated.View>
          </View>

          {/* Secondary focuses count */}
          {secondaryFocuses.length > 0 && (
            <Text style={styles.secondaryCount}>
              +{secondaryFocuses.length} more focus {secondaryFocuses.length === 1 ? 'area' : 'areas'}
            </Text>
          )}
        </View>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          <Text style={styles.sectionLabel}>FOCUS AREAS</Text>

          {/* Primary Focus */}
          <TouchableOpacity
            style={[styles.focusItem, styles.focusItemPrimary]}
            onPress={() => onSelectFocusArea?.(primaryFocus.skillArea)}
            activeOpacity={0.7}
          >
            <View style={styles.focusHeader}>
              <Brain size={20} color={PRACTICE_COLORS.focus} />
              <View style={styles.focusText}>
                <Text style={styles.focusName}>{config?.label || primaryFocus.skillArea}</Text>
                <Text style={styles.focusPriority}>Primary Focus</Text>
              </View>
              {primaryFocus.aiSuggested && (
                <View style={styles.aiBadge}>
                  <Sparkles size={12} color={IOS_COLORS.cyan} />
                </View>
              )}
            </View>

            {/* Confidence levels */}
            <View style={styles.confidenceRow}>
              <View style={styles.confidenceItem}>
                <Text style={styles.confidenceLabel}>Before</Text>
                <SkillLevelDots level={primaryFocus.preSessionConfidence || 3} />
              </View>
              {primaryFocus.postSessionRating && (
                <View style={styles.confidenceItem}>
                  <Text style={styles.confidenceLabel}>After</Text>
                  <SkillLevelDots level={primaryFocus.postSessionRating} color={IOS_COLORS.green} />
                </View>
              )}
            </View>

            {/* AI suggestion reason */}
            {primaryFocus.suggestionReason && (
              <Text style={styles.suggestionReason}>{primaryFocus.suggestionReason}</Text>
            )}

            {/* Improvement notes */}
            {primaryFocus.improvementNotes && (
              <Text style={styles.improvementNotes}>{primaryFocus.improvementNotes}</Text>
            )}
          </TouchableOpacity>

          {/* Secondary Focuses */}
          {secondaryFocuses.map((focus) => {
            const focusConfig = SKILL_AREA_CONFIG[focus.skillArea];
            return (
              <TouchableOpacity
                key={focus.id}
                style={styles.focusItem}
                onPress={() => onSelectFocusArea?.(focus.skillArea)}
                activeOpacity={0.7}
              >
                <View style={styles.focusHeader}>
                  <Brain size={16} color={IOS_COLORS.gray} />
                  <View style={styles.focusText}>
                    <Text style={styles.focusNameSecondary}>
                      {focusConfig?.label || focus.skillArea}
                    </Text>
                  </View>
                  <SkillLevelDots level={focus.preSessionConfidence || 3} size={6} color={IOS_COLORS.gray} />
                </View>
              </TouchableOpacity>
            );
          })}
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
  tufteGrid: {
    gap: 4,
  },
  tufteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tufteValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  skillDots: {
    flexDirection: 'row',
    gap: 4,
  },
  skillDot: {},
  aiChip: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: `${IOS_COLORS.cyan}15`,
  },
  secondaryCount: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.gray,
    marginTop: 4,
    marginLeft: 28,
  },
  expandedContent: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  focusItem: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  focusItemPrimary: {
    backgroundColor: PRACTICE_COLORS.focusBg,
    borderWidth: 1,
    borderColor: `${PRACTICE_COLORS.focus}30`,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  focusText: {
    flex: 1,
  },
  focusName: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  focusNameSecondary: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  focusPriority: {
    fontSize: 11,
    fontWeight: '500',
    color: PRACTICE_COLORS.focus,
    marginTop: 2,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${IOS_COLORS.cyan}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confidenceRow: {
    flexDirection: 'row',
    gap: 24,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${PRACTICE_COLORS.focus}30`,
  },
  confidenceItem: {
    gap: 4,
  },
  confidenceLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionReason: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.cyan,
    fontStyle: 'italic',
  },
  improvementNotes: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  emptySubtext: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    textAlign: 'center',
  },
});

export default FocusAreaDetailCard;
