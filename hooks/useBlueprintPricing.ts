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
}

interface BlueprintPricingRow {
  access_mode: string;
  cohort_scope: string;
  price_per_seat_cents: number | null;
  billing_cadence: string | null;
  author_payout_pct: number | null;
  trial_days: number | null;
}

interface AssignedCohortRow {
  cohort_id: string;
  cohort: { id: string; name: string };
}

export function useBlueprintPricing(blueprintId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['blueprint-pricing', blueprintId];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!blueprintId,
    staleTime: 30_000,
    queryFn: async (): Promise<BlueprintPricing> => {
      const [bpRes, cohortsRes] = await Promise.all([
        supabase
          .from('blueprints')
          .select(
            'access_mode, cohort_scope, price_per_seat_cents, billing_cadence, author_payout_pct, trial_days',
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
      if (Object.keys(payload).length === 0) return;
      const { error } = await supabase.from('blueprints').update(payload).eq('id', blueprintId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
    },
  });

  return {
    pricing: data ?? null,
    loading: isLoading,
    update,
    removeCohort,
  };
}
