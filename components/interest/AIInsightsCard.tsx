/**
 * AIInsightsCard — Displays AI-extracted insights about user's learning patterns.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useAIInsightsByType } from '@/hooks/useAIInsights';
import { useAIInsights } from '@/hooks/useAIInsights';
import { useInsightGrowth } from '@/hooks/useInsightGrowth';
import type { InsightType } from '@/types/manifesto';

interface AIInsightsCardProps {
  interestId: string;
}

const INSIGHT_CONFIG: Partial<Record<InsightType, { color: string; icon: string; label: string }>> = {
  strength: { color: IOS_COLORS.systemGreen, icon: 'trending-up', label: 'Strengths' },
  weakness: { color: IOS_COLORS.systemOrange, icon: 'trending-down', label: 'Areas to Improve' },
  pattern: { color: IOS_COLORS.systemBlue, icon: 'analytics', label: 'Patterns' },
  recommendation: { color: IOS_COLORS.systemPurple, icon: 'bulb', label: 'Recommendations' },
  preference: { color: IOS_COLORS.systemTeal, icon: 'heart', label: 'Preferences' },
  deviation_pattern: { color: IOS_COLORS.systemRed, icon: 'git-branch', label: 'Deviations' },
  personal_record: { color: IOS_COLORS.systemYellow, icon: 'trophy', label: 'Personal Records' },
  plateau: { color: IOS_COLORS.systemOrange, icon: 'pause-circle', label: 'Plateaus' },
  progressive_overload: { color: IOS_COLORS.systemGreen, icon: 'arrow-up-circle', label: 'Progressive Overload' },
  recovery_pattern: { color: IOS_COLORS.systemMint, icon: 'leaf', label: 'Recovery Patterns' },
};

export function AIInsightsCard({ interestId }: AIInsightsCardProps) {
  const { insightsByType, isLoading } = useAIInsightsByType(interestId);
  const { dismiss } = useAIInsights(interestId);
  const { total, newThisWeek } = useInsightGrowth(interestId);

  if (isLoading || !insightsByType) return null;

  // Only show categories that have insights
  const activeCategories = Object.entries(insightsByType).filter(
    ([, items]) => items.length > 0,
  );

  if (activeCategories.length === 0) return null;

  // "New this week" badge for individual insights
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoIso = weekAgo.toISOString();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={16} color={IOS_COLORS.systemPurple} />
        <Text style={styles.headerTitle}>Insights</Text>
        {total > 0 && (
          <Text style={styles.headerSubtitle}>
            {total} learned{newThisWeek > 0 ? ` · ${newThisWeek} new this week` : ''}
          </Text>
        )}
      </View>

      {activeCategories.map(([type, items]) => {
        const config = INSIGHT_CONFIG[type as InsightType];
        if (!config) return null;
        return (
          <View key={type} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={config.icon as any} size={14} color={config.color} />
              <Text style={[styles.sectionLabel, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
            {items.map((insight) => (
              <View key={insight.id} style={styles.insightRow}>
                {insight.created_at > weekAgoIso && <View style={styles.newDot} />}
                <View style={styles.insightContent}>
                  <Text style={styles.insightText}>{insight.content}</Text>
                  <View style={styles.confidenceBar}>
                    <View
                      style={[
                        styles.confidenceFill,
                        { width: `${insight.confidence * 100}%`, backgroundColor: config.color },
                      ]}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={() => dismiss(insight.id)}
                  hitSlop={8}
                  style={styles.dismissButton}
                >
                  <Ionicons name="close" size={14} color={IOS_COLORS.systemGray3} />
                </Pressable>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
    marginBottom: IOS_SPACING.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerSubtitle: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    marginLeft: 'auto' as any,
  },
  newDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOS_COLORS.systemPurple,
    marginTop: 6,
    flexShrink: 0,
  },
  section: {
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  insightContent: {
    flex: 1,
    gap: 3,
  },
  insightText: {
    fontSize: 13,
    color: IOS_COLORS.label,
    lineHeight: 18,
  },
  confidenceBar: {
    height: 2,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 1,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 1,
  },
  dismissButton: {
    paddingTop: 2,
  },
});
