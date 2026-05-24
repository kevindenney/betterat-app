/**
 * useStudioPayouts
 *
 * Data shape for Creator Studio · Payouts (Frame 6 — independent author).
 * Active subscribers + per-blueprint earnings come from real
 * marketplace_subscriptions data via useAuthorMarketplaceStats.
 *
 * The cosmetic series (12-week earnings sparkline, recent transactions
 * feed, bank chip) stays as locally-shaped demo data — wiring those
 * to live Stripe transactions is a bigger lift documented in TODO.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthorMarketplaceStats } from '@/hooks/useAuthorMarketplaceStats';

export interface PayoutWeek {
  weekStart: string;
  amount: number;
}

export interface BlueprintEarning {
  id: string;
  title: string;
  subtitle: string;
  renewalsLabel: string;
  newCountLabel: string;
  amount: number;
  currency: string;
  gradient: [string, string];
}

export interface PayoutTransaction {
  id: string;
  fromInitials: string;
  fromName: string;
  fromOrgChip: string | null;
  blueprintLabel: string;
  ageLabel: string;
  amount: number;
  currency: string;
  gradient: [string, string];
}

export interface StudioPayoutsData {
  loading: boolean;
  isIndependent: boolean;
  currency: string;
  currencySymbol: string;
  scheduleLabel: string;
  nextPayout: {
    amount: number;
    dateLabel: string;
    renewalsCount: number;
    firstTimeCount: number;
    deltaWeekPct: number | null;
  };
  lifetime: { amount: number; sinceLabel: string };
  activeSubscribers: { count: number; weeklyDelta: number };
  weeklySeries: PayoutWeek[];
  blueprintEarnings: BlueprintEarning[];
  recentTransactions: PayoutTransaction[];
  totalTransactionCount: number;
  bank: {
    flag: string;
    flagGradient: [string, string];
    typeLabel: string;
    accountMasked: string;
    bankName: string;
    connectLabel: string;
  };
}

// Cosmetic demo data — used for the parts of the surface that don't
// yet have a real source. Series + recent transactions would need a
// Stripe Connect transactions-by-week aggregation; bank info would
// come from stripe.accounts.retrieve external_accounts. Both are
// follow-up work.
const DEMO_SERIES: PayoutWeek[] = [
  { weekStart: 'Mar 4', amount: 690 },
  { weekStart: 'Mar 11', amount: 800 },
  { weekStart: 'Mar 18', amount: 920 },
  { weekStart: 'Mar 25', amount: 640 },
  { weekStart: 'Apr 1', amount: 1020 },
  { weekStart: 'Apr 8', amount: 1140 },
  { weekStart: 'Apr 15', amount: 1060 },
  { weekStart: 'Apr 22', amount: 940 },
  { weekStart: 'Apr 29', amount: 1220 },
  { weekStart: 'May 6', amount: 1300 },
  { weekStart: 'May 13', amount: 1340 },
  { weekStart: 'May 20', amount: 1480 },
];

const DEMO_BANK = {
  flag: 'US',
  flagGradient: ['#28406B', '#5A6B8B'] as [string, string],
  typeLabel: 'ACH',
  accountMasked: '··· 6789',
  bankName: 'Stripe Connect',
  connectLabel: 'Express',
};

const GRADIENT_POOL: [string, string][] = [
  ['#B8855A', '#5C3F22'],
  ['#7C6E5A', '#3D352B'],
  ['#5A8DB8', '#28406B'],
  ['#7A6A8E', '#4E6A85'],
  ['#6E8B5A', '#5A8B8B'],
  ['#8B6E5A', '#B8855A'],
  ['#8A5AB8', '#5A8B8B'],
];

function blueprintGradient(idx: number): [string, string] {
  return GRADIENT_POOL[idx % GRADIENT_POOL.length];
}

function subtitleFor(unitAmountCents: number, cadence: string, count: number): string {
  const dollars = (unitAmountCents / 100).toFixed(0);
  const cadenceLabel =
    cadence === 'monthly'
      ? '/ month'
      : cadence === 'annual'
        ? '/ year'
        : 'one-time';
  const subscriberLabel = count === 1 ? '1 subscriber' : `${count.toLocaleString()} subscribers`;
  return `$${dollars} ${cadenceLabel} · ${subscriberLabel}`;
}

export function useStudioPayouts(): StudioPayoutsData {
  const { stats, loading: statsLoading } = useAuthorMarketplaceStats();

  const { data: connectAccount, isLoading: csLoading } = useQuery({
    queryKey: ['creator-stripe-account-self'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: row } = await supabase
        .from('creator_stripe_accounts')
        .select('stripe_account_id, charges_enabled, payouts_enabled, onboarding_complete')
        .eq('user_id', user.id)
        .maybeSingle();
      return row;
    },
  });

  return useMemo<StudioPayoutsData>(() => {
    const loading = statsLoading || csLoading;
    const isIndependent = !!connectAccount?.stripe_account_id;
    const activeCount = (stats?.activeCount ?? 0) + (stats?.trialingCount ?? 0);
    const mrr = stats?.mrrCents ?? 0;

    const blueprintEarnings: BlueprintEarning[] = (stats?.byBlueprint ?? []).map(
      (bp, idx) => ({
        id: bp.blueprintId,
        title: bp.blueprintTitle,
        subtitle: subtitleFor(bp.unitAmountCents, bp.cadence, bp.activeCount + bp.trialingCount),
        renewalsLabel:
          bp.activeCount > 0
            ? `${bp.activeCount} active`
            : bp.trialingCount > 0
              ? `${bp.trialingCount} trial`
              : '—',
        newCountLabel: bp.trialingCount > 0 ? `${bp.trialingCount} new` : '—',
        amount: bp.mrrCents / 100,
        currency: 'USD',
        gradient: blueprintGradient(idx),
      }),
    );

    // Lifetime is YTD for now (we don't have year-spanning history).
    const lifetimeCents = (stats?.byBlueprint ?? []).reduce(
      (sum, b) => sum + b.mrrCents,
      0,
    );

    return {
      loading,
      isIndependent,
      currency: 'USD',
      currencySymbol: '$',
      scheduleLabel: 'Payouts weekly · 7-day rolling reserve',
      nextPayout: {
        amount: mrr / 100,
        dateLabel: '—',
        renewalsCount: stats?.activeCount ?? 0,
        firstTimeCount: stats?.trialingCount ?? 0,
        deltaWeekPct: null,
      },
      lifetime: {
        amount: lifetimeCents / 100,
        sinceLabel: 'YTD',
      },
      activeSubscribers: {
        count: activeCount,
        weeklyDelta: stats?.trialingCount ?? 0,
      },
      weeklySeries: DEMO_SERIES,
      blueprintEarnings,
      recentTransactions: [],
      totalTransactionCount: 0,
      bank: DEMO_BANK,
    };
  }, [stats, statsLoading, csLoading, connectAccount]);
}
