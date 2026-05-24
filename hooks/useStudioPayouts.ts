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

// Fallback bank chip when the user has no Stripe Connect account.
const FALLBACK_BANK = {
  flag: 'US',
  flagGradient: ['#28406B', '#5A6B8B'] as [string, string],
  typeLabel: 'ACH',
  accountMasked: 'Not connected',
  bankName: 'Stripe Connect',
  connectLabel: 'Onboard to receive payouts',
};

// Empty 12-week series shape — overlaid by the real series from the
// studio-payouts-data edge function when it loads.
const EMPTY_SERIES: PayoutWeek[] = [];

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

interface StripeSidePayload {
  ok: boolean;
  connected: boolean;
  bank: {
    flag: string;
    flagGradient: [string, string];
    typeLabel: string;
    accountMasked: string;
    bankName: string;
    connectLabel: string;
  } | null;
  weeklySeries: { weekStart: string; amount: number }[];
  recentTransactions: {
    id: string;
    amount: number;
    currency: string;
    ageLabel: string;
    description: string;
    type: string;
  }[];
  nextPayout: {
    amount: number;
    currency: string;
    arrivalDate: string;
  } | null;
}

function nameToInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'XX';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

  const { data: stripeSide, isLoading: stripeLoading } = useQuery({
    queryKey: ['studio-payouts-data', connectAccount?.stripe_account_id ?? null],
    enabled: !!connectAccount?.stripe_account_id,
    staleTime: 60_000,
    queryFn: async (): Promise<StripeSidePayload | null> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/studio-payouts-data`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) return null;
      return (await res.json()) as StripeSidePayload;
    },
  });

  return useMemo<StudioPayoutsData>(() => {
    const loading = statsLoading || csLoading || stripeLoading;
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

    const lifetimeCents = (stats?.byBlueprint ?? []).reduce(
      (sum, b) => sum + b.mrrCents,
      0,
    );

    // Stripe-side derived data (may be undefined if user has no Connect
    // account or the fetch failed). Fall back to empty/placeholder
    // shapes so the existing surface keeps rendering.
    const weeklySeries: PayoutWeek[] =
      stripeSide?.weeklySeries && stripeSide.weeklySeries.length > 0
        ? stripeSide.weeklySeries
        : EMPTY_SERIES;

    const recentTransactions: PayoutTransaction[] = (stripeSide?.recentTransactions ?? []).map(
      (t, idx) => ({
        id: t.id,
        fromInitials: nameToInitials(t.description || 'Stripe'),
        fromName: t.description || 'Stripe transaction',
        fromOrgChip: null,
        blueprintLabel:
          t.type === 'refund'
            ? 'Refund'
            : t.type === 'charge' || t.type === 'payment'
              ? 'Subscribed'
              : t.type,
        ageLabel: t.ageLabel,
        amount: t.amount,
        currency: t.currency,
        gradient: blueprintGradient(idx),
      }),
    );

    const bank = stripeSide?.bank ?? FALLBACK_BANK;

    const nextPayoutAmount = stripeSide?.nextPayout?.amount ?? mrr / 100;
    const nextPayoutDate = stripeSide?.nextPayout?.arrivalDate
      ? new Date(stripeSide.nextPayout.arrivalDate).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : '—';

    return {
      loading,
      isIndependent,
      currency: 'USD',
      currencySymbol: '$',
      scheduleLabel: 'Payouts weekly · 7-day rolling reserve',
      nextPayout: {
        amount: nextPayoutAmount,
        dateLabel: nextPayoutDate,
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
      weeklySeries,
      blueprintEarnings,
      recentTransactions,
      totalTransactionCount: recentTransactions.length,
      bank,
    };
  }, [stats, statsLoading, csLoading, stripeLoading, connectAccount, stripeSide]);
}
