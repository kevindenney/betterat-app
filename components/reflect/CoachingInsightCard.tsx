/**
 * CoachingInsightCard
 *
 * A dedicated insight card that surfaces coaching recommendations when
 * the user's race data shows consistent weakness patterns.
 *
 * Features:
 * - Shows only one insight at a time (most relevant)
 * - Adapts CTAs based on coaching status
 * - Dismissable with 14-day expiry
 * - Only renders when there's real pattern data
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IOS_COLORS, IOS_SHADOWS } from '@/lib/design-tokens-ios';
import { useCoachingInsights, type CoachingInsightData } from '@/hooks/useCoachingInsights';
import { useCoachingInsightDismissals } from '@/hooks/useCoachingInsightDismissals';
import { supabase } from '@/services/supabase';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

interface CoachingInsightCardProps {
  /** Sailor ID to analyze */
  sailorId: string | undefined;
}

// Map phase/skill to icon
const PHASE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  starts: 'flag-outline',
  upwind: 'arrow-up-outline',
  downwind: 'arrow-down-outline',
  'windward mark rounding': 'navigate-outline',
  'leeward mark rounding': 'navigate-outline',
  'pre-start': 'timer-outline',
  finish: 'checkmark-circle-outline',
  'race planning': 'map-outline',
};

// Map phase to color
const PHASE_COLORS: Record<string, string> = {
  starts: IOS_COLORS.systemRed,
  upwind: IOS_COLORS.systemBlue,
  downwind: IOS_COLORS.systemTeal,
  'windward mark rounding': IOS_COLORS.systemOrange,
  'leeward mark rounding': IOS_COLORS.systemOrange,
  'pre-start': IOS_COLORS.systemPurple,
  finish: IOS_COLORS.systemGreen,
  'race planning': IOS_COLORS.systemIndigo,
};

export function CoachingInsightCard({ sailorId }: CoachingInsightCardProps) {
  const { coachingData, loading, error } = useCoachingInsights(sailorId);
  const { isDismissed, dismiss, loaded: dismissalsLoaded } = useCoachingInsightDismissals();

  // Don't render until both data and dismissals are loaded
  if (loading || !dismissalsLoaded) {
    return null;
  }

  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <View style={styles.errorHeader}>
          <Ionicons name="warning-outline" size={18} color={IOS_COLORS.systemOrange} />
          <Text style={styles.errorTitle}>Coaching insights unavailable</Text>
        </View>
        <Text style={styles.errorText}>
          {error.message || 'Unable to load coaching trend analysis right now.'}
        </Text>
      </View>
    );
  }

  // Filter out dismissed insights
  const visibleInsights = coachingData.filter(
    (insight) => !isDismissed(insight.insightId)
  );

  // Only show one insight at a time - pick the most relevant (first one)
  const insight = visibleInsights[0];

  // If no data or no visible insights, don't render
  if (!insight) {
    return null;
  }

  const color = PHASE_COLORS[insight.phase] || IOS_COLORS.systemOrange;
  const icon = PHASE_ICONS[insight.phase] || 'alert-circle-outline';

  const handleDismiss = () => {
    dismiss(insight.insightId);
  };

  return (
    <View style={styles.container}>
      {/* Dismiss button */}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={18} color={IOS_COLORS.systemGray2} />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={styles.titleContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Performance Pattern</Text>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={10} color={IOS_COLORS.systemPurple} />
            </View>
          </View>
          <Text style={styles.subtitle}>
            {insight.phase.charAt(0).toUpperCase() + insight.phase.slice(1)} analysis
          </Text>
        </View>
      </View>

      {/* Content based on variant */}
      <InsightContent insight={insight} color={color} sailorId={sailorId} />
    </View>
  );
}

// Separate component for insight content to handle variants
function InsightContent({
  insight,
  color,
  sailorId,
}: {
  insight: CoachingInsightData;
  color: string;
  sailorId: string | undefined;
}) {
  const router = useRouter();

  const handleShareWithCoach = async () => {
    if (!insight.coachUserId || !sailorId) {
      showAlert('Error', 'Could not identify the coach to share with.');
      return;
    }

    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: insight.coachUserId,
        type: 'trend_shared',
        title: 'Performance Trend Shared',
        message: `Your sailor shared a ${insight.phase} performance trend with you.`,
        data: {
          sailor_id: sailorId,
          phase: insight.phase,
          weak_race_count: insight.weakRaceCount,
          total_recent_races: insight.totalRecentRaces,
        },
        read: false,
      });

      if (error) throw error;

      showAlert(
        'Trend Shared',
        `Your ${insight.phase} trend has been shared with ${insight.coachName || 'your coach'}.`
      );
    } catch (err) {
      console.error('[CoachingInsightCard] Error sharing trend:', err);
      showAlert('Error', 'Could not share this trend. Please try again.');
    }
  };

  const handleFindCoach = () => {
    router.push(`/coach/discover?skill=${insight.skillChipKey}` as any);
  };

  const handleAskCoach = () => {
    // Navigate to coach profile/messaging
    if (insight.coachId) {
      router.push(`/coach/${insight.coachId}` as any);
    }
  };

  switch (insight.variant) {
    case 'no_coach':
      return (
        <>
          <Text style={styles.description}>
            You've dropped positions on{' '}
            <Text style={[styles.emphasis, { color }]}>{insight.phase}</Text> in{' '}
            <Text style={styles.emphasis}>{insight.weakRaceCount}</Text> of your last{' '}
            <Text style={styles.emphasis}>{insight.totalRecentRaces}</Text> races.
            A coach who specializes in {insight.phase} tactics could help.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryCta,
              { backgroundColor: color },
              pressed && styles.ctaPressed,
            ]}
            onPress={handleFindCoach}
          >
            <Text style={styles.primaryCtaText}>Find a {insight.phase} coach</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </>
      );

    case 'has_coach_wrong_specialty':
      return (
        <>
          <Text style={styles.description}>
            You've dropped positions on{' '}
            <Text style={[styles.emphasis, { color }]}>{insight.phase}</Text> in{' '}
            <Text style={styles.emphasis}>{insight.weakRaceCount}</Text> of your last{' '}
            <Text style={styles.emphasis}>{insight.totalRecentRaces}</Text> races.
            Your coach {insight.coachName} specializes in other areas — want to explore
            a {insight.phase} specialist too?
          </Text>
          <View style={styles.dualCtaContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryCta,
                pressed && styles.ctaPressed,
              ]}
              onPress={handleAskCoach}
            >
              <Text style={styles.secondaryCtaText}>Ask {insight.coachName?.split(' ')[0] || 'Coach'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primaryCta,
                { backgroundColor: color, flex: 1 },
                pressed && styles.ctaPressed,
              ]}
              onPress={handleFindCoach}
            >
              <Text style={styles.primaryCtaText}>Find specialist</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </>
      );

    case 'has_coach_right_specialty':
      return (
        <>
          <Text style={styles.description}>
            You've dropped positions on{' '}
            <Text style={[styles.emphasis, { color }]}>{insight.phase}</Text> in{' '}
            <Text style={styles.emphasis}>{insight.weakRaceCount}</Text> of your last{' '}
            <Text style={styles.emphasis}>{insight.totalRecentRaces}</Text> races.
            Share this trend with {insight.coachName}?
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryCta,
              { backgroundColor: color },
              pressed && styles.ctaPressed,
            ]}
            onPress={handleShareWithCoach}
          >
            <Ionicons name="share-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primaryCtaText}>Share with {insight.coachName?.split(' ')[0] || 'Coach'}</Text>
          </Pressable>
        </>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...IOS_SHADOWS.sm,
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingRight: 28, // Space for dismiss button
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
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
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: IOS_COLORS.systemPurple + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  description: {
    fontSize: 15,
    fontWeight: '400',
    color: IOS_COLORS.label,
    lineHeight: 22,
    marginBottom: 16,
  },
  emphasis: {
    fontWeight: '600',
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemGray5,
  },
  secondaryCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  dualCtaContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  ctaPressed: {
    opacity: 0.8,
  },
  errorContainer: {
    borderColor: IOS_COLORS.systemOrange + '33',
    borderWidth: 1,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  errorText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
  },
});

export default CoachingInsightCard;
