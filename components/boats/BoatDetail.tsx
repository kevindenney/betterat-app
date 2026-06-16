import type { BoatPerformanceStats } from '@/hooks/useBoatPerformanceStats';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

type BoatDetailTab =
  | 'overview'
  | 'crew'
  | 'sails'
  | 'rigging'
  | 'equipment'
  | 'maintenance'
  | 'performance'
  | 'tuning3d'
  | 'guides';

interface BoatDetailProps {
  boat: {
    id: string;
    name: string;
    className: string;
    sailNumber?: string;
    manufacturer?: string;
    yearBuilt?: number;
    hullMaterial?: string;
    isPrimary: boolean;
    homeClub?: string;
    storageLocation?: string;
    ownership?: string;
  };
  performanceStats?: BoatPerformanceStats | null;
  performanceLoading?: boolean;
  summaryCounts?: {
    crew?: number | null;
    sails?: number | null;
    maintenance?: number | null;
  };
  onNavigate?: (tab: BoatDetailTab) => void;
}

interface VenueConfig {
  venue: string;
  lastUsed: string;
  setup: string;
  performance: string;
}

const MOCK_VENUE_CONFIGS: VenueConfig[] = [
  {
    venue: 'Victoria Harbour (RHKYC)',
    lastUsed: 'Oct 1, 2025',
    setup: 'Medium Air Setup',
    performance: 'Avg 2.3',
  },
  {
    venue: 'Port Shelter (HHYC)',
    lastUsed: 'Sep 28, 2025',
    setup: 'Heavy Air Setup',
    performance: 'Avg 3.1',
  },
  {
    venue: 'Stanley Bay',
    lastUsed: 'Sep 20, 2025',
    setup: 'Light Air Setup',
    performance: 'Avg 4.2',
  },
];

export function BoatDetail({
  boat,
  performanceStats,
  performanceLoading = false,
  summaryCounts,
  onNavigate,
}: BoatDetailProps) {
  const stats = performanceStats ?? null;
  const counts = summaryCounts ?? {};

  const formatNumber = (value: number | null | undefined, decimals = 1) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    return Number(value).toFixed(decimals);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    return `${Math.round(value)}%`;
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const avgTrend = stats?.avgDelta ?? null;
  const avgTrendIcon =
    avgTrend === null
      ? 'remove'
      : avgTrend > 0
        ? 'trending-up'
        : avgTrend < 0
          ? 'trending-down'
          : 'remove';
  const avgTrendColor =
    avgTrend === null
      ? '#94A3B8'
      : avgTrend > 0
        ? '#10B981'
        : avgTrend < 0
          ? '#EF4444'
          : '#64748B';
  const avgTrendLabel = !stats
    ? 'Race data unavailable'
    : avgTrend === null
      ? 'No recent change'
      : avgTrend > 0
        ? `Improved ${Math.abs(avgTrend).toFixed(1)} vs previous races`
        : avgTrend < 0
          ? `Declined ${Math.abs(avgTrend).toFixed(1)} vs previous races`
          : 'Flat compared to previous races';

  const podiumLabel = !stats
    ? 'Race data unavailable'
    : stats.topThreeRate !== null && stats.topThreeRate !== undefined
      ? `${Math.round(stats.topThreeRate)}% podium rate`
      : 'Log more finishes to unlock podium stats';

  const lastRaceLabel = (() => {
    if (!stats) {
      return performanceLoading ? 'Syncing race data…' : 'Race results temporarily unavailable';
    }
    const formatted = formatDate(stats.lastRaceDate);
    return formatted || 'Add your first result to start tracking';
  })();

  const totalRacesDisplay =
    stats && stats.totalRaces !== undefined && stats.totalRaces !== null
      ? stats.totalRaces
      : '—';

  const quickActions = [
    {
      key: 'crew',
      label: 'Crew',
      icon: 'people' as const,
      badge: counts.crew,
      tab: 'crew' as BoatDetailTab,
    },
    {
      key: 'sails',
      label: 'Sails',
      icon: 'flag' as const,
      badge: counts.sails,
      tab: 'sails' as BoatDetailTab,
    },
    {
      key: 'rigging',
      label: 'Rigging',
      icon: 'git-network' as const,
      badge: null,
      tab: 'rigging' as BoatDetailTab,
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
      icon: 'build' as const,
      badge: counts.maintenance,
      tab: 'maintenance' as BoatDetailTab,
    },
    {
      key: 'performance',
      label: 'Performance',
      icon: 'stats-chart' as const,
      badge:
        stats && stats.totalRaces !== undefined && stats.totalRaces !== null
          ? stats.totalRaces
          : performanceLoading
            ? null
            : undefined,
      tab: 'performance' as BoatDetailTab,
    },
  ];
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Boat Info Card */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, styles.cardTitleStandalone]}>Boat Information</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Class</Text>
            <Text style={styles.infoValue}>{boat.className}</Text>
          </View>
          {boat.sailNumber && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Sail Number</Text>
              <Text style={styles.infoValue}>{boat.sailNumber}</Text>
            </View>
          )}
          {boat.manufacturer && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Manufacturer</Text>
              <Text style={styles.infoValue}>{boat.manufacturer}</Text>
            </View>
          )}
          {boat.yearBuilt && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Year Built</Text>
              <Text style={styles.infoValue}>{boat.yearBuilt}</Text>
            </View>
          )}
          {boat.hullMaterial && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Hull Material</Text>
              <Text style={styles.infoValue}>{boat.hullMaterial}</Text>
            </View>
          )}
          {boat.ownership && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ownership</Text>
              <Text style={styles.infoValue}>{boat.ownership}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Location & Storage */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, styles.cardTitleStandalone]}>Location & Storage</Text>
        <View style={styles.locationInfo}>
          {boat.homeClub && (
            <View style={styles.locationItem}>
              <Ionicons name="business" size={20} color="#3B82F6" />
              <View style={styles.locationText}>
                <Text style={styles.locationLabel}>Home Club</Text>
                <Text style={styles.locationValue}>{boat.homeClub}</Text>
              </View>
            </View>
          )}
          {boat.storageLocation && (
            <View style={styles.locationItem}>
              <Ionicons name="location" size={20} color="#3B82F6" />
              <View style={styles.locationText}>
                <Text style={styles.locationLabel}>Storage</Text>
                <Text style={styles.locationValue}>{boat.storageLocation}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Performance Profile */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Performance Profile</Text>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => onNavigate?.('performance')}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {performanceLoading && (
          <View style={styles.statsLoading}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.statsLoadingText}>Syncing race results…</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatNumber(stats?.avgFinish, 1)}</Text>
            <Text style={styles.statLabel}>Average Finish</Text>
            <View style={styles.statMeta}>
              <Ionicons name={avgTrendIcon} size={14} color={avgTrendColor} />
              <Text style={[styles.statMetaText, { color: avgTrendColor }]}>
                {avgTrendLabel}
              </Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatPercent(stats?.winRate)}</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
            <Text style={[styles.statMetaText, styles.statMetaTextMuted]}>
              {podiumLabel}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalRacesDisplay}</Text>
            <Text style={styles.statLabel}>Total Races Logged</Text>
            <Text style={[styles.statMetaText, styles.statMetaTextMuted]}>
              {lastRaceLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Venue Configurations */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Venue Configurations</Text>
          <TouchableOpacity>
            <Ionicons name="add-circle" size={24} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardSubtitle}>
          Quick access to venue-specific setups and performance
        </Text>
        {MOCK_VENUE_CONFIGS.map((config, index) => (
          <TouchableOpacity key={index} style={styles.venueCard}>
            <View style={styles.venueHeader}>
              <Ionicons name="location" size={18} color="#3B82F6" />
              <Text style={styles.venueName}>{config.venue}</Text>
            </View>
            <View style={styles.venueDetails}>
              <View style={styles.venueDetail}>
                <Ionicons name="time-outline" size={14} color="#64748B" />
                <Text style={styles.venueDetailText}>{config.lastUsed}</Text>
              </View>
              <View style={styles.venueDetail}>
                <Ionicons name="settings-outline" size={14} color="#64748B" />
                <Text style={styles.venueDetailText}>{config.setup}</Text>
              </View>
              <View style={styles.venueDetail}>
                <Ionicons name="trophy-outline" size={14} color="#64748B" />
                <Text style={styles.venueDetailText}>{config.performance}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.card}>
        <Text style={[styles.cardTitle, styles.cardTitleStandalone]}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.actionCard}
              onPress={() => onNavigate?.(action.tab)}
            >
              <Ionicons
                name={action.icon}
                size={24}
                color={action.key === 'maintenance' ? '#DC2626' : '#1D4ED8'}
              />
              <Text style={styles.actionText}>{action.label}</Text>
              {action.badge !== null && action.badge !== undefined && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{action.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginHorizontal: 0,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 16px rgba(15, 23, 42, 0.05)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardTitleStandalone: {
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 24,
    rowGap: 18,
  },
  infoItem: {
    minWidth: '46%',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  locationInfo: {
    gap: 12,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationText: {
    flex: 1,
    gap: 2,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  statsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  statsLoadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    rowGap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 13,
    color: '#475569',
  },
  statMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statMetaTextMuted: {
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },
  venueCard: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  venueName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  venueDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  venueDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueDetailText: {
    fontSize: 12,
    color: '#64748B',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#EEF2FF',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    position: 'relative',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  actionBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#1D4ED8',
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
