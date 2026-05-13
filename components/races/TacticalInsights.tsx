/**
 * TacticalInsights - AI-powered tactical analysis and recommendations
 *
 * Provides automated insights, areas for improvement, and recommendations
 * Part of Phase 3: DEBRIEF Mode
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GPSPoint, SplitTime } from './modes/DebriefModeLayout';

interface TacticalInsightsProps {
  gpsTrack: GPSPoint[];
  splitTimes: SplitTime[];
  raceResult?: {
    position: number;
    totalBoats: number;
  };
}

type InsightType = 'success' | 'improvement' | 'recommendation';
type InsightPriority = 'high' | 'medium' | 'low';

interface Insight {
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  icon: string;
}

export const TacticalInsights: React.FC<TacticalInsightsProps> = ({
  gpsTrack,
  splitTimes,
  raceResult,
}) => {
  // Show empty state if no GPS track data
  if (!gpsTrack || gpsTrack.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Tactical Insights</Text>
        <View style={styles.emptyState}>
          <Ionicons name="bulb-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Race Data Available</Text>
          <Text style={styles.emptyDescription}>
            Tactical insights are generated from GPS track data. Record a race with GPS tracking to receive analysis of what worked, areas for improvement, and personalized recommendations.
          </Text>
        </View>
      </View>
    );
  }

  const insights = generateInsights(gpsTrack, splitTimes, raceResult);

  const successInsights = insights.filter(i => i.type === 'success');
  const improvementInsights = insights.filter(i => i.type === 'improvement');
  const recommendations = insights.filter(i => i.type === 'recommendation');

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Tactical Insights</Text>

      {/* What Worked */}
      {successInsights.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trophy" size={20} color="#10B981" />
            <Text style={styles.sectionSubtitle}>What Worked</Text>
          </View>
          <View style={styles.insightsList}>
            {successInsights.map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </View>
        </View>
      )}

      {/* Areas for Improvement */}
      {improvementInsights.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={20} color="#F59E0B" />
            <Text style={styles.sectionSubtitle}>Areas for Improvement</Text>
          </View>
          <View style={styles.insightsList}>
            {improvementInsights.map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </View>
        </View>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb" size={20} color="#3B82F6" />
            <Text style={styles.sectionSubtitle}>Recommendations</Text>
          </View>
          <View style={styles.insightsList}>
            {recommendations.map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </View>
        </View>
      )}

      {/* Empty state */}
      {insights.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No insights yet</Text>
          <Text style={styles.emptySubtext}>
            Complete a race with GPS tracking to receive tactical insights
          </Text>
        </View>
      )}
    </View>
  );
};

/**
 * Insight Card Component
 */
interface InsightCardProps {
  insight: Insight;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight }) => {
  const typeColors = {
    success: {
      bg: '#D1FAE5',
      border: '#10B981',
      icon: '#10B981',
    },
    improvement: {
      bg: '#FEF3C7',
      border: '#F59E0B',
      icon: '#F59E0B',
    },
    recommendation: {
      bg: '#DBEAFE',
      border: '#3B82F6',
      icon: '#3B82F6',
    },
  };

  const colors = typeColors[insight.type];
  const priorityBadge = {
    high: { text: 'High Impact', color: '#EF4444' },
    medium: { text: 'Medium Impact', color: '#F59E0B' },
    low: { text: 'Low Impact', color: '#6B7280' },
  };

  return (
    <View
      style={[
        styles.insightCard,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      <View style={styles.insightHeader}>
        <View style={styles.insightIconContainer}>
          <Ionicons name={insight.icon as any} size={24} color={colors.icon} />
        </View>
        <View style={styles.insightContent}>
          <View style={styles.insightTitleRow}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <View
              style={[
                styles.priorityBadge,
                { backgroundColor: `${priorityBadge[insight.priority].color}20` },
              ]}
            >
              <Text style={[styles.priorityText, { color: priorityBadge[insight.priority].color }]}>
                {priorityBadge[insight.priority].text}
              </Text>
            </View>
          </View>
          <Text style={styles.insightDescription}>{insight.description}</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Generate tactical insights from race data
 */
function generateInsights(
  track: GPSPoint[],
  splits: SplitTime[],
  result?: { position: number; totalBoats: number }
): Insight[] {
  const insights: Insight[] = [];

  if (track.length === 0) {
    return insights;
  }

  // Speed analysis
  const speeds = track.map(p => p.speed);
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const maxSpeed = Math.max(...speeds);

  if (maxSpeed > avgSpeed * 1.3) {
    insights.push({
      type: 'success',
      priority: 'medium',
      title: 'Strong downwind speed',
      description: `You achieved ${maxSpeed.toFixed(1)} knots maximum speed, significantly above your average of ${avgSpeed.toFixed(1)} knots.`,
      icon: 'speedometer',
    });
  }

  // Split times analysis
  if (splits.length > 1) {
    const positions = splits.map(s => s.position);
    const positionChanges = positions.slice(1).map((p, i) => p - positions[i]);
    const totalGain = -positionChanges.reduce((a, b) => a + b, 0);

    if (totalGain > 0) {
      insights.push({
        type: 'success',
        priority: 'high',
        title: `Gained ${totalGain} positions`,
        description: `You gained ${totalGain} places throughout the race, showing strong tactical decision-making.`,
        icon: 'arrow-up-circle',
      });
    } else if (totalGain < 0) {
      insights.push({
        type: 'improvement',
        priority: 'high',
        title: `Lost ${Math.abs(totalGain)} positions`,
        description: `Focus on maintaining position and avoiding tactical errors that cost places.`,
        icon: 'arrow-down-circle',
      });
    }

    // Rounding efficiency
    const slowRoundings = splits.filter(s => s.roundingTime > 7);
    if (slowRoundings.length > 0) {
      insights.push({
        type: 'improvement',
        priority: 'medium',
        title: 'Mark rounding technique',
        description: `${slowRoundings.length} mark roundings took over 7 seconds. Practice tight roundings to save time.`,
        icon: 'refresh-circle',
      });
    }
  }

  // Overall result
  if (result) {
    const percentile = (1 - result.position / result.totalBoats) * 100;
    if (percentile >= 75) {
      insights.push({
        type: 'success',
        priority: 'high',
        title: 'Top quarter finish',
        description: `Finished ${result.position} out of ${result.totalBoats}, placing in the top 25% of the fleet.`,
        icon: 'podium',
      });
    }
  }

  // Recommendations
  if (avgSpeed < 5) {
    insights.push({
      type: 'recommendation',
      priority: 'medium',
      title: 'Focus on boat speed',
      description: 'Work on trim and sail shape to improve your average speed. Consider upwind and downwind speed drills.',
      icon: 'fitness',
    });
  }

  if (splits.length === 0) {
    insights.push({
      type: 'recommendation',
      priority: 'low',
      title: 'Enable GPS tracking',
      description: 'Turn on GPS tracking during races to get detailed performance insights and split times.',
      icon: 'location',
    });
  }

  // Always add a general recommendation
  insights.push({
    type: 'recommendation',
    priority: 'low',
    title: 'Review weather patterns',
    description: 'Study the wind shifts and current patterns from this race to improve your strategy next time.',
    icon: 'partly-sunny',
  });

  return insights;
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  insightsList: {
    gap: 12,
  },
  insightCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  insightHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
    gap: 8,
  },
  insightTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  insightDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 400,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
});
