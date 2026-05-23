/**
 * useAdminOrgPayouts — Admin · Author payouts surface data.
 * Wraps admin_org_payouts RPC (SECURITY DEFINER + is_org_admin_member).
 *
 * Returns per-author rows + org-level cycle aggregates (paid YTD, pending
 * batch, last batch, upcoming-cycle metadata) in one round-trip.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type AuthorTone = 'navy' | 'brown' | 'warm' | 'green' | 'purple';
export type ConnectStatus = 'verified' | 'action_needed' | 'pending' | 'rejected' | 'disabled';
export type AuthorKind = 'institutional' | 'independent' | 'contractor';

export interface AdminPayoutAuthor {
  id: string;
  authorUserId: string;
  authorKind: AuthorKind;
  authorName: string;
  authorInitials: string;
  authorTone: AuthorTone;
  activeSeats: number;
  earnedYtdCents: number;
  lastPayoutDate: string | null;
  lastPayoutAmountCents: number | null;
  stripeConnectStatus: ConnectStatus;
  stripeConnectAccountId: string | null;
  stripeStatusSyncedAt: string | null;
  blueprintCount: number;
  blueprintTitles: string[];
}

export interface AdminPayoutsData {
  authors: AdminPayoutAuthor[];
  paidYtdCents: number;
  pendingCents: number;
  pendingClears: string | null;
  lastBatchCents: number;
  lastBatchDate: string | null;
  lastBatchAuthors: number;
  cohortSeats: number;
  cohortLabel: string | null;
  upcomingPeriodStart: string | null;
  upcomingPeriodEnd: string | null;
  upcomingAuthorsPaid: number;
  upcomingAuthorsTotal: number;
  upcomingRebateCents: number;
  stripeStatusSyncedAt: string | null;
}

export interface StripeRefreshResult {
  ok: boolean;
  count: number;
  verifiedCount: number;
  notConnectedCount: number;
  actionNeededCount: number;
}

type RpcAuthor = {
  id: string;
  author_user_id: string;
  author_kind: string;
  author_name: string;
  author_initials: string;
  author_tone: string;
  active_seats: number;
  earned_ytd_cents: number;
  last_payout_date: string | null;
  last_payout_amount_cents: number | null;
  stripe_connect_status: string;
  stripe_connect_account_id: string | null;
  stripe_status_synced_at: string | null;
  blueprint_count: number;
  blueprint_titles: string[] | null;
};

type RpcPayload = {
  authors?: RpcAuthor[];
  paid_ytd_cents?: number;
  pending_cents?: number;
  pending_clears?: string | null;
  last_batch_cents?: number;
  last_batch_date?: string | null;
  last_batch_authors?: number;
  cohort_seats?: number;
  cohort_label?: string | null;
  upcoming_period_start?: string | null;
  upcoming_period_end?: string | null;
  upcoming_authors_paid?: number;
  upcoming_authors_total?: number;
  upcoming_rebate_cents?: number;
  stripe_status_synced_at?: string | null;
};

const EMPTY: AdminPayoutsData = {
  authors: [],
  paidYtdCents: 0,
  pendingCents: 0,
  pendingClears: null,
  lastBatchCents: 0,
  lastBatchDate: null,
  lastBatchAuthors: 0,
  cohortSeats: 0,
  cohortLabel: null,
  upcomingPeriodStart: null,
  upcomingPeriodEnd: null,
  upcomingAuthorsPaid: 0,
  upcomingAuthorsTotal: 0,
  upcomingRebateCents: 0,
  stripeStatusSyncedAt: null,
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

export function useAdminOrgPayouts(orgId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['admin-org-payouts', orgId];

  const { data = EMPTY, isLoading, error } = useQuery({
    queryKey,
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminPayoutsData> => {
      const { data: payload, error: rpcErr } = await supabase.rpc('admin_org_payouts', {
        p_org_id: orgId,
      });
      if (rpcErr) {
        console.warn('[useAdminOrgPayouts] RPC failed', rpcErr);
        return EMPTY;
      }
      const p = (payload ?? {}) as RpcPayload;
      const authors: AdminPayoutAuthor[] = (p.authors ?? []).map((r) => ({
        id: r.id,
        authorUserId: r.author_user_id,
        authorKind: r.author_kind as AuthorKind,
        authorName: r.author_name,
        authorInitials: r.author_initials,
        authorTone: r.author_tone as AuthorTone,
        activeSeats: r.active_seats,
        earnedYtdCents: r.earned_ytd_cents,
        lastPayoutDate: r.last_payout_date,
        lastPayoutAmountCents: r.last_payout_amount_cents,
        stripeConnectStatus: r.stripe_connect_status as ConnectStatus,
        stripeConnectAccountId: r.stripe_connect_account_id ?? null,
        stripeStatusSyncedAt: r.stripe_status_synced_at ?? null,
        blueprintCount: r.blueprint_count,
        blueprintTitles: r.blueprint_titles ?? [],
      }));
      return {
        authors,
        paidYtdCents: p.paid_ytd_cents ?? 0,
        pendingCents: p.pending_cents ?? 0,
        pendingClears: p.pending_clears ?? null,
        lastBatchCents: p.last_batch_cents ?? 0,
        lastBatchDate: p.last_batch_date ?? null,
        lastBatchAuthors: p.last_batch_authors ?? 0,
        cohortSeats: p.cohort_seats ?? 0,
        cohortLabel: p.cohort_label ?? null,
        upcomingPeriodStart: p.upcoming_period_start ?? null,
        upcomingPeriodEnd: p.upcoming_period_end ?? null,
        upcomingAuthorsPaid: p.upcoming_authors_paid ?? 0,
        upcomingAuthorsTotal: p.upcoming_authors_total ?? 0,
        upcomingRebateCents: p.upcoming_rebate_cents ?? 0,
        stripeStatusSyncedAt: p.stripe_status_synced_at ?? null,
      };
    },
  });

  const refreshStripe = useMutation({
    mutationFn: async (): Promise<StripeRefreshResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const url = `${SUPABASE_URL}/functions/v1/admin-org-payouts-refresh-stripe`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ org_id: orgId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Failed to refresh');
      }
      const results = (payload?.results ?? []) as { status: ConnectStatus; account_id: string | null }[];
      const verifiedCount = results.filter((r) => r.status === 'verified').length;
      const notConnectedCount = results.filter((r) => !r.account_id).length;
      const actionNeededCount = results.filter((r) => r.status === 'action_needed').length;
      return {
        ok: true,
        count: payload?.count ?? results.length,
        verifiedCount,
        notConnectedCount,
        actionNeededCount,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-feed', orgId] });
    },
  });

  return { ...data, loading: isLoading, error, refreshStripe };
}

export function formatMoneyDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMoneyShort(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatLongPeriod(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return '—';
  const start = new Date(startIso + 'T00:00:00');
  const end = new Date(endIso + 'T00:00:00');
  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = sameYear
    ? end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

export function formatScheduledFor(iso: string | null): string {
  if (!iso) return 'Upcoming payout';
  const d = new Date(iso + 'T00:00:00');
  return `Upcoming payout · ${d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`;
}
