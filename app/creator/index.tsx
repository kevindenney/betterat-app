/**
 * Creator Dashboard — Unified Hub
 *
 * Segmented control toggles between Blueprints (list + stats) and
 * Earnings (balance, sales summary, payout history). No separate
 * earnings page needed — everything lives here.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useUserBlueprints } from '@/hooks/useBlueprint';
import {
  StripeConnectService,
  type StripeConnectStatus,
  type PayoutResult,
  type PayoutHistoryItem,
} from '@/services/StripeConnectService';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { supabase } from '@/services/supabase';
import type { BlueprintRecord } from '@/types/blueprint';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const C = {
  bg: '#FFFFFF',
  card: '#F8F7F6',
  accent: '#00897B',
  accentBg: 'rgba(0,137,123,0.08)',
  border: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  blue: '#007AFF',
  blueBg: '#DBEAFE',
  yellow: '#CA8A04',
  yellowBg: '#FEF9C3',
  red: '#DC2626',
  redBg: '#FEE2E2',
  purple: '#7C3AED',
} as const;

type Segment = 'blueprints' | 'earnings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(bp: BlueprintRecord): string {
  if (bp.access_level === 'public') return 'Free';
  if (bp.access_level === 'org_members') return 'Members only';
  if (!bp.price_cents) return 'Paid';
  const dollars = (bp.price_cents / 100).toFixed(bp.price_cents % 100 === 0 ? 0 : 2);
  const suffix = bp.pricing_type === 'recurring' ? '/mo' : '';
  return `$${dollars}${suffix}`;
}

function accessBadgeColor(level: string) {
  switch (level) {
    case 'paid': return { bg: '#FEF3C7', color: '#92400E' };
    case 'org_members': return { bg: '#DBEAFE', color: '#1D4ED8' };
    default: return { bg: C.greenBg, color: C.green };
  }
}

function formatAmount(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getPayoutStatusStyle(status: string) {
  switch (status) {
    case 'paid': return { bg: C.greenBg, color: C.green };
    case 'in_transit': return { bg: C.yellowBg, color: C.yellow };
    case 'failed': return { bg: C.redBg, color: C.red };
    default: return { bg: '#F1F5F9', color: C.labelMid };
  }
}

// ---------------------------------------------------------------------------
// Earnings summary type
// ---------------------------------------------------------------------------

interface EarningsSummary {
  totalRevenue: number;
  platformFees: number;
  netEarnings: number;
  totalSales: number;
  activeSubscribers: number;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CreatorDashboardScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const userId = user?.id;
  const { data: blueprints, isLoading: bpLoading, refetch: refetchBp } = useUserBlueprints();

  const [segment, setSegment] = useState<Segment>('blueprints');
  const [refreshing, setRefreshing] = useState(false);

  // Earnings state
  const [connectStatus, setConnectStatus] = useState<StripeConnectStatus | null>(null);
  const [balance, setBalance] = useState<{ available: number; pending: number; currency: string } | null>(null);
  const [payouts, setPayouts] = useState<PayoutHistoryItem[]>([]);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsLoaded, setEarningsLoaded] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);

  // Blueprint stats
  const bpStats = useMemo(() => {
    if (!blueprints) return { total: 0, published: 0, subscribers: 0 };
    return {
      total: blueprints.length,
      published: blueprints.filter(b => b.is_published).length,
      subscribers: blueprints.reduce((sum, b) => sum + (b.subscriber_count || 0), 0),
    };
  }, [blueprints]);

  // Lazy-load earnings data on first switch
  const loadEarnings = useCallback(async () => {
    if (!userId) return;
    setEarningsLoading(true);
    try {
      const [status, bal, payoutHistory] = await Promise.all([
        StripeConnectService.getConnectStatus(userId),
        StripeConnectService.getBalance(userId).catch(() => null),
        StripeConnectService.getPayoutHistory(userId).catch(() => []),
      ]);
      setConnectStatus(status);
      if (bal) setBalance({ ...bal, currency: bal.currency || 'usd' });
      setPayouts(payoutHistory);

      const { data: userBlueprints } = await supabase
        .from('timeline_blueprints')
        .select('id')
        .eq('user_id', userId);
      const bpIds = userBlueprints?.map((b: any) => b.id) || [];

      if (bpIds.length > 0) {
        const [{ data: purchases }, { count: subscriberCount }] = await Promise.all([
          supabase
            .from('blueprint_purchases')
            .select('amount_paid_cents, platform_fee_cents, status')
            .eq('status', 'completed')
            .in('blueprint_id', bpIds),
          supabase
            .from('blueprint_subscriptions')
            .select('id', { count: 'exact', head: true })
            .in('subscription_status', ['active', 'past_due'])
            .in('blueprint_id', bpIds),
        ]);
        const completed = purchases || [];
        const totalRevenue = completed.reduce((s, p) => s + (p.amount_paid_cents || 0), 0);
        const platformFees = completed.reduce((s, p) => s + (p.platform_fee_cents || 0), 0);
        setSummary({
          totalRevenue,
          platformFees,
          netEarnings: totalRevenue - platformFees,
          totalSales: completed.length,
          activeSubscribers: subscriberCount || 0,
        });
      } else {
        setSummary({ totalRevenue: 0, platformFees: 0, netEarnings: 0, totalSales: 0, activeSubscribers: 0 });
      }
    } catch (err) {
      console.error('Failed to load earnings data:', err);
    } finally {
      setEarningsLoading(false);
      setEarningsLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    if (segment === 'earnings' && !earningsLoaded && !earningsLoading) {
      loadEarnings();
    }
  }, [segment, earningsLoaded, earningsLoading, loadEarnings]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (segment === 'blueprints') {
      await refetchBp();
    } else {
      await loadEarnings();
    }
    setRefreshing(false);
  }, [segment, refetchBp, loadEarnings]);

  const handleOpenStripeDashboard = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await StripeConnectService.getDashboardLink(userId);
      if (result.success && result.url) {
        if (Platform.OS === 'web') window.open(result.url, '_blank');
        else Linking.openURL(result.url);
      } else {
        showAlert('Error', result.error || 'Could not open Stripe dashboard.');
      }
    } catch {
      showAlert('Error', 'Stripe dashboard is not available. Connect your account first.');
    }
  }, [userId]);

  const handleRequestPayout = useCallback(async () => {
    if (!userId) return;
    showConfirm(
      'Request Payout',
      'Transfer all available funds to your bank account?',
      async () => {
        setPayoutLoading(true);
        const result: PayoutResult = await StripeConnectService.requestPayout(userId);
        setPayoutLoading(false);
        if (result.success) {
          showAlert('Payout Requested', `$${((result.amount || 0) / 100).toFixed(2)} is on its way to your bank.`);
          loadEarnings();
        } else {
          showAlert('Payout Failed', result.error || 'Please try again later.');
        }
      },
    );
  }, [userId, loadEarnings]);

  const firstName = (userProfile?.full_name || '').split(/\s+/)[0];

  if (bpLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={C.labelDark} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {firstName ? `${firstName}'s Dashboard` : 'Creator Dashboard'}
        </Text>
        <Pressable onPress={handleOpenStripeDashboard} hitSlop={12} style={styles.headerIconBtn}>
          <Ionicons name="open-outline" size={18} color={C.purple} />
        </Pressable>
      </View>

      {/* Segmented control */}
      <View style={styles.segmentContainer}>
        <Pressable
          style={[styles.segmentBtn, segment === 'blueprints' && styles.segmentBtnActive]}
          onPress={() => setSegment('blueprints')}
        >
          <Ionicons
            name="document-text-outline"
            size={14}
            color={segment === 'blueprints' ? C.accent : C.labelMid}
          />
          <Text style={[styles.segmentText, segment === 'blueprints' && styles.segmentTextActive]}>
            Blueprints
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, segment === 'earnings' && styles.segmentBtnActive]}
          onPress={() => setSegment('earnings')}
        >
          <Ionicons
            name="cash-outline"
            size={14}
            color={segment === 'earnings' ? C.accent : C.labelMid}
          />
          <Text style={[styles.segmentText, segment === 'earnings' && styles.segmentTextActive]}>
            Earnings
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {segment === 'blueprints' ? (
        <BlueprintsContent blueprints={blueprints} stats={bpStats} router={router} />
      ) : (
        <EarningsContent
          loading={earningsLoading}
          connectStatus={connectStatus}
          balance={balance}
          summary={summary}
          payouts={payouts}
          payoutLoading={payoutLoading}
          onRequestPayout={handleRequestPayout}
          onOpenDashboard={handleOpenStripeDashboard}
        />
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Blueprints tab content
// ---------------------------------------------------------------------------

function BlueprintsContent({
  blueprints,
  stats,
  router,
}: {
  blueprints: BlueprintRecord[] | undefined;
  stats: { total: number; published: number; subscribers: number };
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      {/* Quick Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: C.accent }]}>{stats.published}</Text>
          <Text style={styles.statLabel}>Published</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: C.blue }]}>{stats.subscribers}</Text>
          <Text style={styles.statLabel}>Subscribers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Blueprint list */}
      {(!blueprints || blueprints.length === 0) ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={40} color={C.labelLight} />
          <Text style={styles.emptyTitle}>No blueprints yet</Text>
          <Text style={styles.emptySubtitle}>
            Publish a blueprint from your timeline to start sharing and selling your work.
          </Text>
        </View>
      ) : (
        <View style={styles.blueprintList}>
          {blueprints.map((bp) => {
            const badge = accessBadgeColor(bp.access_level);
            return (
              <View key={bp.id} style={styles.bpCard}>
                <Pressable
                  style={styles.bpCardMain}
                  onPress={() => router.push(`/creator/${bp.id}` as any)}
                >
                  <View style={styles.bpCardHeader}>
                    <Text style={styles.bpTitle} numberOfLines={1}>{bp.title}</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.labelLight} />
                  </View>
                  <View style={styles.bpBadgeRow}>
                    <View style={[styles.badge, bp.is_published ? styles.badgePublished : styles.badgeDraft]}>
                      <View style={[styles.badgeDot, { backgroundColor: bp.is_published ? C.green : C.labelLight }]} />
                      <Text style={[styles.badgeText, { color: bp.is_published ? C.green : C.labelMid }]}>
                        {bp.is_published ? 'Published' : 'Draft'}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>
                        {formatPrice(bp)}
                      </Text>
                    </View>
                    <View style={styles.subCount}>
                      <Ionicons name="people-outline" size={12} color={C.labelMid} />
                      <Text style={styles.subCountText}>{bp.subscriber_count || 0}</Text>
                    </View>
                  </View>
                </Pressable>
                <View style={styles.bpActions}>
                  <Pressable
                    style={styles.bpActionBtn}
                    onPress={() => router.push(`/blueprint/${bp.slug}` as any)}
                  >
                    <Ionicons name="eye-outline" size={14} color={C.accent} />
                    <Text style={styles.bpActionText}>View</Text>
                  </Pressable>
                  <View style={styles.bpActionDivider} />
                  <Pressable
                    style={styles.bpActionBtn}
                    onPress={() => router.push(`/creator/${bp.id}` as any)}
                  >
                    <Ionicons name="people-outline" size={14} color={C.accent} />
                    <Text style={styles.bpActionText}>Subscribers</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Earnings tab content
// ---------------------------------------------------------------------------

function EarningsContent({
  loading,
  connectStatus,
  balance,
  summary,
  payouts,
  payoutLoading,
  onRequestPayout,
  onOpenDashboard,
}: {
  loading: boolean;
  connectStatus: StripeConnectStatus | null;
  balance: { available: number; pending: number; currency: string } | null;
  summary: EarningsSummary | null;
  payouts: PayoutHistoryItem[];
  payoutLoading: boolean;
  onRequestPayout: () => void;
  onOpenDashboard: () => void;
}) {
  if (loading) {
    return (
      <View style={[styles.emptyState, { paddingVertical: 40 }]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  if (!connectStatus?.connected) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="card-outline" size={40} color={C.labelLight} />
        <Text style={styles.emptyTitle}>No Stripe Account</Text>
        <Text style={styles.emptySubtitle}>
          Connect your Stripe account to start receiving payments from blueprint sales.
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* Balance card */}
      {balance && (
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>Available</Text>
              <Text style={styles.balanceAmount}>{formatAmount(balance.available)}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>Pending</Text>
              <Text style={[styles.balanceAmount, { color: C.yellow }]}>{formatAmount(balance.pending)}</Text>
            </View>
          </View>
          {balance.available > 0 && (
            <Pressable
              style={[styles.payoutBtn, payoutLoading && { opacity: 0.6 }]}
              onPress={onRequestPayout}
              disabled={payoutLoading}
            >
              {payoutLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="arrow-forward-circle-outline" size={16} color="#FFFFFF" />
              )}
              <Text style={styles.payoutBtnText}>
                {payoutLoading ? 'Requesting...' : 'Request Payout'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Summary stats */}
      {summary && (
        <View style={styles.earningsStatsGrid}>
          <View style={styles.earningsStatCard}>
            <Text style={styles.statValue}>{summary.totalSales}</Text>
            <Text style={styles.statLabel}>Total Sales</Text>
          </View>
          <View style={styles.earningsStatCard}>
            <Text style={styles.statValue}>{summary.activeSubscribers}</Text>
            <Text style={styles.statLabel}>Active Subs</Text>
          </View>
          <View style={styles.earningsStatCard}>
            <Text style={[styles.statValue, { color: C.green }]}>{formatAmount(summary.netEarnings)}</Text>
            <Text style={styles.statLabel}>Net Earnings</Text>
          </View>
          <View style={styles.earningsStatCard}>
            <Text style={[styles.statValue, { color: C.labelMid }]}>{formatAmount(summary.platformFees)}</Text>
            <Text style={styles.statLabel}>Fees (15%)</Text>
          </View>
        </View>
      )}

      {/* Payout history */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payout History</Text>
        {payouts.length === 0 ? (
          <Text style={styles.emptyRow}>No payouts yet</Text>
        ) : (
          payouts.map((payout) => {
            const statusStyle = getPayoutStatusStyle(payout.status);
            return (
              <View key={payout.id} style={styles.payoutRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutAmountText}>{formatAmount(payout.amount)}</Text>
                  <Text style={styles.payoutDate}>
                    {new Date(payout.arrival_date * 1000).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.statusPillText, { color: statusStyle.color }]}>
                    {payout.status}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Stripe dashboard link */}
      <Pressable style={styles.dashboardLink} onPress={onOpenDashboard}>
        <Ionicons name="open-outline" size={14} color={C.accent} />
        <Text style={styles.dashboardLinkText}>Open Full Stripe Dashboard</Text>
      </Pressable>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: C.labelMid,
    marginTop: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.labelDark,
    flex: 1,
    textAlign: 'center',
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Segmented control
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: C.bg,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } as any,
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.labelMid,
  },
  segmentTextActive: {
    color: C.accent,
  },

  // Blueprint stats
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    gap: 2,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: C.labelDark,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Blueprint list
  blueprintList: {
    marginTop: 16,
    gap: 12,
  },
  bpCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bpCardMain: {
    padding: 14,
    gap: 8,
  },
  bpCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bpTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: C.labelDark,
  },
  bpBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePublished: { backgroundColor: C.greenBg },
  badgeDraft: { backgroundColor: '#F1F1EF' },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto' as any,
  },
  subCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.labelMid,
  },
  bpActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  bpActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
  },
  bpActionDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },
  bpActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.accent,
  },

  // Empty / loading states
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.labelDark,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.labelMid,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Earnings: balance card
  balanceCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 20,
    gap: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: C.border,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: C.green,
  },
  payoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
  },
  payoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Earnings: stats grid
  earningsStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  earningsStatCard: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },

  // Earnings: payout history
  section: {
    marginTop: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.labelDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  emptyRow: {
    fontSize: 13,
    color: C.labelLight,
    paddingVertical: 12,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  payoutAmountText: {
    fontSize: 15,
    fontWeight: '600',
    color: C.labelDark,
  },
  payoutDate: {
    fontSize: 12,
    color: C.labelMid,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  dashboardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
  },
  dashboardLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },
});
