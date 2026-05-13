/**
 * WhyStep Component
 *
 * Step 3 of the 4Q wizard: Why will you do this practice?
 * - AI reasoning based on race performance analysis
 * - User's own rationale
 * - Links to recent races
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  Sparkles,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Link2,
  FileText,
  ChevronRight,
} from 'lucide-react-native';
import { IOS_COLORS } from '@/components/cards/constants';
import {
  WhyStepData,
  PerformanceMetricLink,
  SKILL_AREA_CONFIG,
} from '@/types/practice';

interface WhyStepProps {
  data: WhyStepData;
  onAIReasoningChange: (reasoning: string) => void;
  onUserRationaleChange: (rationale: string) => void;
  onLinkRaces: (raceIds: string[]) => void;
  linkedRaces?: { id: string; name: string; date: string }[];
}

function TrendIcon({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  switch (trend) {
    case 'improving':
      return <TrendingUp size={14} color={IOS_COLORS.green} />;
    case 'declining':
      return <TrendingDown size={14} color={IOS_COLORS.red} />;
    default:
      return <Minus size={14} color={IOS_COLORS.gray} />;
  }
}

function PerformanceMetricCard({ metric }: { metric: PerformanceMetricLink }) {
  const skillConfig = SKILL_AREA_CONFIG[metric.skillArea];
  const trendColors = {
    improving: IOS_COLORS.green,
    declining: IOS_COLORS.red,
    stable: IOS_COLORS.gray,
  };

  return (
    <View style={styles.metricCard}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricSkillArea}>{skillConfig?.label || metric.skillArea}</Text>
        <View style={[styles.trendBadge, { backgroundColor: `${trendColors[metric.trend]}15` }]}>
          <TrendIcon trend={metric.trend} />
          <Text style={[styles.trendText, { color: trendColors[metric.trend] }]}>
            {metric.trend}
          </Text>
        </View>
      </View>
      <Text style={styles.metricName}>{metric.metricName}</Text>
      <View style={styles.metricValues}>
        <Text style={styles.currentValue}>{metric.currentValue.toFixed(1)}</Text>
        {metric.targetValue && (
          <>
            <Text style={styles.valueArrow}>→</Text>
            <Text style={styles.targetValue}>{metric.targetValue.toFixed(1)}</Text>
          </>
        )}
      </View>
    </View>
  );
}

function LinkedRaceCard({
  race,
  onPress,
}: {
  race: { id: string; name: string; date: string };
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.linkedRaceCard} onPress={onPress} activeOpacity={0.7}>
      <FileText size={16} color={IOS_COLORS.indigo} />
      <View style={styles.linkedRaceInfo}>
        <Text style={styles.linkedRaceName}>{race.name}</Text>
        <Text style={styles.linkedRaceDate}>{race.date}</Text>
      </View>
      <ChevronRight size={16} color={IOS_COLORS.gray4} />
    </TouchableOpacity>
  );
}

export function WhyStep({
  data,
  onAIReasoningChange: _onAIReasoningChange,
  onUserRationaleChange,
  onLinkRaces: _onLinkRaces,
  linkedRaces = [],
}: WhyStepProps) {
  const hasAIReasoning = !!data.aiReasoning;
  const hasMetrics = data.linkedPerformanceMetrics && data.linkedPerformanceMetrics.length > 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* AI Reasoning Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Sparkles size={18} color={IOS_COLORS.cyan} />
          <Text style={styles.sectionTitle}>Analysis</Text>
          {hasAIReasoning && (
            <View style={styles.aiActiveBadge}>
              <Text style={styles.aiActiveText}>Active</Text>
            </View>
          )}
        </View>

        {hasAIReasoning ? (
          <View style={styles.aiReasoningBox}>
            <Text style={styles.aiReasoningText}>{data.aiReasoning}</Text>
          </View>
        ) : (
          <View style={styles.noAIBox}>
            <Brain size={32} color={IOS_COLORS.gray4} />
            <Text style={styles.noAITitle}>No AI suggestion</Text>
            <Text style={styles.noAISubtext}>
              Complete more races to get personalized practice recommendations
            </Text>
          </View>
        )}
      </View>

      {/* Performance Metrics Section */}
      {hasMetrics && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={18} color={IOS_COLORS.indigo} />
            <Text style={styles.sectionTitle}>Performance Insights</Text>
          </View>

          <Text style={styles.sectionSubtext}>
            Areas identified for improvement based on recent races
          </Text>

          <View style={styles.metricsGrid}>
            {data.linkedPerformanceMetrics!.map((metric, index) => (
              <PerformanceMetricCard key={index} metric={metric} />
            ))}
          </View>
        </View>
      )}

      {/* Linked Races Section */}
      {linkedRaces.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Link2 size={18} color={IOS_COLORS.indigo} />
            <Text style={styles.sectionTitle}>Linked Races</Text>
            <Text style={styles.sectionCount}>{linkedRaces.length}</Text>
          </View>

          <Text style={styles.sectionSubtext}>
            Race analyses that informed this practice plan
          </Text>

          {linkedRaces.map((race) => (
            <LinkedRaceCard
              key={race.id}
              race={race}
              onPress={() => {
                // Navigate to race analysis
              }}
            />
          ))}
        </View>
      )}

      {/* User Rationale Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FileText size={18} color={IOS_COLORS.indigo} />
          <Text style={styles.sectionTitle}>Your Notes</Text>
        </View>

        <Text style={styles.sectionSubtext}>
          Add your own reasoning for this practice session
        </Text>

        <TextInput
          style={styles.rationaleInput}
          value={data.userRationale || ''}
          onChangeText={onUserRationaleChange}
          placeholder="Why are you doing this practice? What do you hope to achieve?"
          placeholderTextColor={IOS_COLORS.gray3}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Spacer */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  section: {
    backgroundColor: IOS_COLORS.systemBackground,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.gray,
  },
  sectionSubtext: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    marginBottom: 12,
  },
  aiActiveBadge: {
    backgroundColor: `${IOS_COLORS.cyan}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiActiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.cyan,
  },
  aiReasoningBox: {
    backgroundColor: `${IOS_COLORS.cyan}08`,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: IOS_COLORS.cyan,
  },
  aiReasoningText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.label,
  },
  noAIBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noAITitle: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  noAISubtext: {
    fontSize: 13,
    color: IOS_COLORS.gray,
    textAlign: 'center',
    maxWidth: 280,
  },
  metricsGrid: {
    gap: 8,
  },
  metricCard: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricSkillArea: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trendText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  metricName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
    marginBottom: 6,
  },
  metricValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentValue: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  valueArrow: {
    fontSize: 14,
    color: IOS_COLORS.gray,
  },
  targetValue: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.green,
  },
  linkedRaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  linkedRaceInfo: {
    flex: 1,
  },
  linkedRaceName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  linkedRaceDate: {
    fontSize: 12,
    color: IOS_COLORS.gray,
    marginTop: 2,
  },
  rationaleInput: {
    backgroundColor: IOS_COLORS.gray6,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: IOS_COLORS.label,
    minHeight: 100,
    lineHeight: 20,
  },
});

export default WhyStep;
