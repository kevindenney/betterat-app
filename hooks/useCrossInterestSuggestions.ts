/**
 * useCrossInterestSuggestions — fetches AI-generated suggestions that find
 * connections between a user's multiple interests.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useStepDetail } from '@/hooks/useStepDetail';
import {
  gatherCrossInterestContext,
  generateCrossInterestSuggestions,
} from '@/services/ai/StepPlanAIService';
import type { CrossInterestSuggestion } from '@/types/step-detail';
import type { StepPlanData, StepMetadata } from '@/types/step-detail';

export function useCrossInterestSuggestions(
  stepId: string | undefined,
  currentInterestId: string | undefined,
  focusHint?: string,
): {
  suggestions: CrossInterestSuggestion[];
  isLoading: boolean;
  refetch: () => void;
} {
  const { user } = useAuth();
  const { userInterests, currentInterest } = useInterest();
  const { data: step } = useStepDetail(stepId ?? '');

  const resolvedInterestId = currentInterestId || currentInterest?.id;
  const otherInterests = userInterests.filter((i) => i.id !== resolvedInterestId);
  const hasMultiple = otherInterests.length > 0;

  const { data, isLoading, refetch } = useQuery<CrossInterestSuggestion[]>({
    queryKey: ['cross-interest-suggestions', stepId, resolvedInterestId],
    queryFn: async () => {
      if (!user?.id || !resolvedInterestId || !step) return [];

      const planData = ((step.metadata as StepMetadata)?.plan ?? {}) as StepPlanData;

      const crossContext = await gatherCrossInterestContext(
        user.id,
        resolvedInterestId,
        otherInterests.map((i) => ({
          id: i.id,
          slug: i.slug,
          name: i.name,
          accent_color: i.accent_color,
          icon_name: i.icon_name,
        })),
      );

      return generateCrossInterestSuggestions({
        currentInterestName: currentInterest?.name || 'this interest',
        stepTitle: step.title ?? 'Untitled step',
        currentWhat: planData.what_will_you_do?.trim() || undefined,
        capabilityGoals: planData.capability_goals ?? [],
        crossContext,
        focusHint: focusHint?.trim() || undefined,
      });
    },
    enabled: hasMultiple && !!stepId && !!resolvedInterestId && !!user?.id && !!step,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    suggestions: data ?? [],
    isLoading,
    refetch,
  };
}
