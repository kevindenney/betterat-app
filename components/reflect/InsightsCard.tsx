/**
 * InsightsCard - AI-powered performance insights and recommendations
 *
 * Displays personalized insights about racing performance with
 * actionable recommendations, similar to fitness apps' coaching features.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IOS_COLORS, IOS_SHADOWS } from '@/lib/design-tokens-ios';
import type { PerformanceInsight } from '@/hooks/useReflectProfile';

interface InsightsCardProps {
  insights: PerformanceInsight[];
  onSeeMore?: () => void;
  onInsightPress?: (insight: PerformanceInsight) => void;
}

// Map color names to actual colors
function getColor(colorName: string): string {
  const colors: Record<string, string> = {
    systemBlue: IOS_COLORS.systemBlue,
    systemGreen: IOS_COLORS.systemGreen,
    systemYellow: IOS_COLORS.systemYellow,
    systemOrange: IOS_COLORS.systemOrange,
    systemRed: IOS_COLORS.systemRed,
    systemPurple: IOS_COLORS.systemPurple,
    systemTeal: IOS_COLORS.systemTeal,
    systemIndigo: IOS_COLORS.systemIndigo,
  };
  return colors[colorName] || IOS_COLORS.systemBlue;
}

function _getSentimentIcon(sentiment: string): keyof typeof Ionicons.glyphMap {
  switch (sentiment) {
    case 'positive':
      return 'arrow-up-circle';
    case 'needs_attention':
      return 'alert-circle';
    default:
      return 'information-circle';
  }
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'positive':
      return IOS_COLORS.systemGreen;
    case 'needs_attention':
      return IOS_COLORS.systemOrange;
    default:
      return IOS_COLORS.systemBlue;
  }
}

function InsightItem({
  insight,
  onPress,
}: {
  insight: PerformanceInsight;
  onPress?: () => void;
}) {
  const router = useRouter();
  const color = getColor(insight.color);
  const iconName = insight.icon as keyof typeof Ionicons.glyphMap;
  const sentimentColor = getSentimentColor(insight.sentiment);

  const handleActionPress = () => {
    if (insight.actionRoute) {
      router.push(insight.actionRoute as any);
    } else if (onPress) {
      onPress();
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.insightCard,
        pressed && onPress && styles.insightCardPressed,
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Sentiment Indicator */}
      <View style={[styles.sentimentBar, { backgroundColor: sentimentColor }]} />

      <View style={styles.insightContent}>
        {/* Header */}
        <View style={styles.insightHeader}>
          <View style={[styles.insightIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name={iconName} size={18} color={color} />
          </View>
          <Text style={styles.insightTitle} numberOfLines={1}>
            {insight.title}
          </Text>
        </View>

        {/* Description */}
        <Text style={styles.insightDescription} numberOfLines={3}>
          {insight.description}
        </Text>

        {/* Metric (if available) */}
        {insight.metric && (
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>{insight.metric}:</Text>
            <Text style={[styles.metricValue, { color }]}>
              {insight.metricValue}
            </Text>
            {insight.metricChange !== undefined && (
              <View
                style={[
                  styles.changeBadge,
                  {
                    backgroundColor:
                      insight.metricChange < 0
                        ? IOS_COLORS.systemGreen + '20'
                        : IOS_COLORS.systemRed + '20',
                  },
                ]}
              >
                <Ionicons
                  name={insight.metricChange < 0 ? 'arrow-down' : 'arrow-up'}
                  size={10}
                  color={
                    insight.metricChange < 0
                      ? IOS_COLORS.systemGreen
                      : IOS_COLORS.systemRed
                  }
                />
                <Text
                  style={[
                    styles.changeText,
                    {
                      color:
                        insight.metricChange < 0
                          ? IOS_COLORS.systemGreen
                          : IOS_COLORS.systemRed,
                    },
                  ]}
                >
                  {Math.abs(insight.metricChange)}%
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action Button (if available) */}
        {insight.actionLabel && (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
            onPress={handleActionPress}
          >
            <Text style={styles.actionButtonText} numberOfLines={1}>{insight.actionLabel}</Text>
            <Ionicons
              name={insight.actionRoute ? 'chevron-forward' : 'share-outline'}
              size={14}
              color={IOS_COLORS.systemBlue}
            />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export function InsightsCard({
  insights,
  onSeeMore,
  onInsightPress,
}: InsightsCardProps) {
  if (insights.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Ionicons name="bulb" size={18} color={IOS_COLORS.systemYellow} />
            <Text style={styles.title}>Insights</Text>
          </View>
        </View>
        <View style={styles.emptyState}>
          <Ionicons
            name="analytics-outline"
            size={40}
            color={IOS_COLORS.systemGray3}
          />
          <Text style={styles.emptyText}>No insights yet</Text>
          <Text style={styles.emptySubtext}>
            Complete more races to get personalized insights
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="bulb" size={18} color={IOS_COLORS.systemYellow} />
          <Text style={styles.title}>Insights</Text>
        </View>
        {onSeeMore && insights.length > 2 && (
          <Pressable
            onPress={onSeeMore}
            style={({ pressed }) => [
              styles.seeMoreButton,
              pressed && styles.seeMoreButtonPressed,
            ]}
          >
            <Text style={styles.seeMoreText}>See All</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={IOS_COLORS.systemBlue}
            />
          </Pressable>
        )}
      </View>

      {/* Insights Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
      >
        {insights.slice(0, 4).map((insight) => (
          <InsightItem
            key={insight.id}
            insight={insight}
            onPress={onInsightPress ? () => onInsightPress(insight) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
    ...IOS_SHADOWS.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeMoreButtonPressed: {
    opacity: 0.6,
  },
  seeMoreText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
  carouselContent: {
    paddingHorizontal: 12,
    gap: 10,
  },
  insightCard: {
    width: 280,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  insightCardPressed: {
    opacity: 0.8,
  },
  sentimentBar: {
    width: 4,
  },
  insightContent: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.24,
  },
  insightDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  actionButtonPressed: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
    flexShrink: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
  },
});

export default InsightsCard;
