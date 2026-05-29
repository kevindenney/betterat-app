/**
 * /outcomes — the per-vertical hero-metric dashboard for entrepreneurial
 * plans (Wave 2, SHG / Pitroda demo). Shows the member their monthly
 * earnings run-rate against a savings goal, a weekly revenue trend, and
 * the customer/repeat counts behind it.
 *
 * Reads business_outcomes for the current user (or ?userId= for a portfolio
 * cross-link). RLS enforces access.
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useAuth } from '@/providers/AuthProvider';
import {
  useBusinessOutcomes,
  type BusinessOutcome,
} from '@/hooks/useBusinessOutcomes';

const MONTHLY_GOAL_MINOR = 1_000_000; // ₹10,000 — Savitri's demo savings goal
const ACCENT = '#BE185D';

export default function OutcomesScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const { user } = useAuth();
  const targetUserId =
    typeof params.userId === 'string' ? params.userId : user?.id ?? null;

  const { data, isLoading, error } = useBusinessOutcomes(targetUserId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, title: 'Outcomes' }} />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        <Text style={styles.topBarTitle}>Business outcomes</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? <LoadingState /> : null}
        {!isLoading && error ? <ErrorState /> : null}
        {!isLoading && !error && (!data || data.length === 0) ? (
          <EmptyState />
        ) : null}
        {!isLoading && !error && data && data.length > 0 ? (
          <OutcomesContent outcomes={data} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function OutcomesContent({ outcomes }: { outcomes: BusinessOutcome[] }) {
  const currency = outcomes[outcomes.length - 1]?.currency ?? 'INR';

  const monthlyMinor = useMemo(
    () =>
      outcomes
        .slice(-4)
        .reduce((sum, o) => sum + o.revenueMinor, 0),
    [outcomes],
  );

  const latest = outcomes[outcomes.length - 1];
  const goalPct = Math.min(
    100,
    Math.round((monthlyMinor / MONTHLY_GOAL_MINOR) * 100),
  );
  const goalReached = monthlyMinor >= MONTHLY_GOAL_MINOR;

  const repeatRate =
    latest.customerCount > 0
      ? Math.round((latest.repeatCount / latest.customerCount) * 100)
      : 0;

  return (
    <View>
      {/* Hero: monthly run-rate vs goal */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Earnings this month</Text>
        <Text style={styles.heroValue}>{formatMoney(monthlyMinor, currency)}</Text>
        <Text style={styles.heroSub}>
          of {formatMoney(MONTHLY_GOAL_MINOR, currency)} monthly goal
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${goalPct}%` }]} />
        </View>
        <View style={styles.goalRow}>
          {goalReached ? (
            <Ionicons name="checkmark-circle" size={14} color={ACCENT} />
          ) : null}
          <Text style={styles.goalText}>
            {goalReached
              ? 'Savings goal reached this month'
              : `${goalPct}% of goal`}
          </Text>
        </View>
      </View>

      {/* Weekly revenue trend */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly earnings</Text>
        <RevenueTrend outcomes={outcomes} currency={currency} />
      </View>

      {/* Latest-week stat tiles */}
      <View style={styles.statRow}>
        <StatTile
          label="Sold this week"
          value={String(latest.unitsSold)}
          icon="cube-outline"
        />
        <StatTile
          label="Customers"
          value={String(latest.customerCount)}
          icon="people-outline"
        />
        <StatTile
          label="Repeat buyers"
          value={`${repeatRate}%`}
          icon="repeat-outline"
        />
      </View>
    </View>
  );
}

function RevenueTrend({
  outcomes,
  currency,
}: {
  outcomes: BusinessOutcome[];
  currency: string;
}) {
  const width = Dimensions.get('window').width - 40;
  // Cap to the most recent 8 weeks so labels stay legible.
  const recent = outcomes.slice(-8);
  const rupees = recent.map((o) => o.revenueMinor / 100);
  const labels = recent.map((o) => formatWeekLabel(o.weekStart));

  return (
    <LineChart
      data={{ labels, datasets: [{ data: rupees }] }}
      width={width}
      height={200}
      yAxisLabel={currencySymbol(currency)}
      withInnerLines={false}
      chartConfig={{
        backgroundColor: '#FFFFFF',
        backgroundGradientFrom: '#FFFFFF',
        backgroundGradientTo: '#FFFFFF',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(190, 24, 93, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
        style: { borderRadius: 16 },
        propsForDots: { r: '4', strokeWidth: '2', stroke: ACCENT },
      }}
      bezier
      style={styles.chart}
    />
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={18} color={ACCENT} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="small" color="#64748B" />
      <Text style={styles.centerText}>Loading outcomes…</Text>
    </View>
  );
}

function ErrorState() {
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={28} color="#94A3B8" />
      <Text style={styles.centerText}>Couldn’t load outcomes right now.</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.center}>
      <Ionicons name="trending-up-outline" size={28} color="#94A3B8" />
      <Text style={styles.centerTitle}>No outcomes logged yet</Text>
      <Text style={styles.centerText}>
        Weekly earnings will show here as you record them.
      </Text>
    </View>
  );
}

function currencySymbol(currency: string): string {
  switch (currency) {
    case 'INR':
      return '₹';
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return '';
  }
}

function formatMoney(minor: number, currency: string): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${currencySymbol(currency)}${Math.round(major).toLocaleString()}`;
  }
}

function formatWeekLabel(weekStart: string): string {
  // weekStart is a YYYY-MM-DD date; show "DD/MM" to keep axis labels tight.
  const [, month, day] = weekStart.split('-');
  return `${day}/${month}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backButton: { padding: 6 },
  topBarTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginLeft: 4 },
  topBarSpacer: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 },
  centerTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
  centerText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F1E4EC',
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroValue: { fontSize: 34, fontWeight: '800', color: '#0F172A', marginTop: 6 },
  heroSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F1E4EC',
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: ACCENT },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  goalText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  chart: { borderRadius: 16, marginLeft: -8 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  statTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#64748B', textAlign: 'center' },
});
