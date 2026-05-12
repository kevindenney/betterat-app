/**
 * InsightsSection
 *
 * Displays AI-generated insights and coach feedback if available.
 * Shows:
 * - AI summary and recommendations
 * - Coach annotations (if any)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Brain, Sparkles, User } from 'lucide-react-native';
import type { AIInsights } from '@/hooks/usePostRaceReviewData';

// iOS System Colors
const IOS_COLORS = {
  blue: '#007AFF',
  green: '#34C759',
  purple: '#AF52DE',
  orange: '#FF9500',
  gray: '#8E8E93',
  gray3: '#C7C7CC',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  tertiaryLabel: '#3C3C4399',
  separator: '#3C3C4349',
  secondaryBackground: '#FFFFFF',
};

interface InsightsSectionProps {
  aiInsights: AIInsights | null;
  coachFeedback?: string | null;
  accentColor: string;
}

export function InsightsSection({
  aiInsights,
  coachFeedback,
  accentColor,
}: InsightsSectionProps) {
  const hasContent = aiInsights?.summary || aiInsights?.recommendations?.length || coachFeedback;

  if (!hasContent) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* AI Insights */}
      {aiInsights && (aiInsights.summary || aiInsights.recommendations?.length) && (
        <View style={[styles.insightCard, { borderLeftColor: IOS_COLORS.purple }]}>
          <View style={styles.insightHeader}>
            <View style={[styles.iconCircle, { backgroundColor: `${IOS_COLORS.purple}15` }]}>
              <Brain size={16} color={IOS_COLORS.purple} />
            </View>
            <Text style={styles.insightTitle}>Race Insights</Text>
          </View>

          {aiInsights.summary && (
            <Text style={styles.insightText}>{aiInsights.summary}</Text>
          )}

          {aiInsights.strengths && aiInsights.strengths.length > 0 && (
            <View style={styles.listSection}>
              <View style={styles.listHeader}>
                <Sparkles size={12} color={IOS_COLORS.green} />
                <Text style={[styles.listTitle, { color: IOS_COLORS.green }]}>
                  Strengths
                </Text>
              </View>
              {aiInsights.strengths.slice(0, 2).map((strength, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={[styles.bullet, { backgroundColor: IOS_COLORS.green }]} />
                  <Text style={styles.listItemText}>{strength}</Text>
                </View>
              ))}
            </View>
          )}

          {aiInsights.recommendations && aiInsights.recommendations.length > 0 && (
            <View style={styles.listSection}>
              <View style={styles.listHeader}>
                <Sparkles size={12} color={accentColor} />
                <Text style={[styles.listTitle, { color: accentColor }]}>
                  Recommendations
                </Text>
              </View>
              {aiInsights.recommendations.slice(0, 2).map((rec, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={[styles.bullet, { backgroundColor: accentColor }]} />
                  <Text style={styles.listItemText}>{rec}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Coach Feedback */}
      {coachFeedback && (
        <View style={[styles.insightCard, { borderLeftColor: IOS_COLORS.blue }]}>
          <View style={styles.insightHeader}>
            <View style={[styles.iconCircle, { backgroundColor: `${IOS_COLORS.blue}15` }]}>
              <User size={16} color={IOS_COLORS.blue} />
            </View>
            <Text style={styles.insightTitle}>Coach Feedback</Text>
          </View>
          <Text style={styles.insightText}>{coachFeedback}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  insightCard: {
    backgroundColor: IOS_COLORS.secondaryBackground,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  insightText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 20,
  },
  listSection: {
    marginTop: 12,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  listItemText: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.label,
    lineHeight: 18,
  },
});

export default InsightsSection;
