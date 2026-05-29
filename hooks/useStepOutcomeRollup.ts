/**
 * useStepOutcomeRollup — rolls a single step's `metadata.outcome` up into
 * the weekly `business_outcomes` row (entrepreneur vocab).
 *
 * The step is the source of truth for the sale it produced; this hook
 * keeps the weekly rollup table — which the money lane, the EARNINGS
 * headline, and the /outcomes dashboard all read — in sync. On every
 * capture/edit it RECOMPUTES the affected week from all of the interest's
 * steps (never increments), so editing or deleting a step's numbers can't
 * double-count. Writes are user-scoped via the table's self-write RLS, so
 * one member's rollup never touches another's rows.
 *
 * No schema change: per-step truth lives on the step; the weekly row is a
 * materialised sum keyed on the existing UNIQUE (user_id, plan_id,
 * week_start).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { useActivePlan } from '@/hooks/usePlan';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { BusinessOutcomeData, StepMetadata } from '@/types/step-detail';

const DEFAULT_CURRENCY = 'INR';

/** The step's effective date for week bucketing, most-specific first. */
function effectiveDate(step: TimelineStepRecord): Date {
  const iso = step.completed_at ?? step.starts_at ?? step.due_at ?? step.created_at;
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Monday (UTC) of the week containing `d`, as a YYYY-MM-DD string. */
function mondayOf(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function outcomeOf(step: TimelineStepRecord): BusinessOutcomeData | undefined {
  return (step.metadata as StepMetadata | undefined)?.outcome;
}

export function useStepOutcomeRollup(interestId: string | null | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: steps = [] } = useMyTimeline(interestId ?? null);
  const { data: activePlan } = useActivePlan(interestId ?? null);

  return useMutation<
    void,
    Error,
    { step: TimelineStepRecord; outcome: BusinessOutcomeData }
  >({
    mutationFn: async ({ step, outcome }) => {
      const userId = user?.id;
      const planId = activePlan?.id;
      if (!userId) throw new Error('Not authenticated');
      if (!planId) throw new Error('No active plan for this interest — outcome cannot roll up');

      const weekStart = mondayOf(effectiveDate(step));

      // Apply the fresh outcome onto the matching step in the cached list
      // (the detail-cache write hasn't propagated to the list yet), then
      // recompute the whole week from sibling steps.
      const withFresh: TimelineStepRecord[] = steps.some((s) => s.id === step.id)
        ? steps.map((s) =>
            s.id === step.id
              ? { ...s, metadata: { ...(s.metadata ?? {}), outcome } }
              : s,
          )
        : [...steps, { ...step, metadata: { ...(step.metadata ?? {}), outcome } }];

      const weekRows = withFresh.filter(
        (s) => outcomeOf(s) && mondayOf(effectiveDate(s)) === weekStart,
      );

      const totals = weekRows.reduce(
        (acc, s) => {
          const o = outcomeOf(s)!;
          acc.units_sold += o.units_sold ?? 0;
          acc.revenue_minor += o.revenue_minor ?? 0;
          acc.customer_count += o.customer_count ?? 0;
          acc.repeat_count += o.repeat_count ?? 0;
          if (o.currency) acc.currency = o.currency;
          return acc;
        },
        {
          units_sold: 0,
          revenue_minor: 0,
          customer_count: 0,
          repeat_count: 0,
          currency: outcome.currency ?? DEFAULT_CURRENCY,
        },
      );

      const { error } = await supabase.from('business_outcomes').upsert(
        {
          user_id: userId,
          plan_id: planId,
          week_start: weekStart,
          units_sold: totals.units_sold,
          revenue_minor: totals.revenue_minor,
          currency: totals.currency,
          customer_count: totals.customer_count,
          // CHECK (repeat_count <= customer_count) — clamp defensively.
          repeat_count: Math.min(totals.repeat_count, totals.customer_count),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,plan_id,week_start' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-outcomes'] });
      queryClient.invalidateQueries({ queryKey: ['business-outcomes-headline'] });
    },
  });
}
