/**
 * useOnDeck — fetch and act on a user's held step ideas.
 *
 * The On Deck zone is the holding area created in the Phase 7 design:
 * blueprint or peer-fork steps saved for later placement via the
 * AddToTimelineSheet "Save to deck for later" secondary CTA.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  listOnDeck,
  discardOnDeckItem,
  markOnDeckPlaced,
  type StepDeckRecord,
} from '@/services/StepDeckService';

const keys = {
  list: (userId: string, interestId?: string | null) =>
    ['phase7-on-deck', userId, interestId ?? null] as const,
};

export function useOnDeck(interestId?: string | null) {
  const { user } = useAuth();
  return useQuery<StepDeckRecord[]>({
    queryKey: keys.list(user?.id ?? '', interestId),
    queryFn: () => listOnDeck(user!.id, interestId),
    enabled: !!user?.id,
  });
}

export function useDiscardOnDeck(interestId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deckItemId: string) => discardOnDeckItem(deckItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.list(user?.id ?? '', interestId) });
    },
  });
}

export function useMarkOnDeckPlaced(interestId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deckItemId: string) => markOnDeckPlaced(deckItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.list(user?.id ?? '', interestId) });
    },
  });
}
