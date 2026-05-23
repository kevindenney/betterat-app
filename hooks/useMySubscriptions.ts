/**
 * useMySubscriptions — list the signed-in buyer's marketplace
 * subscriptions + cancel mutation. RLS gates reads to the buyer.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface MySubscription {
  id: string;
  blueprintId: string;
  blueprintTitle: string;
  authorName: string;
  orgName: string | null;
  status:
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'paused'
    | 'unpaid';
  unitAmountCents: number;
  currency: string;
  cadence: 'monthly' | 'annual' | 'one_time';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string;
}

export function useMySubscriptions() {
  const queryClient = useQueryClient();
  const queryKey = ['my-marketplace-subscriptions'];

  const { data = [], isLoading } = useQuery({
    queryKey,
    staleTime: 30_000,
    queryFn: async (): Promise<MySubscription[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: subs } = await supabase
        .from('marketplace_subscriptions')
        .select(
          `id, blueprint_id, status, unit_amount_cents, currency, cadence,
           trial_ends_at, current_period_end, canceled_at, created_at`,
        )
        .eq('buyer_user_id', user.id)
        .order('created_at', { ascending: false });
      if (!subs || subs.length === 0) return [];

      // Second query: pull blueprint + author + org for the rows. Two
      // queries keeps RLS happy (marketplace_subscriptions doesn't have
      // PostgREST embeds pre-configured for auth.users).
      const blueprintIds = subs.map((s) => s.blueprint_id);
      const { data: bps } = await supabase
        .from('blueprints')
        .select('id, title, org_id, author_user_id')
        .in('id', blueprintIds);
      const orgIds = Array.from(
        new Set((bps ?? []).map((b) => b.org_id).filter(Boolean)),
      ) as string[];
      const authorIds = Array.from(
        new Set((bps ?? []).map((b) => b.author_user_id).filter(Boolean)),
      ) as string[];
      const [{ data: orgs }, { data: users }] = await Promise.all([
        orgIds.length > 0
          ? supabase.from('organizations').select('id, name').in('id', orgIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        authorIds.length > 0
          ? supabase.from('users').select('id, full_name, email').in('id', authorIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
      ]);
      const orgById = new Map((orgs ?? []).map((o) => [o.id, o]));
      const userById = new Map((users ?? []).map((u) => [u.id, u]));
      const bpById = new Map((bps ?? []).map((b) => [b.id, b]));

      return subs.map((s) => {
        const bp = bpById.get(s.blueprint_id);
        const org = bp?.org_id ? orgById.get(bp.org_id) : null;
        const author = bp?.author_user_id ? userById.get(bp.author_user_id) : null;
        const authorName =
          (author?.full_name ?? '').trim() || author?.email || 'Independent author';
        return {
          id: s.id,
          blueprintId: s.blueprint_id,
          blueprintTitle: bp?.title ?? 'Blueprint',
          authorName,
          orgName: org?.name ?? null,
          status: s.status,
          unitAmountCents: s.unit_amount_cents,
          currency: s.currency,
          cadence: s.cadence,
          trialEndsAt: s.trial_ends_at,
          currentPeriodEnd: s.current_period_end,
          canceledAt: s.canceled_at,
          createdAt: s.created_at,
        };
      });
    },
  });

  const cancel = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/marketplace-cancel-subscription`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? 'Cancel failed');
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { subscriptions: data, loading: isLoading, cancel };
}
