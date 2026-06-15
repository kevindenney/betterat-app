/**
 * ComparisonCard - Fleet and sailor comparisons
 *
 * Shows how you compare to your fleet and specific sailors,
 * including head-to-head records and rankings.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IOS_COLORS, IOS_SHADOWS } from '@/lib/design-tokens-ios';
import type { FleetComparison, SailorComparison } from '@/hooks/useReflectProfile';

interface ComparisonCardProps {
  fleetComparison?: FleetComparison;
  sailorComparisons: SailorComparison[];
  onSeeMoreSailors?: () => void;
  onSailorPress?: (sailor: SailorComparison) => void;
}

type TabType = 'fleet' | 'sailors';

function FleetComparisonView({ data }: { data: FleetComparison }) {
  const getPercentileColor = (percentile: number): string => {
    if (percentile >= 80) return IOS_COLORS.systemGreen;
    if (percentile >= 50) return IOS_COLORS.systemBlue;
    if (percentile >= 25) return IOS_COLORS.systemOrange;
    return IOS_COLORS.systemRed;
  };

  const percentileColor = getPercentileColor(data.yourPercentile);

  return (
    <View style={styles.fleetContainer}>
      {/* Fleet Name */}
      <View style={styles.fleetHeader}>
        <Ionicons name="people" size={16} color={IOS_COLORS.systemBlue} />
        <Text style={styles.fleetName}>{data.fleetName}</Text>
        <Text style={styles.fleetSize}>{data.fleetSize} sailors</Text>
      </View>

      {/* Your Rank */}
      <View style={styles.rankSection}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankNumber}>#{data.yourRank}</Text>
          <Text style={styles.rankLabel}>Your Rank</Text>
        </View>
        <View style={styles.percentileContainer}>
          <View style={[styles.percentileBadge, { backgroundColor: percentileColor + '20' }]}>
            <Text style={[styles.percentileValue, { color: percentileColor }]}>
              Top {100 - data.yourPercentile}%
            </Text>
          </View>
          <Text style={styles.percentileLabel}>of fleet</Text>
        </View>
      </View>

      {/* Stats Comparison */}
      <View style={styles.statsComparison}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Your Avg</Text>
          <Text style={[styles.statValue, { color: IOS_COLORS.systemBlue }]}>
            {data.avgFinish.toFixed(1)}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Fleet Avg</Text>
          <Text style={[styles.statValue, { color: IOS_COLORS.secondaryLabel }]}>
            {data.fleetAvgFinish.toFixed(1)}
          </Text>
        </View>
        {data.avgFinish < data.fleetAvgFinish && (
          <View style={styles.betterBadge}>
            <Ionicons name="arrow-up" size={10} color={IOS_COLORS.systemGreen} />
            <Text style={styles.betterText}>
              {(data.fleetAvgFinish - data.avgFinish).toFixed(1)} better
            </Text>
          </View>
        )}
      </View>

      {/* Top Sailor */}
      {data.topSailorName && (
        <View style={styles.topSailor}>
          <Ionicons name="trophy" size={14} color={IOS_COLORS.systemYellow} />
          <Text style={styles.topSailorText}>
            Fleet leader: <Text style={styles.topSailorName}>{data.topSailorName}</Text>
            {data.topSailorWins && ` (${data.topSailorWins} wins)`}
          </Text>
        </View>
      )}
    </View>
  );
}

function SailorComparisonItem({
  sailor,
  onPress,
}: {
  sailor: SailorComparison;
  onPress?: () => void;
}) {
  const router = useRouter();
  const totalWins = sailor.yourWins + sailor.theirWins;
  const yourPercentage = totalWins > 0 ? (sailor.yourWins / totalWins) * 100 : 50;

  const getResultColor = (result?: string): string => {
    switch (result) {
      case 'won':
        return IOS_COLORS.systemGreen;
      case 'lost':
        return IOS_COLORS.systemRed;
      default:
        return IOS_COLORS.systemGray;
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/profile/${sailor.sailorId}`);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.sailorItem,
        pressed && styles.sailorItemPressed,
      ]}
      onPress={handlePress}
    >
      {/* Avatar */}
      {sailor.sailorAvatar ? (
        <Image source={{ uri: sailor.sailorAvatar }} style={styles.sailorAvatar} />
      ) : (
        <View style={styles.sailorAvatarPlaceholder}>
          <Text style={styles.sailorInitial}>
            {sailor.sailorName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.sailorInfo}>
        <Text style={styles.sailorName} numberOfLines={1}>
          {sailor.sailorName}
        </Text>
        <Text style={styles.sailorStats}>
          {sailor.headToHeadRaces} head-to-head races
        </Text>
      </View>

      {/* Win Comparison Bar */}
      <View style={styles.winComparison}>
        <View style={styles.winBar}>
          <View
            style={[
              styles.yourWinBar,
              { width: `${yourPercentage}%` },
            ]}
          />
        </View>
        <View style={styles.winStats}>
          <Text style={[styles.winCount, { color: IOS_COLORS.systemBlue }]}>
            {sailor.yourWins}
          </Text>
          <Text style={styles.winDash}>-</Text>
          <Text style={[styles.winCount, { color: IOS_COLORS.secondaryLabel }]}>
            {sailor.theirWins}
          </Text>
        </View>
      </View>

      {/* Last Result */}
      {sailor.lastRaceResult && (
        <View
          style={[
            styles.lastResult,
            { backgroundColor: getResultColor(sailor.lastRaceResult) + '20' },
          ]}
        >
          <Text
            style={[
              styles.lastResultText,
              { color: getResultColor(sailor.lastRaceResult) },
            ]}
          >
            {sailor.lastRaceResult === 'won' ? 'W' : sailor.lastRaceResult === 'lost' ? 'L' : 'T'}
          </Text>
        </View>
      )}

      <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
    </Pressable>
  );
}

export function ComparisonCard({
  fleetComparison,
  sailorComparisons,
  onSeeMoreSailors,
  onSailorPress,
}: ComparisonCardProps) {
  const [activeTab, setActiveTab] = useState<TabType>(fleetComparison ? 'fleet' : 'sailors');

  const hasFleet = !!fleetComparison;
  const hasSailors = sailorComparisons.length > 0;

  if (!hasFleet && !hasSailors) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Comparisons</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons
            name="git-compare-outline"
            size={40}
            color={IOS_COLORS.systemGray3}
          />
          <Text style={styles.emptyText}>No comparisons available</Text>
          <Text style={styles.emptySubtext}>
            Join a fleet to see how you compare to others
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Comparisons</Text>
      </View>

      {/* Tabs (if both available) */}
      {hasFleet && hasSailors && (
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'fleet' && styles.tabActive]}
            onPress={() => setActiveTab('fleet')}
          >
            <Text
              style={[styles.tabText, activeTab === 'fleet' && styles.tabTextActive]}
            >
              Fleet
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'sailors' && styles.tabActive]}
            onPress={() => setActiveTab('sailors')}
          >
            <Text
              style={[styles.tabText, activeTab === 'sailors' && styles.tabTextActive]}
            >
              Sailors
            </Text>
          </Pressable>
        </View>
      )}

      {/* Content */}
      {activeTab === 'fleet' && fleetComparison && (
        <FleetComparisonView data={fleetComparison} />
      )}

      {activeTab === 'sailors' && (
        <View style={styles.sailorsList}>
          {sailorComparisons.slice(0, 3).map((sailor, index) => (
            <React.Fragment key={sailor.sailorId}>
              <SailorComparisonItem
                sailor={sailor}
                onPress={onSailorPress ? () => onSailorPress(sailor) : undefined}
              />
              {index < Math.min(sailorComparisons.length, 3) - 1 && (
                <View style={styles.separator} />
              )}
            </React.Fragment>
          ))}
          {onSeeMoreSailors && sailorComparisons.length > 3 && (
            <Pressable
              style={({ pressed }) => [
                styles.seeMoreButton,
                pressed && styles.seeMoreButtonPressed,
              ]}
              onPress={onSeeMoreSailors}
            >
              <Text style={styles.seeMoreText}>
                See All {sailorComparisons.length} Sailors
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={IOS_COLORS.systemBlue}
              />
            </Pressable>
          )}
        </View>
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
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
    padding: 2,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: IOS_COLORS.systemBackground,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  tabTextActive: {
    color: IOS_COLORS.label,
  },
  // Fleet View
  fleetContainer: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  fleetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fleetName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    flex: 1,
  },
  fleetSize: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  rankSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rankBadge: {
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: IOS_COLORS.systemBlue,
  },
  rankLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
  },
  percentileContainer: {
    alignItems: 'center',
  },
  percentileBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 2,
  },
  percentileValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  percentileLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  statsComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: IOS_COLORS.systemGray6,
    padding: 10,
    borderRadius: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: IOS_COLORS.separator,
  },
  betterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: IOS_COLORS.systemGreen + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  betterText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.systemGreen,
  },
  topSailor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topSailorText: {
    fontSize: 12,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
  },
  topSailorName: {
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  // Sailors View
  sailorsList: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sailorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  sailorItemPressed: {
    backgroundColor: IOS_COLORS.systemGray5,
  },
  sailorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sailorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: IOS_COLORS.systemGray5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sailorInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  sailorInfo: {
    flex: 1,
  },
  sailorName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  sailorStats: {
    fontSize: 12,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
  },
  winComparison: {
    alignItems: 'center',
    width: 60,
  },
  winBar: {
    width: '100%',
    height: 4,
    backgroundColor: IOS_COLORS.systemGray5,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  yourWinBar: {
    height: '100%',
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 2,
  },
  winStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  winCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  winDash: {
    fontSize: 12,
    fontWeight: '400',
    color: IOS_COLORS.tertiaryLabel,
    marginHorizontal: 2,
  },
  lastResult: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastResultText: {
    fontSize: 11,
    fontWeight: '700',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
    marginLeft: 62,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  seeMoreButtonPressed: {
    opacity: 0.6,
  },
  seeMoreText: {
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

export default ComparisonCard;
