/**
 * useBusinessOutcomes — weekly revenue/sales metrics for an entrepreneurial
 * plan (the SHG / Pitroda demo). Reads the business_outcomes table directly;
 * RLS enforces self-read plus opt-in public discovery. Rows come back oldest
 * week first so the trend chart reads left-to-right.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface BusinessOutcome {
  id: string;
  weekStart: string;
  unitsSold: number;
  revenueMinor: number;
  currency: string;
  customerCount: number;
  repeatCount: number;
}

const STALE_MS = 60_000;

export const businessOutcomesKey = (userId: string | null | undefined) =>
  ['business-outcomes', userId ?? 'none'] as const;

export function useBusinessOutcomes(userId: string | null | undefined) {
  return useQuery<BusinessOutcome[]>({
    queryKey: businessOutcomesKey(userId),
    enabled: Boolean(userId),
    staleTime: STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_outcomes')
        .select(
          'id, week_start, units_sold, revenue_minor, currency, customer_count, repeat_count',
        )
        .eq('user_id', userId as string)
        .order('week_start', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        weekStart: row.week_start,
        unitsSold: row.units_sold,
        revenueMinor: row.revenue_minor,
        currency: row.currency,
        customerCount: row.customer_count,
        repeatCount: row.repeat_count,
      }));
    },
  });
}
