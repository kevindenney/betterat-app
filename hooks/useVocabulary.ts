/**
 * useVocabulary Hook
 *
 * Provides the interest-aware vocabulary map and a convenience `vocab`
 * function to any component. Vocabulary is fetched once per interest via
 * React Query and cached for the lifetime of the session.
 *
 * Falls back to the sail-racing defaults while loading or when no
 * interest has been selected yet.
 *
 * @example
 * const { vocab, loading } = useVocabulary();
 * <Text>{vocab('Learning Event')}</Text>  // "Race" | "Clinical Shift" | …
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useInterest } from '@/providers/InterestProvider';
import {
  fetchVocabulary,
  getFallbackVocabulary,
  vocab as vocabLookup,
  type VocabularyMap,
} from '@/lib/vocabulary';

// Re-export the type so consumers can import from one place
export type { VocabularyMap } from '@/lib/vocabulary';

/**
 * @param overrideInterestId  When viewing someone else's step (e.g. creator
 *   reviewing a subscriber), pass the step's interest_id so vocabulary matches
 *   the step's domain, not the viewer's active interest.
 */
export function useVocabulary(overrideInterestId?: string) {
  const { currentInterest, allInterests } = useInterest();

  // Resolve the effective interest: override wins when provided and differs
  const effectiveInterest = useMemo(() => {
    if (overrideInterestId && overrideInterestId !== currentInterest?.id) {
      const match = allInterests.find((i) => i.id === overrideInterestId);
      if (match) return match;
    }
    return currentInterest;
  }, [overrideInterestId, currentInterest, allInterests]);

  const {
    data: fetchedVocabulary,
    isLoading,
  } = useQuery<VocabularyMap>({
    queryKey: ['vocabulary', effectiveInterest?.id],
    queryFn: () => fetchVocabulary(effectiveInterest!.id, effectiveInterest!.slug),
    enabled: effectiveInterest !== null,
    staleTime: 1000 * 60 * 30, // 30 minutes – vocabulary rarely changes
  });

  // Stable fallback: memoize so we don't recreate on every render
  const fallback = useMemo(
    () => getFallbackVocabulary(effectiveInterest?.slug),
    [effectiveInterest?.slug],
  );

  // Merge: fetched values win when present, fallback fills the gaps.
  // A `?? fallback` fall-through was wrong for partially-populated tables —
  // a sail-racing row missing 'Step' would otherwise leak the literal noun
  // into the UI (e.g. the Atlas cluster pill rendered "+12 Steps" instead
  // of "+12 sessions"). Merge keeps DB-authoritative terms while ensuring
  // new universal terms have a default.
  const vocabulary: VocabularyMap = useMemo(
    () => ({ ...fallback, ...(fetchedVocabulary ?? {}) }),
    [fallback, fetchedVocabulary],
  );

  const vocab = useCallback(
    (term: string): string => vocabLookup(term, vocabulary),
    [vocabulary],
  );

  return useMemo(
    () => ({
      vocabulary,
      vocab,
      loading: isLoading,
    }),
    [vocabulary, vocab, isLoading],
  );
}
