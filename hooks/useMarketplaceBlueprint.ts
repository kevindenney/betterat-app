/**
 * useMarketplaceBlueprint — public detail read for a single
 * marketplace blueprint. Anonymously safe (the RPC is SECURITY DEFINER
 * + GRANT to anon). Returns the steps array only when the caller has
 * an active subscription, is the author, or is an org admin. Also
 * exposes a useUpsertReview mutation gated to subscribers via RLS.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  ratingAvg: number | null;
  ratingCount: number;
}

export interface MarketplaceReview {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  reviewerUserId: string;
  reviewerName: string;
  reviewerInitials: string;
  isMine: boolean;
}

export interface MyReview {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
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
      reviews: MarketplaceReview[];
      myReview: MyReview | null;
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
    rating_avg: number | string | null;
    rating_count: number;
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
  reviews?: {
    id: string;
    rating: number;
    body: string | null;
    created_at: string;
    reviewer_user_id: string;
    reviewer_name: string;
    reviewer_initials: string;
    is_mine: boolean;
  }[];
  my_review?: {
    id: string;
    rating: number;
    body: string | null;
    created_at: string;
  } | null;
}

export function useMarketplaceBlueprint(blueprintId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['marketplace-blueprint', blueprintId];

  const { data, isLoading } = useQuery({
    queryKey,
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
          ratingAvg:
            p.blueprint.rating_avg == null ? null : Number(p.blueprint.rating_avg),
          ratingCount: p.blueprint.rating_count ?? 0,
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
        reviews: (p.reviews ?? []).map((r) => ({
          id: r.id,
          rating: r.rating,
          body: r.body,
          createdAt: r.created_at,
          reviewerUserId: r.reviewer_user_id,
          reviewerName: r.reviewer_name,
          reviewerInitials: r.reviewer_initials,
          isMine: r.is_mine,
        })),
        myReview: p.my_review
          ? {
              id: p.my_review.id,
              rating: p.my_review.rating,
              body: p.my_review.body,
              createdAt: p.my_review.created_at,
            }
          : null,
      };
    },
  });

  const upsertReview = useMutation({
    mutationFn: async (input: { rating: number; body: string | null }) => {
      if (!blueprintId) throw new Error('No blueprint');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in to write a review');
      const { error } = await supabase
        .from('marketplace_blueprint_reviews')
        .upsert(
          {
            blueprint_id: blueprintId,
            reviewer_user_id: user.id,
            rating: input.rating,
            body: input.body,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'blueprint_id,reviewer_user_id' },
        );
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['marketplace-blueprints'] });
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase
        .from('marketplace_blueprint_reviews')
        .delete()
        .eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['marketplace-blueprints'] });
    },
  });

  return { result: data ?? null, loading: isLoading, upsertReview, deleteReview };
}
