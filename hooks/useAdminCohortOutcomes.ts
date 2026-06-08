/**
 * useAdminCohortOutcomes — cohort-level business-outcome rollup for the
 * org-admin / funder view (entrepreneur vertical, e.g. PRADAN Khunti).
 *
 * Powers the "Cohort earnings" funder card on /admin/[orgId]/overview:
 * the artifact a funder (Pitroda / govt / NGO) actually buys — "N members
 * earning, ₹X this month, Y reached loan-tier".
 *
 * Data path: admin_cohort_outcomes(p_org_id, p_cohort_id) — a SECURITY
 * DEFINER RPC gated by org role, because business_outcomes RLS otherwise
 * only exposes a member's own rows. Returns one row per member who has
 * logged outcomes; we aggregate into headline numbers + a sorted member
 * list. When the RPC returns nothing (non-entrepreneur orgs, or no
 * outcomes logged), `hasOutcomes` is false and the caller hides the card.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

// Monthly run-rate (in major currency units) at which an SHG member is
// considered loan-tier eligible — the microfinance milestone a funder
// cares about. Kept here, not in the DB, so it's tunable per pitch.
export const LOAN_TIER_MONTHLY_MAJOR = 8000;

export interface CohortOutcomeMember {
  userId: string;
  name: string;
  weeksLogged: number;
  totalMajor: number;       // lifetime revenue in major units (₹)
  lastMonthMajor: number;   // last 4 weeks in major units (₹)
  unitsTotal: number;
  loanTier: boolean;
  currency: string;
}

export interface AdminCohortOutcomesData {
  loading: boolean;
  hasOutcomes: boolean;
  currency: string;
  earningMemberCount: number;
  totalMajor: number;
  lastMonthMajor: number;
  loanTierCount: number;
  members: CohortOutcomeMember[];
}

type OutcomeRpcRow = {
  user_id: string;
  full_name: string | null;
  weeks_logged: number;
  total_revenue_minor: number;
  last_month_revenue_minor: number | null;
  units_total: number;
  latest_week_start: string | null;
  currency: string | null;
};

export function useAdminCohortOutcomes(
  orgId: string,
  cohortId?: string | null,
): AdminCohortOutcomesData {
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-cohort-outcomes', orgId, cohortId ?? null],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<OutcomeRpcRow[]> => {
      const { data, error } = await supabase.rpc('admin_cohort_outcomes', {
        p_org_id: orgId,
        p_cohort_id: cohortId ?? null,
      });
      if (error) {
        // insufficient_privilege (wrong role) or a non-entrepreneur org
        // simply has no funder card — don't surface it as an error.
        console.warn('[useAdminCohortOutcomes] RPC failed', error.message);
        return [];
      }
      return (data ?? []) as OutcomeRpcRow[];
    },
  });

  return useMemo(() => {
    const currency = data.find((r) => r.currency)?.currency ?? 'INR';
    const members: CohortOutcomeMember[] = data.map((r) => {
      const lastMonthMajor = Math.round((r.last_month_revenue_minor ?? 0) / 100);
      return {
        userId: r.user_id,
        name: r.full_name ?? 'Member',
        weeksLogged: r.weeks_logged,
        totalMajor: Math.round(r.total_revenue_minor / 100),
        lastMonthMajor,
        unitsTotal: r.units_total,
        loanTier: lastMonthMajor >= LOAN_TIER_MONTHLY_MAJOR,
        currency: r.currency ?? currency,
      };
    });

    return {
      loading: isLoading,
      hasOutcomes: members.length > 0,
      currency,
      earningMemberCount: members.length,
      totalMajor: members.reduce((sum, m) => sum + m.totalMajor, 0),
      lastMonthMajor: members.reduce((sum, m) => sum + m.lastMonthMajor, 0),
      loanTierCount: members.filter((m) => m.loanTier).length,
      members,
    };
  }, [data, isLoading]);
}
