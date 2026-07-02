import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCoachWorkspace } from '@/hooks/useCoachWorkspace';
import { useCoachEarningsSummary } from '@/hooks/useCoachData';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { StripeConnectService, type StripeConnectStatus, type PayoutResult, type PayoutHistoryItem } from '@/services/StripeConnectService';

type PeriodKey = 'week' | 'month' | 'year';

const periodLabels: Record<PeriodKey, string> = {
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
};

const sessionTypeLabels: Record<string, string> = {
  on_water: 'On-Water',
  video_review: 'Video Review',
  strategy_session: 'Strategy Session',
  race_support: 'Race Support',
  boat_setup: 'Boat Setup',
  fitness: 'Fitness',
};

const toTitleCase = (value: string) => value.replace(/\b\w/g, (char: string) => char.toUpperCase());

const getStatusPillStyle = (status: string) => {
  switch (status) {
    case 'pending':
      return { backgroundColor: '#FEF3C7', color: '#92400E' };
    case 'paid':
      return { backgroundColor: '#DCFCE7', color: '#166534' };
    case 'in_transit':
      return { backgroundColor: '#DBEAFE', color: '#1E40AF' };
    case 'refunded':
      return { backgroundColor: '#FEE2E2', color: '#991B1B' };
    case 'failed':
      return { backgroundColor: '#FEE2E2', color: '#991B1B' };
    case 'requires_action':
      return { backgroundColor: '#FDE68A', color: '#92400E' };
    default:
      return { backgroundColor: '#E2E8F0', color: '#1E293B' };
  }
};

const formatCurrency = (amount: number, currency: string = 'USD') => {
  const dollars = amount / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(dollars);
  } catch {
    return `$${dollars.toFixed(2)}`;
  }
};

const formatDate = (value?: string | number | null) => {
  if (!value) return 'TBD';
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const formatPercentChange = (current: number, previous: number) => {
  if (previous <= 0) return null;
  const delta = ((current - previous) / previous) * 100;
  return delta;
};

type ShadowStyle = ViewStyle & { boxShadow?: string };

const createShadowStyle = ({
  webShadow,
  ios,
  androidElevation = 0,
}: {
  webShadow: string;
  ios: {
    color: string;
    opacity: number;
    radius: number;
    offset: { width: number; height: number };
  };
  androidElevation?: number;
}): ShadowStyle => {
  const style: ShadowStyle = {};

  if (Platform.OS === 'web') {
    style.boxShadow = webShadow;
    return style;
  }

  if (Platform.OS === 'ios') {
    style.shadowColor = ios.color;
    style.shadowOpacity = ios.opacity;
    style.shadowRadius = ios.radius;
    style.shadowOffset = ios.offset;
    return style;
  }

  if (Platform.OS === 'android' && androidElevation) {
    style.elevation = androidElevation;
  }

  return style;
};

const summaryCardShadow = createShadowStyle({
  webShadow: '0px 10px 20px rgba(15, 23, 42, 0.08)',
  ios: {
    color: '#0f172a',
    opacity: 0.08,
    radius: 20,
    offset: { width: 0, height: 10 },
  },
  androidElevation: 4,
});

const quickStatCardShadow = createShadowStyle({
  webShadow: '0px 6px 12px rgba(15, 23, 42, 0.05)',
  ios: {
    color: '#0f172a',
    opacity: 0.03,
    radius: 12,
    offset: { width: 0, height: 6 },
  },
  androidElevation: 2,
});

export default function EarningsScreen() {
  const router = useRouter();
  const { coachId, loading: personaLoading, refresh: refreshPersonaContext } = useCoachWorkspace();
  const earningsQuery = useCoachEarningsSummary();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('month');

  // Stripe state
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeStatusLoading, setStripeStatusLoading] = useState(true);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [balanceCurrency, setBalanceCurrency] = useState('usd');
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceUnavailable, setBalanceUnavailable] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistoryItem[]>([]);
  const [payoutHistoryLoading, setPayoutHistoryLoading] = useState(true);
  const [payoutInProgress, setPayoutInProgress] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const summary = earningsQuery.data;
  const isLoading = personaLoading || (!summary && (earningsQuery.isLoading || earningsQuery.isFetching));
  const isConnected = !!coachId;

  const isStripeReady = stripeStatus?.connected &&
    stripeStatus?.detailsSubmitted &&
    stripeStatus?.payoutsEnabled;

  // Load Stripe status, balance, and payout history
  const loadStripeData = useCallback(async () => {
    if (!coachId) return;

    setStripeStatusLoading(true);
    setBalanceLoading(true);
    setPayoutHistoryLoading(true);
    setBalanceUnavailable(false);

    try {
      const [status, history] = await Promise.all([
        StripeConnectService.getConnectStatus(coachId),
        StripeConnectService.getPayoutHistory(coachId),
      ]);

      setStripeStatus(status);
      setPayoutHistory(history);

      // BUG 3: Handle balance fetch separately so 503 errors show "unavailable" UI
      try {
        const balance = await StripeConnectService.getAvailableBalance(coachId);
        setAvailableBalance(balance.available);
        setPendingBalance(balance.pending);
        setBalanceCurrency(balance.currency);
      } catch (balanceError) {
        console.error('Balance unavailable:', balanceError);
        setBalanceUnavailable(true);
      }
    } catch (error) {
      console.error('Error loading Stripe data:', error);
    } finally {
      setStripeStatusLoading(false);
      setBalanceLoading(false);
      setPayoutHistoryLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    if (coachId) {
      loadStripeData();
    }
  }, [coachId, loadStripeData]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      earningsQuery.refetch(),
      loadStripeData(),
    ]);
  }, [earningsQuery, loadStripeData]);

  const handleRequestPayout = useCallback(() => {
    if (!coachId || availableBalance <= 0) return;

    const amountFormatted = formatCurrency(availableBalance, balanceCurrency);

    showConfirm(
      'Request Payout',
      `Transfer ${amountFormatted} to your bank account? Funds typically arrive within 2 business days.`,
      async () => {
        setPayoutInProgress(true);
        try {
          const result: PayoutResult = await StripeConnectService.requestPayout(coachId);

          if (result.success) {
            const arrival = result.estimated_arrival
              ? formatDate(result.estimated_arrival)
              : 'within 2 business days';
            showAlert(
              'Payout initiated',
              `${formatCurrency(result.amount || 0, result.currency || balanceCurrency)} is on its way. Estimated arrival: ${arrival}.`
            );
            // Refresh data to show updated balance and payout history
            await loadStripeData();
          } else {
            if (result.code === 'payout_in_progress' && result.existing_payout) {
              showAlert(
                'Payout already in progress',
                `A payout of ${formatCurrency(result.existing_payout.amount, result.existing_payout.currency)} is already being processed.`
              );
            } else if (result.code === 'insufficient_balance') {
              showAlert('No funds available', result.error || 'No funds available for payout.');
            } else if (result.code === 'account_restricted') {
              showAlert(
                'Account restricted',
                'Your Stripe account has restrictions. Please visit your Stripe dashboard to resolve any issues.'
              );
            } else {
              showAlert('Payout failed', result.error || 'Unable to process payout. Please try again.');
            }
          }
        } catch (error: any) {
          showAlert('Error', error.message || 'An unexpected error occurred.');
        } finally {
          setPayoutInProgress(false);
        }
      },
      { confirmText: 'Confirm Payout' }
    );
  }, [coachId, availableBalance, balanceCurrency, loadStripeData]);

  const handleStartOnboarding = useCallback(async () => {
    if (!coachId) return;
    setOnboardingLoading(true);
    try {
      const result = await StripeConnectService.startOnboarding(coachId);
      if (result.success && result.url) {
        if (Platform.OS === 'web') {
          window.location.href = result.url;
        } else {
          await Linking.openURL(result.url);
        }
      } else {
        showAlert('Error', result.error || 'Failed to start Stripe setup.');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to start Stripe setup.');
    } finally {
      setOnboardingLoading(false);
    }
  }, [coachId]);

  const handleOpenStripeDashboard = useCallback(async () => {
    if (!coachId) return;
    try {
      const result = await StripeConnectService.getDashboardLink(coachId);
      if (result.success && result.url) {
        if (typeof window !== 'undefined') {
          window.open(result.url, '_blank');
        } else {
          await Linking.openURL(result.url);
        }
      } else {
        showAlert('Error', result.error || 'Failed to open Stripe dashboard.');
      }
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to open Stripe dashboard.');
    }
  }, [coachId]);

  const changeStats = useMemo(() => {
    if (!summary) return { current: 0, previous: 0, sessions: 0, average: 0 };
    const periodData = summary.period[selectedPeriod];
    return {
      current: periodData.current.total,
      previous: periodData.previous.total,
      sessions: periodData.current.sessions,
      average: periodData.current.averagePerSession,
    };
  }, [selectedPeriod, summary]);

  const changePercent = formatPercentChange(changeStats.current, changeStats.previous);
  const defaultCurrency = summary?.transactions[0]?.currency || balanceCurrency || 'USD';

  const breakdownEntries = useMemo(() => {
    if (!summary) return [] as { label: string; value: number }[];
    const entries = Object.entries(summary.breakdown || {})
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({
        label: sessionTypeLabels[key] || toTitleCase(key.replace(/_/g, ' ')),
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
    return entries;
  }, [summary]);

  const renderConnectState = () => (
    <View style={styles.missingContainer}>
      <Ionicons name="wallet-outline" size={48} color="#94A3B8" />
      <ThemedText style={styles.missingTitle}>Connect Your Coach Workspace</ThemedText>
      <ThemedText style={styles.missingDescription}>
        Earnings unlock after we confirm your coach profile. Refresh the connection or finish onboarding to continue.
      </ThemedText>
      <TouchableOpacity style={styles.retryButton} onPress={refreshPersonaContext}>
        <ThemedText style={styles.retryButtonText}>Retry Connection</ThemedText>
      </TouchableOpacity>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle" size={40} color="#EF4444" />
      <ThemedText style={styles.errorTitle}>Unable to load earnings</ThemedText>
      <ThemedText style={styles.errorDescription}>
        {earningsQuery.error instanceof Error ? earningsQuery.error.message : 'Please try again in a moment.'}
      </ThemedText>
      <TouchableOpacity style={styles.retryButton} onPress={() => earningsQuery.refetch()}>
        <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
      </TouchableOpacity>
    </View>
  );

  const renderStripeSetupBanner = () => {
    if (stripeStatusLoading) return null;
    if (isStripeReady) return null;

    const needsFullSetup = !stripeStatus?.connected || stripeStatus?.needsOnboarding;
    const needsCompletion = stripeStatus?.connected && !stripeStatus?.payoutsEnabled;

    return (
      <View style={[styles.stripeBanner, needsCompletion && styles.stripeBannerWarning]}>
        <View style={[styles.stripeBannerIcon, needsCompletion && styles.stripeBannerIconWarning]}>
          <Ionicons
            name={needsFullSetup ? 'card-outline' : 'alert-circle-outline'}
            size={24}
            color={needsFullSetup ? '#2563EB' : '#92400E'}
          />
        </View>
        <View style={styles.stripeBannerContent}>
          <ThemedText style={styles.stripeBannerTitle}>
            {needsFullSetup ? 'Set up payouts to receive your earnings' : 'Complete your payout setup'}
          </ThemedText>
          <ThemedText style={styles.stripeBannerDescription}>
            {needsFullSetup
              ? 'Connect your bank account through Stripe to start receiving payouts for your coaching sessions.'
              : 'Your Stripe account needs additional information before payouts can be enabled.'}
          </ThemedText>
        </View>
        <TouchableOpacity
          style={[styles.stripeBannerButton, needsCompletion && styles.stripeBannerButtonWarning]}
          onPress={handleStartOnboarding}
          disabled={onboardingLoading}
        >
          {onboardingLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.stripeBannerButtonText}>
              {needsFullSetup ? 'Set Up' : 'Complete Setup'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderPayoutSection = () => {
    if (!isStripeReady) return null;

    return (
      <View style={styles.payoutCard}>
        <View style={styles.payoutCardHeader}>
          <View>
            <ThemedText style={styles.payoutLabel}>Available for payout</ThemedText>
            {balanceLoading ? (
              <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 8 }} />
            ) : balanceUnavailable ? (
              <ThemedText style={styles.balanceUnavailableText}>
                Balance temporarily unavailable
              </ThemedText>
            ) : (
              <ThemedText style={styles.payoutAmount}>
                {formatCurrency(availableBalance, balanceCurrency)}
              </ThemedText>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.payoutButton,
              (availableBalance <= 0 || payoutInProgress || balanceLoading || balanceUnavailable) && styles.payoutButtonDisabled,
            ]}
            onPress={handleRequestPayout}
            disabled={availableBalance <= 0 || payoutInProgress || balanceLoading || balanceUnavailable}
          >
            {payoutInProgress ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cash-outline" size={18} color="#fff" />
                <ThemedText style={styles.payoutButtonText}>Request Payout</ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Pending balance info */}
        {!balanceLoading && pendingBalance > 0 && availableBalance <= 0 && (
          <View style={styles.pendingNotice}>
            <Ionicons name="time-outline" size={16} color="#92400E" />
            <ThemedText style={styles.pendingNoticeText}>
              {formatCurrency(pendingBalance, balanceCurrency)} pending — funds become available after Stripe's standard holding period
            </ThemedText>
          </View>
        )}

        {/* No funds message */}
        {!balanceLoading && availableBalance <= 0 && pendingBalance <= 0 && (
          <View style={styles.noFundsNotice}>
            <ThemedText style={styles.noFundsText}>No funds available for payout</ThemedText>
          </View>
        )}

        {/* Stripe dashboard link */}
        <TouchableOpacity style={styles.stripeDashboardLink} onPress={handleOpenStripeDashboard}>
          <Ionicons name="open-outline" size={14} color="#6366F1" />
          <ThemedText style={styles.stripeDashboardLinkText}>Open Stripe Dashboard</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPayoutHistory = () => {
    if (!isStripeReady) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <ThemedText style={styles.sectionTitle}>Payout history</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>Recent bank transfers</ThemedText>
          </View>
        </View>
        {payoutHistoryLoading ? (
          <ActivityIndicator size="small" color="#94A3B8" style={{ marginTop: 8 }} />
        ) : payoutHistory.length === 0 ? (
          <ThemedText style={styles.emptyText}>No payouts yet</ThemedText>
        ) : (
          payoutHistory.map((payout) => {
            const pill = getStatusPillStyle(payout.status);
            return (
              <View key={payout.id} style={styles.transactionRow}>
                <View style={styles.payoutHistoryIcon}>
                  <Ionicons
                    name={payout.status === 'paid' ? 'checkmark-circle-outline' : 'arrow-forward-circle-outline'}
                    size={18}
                    color={payout.status === 'paid' ? '#16A34A' : '#2563EB'}
                  />
                </View>
                <View style={styles.transactionContent}>
                  <ThemedText style={styles.transactionTitle}>
                    {payout.description || 'Bank transfer'}
                  </ThemedText>
                  <ThemedText style={styles.transactionSubtitle}>
                    {payout.arrival_date ? `Arrives ${formatDate(payout.arrival_date)}` : `Created ${formatDate(payout.created)}`}
                  </ThemedText>
                </View>
                <View style={styles.transactionMeta}>
                  <ThemedText style={styles.transactionAmount}>
                    {formatCurrency(payout.amount, payout.currency || defaultCurrency)}
                  </ThemedText>
                </View>
                <View style={[styles.statusPillBase, { backgroundColor: pill.backgroundColor }]}>
                  <ThemedText style={[styles.statusPillLabel, { color: pill.color }]}>
                    {payout.status.replace(/_/g, ' ')}
                  </ThemedText>
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  };

  if (!isConnected && !personaLoading) {
    return <ThemedView style={styles.container}>{renderConnectState()}</ThemedView>;
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading earnings...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (earningsQuery.isError) {
    return <ThemedView style={styles.container}>{renderErrorState()}</ThemedView>;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={earningsQuery.isRefetching} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <View>
            <ThemedText style={styles.title}>Earnings</ThemedText>
            <ThemedText style={styles.subtitle}>Track payouts, income, and recent sessions</ThemedText>
          </View>
        </View>

        {/* Stripe Setup Banner (for coaches who haven't set up or completed Stripe) */}
        {renderStripeSetupBanner()}

        {/* Payout Section (only when Stripe is fully set up) */}
        {renderPayoutSection()}

        <View style={styles.periodSelector}>
          {(Object.keys(periodLabels) as PeriodKey[]).map(period => (
            <TouchableOpacity
              key={period}
              style={[styles.periodButton, selectedPeriod === period && styles.periodButtonActive]}
              onPress={() => setSelectedPeriod(period)}
            >
              <ThemedText
                style={[styles.periodButtonText, selectedPeriod === period && styles.periodButtonTextActive]}
              >
                {periodLabels[period]}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {summary && (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <View>
                  <ThemedText style={styles.summaryLabel}>Earnings {periodLabels[selectedPeriod].toLowerCase()}</ThemedText>
                  <ThemedText style={styles.summaryValue}>
                    {formatCurrency(changeStats.current, defaultCurrency)}
                  </ThemedText>
                </View>
                <View style={styles.summaryIcon}>
                  <Ionicons name="trending-up" size={22} color="#10B981" />
                </View>
              </View>
              <View style={styles.summaryMetaRow}>
                <View>
                  <ThemedText style={styles.summaryMetaLabel}>Sessions</ThemedText>
                  <ThemedText style={styles.summaryMetaValue}>{changeStats.sessions}</ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.summaryMetaLabel}>Avg / session</ThemedText>
                  <ThemedText style={styles.summaryMetaValue}>
                    {formatCurrency(changeStats.average, defaultCurrency)}
                  </ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.summaryMetaLabel}>Change</ThemedText>
                  <ThemedText
                    style={[
                      styles.trendValue,
                      changePercent === null
                        ? styles.trendNeutral
                        : changePercent >= 0
                        ? styles.trendPositive
                        : styles.trendNegative,
                    ]}
                  >
                    {changePercent === null ? '—' : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.quickStatsContainer}>
              <View style={styles.quickStatCard}>
                <Ionicons name="hourglass-outline" size={18} color="#F97316" />
                <ThemedText style={styles.quickStatLabel}>Pending payouts</ThemedText>
                <ThemedText style={styles.quickStatValue}>
                  {formatCurrency(summary.totals.pendingPayouts, defaultCurrency)}
                </ThemedText>
              </View>
              <View style={styles.quickStatCard}>
                <Ionicons name="wallet-outline" size={18} color="#0EA5E9" />
                <ThemedText style={styles.quickStatLabel}>Lifetime</ThemedText>
                <ThemedText style={styles.quickStatValue}>
                  {formatCurrency(summary.totals.lifetime, defaultCurrency)}
                </ThemedText>
              </View>
              <View style={styles.quickStatCard}>
                <Ionicons name="people-outline" size={18} color="#10B981" />
                <ThemedText style={styles.quickStatLabel}>Sessions</ThemedText>
                <ThemedText style={styles.quickStatValue}>{summary.totals.sessions}</ThemedText>
              </View>
            </View>

            {/* Manage Pricing Link */}
            <TouchableOpacity
              style={styles.managePricingCard}
              onPress={() => router.push('/coach/pricing')}
            >
              <View style={styles.managePricingContent}>
                <View style={styles.managePricingIcon}>
                  <Ionicons name="pricetag-outline" size={20} color="#007AFF" />
                </View>
                <View style={styles.managePricingText}>
                  <ThemedText style={styles.managePricingTitle}>Manage Pricing</ThemedText>
                  <ThemedText style={styles.managePricingSubtitle}>
                    Update rates, custom charges, and packages
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </TouchableOpacity>

            <View style={styles.breakdownCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <ThemedText style={styles.sectionTitle}>Revenue breakdown</ThemedText>
                  <ThemedText style={styles.sectionSubtitle}>Top services driving payouts</ThemedText>
                </View>
              </View>
              {breakdownEntries.length === 0 ? (
                <ThemedText style={styles.emptyText}>No paid sessions yet</ThemedText>
              ) : (
                breakdownEntries.map((entry, index) => {
                  const maxValue = breakdownEntries[0]?.value || 1;
                  const widthPercent = maxValue > 0 ? Math.min(100, (entry.value / maxValue) * 100) : 0;
                  return (
                    <View key={`${entry.label}-${index}`} style={styles.breakdownRow}>
                      <View style={styles.breakdownRowHeader}>
                        <ThemedText style={styles.breakdownLabel}>{entry.label}</ThemedText>
                        <ThemedText style={styles.breakdownValue}>
                          {formatCurrency(entry.value, defaultCurrency)}
                        </ThemedText>
                      </View>
                      <View style={styles.breakdownBarTrack}>
                        <View
                          style={[styles.breakdownBar, { width: `${widthPercent}%` }]}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Payout History */}
            {renderPayoutHistory()}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <ThemedText style={styles.sectionTitle}>Pending payouts</ThemedText>
                  <ThemedText style={styles.sectionSubtitle}>
                    Next transfer ETA {formatDate(summary.totals.nextPayoutDate)}
                  </ThemedText>
                </View>
              </View>
              {summary.pendingTransactions.length === 0 ? (
                <ThemedText style={styles.emptyText}>Nothing waiting on payouts right now.</ThemedText>
              ) : (
                summary.pendingTransactions.map(txn => (
                  <View key={txn.id} style={styles.transactionRow}>
                    <View style={styles.transactionIconPending}>
                      <Ionicons name="time-outline" size={18} color="#F97316" />
                    </View>
                    <View style={styles.transactionContent}>
                      <ThemedText style={styles.transactionTitle}>{txn.clientName}</ThemedText>
                      <ThemedText style={styles.transactionSubtitle}>{txn.sessionType}</ThemedText>
                    </View>
                    <View style={styles.transactionMeta}>
                      <ThemedText style={styles.transactionAmount}>
                        {formatCurrency(txn.amount, txn.currency || defaultCurrency)}
                      </ThemedText>
                      <ThemedText style={styles.transactionDate}>Payout {formatDate(txn.payoutDate)}</ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <ThemedText style={styles.sectionTitle}>Recent transactions</ThemedText>
                  <ThemedText style={styles.sectionSubtitle}>Latest 30 coaching sessions</ThemedText>
                </View>
              </View>
              {summary.transactions.length === 0 ? (
                <ThemedText style={styles.emptyText}>No transactions yet.</ThemedText>
              ) : (
                summary.transactions.map(txn => {
                  const pill = getStatusPillStyle(txn.status);
                  return (
                    <View key={txn.id} style={styles.transactionRow}>
                      <View style={styles.transactionIcon}>
                        <Ionicons name="receipt-outline" size={18} color="#007AFF" />
                      </View>
                      <View style={styles.transactionContent}>
                        <ThemedText style={styles.transactionTitle}>{txn.clientName}</ThemedText>
                        <ThemedText style={styles.transactionSubtitle}>{txn.sessionType}</ThemedText>
                      </View>
                      <View style={styles.transactionMeta}>
                        <ThemedText style={styles.transactionAmount}>
                          {formatCurrency(txn.amount, txn.currency || defaultCurrency)}
                        </ThemedText>
                        <ThemedText style={styles.transactionDate}>{formatDate(txn.date)}</ThemedText>
                      </View>
                      <View style={[styles.statusPillBase, { backgroundColor: pill.backgroundColor }]}>
                        <ThemedText style={[styles.statusPillLabel, { color: pill.color }]}>
                          {txn.status.replace(/_/g, ' ')}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  periodButtonText: {
    fontWeight: '600',
    color: '#475569',
  },
  periodButtonTextActive: {
    color: '#4338CA',
  },
  summaryCard: {
    margin: 16,
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    ...summaryCardShadow,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111827',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryMetaLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  summaryMetaValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 4,
  },
  trendValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
  },
  trendPositive: {
    color: '#16A34A',
  },
  trendNegative: {
    color: '#DC2626',
  },
  trendNeutral: {
    color: '#94A3B8',
  },
  quickStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 6,
    ...quickStatCardShadow,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#475569',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  breakdownCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  breakdownRow: {
    marginTop: 12,
  },
  breakdownRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  breakdownBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  breakdownBar: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#6366F1',
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionIconPending: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutHistoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionContent: {
    flex: 1,
  },
  transactionMeta: {
    alignItems: 'flex-end',
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  transactionSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  transactionDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
  },
  missingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  missingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
  },
  missingDescription: {
    fontSize: 14,
    textAlign: 'center',
    color: '#94A3B8',
  },
  retryButton: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  errorDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  statusPillBase: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#0F172A',
  },
  // Manage Pricing Card
  managePricingCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5F1FF',
  },
  managePricingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  managePricingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E5F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  managePricingText: {
    gap: 2,
  },
  managePricingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  managePricingSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  // Stripe Setup Banner
  stripeBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  // BUG 11: Amber/warning variant for incomplete Stripe setup
  stripeBannerWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  stripeBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeBannerIconWarning: {
    backgroundColor: '#FEF3C7',
  },
  stripeBannerContent: {
    flex: 1,
    gap: 4,
  },
  stripeBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  stripeBannerDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  stripeBannerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 80,
    alignItems: 'center',
  },
  stripeBannerButtonWarning: {
    backgroundColor: '#F59E0B',
  },
  stripeBannerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Payout Card
  payoutCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    ...summaryCardShadow,
  },
  payoutCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payoutLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  payoutAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  // BUG 3: Style for when balance is temporarily unavailable
  balanceUnavailableText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 4,
    fontStyle: 'italic',
  },
  payoutButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    gap: 6,
  },
  payoutButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  payoutButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
  },
  pendingNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  noFundsNotice: {
    marginTop: 12,
  },
  noFundsText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  stripeDashboardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  stripeDashboardLinkText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
});
