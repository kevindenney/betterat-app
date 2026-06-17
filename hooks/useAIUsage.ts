/**
 * useAIUsage — gating + remaining-allowance for metered AI features.
 *
 * Paid users are unlimited; free users are capped by FREE_AI_LIMITS. The UI
 * should call `canUse(feature)` before kicking off an AI action and show the
 * paywall when it returns false. After a successful action, the recording RPC
 * (AIUsageService.recordUsage, usually called inside the feature service) bumps
 * the counter; call `refresh()` to re-read it.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/providers/AuthProvider';
import { useSubscription } from '@/lib/contexts/SubscriptionContext';
import {
  AIUsageService,
  FREE_AI_LIMITS,
  type AIFeature,
} from '@/services/ai/AIUsageService';

export function useAIUsage() {
  const { user } = useAuth();
  const { status } = useSubscription();
  const queryClient = useQueryClient();

  const isPaid = !!status && status.tier !== 'free';

  const { data } = useQuery({
    queryKey: ['ai-usage', user?.id, AIUsageService.currentPeriod()],
    queryFn: () => AIUsageService.getMonthlyUsage(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const counts = useMemo(() => data?.counts ?? {}, [data?.counts]);

  const canUse = useCallback(
    (feature: AIFeature): boolean => {
      if (isPaid) return true;
      return (counts[feature] ?? 0) < FREE_AI_LIMITS[feature];
    },
    [counts, isPaid],
  );

  /** Remaining uses this month, or null for unlimited (paid) users. */
  const remaining = useCallback(
    (feature: AIFeature): number | null => {
      if (isPaid) return null;
      return Math.max(0, FREE_AI_LIMITS[feature] - (counts[feature] ?? 0));
    },
    [counts, isPaid],
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ai-usage', user?.id] });
  }, [queryClient, user?.id]);

  return { isPaid, counts, limits: FREE_AI_LIMITS, canUse, remaining, refresh };
}
