/**
 * useCoachRecruitment
 *
 * Manages coaching recruitment prompts throughout the app.
 * Handles dismissal tracking with 30-day expiry.
 *
 * Contexts:
 * - 'coaches_tab' - Banner on Learn → Coaches tab
 * - 'course_completion' - Prompt after completing a course
 * - 'coach_profile' - Subtle link for coached users viewing coach profiles
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '@/lib/utils/logger';

const DISMISSAL_STORAGE_KEY = '@regattaflow/coach-recruitment-dismissals';
const DISMISSAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const logger = createLogger('useCoachRecruitment');

export type RecruitmentContext = 'coaches_tab' | 'course_completion' | 'coach_profile';

export type CoachingRelationship = 'NO_RELATIONSHIP' | 'HAS_COACH' | 'IS_COACH';

interface DismissalRecord {
  [context: string]: number; // timestamp when dismissed
}

export function useCoachRecruitment() {
  const { user, capabilities } = useAuth();
  const [dismissals, setDismissals] = useState<DismissalRecord>({});
  const [dismissalsLoaded, setDismissalsLoaded] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load dismissals from AsyncStorage
  useEffect(() => {
    void AsyncStorage.getItem(DISMISSAL_STORAGE_KEY).then((value) => {
      if (!isMountedRef.current) return;
      if (value) {
        try {
          const parsed = JSON.parse(value);
          // Clean up expired dismissals
          const now = Date.now();
          const cleaned: DismissalRecord = {};
          Object.entries(parsed).forEach(([ctx, timestamp]) => {
            if (now - (timestamp as number) < DISMISSAL_DURATION_MS) {
              cleaned[ctx] = timestamp as number;
            }
          });
          setDismissals(cleaned);
        } catch {
          // Ignore parse errors
        }
      }
      setDismissalsLoaded(true);
    });
  }, []);

  // Check if user is a coach
  const { data: coachProfile, isLoading: loadingCoach, error: coachProfileError } = useQuery({
    queryKey: ['coach-recruitment', 'is-coach', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('coach_profiles')
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) {
        logger.error('Failed to load coach profile state', error);
        throw new Error(error.message || 'Failed to load coach profile');
      }
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Check if user has active coaching relationships (as a sailor)
  const { data: coachingClient, isLoading: loadingClient, error: coachingClientError } = useQuery({
    queryKey: ['coach-recruitment', 'has-coach', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('coaching_clients')
        .select('id')
        .eq('sailor_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (error) {
        logger.error('Failed to load coaching relationship state', error);
        throw new Error(error.message || 'Failed to load coaching relationships');
      }
      return data;
    },
    enabled: !!user?.id && !coachProfile,
    staleTime: 5 * 60 * 1000,
  });

  // Get sailor profile data for personalized messaging
  const { data: sailorData, isLoading: loadingSailor, error: sailorDataError } = useQuery({
    queryKey: ['coach-recruitment', 'sailor-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return { boatClasses: [], seasonCount: 0, raceCount: 0 };

      // Get user's boat classes and race history. Boat classes live in the
      // canonical sailor_classes -> boat_classes relation (sailor_profiles has
      // no boat-class columns), primary first.
      const [classesResult, seasonsResult, racesResult] = await Promise.all([
        supabase
          .from('sailor_classes')
          .select('is_primary, boat_classes(name)')
          .eq('sailor_id', user.id),
        supabase
          .from('user_seasons')
          .select('id')
          .eq('user_id', user.id),
        supabase
          .from('race_entries')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

      if (classesResult.error) {
        logger.error('Failed to load sailor classes for recruitment', classesResult.error);
        throw new Error(classesResult.error.message || 'Failed to load sailor classes');
      }
      if (seasonsResult.error) {
        logger.error('Failed to load user seasons for recruitment', seasonsResult.error);
        throw new Error(seasonsResult.error.message || 'Failed to load season history');
      }
      if (racesResult.error) {
        logger.error('Failed to load race history for recruitment', racesResult.error);
        throw new Error(racesResult.error.message || 'Failed to load race history');
      }

      type SailorClassRow = {
        is_primary: boolean | null;
        boat_classes: { name: string | null } | { name: string | null }[] | null;
      };
      const classRows = (classesResult.data ?? []) as SailorClassRow[];
      const boatClasses: string[] = [];
      const orderedClasses = [...classRows].sort(
        (a, b) => Number(b.is_primary ?? false) - Number(a.is_primary ?? false),
      );
      for (const row of orderedClasses) {
        const embed = row.boat_classes;
        const name = Array.isArray(embed) ? embed[0]?.name : embed?.name;
        if (name && !boatClasses.includes(name)) boatClasses.push(name);
      }

      return {
        boatClasses,
        seasonCount: seasonsResult.data?.length || 0,
        raceCount: racesResult.count || 0,
      };
    },
    enabled: !!user?.id && !coachProfile && !coachingClient,
    staleTime: 10 * 60 * 1000,
  });

  // Determine relationship status
  let relationship: CoachingRelationship = 'NO_RELATIONSHIP';
  if (coachProfile || capabilities?.hasCoaching) {
    relationship = 'IS_COACH';
  } else if (coachingClient) {
    relationship = 'HAS_COACH';
  }

  const isLoading = loadingCoach || loadingClient || loadingSailor || !dismissalsLoaded;
  const error = (coachProfileError || coachingClientError || sailorDataError) as Error | null;

  // Check if a context is dismissed
  const isDismissed = useCallback(
    (context: RecruitmentContext): boolean => {
      const dismissedAt = dismissals[context];
      if (!dismissedAt) return false;
      return Date.now() - dismissedAt < DISMISSAL_DURATION_MS;
    },
    [dismissals]
  );

  // Should show prompt for a context
  const shouldShowPrompt = useCallback(
    (context: RecruitmentContext): boolean => {
      // Never show if user is a coach
      if (relationship === 'IS_COACH') return false;

      // Check dismissal
      if (isDismissed(context)) return false;

      // Context-specific rules
      switch (context) {
        case 'coaches_tab':
          // Show banner for NO_RELATIONSHIP users
          return relationship === 'NO_RELATIONSHIP';
        case 'course_completion':
          // Show for NO_RELATIONSHIP users
          return relationship === 'NO_RELATIONSHIP';
        case 'coach_profile':
          // Show subtle link for HAS_COACH users
          return relationship === 'HAS_COACH';
        default:
          return false;
      }
    },
    [relationship, isDismissed]
  );

  // Dismiss a context
  const dismiss = useCallback(
    async (context: RecruitmentContext) => {
      const updated = {
        ...dismissals,
        [context]: Date.now(),
      };
      if (!isMountedRef.current) return;
      setDismissals(updated);
      await AsyncStorage.setItem(DISMISSAL_STORAGE_KEY, JSON.stringify(updated));
    },
    [dismissals]
  );

  // Get personalized banner message
  const getBannerMessage = useCallback((): { title: string; subtitle: string } => {
    const profile = sailorData || { boatClasses: [], seasonCount: 0, raceCount: 0 };

    if (profile.boatClasses.length > 0 && profile.seasonCount > 0) {
      const boatClass = profile.boatClasses[0];
      return {
        title: 'Share Your Knowledge',
        subtitle: `You've been racing ${boatClass} for ${profile.seasonCount} season${profile.seasonCount === 1 ? '' : 's'}. Help others improve — become a BetterAt coach.`,
      };
    }

    if (profile.seasonCount > 0) {
      return {
        title: 'Share Your Knowledge',
        subtitle: `${profile.seasonCount} season${profile.seasonCount === 1 ? '' : 's'} of sailing experience? Help others improve — become a BetterAt coach.`,
      };
    }

    if (profile.raceCount > 0) {
      return {
        title: 'Share Your Knowledge',
      subtitle: 'Your racing experience could help others. Become a BetterAt coach.',
      };
    }

    return {
      title: 'Become a Coach',
      subtitle: 'Experienced sailor? Help others improve — become a BetterAt coach.',
    };
  }, [sailorData]);

  return {
    relationship,
    sailorProfile: sailorData || { boatClasses: [], seasonCount: 0, raceCount: 0 },
    isLoading,
    error,
    shouldShowPrompt,
    isDismissed,
    dismiss,
    getBannerMessage,
  };
}
