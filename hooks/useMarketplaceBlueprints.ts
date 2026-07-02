/**
 * useMarketplaceBlueprints — public catalog of listed independent
 * blueprints (anon-safe). Backs the /marketplace surface.
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type AuthorTone = 'navy' | 'brown' | 'warm' | 'green' | 'purple';

// A listed plan can come from either blueprint system. The two have different
// detail surfaces: 'marketplace' → /marketplace/{id} (Stripe checkout),
// 'timeline' → /blueprint/{slug} (subscribe CTA on the public blueprint page).
export type BlueprintSource = 'marketplace' | 'timeline';

export interface MarketplaceBlueprint {
  id: string;
  slug: string;
  source: BlueprintSource;
  title: string;
  description: string | null;
  pricePerSeatCents: number;
  billingCadence: 'monthly' | 'annual' | 'one_time';
  trialDays: number;
  stripePriceId: string | null;
  authorUserId: string | null;
  authorName: string;
  authorInitials: string;
  authorTone: AuthorTone;
  authorBio: string | null;
  orgName: string | null;
  interestId: string | null;
  interestName: string | null;
  interestSlug: string | null;
  createdAt: string;
  ratingAvg: number | null;
  ratingCount: number;
  activeSubscriberCount: number;
  isFeatured: boolean;
  featuredRank: number | null;
  featuredBlurb: string | null;
}

// The two sources have different detail surfaces — a marketplace plan opens the
// Stripe-backed /marketplace/{id} page; a timeline plan opens its public
// /blueprint/{slug} subscribe page. Routing by source keeps unioned cards from
// landing on a detail page that can't resolve the other system's id.
export function blueprintDetailHref(
  bp: Pick<MarketplaceBlueprint, 'source' | 'slug' | 'id'>,
): string {
  return bp.source === 'timeline' ? `/blueprint/${bp.slug}` : `/marketplace/${bp.id}`;
}

interface Row {
  id: string;
  slug: string;
  source: BlueprintSource;
  title: string;
  description: string | null;
  price_per_seat_cents: number;
  billing_cadence: 'monthly' | 'annual' | 'one_time';
  trial_days: number;
  stripe_price_id: string | null;
  author_user_id: string | null;
  author_name: string;
  author_initials: string;
  author_tone: string;
  author_bio: string | null;
  org_name: string | null;
  interest_id: string | null;
  interest_name: string | null;
  interest_slug: string | null;
  created_at: string;
  rating_avg: number | string | null;
  rating_count: number;
  active_subscriber_count: number;
  is_featured: boolean;
  featured_rank: number | null;
  featured_blurb: string | null;
}

export function useMarketplaceBlueprints(interestId?: string | null) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['marketplace-blueprints', interestId ?? null],
    staleTime: 60_000,
    queryFn: async (): Promise<MarketplaceBlueprint[]> => {
      const { data, error } = await supabase.rpc('list_marketplace_blueprints', {
        p_interest_id: interestId ?? undefined,
      });
      if (error) {
        console.warn('[useMarketplaceBlueprints] RPC failed', error);
        return [];
      }
      const payload = (data ?? {}) as { ok: boolean; blueprints?: Row[] };
      const rows = (payload.blueprints ?? []) as Row[];
      return rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        source: r.source,
        title: r.title,
        description: r.description,
        pricePerSeatCents: r.price_per_seat_cents,
        billingCadence: r.billing_cadence,
        trialDays: r.trial_days,
        stripePriceId: r.stripe_price_id,
        authorUserId: r.author_user_id,
        authorName: r.author_name,
        authorInitials: r.author_initials,
        authorTone: (r.author_tone as AuthorTone) ?? 'navy',
        authorBio: r.author_bio ?? null,
        orgName: r.org_name,
        interestId: r.interest_id ?? null,
        interestName: r.interest_name ?? null,
        interestSlug: r.interest_slug ?? null,
        createdAt: r.created_at,
        ratingAvg: r.rating_avg == null ? null : Number(r.rating_avg),
        ratingCount: r.rating_count ?? 0,
        activeSubscriberCount: r.active_subscriber_count ?? 0,
        isFeatured: !!r.is_featured,
        featuredRank: r.featured_rank,
        featuredBlurb: r.featured_blurb,
      }));
    },
  });

  return { blueprints: data, loading: isLoading, error };
}

export function useMarketplaceCheckout() {
  return useMutation({
    mutationFn: async (blueprintId: string): Promise<{ url: string; sessionId: string }> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in to subscribe');
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://betterat.app';
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/marketplace-blueprint-checkout`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          blueprint_id: blueprintId,
          success_url: `${origin}/marketplace?stripe=success&bp=${blueprintId}`,
          cancel_url: `${origin}/marketplace?stripe=cancelled&bp=${blueprintId}`,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Checkout session failed');
      }
      return { url: payload.url, sessionId: payload.session_id };
    },
  });
}
