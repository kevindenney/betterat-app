/**
 * useInterestVision — read/write the user's vision for a specific
 * interest. Vision is per-(user, interest), not per-season; the user's
 * "land an ICU job at JHU in May" belongs to Nursing whether Winter
 * 2025-2026 or Summer 2026 is the active calendar partition.
 *
 * Stored on user_interests so each persona carries its own vision +
 * competency anchors. Returns nulls when the row doesn't exist (user
 * hasn't added the interest, or vision unset).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface InterestVision {
  vision_statement: string | null;
  vision_competency_ids: string[];
}

const STALE_MS = 30_000;

const interestVisionKey = (userId: string | undefined, interestId: string | undefined) =>
  ['interest-vision', userId ?? 'anon', interestId ?? 'none'] as const;

export function useInterestVision(interestId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: interestVisionKey(user?.id, interestId ?? undefined),
    enabled: Boolean(user?.id && interestId),
    staleTime: STALE_MS,
    queryFn: async (): Promise<InterestVision> => {
      if (!user?.id || !interestId) {
        return { vision_statement: null, vision_competency_ids: [] };
      }
      const { data, error } = await supabase
        .from('user_interests')
        .select('vision_statement, vision_competency_ids')
        .eq('user_id', user.id)
        .eq('interest_id', interestId)
        .maybeSingle();
      if (error) throw error;
      return {
        vision_statement: (data?.vision_statement as string | null) ?? null,
        vision_competency_ids: Array.isArray(data?.vision_competency_ids)
          ? (data!.vision_competency_ids as string[])
          : [],
      };
    },
  });
}

export interface UpdateInterestVisionInput {
  interestId: string;
  vision_statement: string | null;
  vision_competency_ids: string[];
}

export function useUpdateInterestVision() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInterestVisionInput) => {
      if (!user?.id) throw new Error('not authenticated');
      const { error } = await supabase
        .from('user_interests')
        .update({
          vision_statement: input.vision_statement,
          vision_competency_ids: input.vision_competency_ids,
        })
        .eq('user_id', user.id)
        .eq('interest_id', input.interestId);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      queryClient.invalidateQueries({
        queryKey: interestVisionKey(user?.id, input.interestId),
      });
    },
  });
}
