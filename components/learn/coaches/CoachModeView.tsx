/**
 * CoachModeView (View C)
 *
 * Shown when a dual-role user toggles to Coach mode.
 * Displays coach metrics, quick actions, incoming sessions,
 * active client list, and earnings summary.
 */

import React, { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_COLORS } from '@/components/cards/constants';
import { TufteTokens } from '@/constants/designSystem';
import {
  useCoachMetrics,
  useUpcomingCoachSessions,
  useCoachClients,
  useCoachEarningsSummary,
} from '@/hooks/useCoachData';

import {
  TufteSection,
  TufteSessionRow,
  MetricsRow,
  EmptyState,
  styles as sharedStyles,
} from './shared';
import type { DashboardMetric } from './shared';

interface CoachModeViewProps {
  toolbarOffset?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export function CoachModeView({ toolbarOffset = 0, onScroll }: CoachModeViewProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: metricsData,
    refetch: refetchMetrics,
  } = useCoachMetrics();

  const {
    data: upcomingSessions = [],
    refetch: refetchSessions,
  } = useUpcomingCoachSessions(6);

  const {
    data: clients = [],
    refetch: refetchClients,
  } = useCoachClients('active');

  const {
    data: earningsSummary,
    refetch: refetchEarnings,
  } = useCoachEarningsSummary();

  // Coach metrics row
  const metrics = useMemo<DashboardMetric[]>(() => {
    if (!metricsData) {
      return [
        { label: 'Clients', value: '\u2014', helper: 'active' },
        { label: 'Upcoming', value: '\u2014', helper: 'sessions' },
        { label: 'Rating', value: '\u2014', helper: 'avg' },
        { label: 'This Month', value: '\u2014', helper: 'sessions' },
      ];
    }
    return [
      { label: 'Clients', value: `${metricsData.activeClients || 0}`, helper: 'active' },
      { label: 'Upcoming', value: `${metricsData.upcomingSessions || 0}`, helper: 'sessions' },
      { label: 'Rating', value: metricsData.averageRating ? metricsData.averageRating.toFixed(1) : '\u2014', helper: 'avg' },
      { label: 'This Month', value: `${metricsData.sessionsThisMonth || 0}`, helper: 'sessions' },
    ];
  }, [metricsData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchMetrics(),
      refetchSessions(),
      refetchClients(),
      refetchEarnings(),
    ]);
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingBottom: 120 }, toolbarOffset > 0 && { paddingTop: toolbarOffset }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={IOS_COLORS.blue} />
      }
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {/* Coach Metrics */}
      <MetricsRow metrics={metrics} />

      {/* Quick Actions */}
      <TufteSection title="QUICK ACTIONS">
        <View style={sharedStyles.quickActionsContainer}>
          <TouchableOpacity
            style={sharedStyles.quickActionRow}
            onPress={() => router.push('/(tabs)/coaching')}
          >
            <View style={sharedStyles.quickActionLeft}>
              <Ionicons name="easel-outline" size={18} color={IOS_COLORS.secondaryLabel} />
              <Text style={sharedStyles.quickActionLabel}>Full Dashboard</Text>
            </View>
            <Text style={sharedStyles.quickActionChevron}>{'\u203A'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={sharedStyles.quickActionRow}
            onPress={() => router.push('/coach/my-bookings')}
          >
            <View style={sharedStyles.quickActionLeft}>
              <Ionicons name="calendar-outline" size={18} color={IOS_COLORS.secondaryLabel} />
              <Text style={sharedStyles.quickActionLabel}>View Schedule</Text>
            </View>
            <Text style={sharedStyles.quickActionChevron}>{'\u203A'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[sharedStyles.quickActionRow, sharedStyles.quickActionRowLast]}
            onPress={() => router.push('/(tabs)/earnings')}
          >
            <View style={sharedStyles.quickActionLeft}>
              <Ionicons name="wallet-outline" size={18} color={IOS_COLORS.secondaryLabel} />
              <Text style={sharedStyles.quickActionLabel}>View Earnings</Text>
            </View>
            <Text style={sharedStyles.quickActionChevron}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>
      </TufteSection>

      {/* Incoming Sessions */}
      <TufteSection
        title="INCOMING SESSIONS"
        action="Calendar"
        onActionPress={() => router.push('/coach/my-bookings')}
      >
        <View style={sharedStyles.sessionsContainer}>
          {upcomingSessions.length > 0 ? (
            upcomingSessions.map((session, index) => (
              <TufteSessionRow
                key={session.id}
                session={session}
                onPress={() => router.push('/coach/my-bookings')}
                isLast={index === upcomingSessions.length - 1}
              />
            ))
          ) : (
            <EmptyState text="No upcoming sessions" />
          )}
        </View>
      </TufteSection>

      {/* Active Clients */}
      <TufteSection
        title="ACTIVE CLIENTS"
        action="All clients"
        onActionPress={() => router.push('/(tabs)/coaching')}
      >
        <View style={sharedStyles.coachesContainer}>
          {clients.length > 0 ? (
            clients.slice(0, 5).map((client, index) => (
              <TouchableOpacity
                key={client.id}
                style={[
                  localStyles.clientRow,
                  index === Math.min(clients.length, 5) - 1 && localStyles.clientRowLast,
                ]}
                onPress={() => router.push(`/(tabs)/coaching`)}
                activeOpacity={0.6}
              >
                <View style={localStyles.clientAvatar}>
                  <Text style={localStyles.clientAvatarText}>
                    {(client.sailor?.full_name || client.sailor?.email || 'S')
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={localStyles.clientContent}>
                  <Text style={localStyles.clientName} numberOfLines={1}>
                    {client.sailor?.full_name || client.sailor?.email || 'Sailor'}
                  </Text>
                  <Text style={localStyles.clientMeta} numberOfLines={1}>
                    {client.total_sessions} sessions
                    {client.skill_level ? ` \u00B7 ${client.skill_level}` : ''}
                  </Text>
                </View>
                <Text style={sharedStyles.quickActionChevron}>{'\u203A'}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyState text="No active clients" />
          )}
        </View>
      </TufteSection>

      {/* Earnings Summary */}
      {earningsSummary && (
        <TufteSection
          title="EARNINGS"
          action="Details"
          onActionPress={() => router.push('/coach/my-bookings')}
        >
          <View style={localStyles.earningsContainer}>
            <View style={localStyles.earningsRow}>
              <View style={localStyles.earningsItem}>
                <Text style={localStyles.earningsValue}>
                  ${((earningsSummary?.period?.month?.current?.total ?? 0) / 100).toFixed(0)}
                </Text>
                <Text style={localStyles.earningsLabel}>This Month</Text>
              </View>
              <View style={localStyles.earningsItem}>
                <Text style={localStyles.earningsValue}>
                  ${((earningsSummary?.totals?.lifetime ?? 0) / 100).toFixed(0)}
                </Text>
                <Text style={localStyles.earningsLabel}>Lifetime</Text>
              </View>
              <View style={localStyles.earningsItem}>
                <Text style={localStyles.earningsValue}>
                  {earningsSummary?.totals?.sessions ?? 0}
                </Text>
                <Text style={localStyles.earningsLabel}>Sessions</Text>
              </View>
            </View>
            {(earningsSummary?.totals?.pendingPayouts ?? 0) > 0 && (
              <Text style={localStyles.pendingText}>
                ${((earningsSummary?.totals?.pendingPayouts ?? 0) / 100).toFixed(0)} pending payout
              </Text>
            )}
          </View>
        </TufteSection>
      )}

      {/* Subtle "Looking for coaching yourself?" prompt */}
      <View style={sharedStyles.subtleCoachPrompt}>
        <TouchableOpacity
          style={sharedStyles.subtleCoachLink}
          onPress={() => router.push('/coach/discover')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={sharedStyles.subtleCoachText}>Looking for coaching yourself? Find a coach</Text>
          <Ionicons name="arrow-forward" size={14} color={IOS_COLORS.blue} />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: TufteTokens.spacing.section,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
    minHeight: 56,
  },
  clientRowLast: {
    borderBottomWidth: 0,
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clientAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  clientContent: {
    flex: 1,
    gap: 2,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.label,
  },
  clientMeta: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  earningsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: TufteTokens.borders.hairline,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
    paddingVertical: 16,
    paddingHorizontal: TufteTokens.spacing.section,
  },
  earningsRow: {
    flexDirection: 'row',
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsValue: {
    fontSize: 22,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  earningsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  pendingText: {
    fontSize: 13,
    color: IOS_COLORS.orange,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
});
