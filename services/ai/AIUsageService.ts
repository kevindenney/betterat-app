/**
 * AI Usage Metering
 *
 * Free users get a monthly allowance of each metered AI feature; paid users are
 * unlimited (the tier check lives in the useAIUsage hook). Counters are stored
 * per user/month in `ai_usage_counters` and incremented through the
 * SECURITY DEFINER `increment_ai_usage` RPC so usage can't be under-reported
 * from the client. See migration 20260617170000_ai_usage_metering.sql.
 */

import { supabase } from '@/services/supabase';

export type AIFeature = 'plan_generation' | 'capability_tagging' | 'coach_chat';

/** Monthly allowance for free-tier users, per feature. */
export const FREE_AI_LIMITS: Record<AIFeature, number> = {
  plan_generation: 5,
  capability_tagging: 10,
  coach_chat: 10,
};

export interface AIUsageSnapshot {
  periodMonth: string;
  counts: Partial<Record<AIFeature, number>>;
}

export class AIUsageService {
  /** First day of the current UTC month as `YYYY-MM-01`, matching the RPC. */
  static currentPeriod(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  static async getMonthlyUsage(userId: string): Promise<AIUsageSnapshot> {
    const periodMonth = AIUsageService.currentPeriod();
    const { data, error } = await supabase
      .from('ai_usage_counters')
      .select('feature, count')
      .eq('user_id', userId)
      .eq('period_month', periodMonth);

    if (error) throw error;

    const counts: Partial<Record<AIFeature, number>> = {};
    for (const row of data ?? []) {
      counts[row.feature as AIFeature] = row.count;
    }
    return { periodMonth, counts };
  }

  /**
   * Record one use of a metered feature. Returns the new running count for the
   * month, or null if recording failed (recording must never block the feature
   * the user already paid/qualified for — gating happens before the action).
   */
  static async recordUsage(feature: AIFeature): Promise<number | null> {
    const { data, error } = await supabase.rpc('increment_ai_usage', {
      p_feature: feature,
    });
    if (error) {
      console.error('[AIUsageService] increment failed', error);
      return null;
    }
    return typeof data === 'number' ? data : null;
  }
}
