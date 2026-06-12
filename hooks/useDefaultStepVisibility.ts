/**
 * Resolves the visibility tier a new step will get if the user doesn't
 * touch the chip: per-interest override → profile default → 'private'.
 * Shared by the step composers so creation is never silently private.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { resolveDefaultVisibility } from '@/services/PrivacySettingsService';
import type { TimelineStepVisibility } from '@/types/timeline-steps';

export function useDefaultStepVisibility(
  interestId?: string | null,
  enabled: boolean = true,
) {
  const { user } = useAuth();
  return useQuery<TimelineStepVisibility>({
    queryKey: ['default-step-visibility', user?.id, interestId],
    queryFn: () => resolveDefaultVisibility(user!.id, interestId!),
    enabled: Boolean(enabled && user?.id && interestId),
    staleTime: 60_000,
  });
}
