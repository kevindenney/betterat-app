/**
 * WeeklySummaryCard - Shareable weekly recap
 *
 * Shows a summary of the week's racing activity with
 * option to share as an image, similar to Strava's weekly summaries.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Share } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SHADOWS } from '@/lib/design-tokens-ios';
import type { WeeklySummary } from '@/hooks/useReflectProfile';

interface WeeklySummaryCardProps {
  summary?: WeeklySummary;
  onShare?: () => void;
  onSeeDetails?: () => void;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getOrdinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

export function WeeklySummaryCard({
  summary,
  onShare,
  onSeeDetails,
}: WeeklySummaryCardProps) {
  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }

    if (!summary) return;

    // Generate share text
    const shareText = `My Week in Sailing ${formatDateRange(summary.weekStartDate, summary.weekEndDate)}

${summary.racesCompleted} races completed
${summary.wins > 0 ? `${summary.wins} wins ` : ''}${summary.podiums} podiums
${formatTime(summary.timeOnWater)} on the water
${summary.avgFinish ? `Avg finish: ${summary.avgFinish.toFixed(1)}` : ''}
${summary.highlightRace ? `\nHighlight: ${getOrdinal(summary.highlightRace.position)} in ${summary.highlightRace.name}` : ''}

#BetterAt #Sailing`;

    try {
      await Share.share({
        message: shareText,
      });
    } catch (error) {
      showAlert('Error', 'Could not share summary');
    }
  };

  if (!summary) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Summary</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons
            name="calendar-outline"
            size={40}
            color={IOS_COLORS.systemGray3}
          />
          <Text style={styles.emptyText}>No activity this week</Text>
          <Text style={styles.emptySubtext}>
            Get out on the water to see your weekly summary
          </Text>
        </View>
      </View>
    );
  }

  const hasImprovement =
    summary.comparedToLastWeek.avgFinish !== null &&
    summary.comparedToLastWeek.avgFinish < 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Weekly Summary</Text>
          <Text style={styles.dateRange}>
            {formatDateRange(summary.weekStartDate, summary.weekEndDate)}
          </Text>
        </View>
        {summary.isShareable && (
          <Pressable
            style={({ pressed }) => [
              styles.shareButton,
              pressed && styles.shareButtonPressed,
            ]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color={IOS_COLORS.systemBlue} />
          </Pressable>
        )}
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Ionicons name="flag" size={20} color={IOS_COLORS.systemBlue} />
          <Text style={styles.statValue}>{summary.racesCompleted}</Text>
          <Text style={styles.statLabel}>Races</Text>
          {summary.comparedToLastWeek.races !== 0 && (
            <View style={styles.comparisonBadge}>
              <Ionicons
                name={summary.comparedToLastWeek.races > 0 ? 'arrow-up' : 'arrow-down'}
                size={10}
                color={
                  summary.comparedToLastWeek.races > 0
                    ? IOS_COLORS.systemGreen
                    : IOS_COLORS.systemRed
                }
              />
              <Text
                style={[
                  styles.comparisonText,
                  {
                    color:
                      summary.comparedToLastWeek.races > 0
                        ? IOS_COLORS.systemGreen
                        : IOS_COLORS.systemRed,
                  },
                ]}
              >
                {Math.abs(summary.comparedToLastWeek.races)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statBox}>
          <Ionicons name="trophy" size={20} color={IOS_COLORS.systemYellow} />
          <Text style={styles.statValue}>{summary.wins}</Text>
          <Text style={styles.statLabel}>Wins</Text>
        </View>

        <View style={styles.statBox}>
          <Ionicons name="medal" size={20} color={IOS_COLORS.systemOrange} />
          <Text style={styles.statValue}>{summary.podiums}</Text>
          <Text style={styles.statLabel}>Podiums</Text>
        </View>

        <View style={styles.statBox}>
          <Ionicons name="time" size={20} color={IOS_COLORS.systemTeal} />
          <Text style={styles.statValue}>{formatTime(summary.timeOnWater)}</Text>
          <Text style={styles.statLabel}>On Water</Text>
        </View>
      </View>

      {/* Average Finish */}
      {summary.avgFinish !== null && (
        <View style={styles.avgFinishRow}>
          <Text style={styles.avgFinishLabel}>Average Finish</Text>
          <View style={styles.avgFinishValue}>
            <Text style={styles.avgFinishNumber}>
              {summary.avgFinish.toFixed(1)}
            </Text>
            {summary.comparedToLastWeek.avgFinish !== null && (
              <View
                style={[
                  styles.avgFinishBadge,
                  {
                    backgroundColor: hasImprovement
                      ? IOS_COLORS.systemGreen + '20'
                      : IOS_COLORS.systemRed + '20',
                  },
                ]}
              >
                <Ionicons
                  name={hasImprovement ? 'arrow-up' : 'arrow-down'}
                  size={10}
                  color={hasImprovement ? IOS_COLORS.systemGreen : IOS_COLORS.systemRed}
                />
                <Text
                  style={[
                    styles.avgFinishChange,
                    { color: hasImprovement ? IOS_COLORS.systemGreen : IOS_COLORS.systemRed },
                  ]}
                >
                  {Math.abs(summary.comparedToLastWeek.avgFinish).toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Highlight Race */}
      {summary.highlightRace && (
        <View style={styles.highlightSection}>
          <View style={styles.highlightIcon}>
            <Ionicons name="star" size={16} color={IOS_COLORS.systemYellow} />
          </View>
          <View style={styles.highlightContent}>
            <Text style={styles.highlightLabel}>Week's Highlight</Text>
            <Text style={styles.highlightText}>
              <Text style={styles.highlightPosition}>
                {getOrdinal(summary.highlightRace.position)}
              </Text>
              {' in '}
              {summary.highlightRace.name}
              <Text style={styles.highlightFleet}>
                {' '}({summary.highlightRace.fleetSize} boats)
              </Text>
            </Text>
          </View>
        </View>
      )}

      {/* Streak */}
      {summary.streakDays > 0 && (
        <View style={styles.streakRow}>
          <Ionicons name="flame" size={16} color={IOS_COLORS.systemOrange} />
          <Text style={styles.streakText}>
            {summary.streakDays} day racing streak!
          </Text>
        </View>
      )}

      {/* See Details Button */}
      {onSeeDetails && (
        <Pressable
          style={({ pressed }) => [
            styles.detailsButton,
            pressed && styles.detailsButtonPressed,
          ]}
          onPress={onSeeDetails}
        >
          <Text style={styles.detailsButtonText}>See Full Week Details</Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={IOS_COLORS.systemBlue}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...IOS_SHADOWS.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
  },
  dateRange: {
    fontSize: 13,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: IOS_COLORS.systemBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonPressed: {
    opacity: 0.7,
  },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 10,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
    position: 'relative',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
  comparisonBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  comparisonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  avgFinishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  avgFinishLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  avgFinishValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avgFinishNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  avgFinishBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  avgFinishChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  highlightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemYellow + '15',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 10,
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemYellow + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightContent: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  highlightText: {
    fontSize: 14,
    fontWeight: '400',
    color: IOS_COLORS.label,
  },
  highlightPosition: {
    fontWeight: '700',
    color: IOS_COLORS.systemYellow,
  },
  highlightFleet: {
    color: IOS_COLORS.secondaryLabel,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.systemOrange,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  detailsButtonPressed: {
    opacity: 0.6,
  },
  detailsButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
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

export default WeeklySummaryCard;
