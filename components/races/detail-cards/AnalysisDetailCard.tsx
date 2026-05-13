/**
 * Analysis Detail Card
 * Expandable card showing AI analysis summary and insights
 * Collapsed: Header + summary preview + confidence chip
 * Expanded: Full summary, all insights, confidence bar
 */

import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
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

interface AnalysisDetailCardProps {
  raceId: string;
  hasDebrief?: boolean;
  analysisSummary?: string | null;
  analysisInsights?: string[] | null;
  analysisConfidence?: number | null;
  isExpanded?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  onAddDebrief?: () => void;
  onShare?: () => void;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return IOS_COLORS.green;
  if (confidence >= 60) return IOS_COLORS.orange;
  return IOS_COLORS.secondaryLabel;
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'High';
  if (confidence >= 60) return 'Medium';
  return 'Low';
}

export function AnalysisDetailCard({
  raceId: _raceId,
  hasDebrief,
  analysisSummary,
  analysisInsights,
  analysisConfidence,
  isExpanded = false,
  onToggle,
  onPress,
  onAddDebrief,
  onShare,
}: AnalysisDetailCardProps) {
  const hasAnalysis = hasDebrief && analysisSummary;
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
        <View style={[styles.headerIcon, hasAnalysis && styles.headerIconActive]}>
          <MaterialCommunityIcons
            name={"sparkles" as any}
            size={18}
            color={hasAnalysis ? IOS_COLORS.purple : IOS_COLORS.gray}
          />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Analysis</Text>
          <Text style={styles.headerSubtitle}>Race insights & recommendations</Text>
        </View>
        <Animated.View style={chevronStyle}>
          <MaterialCommunityIcons name="chevron-right" size={20} color={IOS_COLORS.gray} />
        </Animated.View>
      </View>

      {hasAnalysis ? (
        <>
          {/* Collapsed: Preview */}
          {!isExpanded && (
            <View style={styles.collapsedContent}>
              <Text style={styles.summaryPreview} numberOfLines={2}>
                {analysisSummary}
              </Text>
              <View style={styles.collapsedChips}>
                {analysisConfidence !== null && analysisConfidence !== undefined && (
                  <View style={[styles.confidenceChip, { backgroundColor: `${getConfidenceColor(analysisConfidence)}15` }]}>
                    <View style={[styles.confidenceDot, { backgroundColor: getConfidenceColor(analysisConfidence) }]} />
                    <Text style={[styles.confidenceChipText, { color: getConfidenceColor(analysisConfidence) }]}>
                      {getConfidenceLabel(analysisConfidence)} confidence
                    </Text>
                  </View>
                )}
                {analysisInsights && analysisInsights.length > 0 && (
                  <View style={styles.insightsChip}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={12} color={IOS_COLORS.orange} />
                    <Text style={styles.insightsChipText}>{analysisInsights.length} insights</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Expanded: Full content */}
          {isExpanded && (
            <View style={styles.expandedContent}>
              {/* Summary */}
              <View style={styles.summarySection}>
                <Text style={styles.sectionLabel}>Summary</Text>
                <Text style={styles.summaryText}>{analysisSummary}</Text>
              </View>

              {/* Key Insights */}
              {analysisInsights && analysisInsights.length > 0 && (
                <View style={styles.insightsSection}>
                  <Text style={styles.sectionLabel}>Key Insights</Text>
                  <View style={styles.insightsList}>
                    {analysisInsights.map((insight, index) => (
                      <View key={index} style={styles.insightRow}>
                        <MaterialCommunityIcons name="lightbulb-outline" size={16} color={IOS_COLORS.orange} />
                        <Text style={styles.insightText}>{insight}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Confidence Score */}
              {analysisConfidence !== null && analysisConfidence !== undefined && (
                <View style={styles.confidenceSection}>
                  <View style={styles.confidenceHeader}>
                    <Text style={styles.confidenceLabel}>Analysis Confidence</Text>
                    <Text style={[styles.confidenceValue, { color: getConfidenceColor(analysisConfidence) }]}>
                      {analysisConfidence}%
                    </Text>
                  </View>
                  <View style={styles.confidenceBar}>
                    <View
                      style={[
                        styles.confidenceFill,
                        {
                          width: `${analysisConfidence}%`,
                          backgroundColor: getConfidenceColor(analysisConfidence),
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Share Action */}
              {onShare && (
                <Pressable
                  style={styles.shareAction}
                  onPress={(e) => {
                    e.stopPropagation();
                    onShare();
                  }}
                >
                  <MaterialCommunityIcons name="share-variant" size={16} color={IOS_COLORS.purple} />
                  <Text style={styles.shareActionText}>Share Analysis</Text>
                </Pressable>
              )}
            </View>
          )}
        </>
      ) : (
        <View style={styles.emptyContent}>
          <View style={styles.emptyIconContainer}>
            <MaterialCommunityIcons name="notebook-edit-outline" size={32} color={IOS_COLORS.gray3} />
          </View>
          <Text style={styles.emptyTitle}>No debrief recorded</Text>
          <Text style={styles.emptySubtitle}>
            Add a race debrief to get insights
          </Text>
          {onAddDebrief && (
            <Pressable
              style={styles.addDebriefButton}
              onPress={onAddDebrief}
            >
              <MaterialCommunityIcons name="plus" size={18} color={IOS_COLORS.systemBackground} />
              <Text style={styles.addDebriefText}>Add Race Debrief</Text>
            </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconActive: {
    backgroundColor: `${IOS_COLORS.purple}15`,
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
  summaryPreview: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.label,
  },
  collapsedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  confidenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  insightsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${IOS_COLORS.orange}15`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  insightsChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.orange,
  },

  // Expanded content
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.gray6,
    gap: 16,
  },
  summarySection: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
  },
  insightsSection: {
    gap: 10,
  },
  insightsList: {
    gap: 10,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  confidenceSection: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: IOS_COLORS.gray6,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confidenceValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  confidenceBar: {
    height: 6,
    backgroundColor: IOS_COLORS.secondarySystemBackground,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
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
  addDebriefButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.blue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  addDebriefText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemBackground,
  },
  shareAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: `${IOS_COLORS.purple}10`,
    borderWidth: 1,
    borderColor: `${IOS_COLORS.purple}20`,
  },
  shareActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.purple,
  },
});
