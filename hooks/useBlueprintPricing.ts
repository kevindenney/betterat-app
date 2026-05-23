/**
 * useBlueprintPricing — read + write pricing & access for one blueprint.
 *
 * Hits public.blueprints columns: access_mode, cohort_scope,
 * price_per_seat_cents, billing_cadence, author_payout_pct, trial_days.
 * Cohort assignments live in blueprint_cohorts and are managed via a
 * separate mutation set here.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { logAuditEvent } from '@/services/auditLog';

export type AccessMode = 'institutional' | 'independent';
export type BillingCadence = 'monthly' | 'annual' | 'one_time';
export type CohortScope = 'all' | 'specific';

export interface BlueprintPricing {
  accessMode: AccessMode;
  cohortScope: CohortScope;
  pricePerSeatCents: number | null;
  billingCadence: BillingCadence;
  authorPayoutPct: number;
  trialDays: number;
  assignedCohorts: { id: string; name: string }[];
  stripeProductId: string | null;
  stripePriceId: string | null;
  stripeSyncedAt: string | null;
  stripeSyncError: string | null;
}

interface BlueprintPricingRow {
  access_mode: string;
  cohort_scope: string;
  price_per_seat_cents: number | null;
  billing_cadence: string | null;
  author_payout_pct: number | null;
  trial_days: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stripe_synced_at: string | null;
  stripe_sync_error: string | null;
}

interface AssignedCohortRow {
  cohort_id: string;
  cohort: { id: string; name: string };
}

export function useBlueprintPricing(blueprintId: string, orgId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['blueprint-pricing', blueprintId];

  function describePricingPatch(
    patch: Partial<{
      accessMode: AccessMode;
      cohortScope: CohortScope;
      pricePerSeatCents: number | null;
      billingCadence: BillingCadence;
      authorPayoutPct: number;
      trialDays: number;
    }>,
  ): { label: string; description: string } | null {
    if (patch.accessMode !== undefined) {
      return {
        label: 'Changed access mode',
        description: `Set access mode to ${patch.accessMode === 'institutional' ? 'Institutional' : 'Independent'}.`,
      };
    }
    if (patch.cohortScope !== undefined) {
      return {
        label: 'Changed cohort scope',
        description: `Set cohort scope to ${patch.cohortScope === 'all' ? 'All cohorts' : 'Specific cohorts'}.`,
      };
    }
    if (patch.pricePerSeatCents !== undefined) {
      const dollars = patch.pricePerSeatCents != null ? (patch.pricePerSeatCents / 100).toFixed(2) : null;
      return {
        label: 'Changed per-seat price',
        description: dollars ? `Set per-seat price to $${dollars}.` : 'Cleared per-seat price.',
      };
    }
    if (patch.billingCadence !== undefined) {
      return {
        label: 'Changed billing cadence',
        description: `Set billing cadence to ${patch.billingCadence}.`,
      };
    }
    if (patch.authorPayoutPct !== undefined) {
      return {
        label: 'Changed author payout',
        description: `Set author payout to ${patch.authorPayoutPct}%.`,
      };
    }
    if (patch.trialDays !== undefined) {
      return {
        label: 'Changed trial length',
        description: `Set trial to ${patch.trialDays} day${patch.trialDays === 1 ? '' : 's'}.`,
      };
    }
    return null;
  }

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!blueprintId,
    staleTime: 30_000,
    queryFn: async (): Promise<BlueprintPricing> => {
      const [bpRes, cohortsRes] = await Promise.all([
        supabase
          .from('blueprints')
          .select(
            'access_mode, cohort_scope, price_per_seat_cents, billing_cadence, author_payout_pct, trial_days, stripe_product_id, stripe_price_id, stripe_synced_at, stripe_sync_error',
          )
          .eq('id', blueprintId)
          .maybeSingle(),
        supabase
          .from('blueprint_cohorts')
          .select('cohort_id, cohort:betterat_org_cohorts(id, name)')
          .eq('blueprint_id', blueprintId),
      ]);
      const bp = (bpRes.data ?? {}) as BlueprintPricingRow;
      const assigned = ((cohortsRes.data ?? []) as unknown as AssignedCohortRow[])
        .filter((r) => r.cohort)
        .map((r) => ({ id: r.cohort.id, name: r.cohort.name }));
      return {
        accessMode: (bp.access_mode as AccessMode) ?? 'institutional',
        cohortScope: (bp.cohort_scope as CohortScope) ?? 'specific',
        pricePerSeatCents: bp.price_per_seat_cents ?? null,
        billingCadence: (bp.billing_cadence as BillingCadence) ?? 'monthly',
        authorPayoutPct: bp.author_payout_pct ?? 70,
        trialDays: bp.trial_days ?? 7,
        assignedCohorts: assigned,
        stripeProductId: bp.stripe_product_id ?? null,
        stripePriceId: bp.stripe_price_id ?? null,
        stripeSyncedAt: bp.stripe_synced_at ?? null,
        stripeSyncError: bp.stripe_sync_error ?? null,
      };
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<{
      accessMode: AccessMode;
      cohortScope: CohortScope;
      pricePerSeatCents: number | null;
      billingCadence: BillingCadence;
      authorPayoutPct: number;
      trialDays: number;
    }>) => {
      const payload: Record<string, unknown> = {};
      if (patch.accessMode !== undefined) payload.access_mode = patch.accessMode;
      if (patch.cohortScope !== undefined) payload.cohort_scope = patch.cohortScope;
      if (patch.pricePerSeatCents !== undefined)
        payload.price_per_seat_cents = patch.pricePerSeatCents;
      if (patch.billingCadence !== undefined) payload.billing_cadence = patch.billingCadence;
      if (patch.authorPayoutPct !== undefined) payload.author_payout_pct = patch.authorPayoutPct;
      if (patch.trialDays !== undefined) payload.trial_days = patch.trialDays;
      if (Object.keys(payload).length === 0) return { patch };
      const { error } = await supabase.from('blueprints').update(payload).eq('id', blueprintId);
      if (error) throw error;
      return { patch };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
      if (orgId && result?.patch) {
        const summary = describePricingPatch(result.patch);
        if (summary) {
          void logAuditEvent({
            orgId,
            verb: 'config_change',
            verbLabel: summary.label,
            description: summary.description,
            targetType: 'blueprint',
            targetId: blueprintId,
            payload: result.patch as Record<string, unknown>,
          });
          queryClient.invalidateQueries({ queryKey: ['blueprint-activity', blueprintId] });
        }
      }
    },
  });

  const removeCohort = useMutation({
    mutationFn: async (cohortId: string) => {
      const { error } = await supabase
        .from('blueprint_cohorts')
        .delete()
        .eq('blueprint_id', blueprintId)
        .eq('cohort_id', cohortId);
      if (error) throw error;
      return { cohortId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
      if (orgId && result) {
        void logAuditEvent({
          orgId,
          verb: 'cohort_edit',
          verbLabel: 'Unsubscribed cohort',
          description: 'Removed a cohort from this blueprint.',
          targetType: 'blueprint',
          targetId: blueprintId,
          payload: { cohort_id: result.cohortId },
        });
        queryClient.invalidateQueries({ queryKey: ['blueprint-activity', blueprintId] });
      }
    },
  });

  const previewCheckout = useMutation({
    mutationFn: async (): Promise<{ url: string; sessionId: string }> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://betterat.app';
      const successUrl = `${origin}/studio/blueprints/${blueprintId}?stripe=success`;
      const cancelUrl = `${origin}/studio/blueprints/${blueprintId}?stripe=cancelled`;
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/marketplace-blueprint-checkout`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          blueprint_id: blueprintId,
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Checkout session failed');
      }
      return { url: payload.url, sessionId: payload.session_id };
    },
  });

  const syncStripe = useMutation({
    mutationFn: async (): Promise<{
      stripeProductId: string;
      stripePriceId: string;
      priceChanged: boolean;
    }> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/blueprint-stripe-sync`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ blueprint_id: blueprintId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? 'Stripe sync failed');
      }
      return {
        stripeProductId: payload.stripe_product_id,
        stripePriceId: payload.stripe_price_id,
        priceChanged: !!payload.price_changed,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
      queryClient.invalidateQueries({ queryKey: ['blueprint-activity', blueprintId] });
    },
  });

  return {
    pricing: data ?? null,
    loading: isLoading,
    update,
    removeCohort,
    syncStripe,
    previewCheckout,
  };
}
