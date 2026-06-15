/**
 * ClubLeaderboard - Strava-style club member rankings
 *
 * Displays a leaderboard of club members ranked by activity:
 * - Member rankings with positions
 * - Race count, wins, and podiums
 * - Total club stats
 * - Period selector (This Month, This Season, All Time)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Trophy, Flag, Award, ChevronRight, Users } from 'lucide-react-native';
import { getInitials } from '@/components/account/accountStyles';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_SHADOWS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import {
  useClubLeaderboard,
  type ClubMemberRanking,
} from '@/hooks/useClubLeaderboard';

interface ClubLeaderboardProps {
  clubId: string;
  /** Maximum members to show in collapsed view */
  previewLimit?: number;
  /** Whether to show as expanded full list */
  expanded?: boolean;
}

type LeaderboardPeriod = 'month' | 'season' | 'all';

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'month', label: 'This Month' },
  { value: 'season', label: 'This Season' },
  { value: 'all', label: 'All Time' },
];

function RankBadge({ rank }: { rank: number }) {
  // Gold, Silver, Bronze for top 3
  let backgroundColor = IOS_COLORS.systemGray5;
  let textColor = IOS_COLORS.label;

  if (rank === 1) {
    backgroundColor = '#FFD700';
    textColor = '#000';
  } else if (rank === 2) {
    backgroundColor = '#C0C0C0';
    textColor = '#000';
  } else if (rank === 3) {
    backgroundColor = '#CD7F32';
    textColor = '#FFF';
  }

  return (
    <View style={[styles.rankBadge, { backgroundColor }]}>
      <Text style={[styles.rankText, { color: textColor }]}>{rank}</Text>
    </View>
  );
}

function MemberRow({
  member,
  onPress,
  isLast,
}: {
  member: ClubMemberRanking;
  onPress: () => void;
  isLast: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.memberRow,
        pressed && styles.memberRowPressed,
        !isLast && styles.memberRowBorder,
      ]}
      onPress={onPress}
    >
      <RankBadge rank={member.rank} />

      <View
        style={[
          styles.avatar,
          { backgroundColor: member.avatarColor || IOS_COLORS.systemBlue },
        ]}
      >
        {member.avatarEmoji ? (
          <Text style={styles.avatarEmoji}>{member.avatarEmoji}</Text>
        ) : (
          <Text style={styles.avatarInitials}>
            {getInitials(member.displayName)}
          </Text>
        )}
      </View>

      <View style={styles.memberInfo}>
        <Text style={styles.memberName} numberOfLines={1}>
          {member.displayName}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Flag size={12} color={IOS_COLORS.secondaryLabel} />
            <Text style={styles.statText}>{member.raceCount}</Text>
          </View>
          {member.wins > 0 && (
            <View style={styles.statItem}>
              <Trophy size={12} color={IOS_COLORS.systemYellow} />
              <Text style={styles.statText}>{member.wins}</Text>
            </View>
          )}
          {member.podiums > 0 && (
            <View style={styles.statItem}>
              <Award size={12} color={IOS_COLORS.systemOrange} />
              <Text style={styles.statText}>{member.podiums}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.points}>{member.points} pts</Text>
      <ChevronRight size={16} color={IOS_COLORS.tertiaryLabel} />
    </Pressable>
  );
}

export function ClubLeaderboard({
  clubId,
  previewLimit = 5,
  expanded = false,
}: ClubLeaderboardProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<LeaderboardPeriod>('season');
  const { data, isLoading, error } = useClubLeaderboard(clubId, period);

  const handleMemberPress = useCallback(
    (userId: string) => {
      triggerHaptic('selection');
      router.push(`/profile/${userId}`);
    },
    [router]
  );

  const handlePeriodChange = useCallback((newPeriod: LeaderboardPeriod) => {
    triggerHaptic('selection');
    setPeriod(newPeriod);
  }, []);

  const handleViewAll = useCallback(() => {
    triggerHaptic('selection');
    // Navigate to full leaderboard view
    router.push(`/club/${clubId}/leaderboard`);
  }, [router, clubId]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
        </View>
      </View>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.totalMembers === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Trophy size={18} color={IOS_COLORS.systemYellow} />
          <Text style={styles.title}>Club Leaderboard</Text>
        </View>
        <View style={styles.emptyState}>
          <Users size={32} color={IOS_COLORS.tertiaryLabel} />
          <Text style={styles.emptyText}>No members yet</Text>
        </View>
      </View>
    );
  }

  const displayMembers = expanded
    ? data.members
    : data.members.slice(0, previewLimit);
  const hasMore = !expanded && data.members.length > previewLimit;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Trophy size={18} color={IOS_COLORS.systemYellow} />
        <Text style={styles.title}>Club Leaderboard</Text>
        <Text style={styles.periodLabel}>{data.periodLabel}</Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {PERIOD_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.periodOption,
              period === option.value && styles.periodOptionActive,
            ]}
            onPress={() => handlePeriodChange(option.value)}
          >
            <Text
              style={[
                styles.periodOptionText,
                period === option.value && styles.periodOptionTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Total Stats */}
      <View style={styles.totalStats}>
        <View style={styles.totalStatItem}>
          <Text style={styles.totalStatValue}>{data.totalMembers}</Text>
          <Text style={styles.totalStatLabel}>Members</Text>
        </View>
        <View style={styles.totalStatDivider} />
        <View style={styles.totalStatItem}>
          <Text style={styles.totalStatValue}>{data.totalRaces}</Text>
          <Text style={styles.totalStatLabel}>Races</Text>
        </View>
        <View style={styles.totalStatDivider} />
        <View style={styles.totalStatItem}>
          <Text style={styles.totalStatValue}>{data.totalWins}</Text>
          <Text style={styles.totalStatLabel}>Wins</Text>
        </View>
      </View>

      {/* Member List */}
      <View style={styles.memberList}>
        {displayMembers.map((member, index) => (
          <MemberRow
            key={member.userId}
            member={member}
            onPress={() => handleMemberPress(member.userId)}
            isLast={index === displayMembers.length - 1 && !hasMore}
          />
        ))}

        {/* View All Button */}
        {hasMore && (
          <Pressable
            style={({ pressed }) => [
              styles.viewAllButton,
              pressed && styles.viewAllButtonPressed,
            ]}
            onPress={handleViewAll}
          >
            <Text style={styles.viewAllText}>
              View all {data.members.length} members
            </Text>
            <ChevronRight size={16} color={IOS_COLORS.systemBlue} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    overflow: 'hidden',
    ...IOS_SHADOWS.sm,
  },
  loadingContainer: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: IOS_SPACING.lg,
    gap: IOS_SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  title: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    flex: 1,
  },
  periodLabel: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
  },
  periodSelector: {
    flexDirection: 'row',
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.xs,
  },
  periodOption: {
    flex: 1,
    paddingVertical: IOS_SPACING.xs + 2,
    alignItems: 'center',
    borderRadius: IOS_RADIUS.sm,
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  periodOptionActive: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  periodOptionText: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  periodOptionTextActive: {
    color: '#FFFFFF',
  },
  totalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: IOS_SPACING.md,
    marginHorizontal: IOS_SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.separator,
  },
  totalStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  totalStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: IOS_COLORS.separator,
  },
  totalStatValue: {
    ...IOS_TYPOGRAPHY.title3,
    color: IOS_COLORS.label,
  },
  totalStatLabel: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  memberList: {
    paddingTop: IOS_SPACING.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
  },
  memberRowPressed: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  memberRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: IOS_SPACING.sm,
  },
  rankText: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '700',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: IOS_SPACING.md,
  },
  avatarEmoji: {
    fontSize: 18,
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...IOS_TYPOGRAPHY.subhead,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: IOS_SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.secondaryLabel,
  },
  points: {
    ...IOS_TYPOGRAPHY.caption1,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    marginRight: IOS_SPACING.xs,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IOS_SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    gap: IOS_SPACING.xs,
  },
  viewAllButtonPressed: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  viewAllText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.systemBlue,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: IOS_SPACING.xxl,
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: IOS_SPACING.sm,
  },
});
