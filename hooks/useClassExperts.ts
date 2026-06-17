/**
 * useClassExperts Hook
 *
 * Discovers high-performing sailors by boat class who share openly.
 * Uses expert scoring algorithm: results performance + sharing activity.
 *
 * Discovery Mode: Class Expert Discovery
 * - "Learn from top Dragon sailors"
 * - Filtered by user's boat class
 * - Ranked by podium finishes + content sharing
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useClassExperts');

function normalizeClassExpertsError(error: unknown): string {
  const code = (error as any)?.code;
  const message = typeof (error as any)?.message === 'string' ? (error as any).message : '';
  const normalized = message.toLowerCase();

  if (code === '42883' || normalized.includes('get_class_experts')) {
    return '[CLASS_EXPERTS_RPC_UNAVAILABLE] Class experts are temporarily unavailable.';
  }
  if (code === '42501' || normalized.includes('row-level security') || normalized.includes('permission denied')) {
    return '[CLASS_EXPERTS_RLS] Class experts are unavailable due to access policy restrictions.';
  }
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('timed out')) {
    return '[CLASS_EXPERTS_NETWORK] Unable to load class experts due to a network issue.';
  }
  if (message.trim()) {
    return message.trim();
  }
  return 'Failed to load class experts.';
}

/**
 * Expert sailor profile with scoring
 */
export interface ClassExpert {
  userId: string;
  userName: string;
  avatarEmoji?: string;
  avatarColor?: string;
  expertScore: number;
  podiumCount: number;
  publicRaceCount: number;
  recentActivity: boolean;
  isFollowing?: boolean;
  // Preview content (loaded on demand)
  recentRaces?: ExpertRacePreview[];
}

/**
 * Race preview for expert card
 */
export interface ExpertRacePreview {
  id: string;
  name: string;
  date: string;
  hasPrepNotes: boolean;
  hasPostRaceNotes: boolean;
}

/**
 * Hook options
 */
export interface UseClassExpertsOptions {
  /** Boat class ID to filter experts */
  classId?: string;
  /** Maximum number of experts to return */
  limit?: number;
  /** Whether to auto-fetch on mount */
  enabled?: boolean;
}

/**
 * Hook return type
 */
export interface UseClassExpertsResult {
  /** Expert sailors */
  experts: ClassExpert[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh data */
  refresh: () => Promise<void>;
  /** Load race previews for an expert */
  loadExpertRaces: (expertUserId: string) => Promise<ExpertRacePreview[]>;
  /** Toggle follow for an expert */
  toggleFollow: (expertUserId: string) => Promise<void>;
}

/**
 * Hook to discover class experts
 */
export function useClassExperts(
  options: UseClassExpertsOptions = {}
): UseClassExpertsResult {
  const { classId, limit = 10, enabled = true } = options;
  const { user, isGuest } = useAuth();
  const [experts, setExperts] = useState<ClassExpert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;

  const fetchFallbackExperts = useCallback(async (): Promise<ClassExpert[]> => {
    if (!classId) return [];

    const { data: boats, error: boatsError } = await supabase
      .from('sailor_boats')
      .select('sailor_id')
      .eq('class_id', classId)
      .limit(limit * 8);

    if (boatsError) {
      throw boatsError;
    }

    const candidateIds = Array.from(
      new Set(
        (boats || [])
          .map((row: any) => row?.sailor_id)
          .filter((id: any) => Boolean(id) && id !== userId)
      )
    ) as string[];

    if (candidateIds.length === 0) return [];

    const [{ data: profiles, error: profilesError }, { data: follows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', candidateIds),
      userId
        ? supabase.from('user_follows').select('following_id').eq('follower_id', userId)
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ]);

    if (profilesError) {
      throw profilesError;
    }

    const followingIds = new Set((follows || []).map((f: any) => f.following_id));

    const { data: recentRaces } = await supabase
      .from('regattas')
      .select('created_by, start_date')
      .in('created_by', candidateIds)
      .gte('start_date', new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString())
      .limit(400);

    const raceCountByUser = new Map<string, number>();
    (recentRaces || []).forEach((race: any) => {
      const owner = race?.created_by;
      if (!owner) return;
      raceCountByUser.set(owner, (raceCountByUser.get(owner) || 0) + 1);
    });

    const fallbackExperts: ClassExpert[] = (profiles || [])
      .map((profile: any) => {
        const publicRaceCount = raceCountByUser.get(profile.id) || 0;
        const recentActivity = publicRaceCount > 0;
        const expertScore = Math.min(100, 30 + publicRaceCount * 8);
        return {
          userId: profile.id,
          userName: profile.full_name || 'Sailor',
          avatarEmoji: profile.avatar_emoji || undefined,
          avatarColor: profile.avatar_color || undefined,
          expertScore,
          podiumCount: 0,
          publicRaceCount,
          recentActivity,
          isFollowing: followingIds.has(profile.id),
        } satisfies ClassExpert;
      })
      .sort((a, b) => b.expertScore - a.expertScore)
      .slice(0, limit);

    return fallbackExperts;
  }, [classId, limit, userId]);

  // Fetch class experts using database function
  const fetchExperts = useCallback(async () => {
    if (!enabled || !classId || isGuest) {
      setExperts([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info('[useClassExperts] Fetching experts for class:', classId);

      // Call the database function
      const { data, error: rpcError } = await supabase.rpc('get_class_experts', {
        target_class_id: classId,
        exclude_user_id: userId || null,
        result_limit: limit,
      });

      if (rpcError) {
        const rpcCode = rpcError?.code;
        const rpcMessage = (rpcError?.message || '').toLowerCase();
        const rpcUnavailable =
          rpcCode === '42883' || rpcMessage.includes('get_class_experts');
        if (!rpcUnavailable) {
          throw rpcError;
        }

        logger.warn('[useClassExperts] RPC unavailable, using fallback expert query');
        const fallbackExperts = await fetchFallbackExperts();
        setExperts(fallbackExperts);
        setError(
          fallbackExperts.length > 0
            ? null
            : '[CLASS_EXPERTS_RPC_UNAVAILABLE] Class experts are temporarily unavailable.'
        );
        return;
      }

      // Get following status for current user
      let followingIds: Set<string> = new Set();
      if (userId) {
        const { data: follows } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', userId);

        if (follows) {
          followingIds = new Set(follows.map((f: any) => f.following_id));
        }
      }

      const foundExperts: ClassExpert[] = (data || []).map((e: any) => ({
        userId: e.user_id,
        userName: e.user_name,
        avatarEmoji: e.avatar_emoji,
        avatarColor: e.avatar_color,
        expertScore: e.expert_score,
        podiumCount: e.podium_count,
        publicRaceCount: e.public_race_count,
        recentActivity: e.recent_activity,
        isFollowing: followingIds.has(e.user_id),
      }));

      setExperts(foundExperts);
      setError(null);
      logger.info('[useClassExperts] Found experts:', foundExperts.length);
    } catch (err: any) {
      logger.error('[useClassExperts] Error:', err);
      setError(normalizeClassExpertsError(err));
      setExperts([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, classId, userId, limit, isGuest, fetchFallbackExperts]);

  // Load race previews for an expert
  const loadExpertRaces = useCallback(async (expertUserId: string): Promise<ExpertRacePreview[]> => {
    try {
      // Check if expert allows sharing
      const { data: sailorProfile, error: profileError } = await supabase
        .from('sailor_profiles')
        .select('allow_follower_sharing')
        .eq('user_id', expertUserId)
        .maybeSingle();

      if (profileError) {
        logger.warn('[useClassExperts] Error checking sharing setting:', profileError);
      }

      // If sharing is explicitly disabled, return empty
      if (sailorProfile?.allow_follower_sharing === false) {
        setError(null);
        return [];
      }

      const { data, error: fetchError } = await supabase
        .from('regattas')
        .select('id, name, start_date, prep_notes, post_race_notes')
        .eq('created_by', expertUserId)
        .order('start_date', { ascending: false })
        .limit(5);

      if (fetchError) {
        throw fetchError;
      }

      const previews: ExpertRacePreview[] = (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        date: r.start_date,
        hasPrepNotes: !!r.prep_notes,
        hasPostRaceNotes: !!r.post_race_notes,
      }));

      // Update expert with race previews
      setExperts((prev) =>
        prev.map((e) => (e.userId === expertUserId ? { ...e, recentRaces: previews } : e))
      );
      setError(null);

      return previews;
    } catch (err: any) {
      logger.error('[useClassExperts] Error loading races:', err);
      setError(normalizeClassExpertsError(err));
      return [];
    }
  }, []);

  // Toggle follow for an expert
  const toggleFollow = useCallback(async (expertUserId: string) => {
    if (!userId) return;

    try {
      const expert = experts.find((e) => e.userId === expertUserId);
      if (!expert) return;

      if (expert.isFollowing) {
        const { error: deleteError } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', userId)
          .eq('following_id', expertUserId);
        if (deleteError) throw deleteError;
      } else {
        const { error: insertError } = await supabase.from('user_follows').insert({
          follower_id: userId,
          following_id: expertUserId,
        });
        if (insertError) throw insertError;
      }

      // Update local state
      setExperts((prev) =>
        prev.map((e) =>
          e.userId === expertUserId ? { ...e, isFollowing: !e.isFollowing } : e
        )
      );
      setError(null);

      logger.info('[useClassExperts] Toggled follow:', {
        expertUserId,
        nowFollowing: !expert.isFollowing,
      });
    } catch (err: any) {
      logger.error('[useClassExperts] Error toggling follow:', err);
      setError(normalizeClassExpertsError(err));
    }
  }, [userId, experts]);

  // Initial fetch
  useEffect(() => {
    fetchExperts();
  }, [fetchExperts]);

  return {
    experts,
    isLoading,
    error,
    refresh: fetchExperts,
    loadExpertRaces,
    toggleFollow,
  };
}

/**
 * Hook to get user's primary boat class
 */
export function useUserBoatClass(): {
  classId: string | null;
  className: string | null;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);
  const fetchRunIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRunIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const runId = ++fetchRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === fetchRunIdRef.current;

    if (!user?.id) {
      if (!canCommit()) return;
      setClassId(null);
      setClassName(null);
      setIsLoading(false);
      return;
    }

    if (!canCommit()) return;
    setIsLoading(true);

    const fetchBoatClass = async () => {
      try {
        // Get user's primary boat
        const { data: boat } = await supabase
          .from('sailor_boats')
          .select('class_id, boat_classes(id, name)')
          .eq('sailor_id', user.id)
          .eq('is_primary', true)
          .maybeSingle();

        if (boat) {
          if (!canCommit()) return;
          setClassId(boat.class_id);
          setClassName((boat.boat_classes as any)?.name || null);
        } else {
          // Try getting any boat
          const { data: anyBoat } = await supabase
            .from('sailor_boats')
            .select('class_id, boat_classes(id, name)')
            .eq('sailor_id', user.id)
            .limit(1)
            .maybeSingle();

          if (anyBoat) {
            if (!canCommit()) return;
            setClassId(anyBoat.class_id);
            setClassName((anyBoat.boat_classes as any)?.name || null);
          } else {
            if (!canCommit()) return;
            setClassId(null);
            setClassName(null);
          }
        }
      } catch (err) {
        logger.error('[useUserBoatClass] Error:', err);
      } finally {
        if (!canCommit()) return;
        setIsLoading(false);
      }
    };

    void fetchBoatClass();
  }, [user?.id]);

  return { classId, className, isLoading };
}

export default useClassExperts;
