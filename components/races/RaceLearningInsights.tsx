/**
 * RaceLearningInsights Component
 *
 * Displays personalized post-race learning insights powered by Claude Skills.
 * Shows strengths to celebrate, focus areas to improve, and actionable practice drills.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { postRaceLearningService } from '@/services/PostRaceLearningService';
import { useAuth } from '@/providers/AuthProvider';
import type { LearningProfile } from '@/types/raceLearning';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('RaceLearningInsights');

interface RaceLearningInsightsProps {
  onPreRaceReminderPress?: (reminder: string) => void;
}

export function RaceLearningInsights({ onPreRaceReminderPress }: RaceLearningInsightsProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      const data = await postRaceLearningService.getLearningProfileForUser(user.id);
      setProfile(data);
    } catch (error) {
      logger.error('Failed to load learning profile', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Analyzing your race history...</Text>
      </View>
    );
  }

  if (!profile || profile.racesAnalyzed === 0) {
    return (
      <View style={styles.emptyCard}>
        <Ionicons name="analytics-outline" size={48} color="#94a3b8" />
        <Text style={styles.emptyTitle}>No Race Data Yet</Text>
        <Text style={styles.emptySubtitle}>
          Complete a few races and rate your performance to unlock personalized learning insights.
        </Text>
      </View>
    );
  }

  const aiSummary = profile.aiSummary;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header with race count */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          Based on {profile.racesAnalyzed} race{profile.racesAnalyzed !== 1 ? 's' : ''}
        </Text>
      </View>

      {aiSummary ? (
        <>
          {/* AI-Powered Headline */}
          {aiSummary.headline && (
            <View style={styles.headlineCard}>
              <View style={styles.cardRow}>
                <Ionicons name="bulb" size={24} color="#0ea5e9" style={styles.cardIcon} />
                <Text style={styles.headlineText}>{aiSummary.headline}</Text>
              </View>
            </View>
          )}

          {/* Keep Doing - Celebrate Strengths */}
          {aiSummary.keepDoing && aiSummary.keepDoing.length > 0 && (
            <View style={styles.keepDoingCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="trophy" size={20} color="#22c55e" />
                <Text style={styles.cardTitle}>Keep Doing</Text>
              </View>
              {aiSummary.keepDoing.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" style={styles.listIcon} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Focus Next - Priority Improvements */}
          {aiSummary.focusNext && aiSummary.focusNext.length > 0 && (
            <View style={styles.focusCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="flag" size={20} color="#f59e0b" />
                <Text style={styles.cardTitle}>Focus Next</Text>
              </View>
              {aiSummary.focusNext.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <Ionicons name="arrow-forward-circle" size={20} color="#f59e0b" style={styles.listIcon} />
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Practice Ideas - Actionable Drills */}
          {aiSummary.practiceIdeas && aiSummary.practiceIdeas.length > 0 && (
            <View style={styles.practiceCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="fitness" size={20} color="#a855f7" />
                <Text style={styles.cardTitle}>Practice Ideas</Text>
              </View>
              {aiSummary.practiceIdeas.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.practiceNumber}>{index + 1}.</Text>
                  <Text style={styles.listText}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Planning vs Execution Feedback */}
          {aiSummary.planningFeedback && (
            <View style={styles.planningFeedbackCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="analytics" size={20} color="#3b82f6" />
                <Text style={styles.cardTitle}>Planning vs Execution</Text>
              </View>
              <Text style={styles.planningFeedbackText}>{aiSummary.planningFeedback}</Text>
            </View>
          )}

          {/* Pre-Race Reminder - Motivational Card */}
          {aiSummary.preRaceReminder && (
            <TouchableOpacity
              style={styles.reminderCard}
              onPress={() => onPreRaceReminderPress?.(aiSummary.preRaceReminder!)}
            >
              <View style={styles.cardHeader}>
                <Ionicons name="time" size={20} color="#ffffff" />
                <Text style={styles.reminderTitle}>Pre-Race Reminder</Text>
              </View>
              <Text style={styles.reminderText}>"{aiSummary.preRaceReminder}"</Text>
              <View style={styles.reminderFooter}>
                <Text style={styles.reminderFooterText}>Tap to save for your next race</Text>
              </View>
            </TouchableOpacity>
          )}
        </>
      ) : (
        /* Fallback: Show Raw Patterns */
        <>
          {/* Strengths */}
          {profile.strengths.length > 0 && (
            <View style={styles.keepDoingCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="trophy" size={20} color="#22c55e" />
                <Text style={styles.cardTitle}>Your Strengths</Text>
              </View>
              {profile.strengths.map((strength) => (
                <View key={strength.id} style={styles.patternItem}>
                  <Text style={styles.patternLabel}>{strength.label}</Text>
                  <Text style={styles.patternMessage}>{strength.message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Focus Areas */}
          {profile.focusAreas.length > 0 && (
            <View style={styles.focusCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="flag" size={20} color="#f59e0b" />
                <Text style={styles.cardTitle}>Areas to Improve</Text>
              </View>
              {profile.focusAreas.map((area) => (
                <View key={area.id} style={styles.patternItem}>
                  <Text style={styles.patternLabel}>{area.label}</Text>
                  <Text style={styles.patternMessage}>{area.message}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* Framework Trends (Compact) */}
      {profile.frameworkTrends.length > 0 && (
        <View style={styles.frameworkCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="stats-chart" size={20} color="#6366f1" />
            <Text style={styles.cardTitle}>Framework Progress</Text>
          </View>
          {profile.frameworkTrends.map((trend) => (
            <View key={trend.framework} style={styles.frameworkRow}>
              <Text style={styles.frameworkLabel}>{trend.framework}</Text>
              <View style={styles.frameworkScore}>
                <Text style={styles.frameworkScoreText}>{trend.average_score}</Text>
                {trend.trend === 'improving' && (
                  <Ionicons name="trending-up" size={16} color="#22c55e" />
                )}
                {trend.trend === 'declining' && (
                  <Ionicons name="trending-down" size={16} color="#ef4444" />
                )}
                {trend.trend === 'stable' && (
                  <Ionicons name="remove" size={16} color="#64748b" />
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/**
 * Compact Pre-Race Reminder Card
 * Shows just the reminder for display on race prep screens
 */
interface PreRaceReminderCardProps {
  userId: string;
  onPress?: () => void;
}

export function PreRaceReminderCard({ userId, onPress }: PreRaceReminderCardProps) {
  const [reminder, setReminder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReminder = async () => {
      try {
        const profile = await postRaceLearningService.getLearningProfileForUser(userId);
        setReminder(profile?.aiSummary?.preRaceReminder ?? null);
      } catch (error) {
        logger.error('Failed to load pre-race reminder', error);
      } finally {
        setLoading(false);
      }
    };

    loadReminder();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.compactLoadingCard}>
        <ActivityIndicator size="small" color="#0ea5e9" />
      </View>
    );
  }

  if (!reminder) {
    return null;
  }

  return (
    <TouchableOpacity style={styles.compactReminderCard} onPress={onPress}>
      <View style={styles.compactReminderRow}>
        <Ionicons name="time" size={20} color="#ffffff" style={styles.compactIcon} />
        <View style={styles.compactReminderContent}>
          <Text style={styles.compactReminderLabel}>YOUR PRE-RACE REMINDER</Text>
          <Text style={styles.compactReminderText}>"{reminder}"</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#6b7280',
    fontSize: 14,
  },
  emptyCard: {
    margin: 16,
    padding: 24,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  headlineCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIcon: {
    marginRight: 12,
    marginTop: 4,
  },
  headlineText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 26,
  },
  keepDoingCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  focusCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  practiceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#faf5ff',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#a855f7',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  listIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  listText: {
    flex: 1,
    color: '#374151',
    fontSize: 14,
    lineHeight: 22,
  },
  practiceNumber: {
    color: '#a855f7',
    fontWeight: '700',
    marginRight: 12,
    marginTop: 2,
    fontSize: 14,
  },
  reminderCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
  },
  reminderTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  reminderText: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 28,
    fontStyle: 'italic',
    marginTop: 8,
  },
  reminderFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  reminderFooterText: {
    color: '#bfdbfe',
    fontSize: 12,
  },
  patternItem: {
    marginBottom: 12,
  },
  patternLabel: {
    fontWeight: '600',
    color: '#1f2937',
    fontSize: 14,
    marginBottom: 4,
  },
  patternMessage: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  frameworkCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  frameworkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 8,
  },
  frameworkLabel: {
    flex: 1,
    color: '#374151',
    fontSize: 14,
  },
  frameworkScore: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frameworkScoreText: {
    marginRight: 8,
    fontWeight: '600',
    color: '#1f2937',
    fontSize: 14,
  },
  planningFeedbackCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  planningFeedbackText: {
    color: '#1e3a8a',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },
  compactLoadingCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  compactReminderCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  compactReminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  compactIcon: {
    marginRight: 8,
    marginTop: 4,
  },
  compactReminderContent: {
    flex: 1,
  },
  compactReminderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#bfdbfe',
    marginBottom: 4,
  },
  compactReminderText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
  },
});
