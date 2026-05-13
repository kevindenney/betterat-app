/**
 * AIPatternDetection
 *
 * Displays aggregated learning insights and AI-personalized guidance after races.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/providers/AuthProvider';
import { postRaceLearningService } from '@/services/PostRaceLearningService';
import { createLogger } from '@/lib/utils/logger';
import type {
  LearningProfile,
  PerformancePattern,
  RecurringInsight,
} from '@/types/raceLearning';

const logger = createLogger('AIPatternDetection');

type PatternVariant = 'positive' | 'warning';

interface PatternListProps {
  title: string;
  subtitle?: string;
  patterns: PerformancePattern[];
  variant: PatternVariant;
}

interface FrameworkTrendListProps {
  profile: LearningProfile;
}

interface InsightListProps {
  title: string;
  icon: string;
  insights: RecurringInsight[];
  emptyMessage: string;
}

export const AIPatternDetection: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await postRaceLearningService.getLearningProfileForUser(user.id);
      setProfile(result);
    } catch (err) {
      logger.error('Failed to load learning profile', err);
      setError('Unable to load learning insights right now.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleRefresh = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    try {
      setRefreshing(true);
      const result = await postRaceLearningService.getLearningProfileForUser(user.id);
      setProfile(result);
    } catch (err) {
      logger.error('Refresh failed', err);
      setError('Unable to refresh learning insights right now.');
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  const hasData = Boolean(profile && profile.racesAnalyzed > 0);
  const updatedLabel = useMemo(() => {
    if (!profile?.lastUpdated) return null;
    try {
      return new Date(profile.lastUpdated).toLocaleString();
    } catch {
      return profile.lastUpdated;
    }
  }, [profile?.lastUpdated]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Learning Patterns</Text>
          <Text style={styles.subtitle}>
            Track your recurring wins and the next focus items after every race.
          </Text>
        </View>
        {user?.id && (
          <Pressable
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={loading || refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#1D4ED8" />
            ) : (
              <Ionicons name="refresh" size={18} color="#1D4ED8" />
            )}
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Crunching race history…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Ionicons name="warning-outline" size={20} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !hasData ? (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={40} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Complete a race to unlock coaching patterns</Text>
          <Text style={styles.emptyDescription}>
            Post-race analysis and GPS data reveal what you repeat and what needs work.
          </Text>
        </View>
      ) : profile ? (
        <View style={styles.content}>
          <View style={styles.metaCard}>
            <View style={styles.metaRow}>
              <Ionicons name="compass-outline" size={18} color="#2563EB" />
              <Text style={styles.metaLabel}>
                {profile.racesAnalyzed} race{profile.racesAnalyzed === 1 ? '' : 's'} analyzed
              </Text>
            </View>
            {profile.lastRaceCompletedAt && (
              <Text style={styles.metaDetail}>
                Last race: {new Date(profile.lastRaceCompletedAt).toLocaleDateString()}
              </Text>
            )}
            {updatedLabel && <Text style={styles.metaHint}>Updated {updatedLabel}</Text>}
          </View>

          {profile.aiSummary && (
            <AISummaryCard summary={profile.aiSummary} />
          )}

          <PatternList
            title="Keep doing this"
            subtitle="Consistent strengths that separate you from the fleet."
            patterns={profile.strengths}
            variant="positive"
          />

          <PatternList
            title="Next focus items"
            subtitle="High-impact gaps surfaced from your last races."
            patterns={profile.focusAreas}
            variant="warning"
          />

          {profile.frameworkTrends.length > 0 && (
            <FrameworkTrendList profile={profile} />
          )}

          <InsightList
            title="Recurring wins"
            icon="trophy-outline"
            insights={profile.recurringWins}
            emptyMessage="We will highlight standout streaks once you log more races."
          />

          <InsightList
            title="Recurring challenges"
            icon="flag-outline"
            insights={profile.recurringChallenges}
            emptyMessage="No persistent issues detected yet—keep logging debriefs."
          />

          {profile.aiSummary?.preRaceReminder && (
            <View style={styles.reminderCard}>
              <Ionicons name="megaphone-outline" size={20} color="#0EA5E9" />
              <Text style={styles.reminderTitle}>Pre-race reminder</Text>
              <Text style={styles.reminderText}>{profile.aiSummary.preRaceReminder}</Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
};

const AISummaryCard: React.FC<{ summary: NonNullable<LearningProfile['aiSummary']> }> = ({
  summary,
}) => {
  return (
    <View style={styles.aiCard}>
      <Text style={styles.aiHeadline}>{summary.headline}</Text>
      {summary.keepDoing?.length ? (
        <View style={styles.aiSection}>
          <Text style={styles.aiSectionTitle}>Keep doing:</Text>
          {summary.keepDoing.map((item, index) => (
            <View key={`keep-${index}`} style={styles.aiBulletRow}>
              <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.aiBulletText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {summary.focusNext?.length ? (
        <View style={styles.aiSection}>
          <Text style={styles.aiSectionTitle}>Focus next:</Text>
          {summary.focusNext.map((item, index) => (
            <View key={`focus-${index}`} style={styles.aiBulletRow}>
              <Ionicons name="flash-outline" size={18} color="#F97316" />
              <Text style={styles.aiBulletText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {summary.practiceIdeas?.length ? (
        <View style={styles.aiSection}>
          <Text style={styles.aiSectionTitle}>Practice ideas:</Text>
          {summary.practiceIdeas.map((item, index) => (
            <View key={`practice-${index}`} style={styles.aiBulletRow}>
              <Ionicons name="construct-outline" size={18} color="#0284C7" />
              <Text style={styles.aiBulletText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const PatternList: React.FC<PatternListProps> = ({ title, subtitle, patterns, variant }) => {
  const emptyMessage =
    variant === 'positive'
      ? 'No sustained strengths yet. Complete another race to build history.'
      : 'No urgent focus items detected. New ones will surface as they emerge.';

  const borderColor = variant === 'positive' ? '#DCFCE7' : '#FEF3C7';
  const titleColor = variant === 'positive' ? '#047857' : '#B45309';
  const indicatorColor = variant === 'positive' ? '#10B981' : '#F97316';

  return (
    <View style={[styles.patternCard, { borderColor }]}>
      <View style={styles.patternHeader}>
        <View style={styles.patternTitleRow}>
          <View style={[styles.patternIndicator, { backgroundColor: indicatorColor }]} />
          <Text style={[styles.patternTitle, { color: titleColor }]}>{title}</Text>
        </View>
        {subtitle && <Text style={styles.patternSubtitle}>{subtitle}</Text>}
      </View>
      {patterns.length === 0 ? (
        <Text style={styles.patternEmpty}>{emptyMessage}</Text>
      ) : (
        patterns.map((pattern) => (
          <PatternRow key={pattern.id} pattern={pattern} />
        ))
      )}
    </View>
  );
};

const PatternRow: React.FC<{ pattern: PerformancePattern }> = ({ pattern }) => {
  const trendIcon = pattern.trend === 'improving'
    ? 'trending-up'
    : pattern.trend === 'declining'
      ? 'trending-down'
      : 'remove-outline';

  const trendColor =
    pattern.trend === 'improving'
      ? '#16A34A'
      : pattern.trend === 'declining'
        ? '#DC2626'
        : '#6B7280';

  return (
    <View style={styles.patternRow}>
      <View style={styles.patternRowText}>
        <Text style={styles.patternRowTitle}>{pattern.label}</Text>
        {pattern.message && <Text style={styles.patternRowMessage}>{pattern.message}</Text>}
      </View>
      <View style={styles.patternStats}>
        <Text style={styles.patternAverage}>{pattern.average.toFixed(1)}</Text>
        <View style={styles.trendBadge}>
          <Ionicons name={trendIcon as any} size={16} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>{pattern.trend}</Text>
        </View>
      </View>
    </View>
  );
};

const FrameworkTrendList: React.FC<FrameworkTrendListProps> = ({ profile }) => {
  return (
    <View style={styles.frameworkCard}>
      <View style={styles.frameworkHeader}>
        <Ionicons name="layers-outline" size={18} color="#6366F1" />
        <Text style={styles.frameworkTitle}>Framework adoption trend</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.frameworkScroll}>
        {profile.frameworkTrends.map((entry) => (
          <View key={entry.framework} style={styles.frameworkChip}>
            <Text style={styles.frameworkName}>{entry.framework}</Text>
            <Text style={styles.frameworkScore}>
              Avg {entry.average_score.toFixed(0)} | Latest {entry.latest_score.toFixed(0)}
            </Text>
            <Text
              style={[
                styles.frameworkTrend,
                entry.trend === 'improving'
                  ? styles.frameworkTrendUp
                  : entry.trend === 'declining'
                    ? styles.frameworkTrendDown
                    : styles.frameworkTrendFlat,
              ]}
            >
              {entry.trend === 'improving'
                ? `+${entry.change_percentage.toFixed(1)}`
                : entry.change_percentage.toFixed(1)}
              {' '}pts
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const InsightList: React.FC<InsightListProps> = ({ title, icon, insights, emptyMessage }) => {
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <Ionicons name={icon as any} size={18} color="#0F172A" />
        <Text style={styles.insightTitle}>{title}</Text>
      </View>
      {insights.length === 0 ? (
        <Text style={styles.insightEmpty}>{emptyMessage}</Text>
      ) : (
        insights.map((insight) => (
          <View key={insight.id} style={styles.insightRow}>
            <Ionicons name="ellipse" size={6} color="#0F172A" style={styles.insightDot} />
            <Text style={styles.insightText}>{insight.summary}</Text>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    maxWidth: 320,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  loadingState: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#4B5563',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginTop: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    flex: 1,
  },
  emptyState: {
    paddingVertical: 28,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  content: {
    gap: 16,
    marginTop: 16,
  },
  metaCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#312E81',
  },
  metaDetail: {
    fontSize: 13,
    color: '#4C1D95',
  },
  metaHint: {
    fontSize: 12,
    color: '#6B21A8',
  },
  aiCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 12,
  },
  aiHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  aiSection: {
    gap: 8,
  },
  aiSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  aiBulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  aiBulletText: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  patternCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  patternHeader: {
    gap: 4,
  },
  patternTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  patternIndicator: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  patternTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  patternSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  patternEmpty: {
    fontSize: 13,
    color: '#6B7280',
  },
  patternRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  patternRowText: {
    flex: 1,
    gap: 4,
  },
  patternRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  patternRowMessage: {
    fontSize: 12,
    color: '#4B5563',
  },
  patternStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  patternAverage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  frameworkCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  frameworkHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  frameworkTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  frameworkScroll: {
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },
  frameworkChip: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    gap: 4,
    minWidth: 160,
  },
  frameworkName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  frameworkScore: {
    fontSize: 12,
    color: '#4B5563',
  },
  frameworkTrend: {
    fontSize: 12,
    fontWeight: '600',
  },
  frameworkTrendUp: {
    color: '#15803D',
  },
  frameworkTrendDown: {
    color: '#DC2626',
  },
  frameworkTrendFlat: {
    color: '#4B5563',
  },
  insightCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  insightEmpty: {
    fontSize: 12,
    color: '#6B7280',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  insightDot: {
    marginTop: 6,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  reminderCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    gap: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reminderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  reminderText: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
});
