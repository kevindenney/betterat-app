/**
 * RacePrepLearningCard Component
 *
 * Displays personalized learning insights during race preparation.
 * Shows pre-race reminder, focus areas, and venue/conditions-specific insights.
 * Creates a feedback loop where past race analysis informs future race prep.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChevronDown, ChevronUp, Lightbulb, MapPin, Wind, Flag, Target } from 'lucide-react-native';
import { postRaceLearningService } from '@/services/PostRaceLearningService';
import { useAuth } from '@/providers/AuthProvider';
import type { LearningProfile } from '@/types/raceLearning';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('RacePrepLearningCard');

interface RacePrepLearningCardProps {
  /** Venue name to find venue-specific insights */
  venueName?: string;
  /** Expected wind speed to find conditions-specific insights */
  windSpeed?: number;
  /** Expected wind direction (optional) */
  windDirection?: number;
  /** Callback when the card is pressed */
  onPress?: () => void;
  /** Whether to show in compact mode (just reminder) */
  compact?: boolean;
}

interface VenueInsights {
  raceCount: number;
  insights: string[];
  averagePerformance: number | null;
  keyLearnings: string[];
}

interface ConditionsInsights {
  raceCount: number;
  insights: string[];
  averagePerformance: number | null;
  keyLearnings: string[];
  conditionLabel: string;
}

export function RacePrepLearningCard({
  venueName,
  windSpeed,
  windDirection,
  onPress,
  compact = false,
}: RacePrepLearningCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [venueInsights, setVenueInsights] = useState<VenueInsights | null>(null);
  const [conditionsInsights, setConditionsInsights] = useState<ConditionsInsights | null>(null);
  const [venueExpanded, setVenueExpanded] = useState(false);
  const [conditionsExpanded, setConditionsExpanded] = useState(false);

  useEffect(() => {
    const loadInsights = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Load main learning profile
        const profileData = await postRaceLearningService.getLearningProfileForUser(user.id);
        setProfile(profileData);

        // Load venue-specific insights if venue provided
        if (venueName && venueName.trim().length > 0) {
          const venue = await postRaceLearningService.getVenueSpecificInsights(user.id, venueName);
          if (venue.raceCount > 0) {
            setVenueInsights(venue);
          }
        }

        // Load conditions-specific insights if wind data provided
        if (windSpeed !== undefined && windSpeed > 0) {
          const conditions = await postRaceLearningService.getConditionsSpecificInsights(
            user.id,
            windSpeed,
            windDirection
          );
          if (conditions.raceCount > 0) {
            setConditionsInsights(conditions);
          }
        }
      } catch (error) {
        logger.error('Failed to load race prep learning insights', error);
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, [user?.id, venueName, windSpeed, windDirection]);

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading your race insights...</Text>
      </View>
    );
  }

  // Show helpful empty state if no learning profile or no races analyzed
  if (!profile || profile.racesAnalyzed === 0) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIconContainer}>
          <Lightbulb size={24} color="#94a3b8" />
        </View>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyTitle}>Personalized Race Insights</Text>
          <Text style={styles.emptyText}>
            Complete races and add notes to unlock insights tailored to your sailing style.
          </Text>
        </View>
      </View>
    );
  }

  const aiSummary = profile.aiSummary;
  const preRaceReminder = aiSummary?.preRaceReminder;
  const focusNext = aiSummary?.focusNext?.slice(0, 3) ?? [];
  const hasInsights = preRaceReminder || focusNext.length > 0 || venueInsights || conditionsInsights;

  // Show empty state if profile exists but no actionable insights yet
  if (!hasInsights) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIconContainer}>
          <Lightbulb size={24} color="#94a3b8" />
        </View>
        <View style={styles.emptyContent}>
          <Text style={styles.emptyTitle}>Building Your Insights</Text>
          <Text style={styles.emptyText}>
            You have {profile.racesAnalyzed} race{profile.racesAnalyzed !== 1 ? 's' : ''} analyzed. Add more race notes to generate personalized pre-race reminders.
          </Text>
        </View>
      </View>
    );
  }

  // Compact mode - just show the reminder
  if (compact && preRaceReminder) {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={onPress}>
        <View style={styles.compactRow}>
          <Lightbulb size={20} color="#ffffff" style={styles.compactIcon} />
          <View style={styles.compactContent}>
            <Text style={styles.compactLabel}>YOUR PRE-RACE REMINDER</Text>
            <Text style={styles.compactText}>"{preRaceReminder}"</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Lightbulb size={20} color="#3b82f6" />
          <Text style={styles.headerTitle}>Your Race Learnings</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Based on {profile.racesAnalyzed} past race{profile.racesAnalyzed !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Pre-Race Reminder - Most prominent */}
      {preRaceReminder && (
        <View style={styles.reminderCard}>
          <View style={styles.reminderHeader}>
            <Target size={18} color="#ffffff" />
            <Text style={styles.reminderLabel}>PRE-RACE REMINDER</Text>
          </View>
          <Text style={styles.reminderText}>"{preRaceReminder}"</Text>
        </View>
      )}

      {/* Focus Areas */}
      {focusNext.length > 0 && (
        <View style={styles.focusCard}>
          <View style={styles.focusHeader}>
            <Flag size={16} color="#f59e0b" />
            <Text style={styles.focusTitle}>Focus This Race</Text>
          </View>
          {focusNext.map((item, index) => (
            <View key={index} style={styles.focusItem}>
              <Ionicons name="arrow-forward-circle" size={16} color="#f59e0b" style={styles.focusIcon} />
              <Text style={styles.focusText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Venue-Specific Insights (Collapsible) */}
      {venueInsights && venueInsights.raceCount > 0 && (
        <View style={styles.collapsibleCard}>
          <Pressable
            style={styles.collapsibleHeader}
            onPress={() => setVenueExpanded(!venueExpanded)}
          >
            <View style={styles.collapsibleHeaderLeft}>
              <MapPin size={16} color="#10b981" />
              <Text style={styles.collapsibleTitle}>
                {venueName} Insights
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{venueInsights.raceCount} races</Text>
              </View>
            </View>
            {venueExpanded ? (
              <ChevronUp size={20} color="#6b7280" />
            ) : (
              <ChevronDown size={20} color="#6b7280" />
            )}
          </Pressable>
          
          {venueExpanded && (
            <View style={styles.collapsibleContent}>
              {venueInsights.averagePerformance && (
                <Text style={styles.performanceText}>
                  Your average performance here: {venueInsights.averagePerformance}/5
                </Text>
              )}
              {venueInsights.insights.map((insight, index) => (
                <View key={index} style={styles.insightItem}>
                  <Ionicons name="information-circle" size={14} color="#10b981" />
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
              {venueInsights.keyLearnings.length > 0 && (
                <View style={styles.learningsSection}>
                  <Text style={styles.learningSectionTitle}>Past Learnings:</Text>
                  {venueInsights.keyLearnings.slice(0, 3).map((learning, index) => (
                    <Text key={index} style={styles.learningText}>• {learning}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Conditions-Specific Insights (Collapsible) */}
      {conditionsInsights && conditionsInsights.raceCount > 0 && (
        <View style={styles.collapsibleCard}>
          <Pressable
            style={styles.collapsibleHeader}
            onPress={() => setConditionsExpanded(!conditionsExpanded)}
          >
            <View style={styles.collapsibleHeaderLeft}>
              <Wind size={16} color="#6366f1" />
              <Text style={styles.collapsibleTitle}>
                {conditionsInsights.conditionLabel.charAt(0).toUpperCase() + conditionsInsights.conditionLabel.slice(1)} Insights
              </Text>
              <View style={[styles.badge, styles.badgePurple]}>
                <Text style={styles.badgeText}>{conditionsInsights.raceCount} races</Text>
              </View>
            </View>
            {conditionsExpanded ? (
              <ChevronUp size={20} color="#6b7280" />
            ) : (
              <ChevronDown size={20} color="#6b7280" />
            )}
          </Pressable>
          
          {conditionsExpanded && (
            <View style={styles.collapsibleContent}>
              {conditionsInsights.averagePerformance && (
                <Text style={styles.performanceText}>
                  Your performance in {conditionsInsights.conditionLabel}: {conditionsInsights.averagePerformance}/5
                </Text>
              )}
              {conditionsInsights.insights.map((insight, index) => (
                <View key={index} style={styles.insightItem}>
                  <Ionicons name="information-circle" size={14} color="#6366f1" />
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
              {conditionsInsights.keyLearnings.length > 0 && (
                <View style={styles.learningsSection}>
                  <Text style={styles.learningSectionTitle}>Past Learnings:</Text>
                  {conditionsInsights.keyLearnings.slice(0, 3).map((learning, index) => (
                    <Text key={index} style={styles.learningText}>• {learning}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  loadingCard: {
    marginVertical: 12,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#3b82f6',
    fontSize: 14,
  },
  emptyCard: {
    marginVertical: 12,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emptyIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContent: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  header: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 28,
  },
  reminderCard: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reminderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#bfdbfe',
    letterSpacing: 0.5,
  },
  reminderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  focusCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  focusTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
  },
  focusItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  focusIcon: {
    marginTop: 2,
  },
  focusText: {
    flex: 1,
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  collapsibleCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  collapsibleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  badge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgePurple: {
    backgroundColor: '#e0e7ff',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065f46',
  },
  collapsibleContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  performanceText: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 10,
    marginBottom: 8,
    fontWeight: '500',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  learningsSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  learningSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  learningText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    marginBottom: 4,
  },
  // Compact mode styles
  compactCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  compactIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  compactContent: {
    flex: 1,
  },
  compactLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#bfdbfe',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  compactText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
