/**
 * useMarketplaceBlueprint — public detail read for a single
 * marketplace blueprint. Anonymously safe (the RPC is SECURITY DEFINER
 * + GRANT to anon). Returns the steps array only when the caller has
 * an active subscription, is the author, or is an org admin.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface MarketplaceBlueprintStep {
  id: string;
  sortOrder: number;
  title: string;
  description: string | null;
  category: string;
  whatQuestion: string | null;
  buyerStatus: 'pending' | 'in_progress' | 'completed' | 'skipped' | null;
  buyerStepId: string | null;
}

export interface MarketplaceBlueprintDetail {
  id: string;
  title: string;
  description: string | null;
  pricePerSeatCents: number;
  billingCadence: 'monthly' | 'annual' | 'one_time';
  trialDays: number;
  authorName: string;
  orgName: string | null;
  stripePriceId: string;
}

export interface MarketplaceSubscriptionState {
  id: string;
  status: 'active' | 'trialing';
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

export type DetailResult =
  | { ok: false; reason: 'not_found' | 'not_listed' }
  | {
      ok: true;
      blueprint: MarketplaceBlueprintDetail;
      hasAccess: boolean;
      subscription: MarketplaceSubscriptionState | null;
      steps: MarketplaceBlueprintStep[];
    };

interface RpcPayload {
  ok: boolean;
  reason?: 'not_found' | 'not_listed';
  blueprint?: {
    id: string;
    title: string;
    description: string | null;
    price_per_seat_cents: number;
    billing_cadence: 'monthly' | 'annual' | 'one_time';
    trial_days: number;
    author_name: string;
    org_name: string | null;
    stripe_price_id: string;
  };
  has_access?: boolean;
  subscription?: {
    id: string;
    status: 'active' | 'trialing';
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  } | null;
  steps?: {
    id: string;
    sort_order: number;
    title: string;
    description: string | null;
    category: string;
    what_question: string | null;
    buyer_status: 'pending' | 'in_progress' | 'completed' | 'skipped' | null;
    buyer_step_id: string | null;
  }[];
}

export function useMarketplaceBlueprint(blueprintId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-blueprint', blueprintId],
    enabled: !!blueprintId,
    staleTime: 30_000,
    queryFn: async (): Promise<DetailResult> => {
      const { data: payload, error } = await supabase.rpc('get_marketplace_blueprint', {
        p_blueprint_id: blueprintId,
      });
      if (error) {
        console.warn('[useMarketplaceBlueprint] RPC failed', error);
        return { ok: false, reason: 'not_found' };
      }
      const p = (payload ?? {}) as RpcPayload;
      if (!p.ok || !p.blueprint) {
        return { ok: false, reason: p.reason ?? 'not_found' };
      }
      return {
        ok: true,
        blueprint: {
          id: p.blueprint.id,
          title: p.blueprint.title,
          description: p.blueprint.description,
          pricePerSeatCents: p.blueprint.price_per_seat_cents,
          billingCadence: p.blueprint.billing_cadence,
          trialDays: p.blueprint.trial_days,
          authorName: p.blueprint.author_name,
          orgName: p.blueprint.org_name,
          stripePriceId: p.blueprint.stripe_price_id,
        },
        hasAccess: !!p.has_access,
        subscription: p.subscription
          ? {
              id: p.subscription.id,
              status: p.subscription.status,
              cancelAtPeriodEnd: p.subscription.cancel_at_period_end,
              currentPeriodEnd: p.subscription.current_period_end,
            }
          : null,
        steps: (p.steps ?? []).map((s) => ({
          id: s.id,
          sortOrder: s.sort_order,
          title: s.title,
          description: s.description,
          category: s.category,
          whatQuestion: s.what_question,
          buyerStatus: s.buyer_status ?? null,
          buyerStepId: s.buyer_step_id ?? null,
        })),
      };
    },
  });

  return { result: data ?? null, loading: isLoading };
}
