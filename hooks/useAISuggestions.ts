/**
 * useAISuggestions — React hook for cross-interest AI suggestions.
 *
 * Provides active suggestions for the current interest, with methods
 * to apply, dismiss, and save them. Handles loading state and
 * automatic refresh when the interest changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useInterest } from '@/hooks/useInterest';
import { useAuth } from '@/providers/AuthProvider';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import {
  getActiveSuggestions,
  updateSuggestionStatus,
  generateAndSaveSuggestions,
} from '@/services/ai/crossInterestSuggestions';
import type { AISuggestion, UserInterestActivity } from '@/services/ai/crossInterestSuggestions';
import type { InterestSlug } from '@/lib/skillTaxonomy';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useAISuggestions');

const SUPPORTED_INTEREST_SLUGS = new Set<InterestSlug>([
  'sail-racing',
  'nursing',
  'drawing',
  'fitness',
  'lifelong-learning',
  'regenerative-agriculture',
]);

function isInterestSlug(slug: string | null | undefined): slug is InterestSlug {
  return Boolean(slug && SUPPORTED_INTEREST_SLUGS.has(slug as InterestSlug));
}

function stepDate(step: TimelineStepRecord): string {
  return step.completed_at ?? step.starts_at ?? step.updated_at ?? step.created_at;
}

function stepSkills(step: TimelineStepRecord): string[] {
  const skills = new Set<string>();
  if (step.category) skills.add(step.category);
  if (step.is_race) skills.add('race');

  const metadata = step.metadata ?? {};
  const candidates = [
    metadata.category,
    metadata.phase,
    metadata.kind,
    metadata.capture_kind,
    metadata.capability,
    metadata.capability_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      skills.add(candidate.trim());
    }
  }

  return Array.from(skills);
}

function buildUserActivities(
  steps: TimelineStepRecord[],
  userInterests: ReturnType<typeof useInterest>['userInterests'],
  currentInterestId: string,
): UserInterestActivity[] {
  const interestById = new Map(userInterests.map((interest) => [interest.id, interest]));
  const grouped = new Map<string, TimelineStepRecord[]>();

  for (const step of steps) {
    if (step.interest_id === currentInterestId) continue;
    const interest = interestById.get(step.interest_id);
    if (!isInterestSlug(interest?.slug)) continue;
    const list = grouped.get(step.interest_id) ?? [];
    list.push(step);
    grouped.set(step.interest_id, list);
  }

  return Array.from(grouped.entries()).flatMap(([interestId, interestSteps]) => {
    const interest = interestById.get(interestId);
    if (!isInterestSlug(interest?.slug)) return [];

    const recent = [...interestSteps]
      .sort((a, b) => new Date(stepDate(b)).getTime() - new Date(stepDate(a)).getTime())
      .slice(0, 5);

    if (recent.length === 0) return [];

    const activeSkills = Array.from(new Set(recent.flatMap(stepSkills)));
    return [{
      interestId,
      interestSlug: interest.slug,
      activeSkills,
      recentEvents: recent.map((step) => ({
        eventId: step.id,
        eventType: step.category || 'step',
        title: step.title?.trim() || step.description?.trim() || 'Recent step',
        date: stepDate(step),
        skillsUsed: stepSkills(step),
      })),
    }];
  });
}

interface UseAISuggestionsResult {
  /** Active suggestions for the current interest */
  suggestions: AISuggestion[];
  /** Whether suggestions are loading */
  isLoading: boolean;
  /** Any error that occurred */
  error: Error | null;
  /** Apply a suggestion to the current plan/event */
  applySuggestion: (suggestion: AISuggestion, eventId?: string) => Promise<void>;
  /** Dismiss a suggestion (hides it and trains the engine) */
  dismissSuggestion: (suggestion: AISuggestion) => Promise<void>;
  /** Save a suggestion for later */
  saveSuggestion: (suggestion: AISuggestion) => Promise<void>;
  /** Force refresh suggestions */
  refresh: () => Promise<void>;
  /** Whether any suggestions are available */
  hasSuggestions: boolean;
}

export function useAISuggestions(active: boolean = true): UseAISuggestionsResult {
  const { currentInterest, userInterests } = useInterest();
  const { user } = useAuth();
  const otherInterestIds = userInterests
    .filter((interest) => interest.id !== currentInterest?.id)
    .map((interest) => interest.id);
  const { data: allInterestSteps = [] } = useMyTimeline(
    otherInterestIds.length > 0 ? otherInterestIds : null,
  );

  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const lastInterestRef = useRef<string | null>(null);

  // Fetch active suggestions when interest changes
  const fetchSuggestions = useCallback(async () => {
    if (!user?.id || !currentInterest?.id || !isInterestSlug(currentInterest.slug)) return;

    setIsLoading(true);
    setError(null);

    try {
      let active = await getActiveSuggestions(user.id, currentInterest.id);
      if (active.length === 0 && allInterestSteps.length > 0) {
        const userActivities = buildUserActivities(
          allInterestSteps,
          userInterests,
          currentInterest.id,
        );
        if (userActivities.length > 0) {
          active = await generateAndSaveSuggestions(
            user.id,
            currentInterest.id,
            currentInterest.slug,
            userActivities,
          );
        }
      }
      setSuggestions(active);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      logger.error('[useAISuggestions] Fetch error:', e);
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [
    user?.id,
    currentInterest?.id,
    currentInterest?.slug,
    allInterestSteps,
    userInterests,
  ]);

  // Auto-fetch when interest changes. Gated on `active` so always-mounted
  // consumers (e.g. the global + composer) don't trigger the suggestion
  // edge-fn until they're actually opened.
  useEffect(() => {
    if (!active) return;
    if (!currentInterest?.id) return;
    const key = `${currentInterest.id}:${allInterestSteps.length}`;
    if (lastInterestRef.current === key) return;

    lastInterestRef.current = key;
    fetchSuggestions();
  }, [active, currentInterest?.id, allInterestSteps.length, fetchSuggestions]);

  // Apply a suggestion
  const applySuggestion = useCallback(
    async (suggestion: AISuggestion, eventId?: string) => {
      try {
        await updateSuggestionStatus(suggestion.id, 'applied', eventId);
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      } catch (err) {
        logger.error('[useAISuggestions] Apply error:', err);
      }
    },
    [],
  );

  // Dismiss a suggestion
  const dismissSuggestion = useCallback(
    async (suggestion: AISuggestion) => {
      try {
        await updateSuggestionStatus(suggestion.id, 'dismissed');
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      } catch (err) {
        logger.error('[useAISuggestions] Dismiss error:', err);
      }
    },
    [],
  );

  // Save a suggestion for later
  const saveSuggestion = useCallback(
    async (suggestion: AISuggestion) => {
      try {
        await updateSuggestionStatus(suggestion.id, 'saved');
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      } catch (err) {
        logger.error('[useAISuggestions] Save error:', err);
      }
    },
    [],
  );

  return {
    suggestions,
    isLoading,
    error,
    applySuggestion,
    dismissSuggestion,
    saveSuggestion,
    refresh: fetchSuggestions,
    hasSuggestions: suggestions.length > 0,
  };
}

export default useAISuggestions;
