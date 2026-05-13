/**
 * WhyDetailCard Component
 *
 * Shows the WHY section of the 4Q framework:
 * - AI reasoning for the practice suggestion
 * - Linked races that informed the decision
 * - User's own rationale
 *
 * Apple HIG compliant with Tufte design principles.
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
import {
  Sparkles,
  Brain,
  Link2,
  FileText,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/components/cards/constants';
import { CARD_EXPAND_DURATION, CARD_COLLAPSE_DURATION } from '@/constants/navigationAnimations';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WHY_COLORS = {
  ai: IOS_COLORS.cyan,
  aiBg: `${IOS_COLORS.cyan}15`,
  link: IOS_COLORS.indigo,
} as const;

interface LinkedRace {
  id: string;
  name: string;
  date: string;
}

interface PerformanceInsight {
  skillArea: string;
  skillAreaLabel: string;
  trend: 'improving' | 'stable' | 'declining';
  note?: string;
}

interface WhyDetailCardProps {
  aiReasoning?: string;
  userRationale?: string;
  linkedRaces?: LinkedRace[];
  performanceInsights?: PerformanceInsight[];
  isExpanded?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  onViewRace?: (raceId: string) => void;
}

function TrendIcon({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp size={12} color={IOS_COLORS.green} />;
    case 'declining':
      return <TrendingDown size={12} color={IOS_COLORS.red} />;
    default:
      return <Minus size={12} color={IOS_COLORS.gray} />;
  }
}

export function WhyDetailCard({
  aiReasoning,
  userRationale,
  linkedRaces = [],
  performanceInsights = [],
  isExpanded = false,
  onToggle,
  onPress,
  onViewRace,
}: WhyDetailCardProps) {
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

  const hasAI = !!aiReasoning;
  const hasUserNotes = !!userRationale;
  const hasLinkedRaces = linkedRaces.length > 0;
  const hasInsights = performanceInsights.length > 0;
  const hasContent = hasAI || hasUserNotes || hasLinkedRaces;

  if (!hasContent) {
    return null; // Don't show card if no WHY content
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      {/* Collapsed View */}
      {!isExpanded && (
        <View style={styles.tufteGrid}>
          <View style={styles.tufteRow}>
            {hasAI ? (
              <Sparkles size={18} color={WHY_COLORS.ai} />
            ) : (
              <Brain size={18} color={IOS_COLORS.gray} />
            )}
            <Text style={styles.tufteValue}>
              {hasAI ? 'Recommended' : 'Practice Rationale'}
            </Text>
            {hasLinkedRaces && (
              <View style={styles.linkedBadge}>
                <Link2 size={10} color={WHY_COLORS.link} />
                <Text style={styles.linkedBadgeText}>{linkedRaces.length}</Text>
              </View>
            )}
            <Animated.View style={chevronStyle}>
              <MaterialCommunityIcons name="chevron-right" size={18} color={IOS_COLORS.gray3} />
            </Animated.View>
          </View>

          {hasAI && (
            <Text style={styles.previewText} numberOfLines={2}>
              {aiReasoning}
            </Text>
          )}
        </View>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* AI Reasoning Section */}
          {hasAI && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Sparkles size={14} color={WHY_COLORS.ai} />
                <Text style={styles.sectionLabel}>AI ANALYSIS</Text>
              </View>
              <View style={styles.aiBox}>
                <Text style={styles.aiText}>{aiReasoning}</Text>
              </View>
            </View>
          )}

          {/* Performance Insights */}
          {hasInsights && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PERFORMANCE INSIGHTS</Text>
              <View style={styles.insightsGrid}>
                {performanceInsights.map((insight, index) => (
                  <View key={index} style={styles.insightChip}>
                    <TrendIcon trend={insight.trend} />
                    <Text style={styles.insightText}>{insight.skillAreaLabel}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Linked Races */}
          {hasLinkedRaces && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Link2 size={14} color={WHY_COLORS.link} />
                <Text style={styles.sectionLabel}>LINKED RACES</Text>
              </View>
              {linkedRaces.map((race) => (
                <TouchableOpacity
                  key={race.id}
                  style={styles.raceItem}
                  onPress={() => onViewRace?.(race.id)}
                  activeOpacity={0.7}
                >
                  <FileText size={14} color={WHY_COLORS.link} />
                  <View style={styles.raceInfo}>
                    <Text style={styles.raceName}>{race.name}</Text>
                    <Text style={styles.raceDate}>{race.date}</Text>
                  </View>
                  <ChevronRight size={14} color={IOS_COLORS.gray4} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* User Rationale */}
          {hasUserNotes && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <FileText size={14} color={IOS_COLORS.gray} />
                <Text style={styles.sectionLabel}>YOUR NOTES</Text>
              </View>
              <Text style={styles.rationaleText}>{userRationale}</Text>
            </View>
          )}
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
    gap: 6,
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
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${WHY_COLORS.link}15`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  linkedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: WHY_COLORS.link,
  },
  previewText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
    marginLeft: 28,
    lineHeight: 18,
  },
  expandedContent: {
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  aiBox: {
    backgroundColor: WHY_COLORS.aiBg,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: WHY_COLORS.ai,
  },
  aiText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  insightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.gray6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  insightText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  raceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 10,
    padding: 10,
  },
  raceInfo: {
    flex: 1,
  },
  raceName: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  raceDate: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    marginTop: 1,
  },
  rationaleText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 10,
    padding: 12,
  },
});

export default WhyDetailCard;
