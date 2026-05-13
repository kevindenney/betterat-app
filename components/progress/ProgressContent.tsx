/**
 * ProgressContent - Embeddable Progress segment for the Races tab
 *
 * Extracted from app/(tabs)/progress.tsx for use as a segment
 * within the Races screen segmented control.
 *
 * Renders all Excellence Framework metrics in a self-contained
 * ScrollView with pull-to-refresh.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useExcellenceMetrics } from '@/hooks/useExcellenceMetrics';
import { useLearnableEvents, useLearningInsights } from '@/hooks/useAdaptiveLearning';
import { useSignaturePrinciples } from '@/hooks/useSignaturePrinciples';
import { useSeasonSelection } from '@/hooks/useSailorProfile';
import { useCurrentSeason, useUserSeasons } from '@/hooks/useSeason';
import { sparkline } from '@/lib/tufte';

import {
  PhaseMasteryChart,
  OutcomeTrendCard,
  FocusRecommendations,
  RecentLearnings,
  SeasonHistorySection,
  PastRaceList,
} from '@/components/progress';

export interface ProgressContentProps {
  seasonId?: string | null;
  seasonName?: string | null;
  onOpenSeasonSettings?: () => void;
  onOpenSeasonArchive?: () => void;
}

export function ProgressContent({
  seasonId: externalSeasonId,
  seasonName: externalSeasonName,
  onOpenSeasonSettings,
  onOpenSeasonArchive,
}: ProgressContentProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get current season (if available)
  const { currentSeason } = useSeasonSelection?.() || { currentSeason: null };

  // Use external season ID if provided, otherwise fall back to hook
  const effectiveSeasonId = externalSeasonId ?? currentSeason?.id;
  const effectiveSeasonName = externalSeasonName ?? currentSeason?.name;

  // Season data for history section
  const { data: activeSeason } = useCurrentSeason();
  const { data: userSeasons = [], isLoading: _loadingSeasons } = useUserSeasons();

  // Build SeasonWithSummary list for slope graph
  const seasonsWithSummary = (userSeasons as any[]).filter(
    (s) => s.summary?.user_standing
  );

  // Load excellence metrics
  const {
    metrics,
    phaseMastery,
    frameworkScores: _frameworkScores,
    outcomes,
    focusRecommendations,
    overallScore,
    isLoading,
    isRefreshing: isMetricsRefreshing,
    refresh: refreshMetrics,
  } = useExcellenceMetrics(effectiveSeasonId);

  // Load learnable events
  const { events: learningEvents, isLoading: _eventsLoading } = useLearnableEvents({
    limit: 10,
  });

  // Load learning insights
  const { insights: _insights } = useLearningInsights();
  const { principles, isLoading: principlesLoading } = useSignaturePrinciples(5);

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshMetrics();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Generate summary sparkline from recent results
  const generateSummarySparkline = () => {
    if (!outcomes.recentResults || outcomes.recentResults.length < 2) return '';
    const positions = outcomes.recentResults.map((r) => r.position);
    const maxPos = Math.max(...positions, 1);
    const inverted = positions.map((p) => maxPos - p + 1);
    return sparkline(inverted, { width: 10 });
  };

  // Get trend indicator
  const getTrendDisplay = () => {
    switch (outcomes.positionTrend) {
      case 'improving':
        return { text: 'improving', arrow: '↑' };
      case 'declining':
        return { text: 'declining', arrow: '↓' };
      default:
        return { text: 'stable', arrow: '→' };
    }
  };

  // Loading state
  if (isLoading && !metrics) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#64748B" />
        <Text style={styles.loadingText}>Loading progress...</Text>
      </View>
    );
  }

  const trend = getTrendDisplay();
  const summarySparkline = generateSummarySparkline();

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing || isMetricsRefreshing}
          onRefresh={handleRefresh}
          tintColor="#64748B"
        />
      }
    >
      {/* Summary header with season selector */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.summaryLine}>
            <Text style={styles.summaryValue}>{overallScore}%</Text>
            <Text style={styles.summaryLabel}> overall</Text>
            <Text style={styles.summarySeparator}> · </Text>
            <Text style={styles.summaryValue}>{outcomes.racesCompleted}</Text>
            <Text style={styles.summaryLabel}> races</Text>
            {summarySparkline && (
              <>
                <Text style={styles.summarySeparator}> · </Text>
                <Text style={styles.summaryTrend}>
                  {trend.text} {summarySparkline}
                </Text>
              </>
            )}
          </Text>
          {onOpenSeasonSettings && (
            <TouchableOpacity
              onPress={onOpenSeasonSettings}
              activeOpacity={0.6}
            >
              <Text style={styles.seasonText}>
                {effectiveSeasonName || activeSeason?.name || 'No season ›'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.mainDivider} />

      {/* Phase Mastery Section */}
      <View style={styles.section}>
        <PhaseMasteryChart mastery={phaseMastery} highlightLowest={2} />
      </View>

      <View style={styles.sectionDivider} />

      {/* Results Section */}
      <View style={styles.section}>
        <OutcomeTrendCard outcomes={outcomes} />
      </View>

      <View style={styles.sectionDivider} />

      {/* Focus Recommendations Section */}
      <View style={styles.section}>
        <FocusRecommendations
          recommendations={focusRecommendations}
          onDrillPress={(_drill) => {
            router.push('/(tabs)/learn');
          }}
        />
      </View>

      <View style={styles.sectionDivider} />

      {/* Learnings Section */}
      <View style={styles.section}>
        <RecentLearnings
          events={learningEvents}
          limit={5}
          onViewAll={() => {
            // Future: navigate to full learnings list
          }}
        />
      </View>

      <View style={styles.sectionDivider} />

      <View style={styles.section}>
        <Text style={styles.principlesTitle}>My Principles</Text>
        {principlesLoading ? (
          <Text style={styles.principlesLoading}>Loading principles...</Text>
        ) : principles.length > 0 ? (
          <View style={styles.principlesList}>
            {principles.map((principle) => (
              <View key={principle.id} style={styles.principleCard}>
                <Text style={styles.principleText}>{principle.principle_text}</Text>
                <Text style={styles.principleMeta}>
                  reinforced {principle.times_reinforced}x
                  {principle.times_challenged > 0 ? ` · challenged ${principle.times_challenged}x` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.principlesEmpty}>
            Complete a timeline step with analysis to start building your principles.
          </Text>
        )}
      </View>

      {/* Season History Section */}
      {userSeasons.length > 0 && (
        <>
          <View style={styles.sectionDivider} />
          <View style={styles.section}>
            <SeasonHistorySection
              seasonsWithSummary={seasonsWithSummary}
              seasons={userSeasons}
              limit={5}
              onSeasonPress={(_seasonId) => {
                // Future: navigate to season detail
              }}
              onViewAll={onOpenSeasonArchive}
            />
          </View>
        </>
      )}

      {/* Past Races Section */}
      {outcomes.recentResults && outcomes.recentResults.length > 0 && (
        <>
          <View style={styles.sectionDivider} />
          <View style={styles.section}>
            <PastRaceList
              races={outcomes.recentResults}
              limit={8}
              onRacePress={(_raceId) => {
                // Future: navigate to race detail
              }}
            />
          </View>
        </>
      )}

      {/* Footer spacer */}
      <View style={styles.footerSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  seasonText: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  summaryLine: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  summaryValue: {
    fontWeight: '600',
    color: '#1a1a1a',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    fontWeight: '400',
    color: '#6b7280',
  },
  summarySeparator: {
    color: '#d1d5db',
  },
  summaryTrend: {
    color: '#6b7280',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -0.5,
  },
  mainDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 20,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  principlesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  principlesLoading: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  principlesList: {
    gap: 8,
  },
  principleCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  principleText: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 19,
    marginBottom: 4,
  },
  principleMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  principlesEmpty: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  section: {
    // No background, no padding - let child components handle layout
  },
  footerSpacer: {
    height: Platform.OS === 'ios' ? 100 : 80,
  },
});
