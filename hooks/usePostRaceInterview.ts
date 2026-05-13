/**
 * usePostRaceInterview Hook
 *
 * Manages post-race interview state, including loading user sessions,
 * triggering interviews on race completion, and handling interview completion.
 */

import { useCallback, useEffect, useState } from 'react';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import { isPersistedRaceId } from '@/lib/races/isPersistedRaceId';

const logger = createLogger('usePostRaceInterview');

// =============================================================================
// TYPES
// =============================================================================

export interface RaceTimerSession {
  id: string;
  sailor_id: string;
  regatta_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  track_points?: unknown[];
  [key: string]: unknown;
}

export interface SelectedRaceDataForInterview {
  name?: string;
  start_date?: string;
  [key: string]: unknown;
}

export interface UserForInterview {
  id: string;
  [key: string]: unknown;
}

export interface UsePostRaceInterviewParams {
  /** Currently selected race ID */
  selectedRaceId: string | null;
  /** Selected race data object */
  selectedRaceData: SelectedRaceDataForInterview | null;
  /** Current user */
  user: UserForInterview | null;
  /** Refetch function to refresh race data after interview */
  refetch?: () => void;
}

export interface UsePostRaceInterviewReturn {
  /** Whether post-race interview modal is shown */
  showPostRaceInterview: boolean;
  /** ID of the completed session for the interview */
  completedSessionId: string | null;
  /** Name of the completed race */
  completedRaceName: string;
  /** ID of the completed race */
  completedRaceId: string | null;
  /** Number of GPS points recorded in the session */
  completedSessionGpsPoints: number;
  /** User's most recent race timer session for this race */
  userPostRaceSession: RaceTimerSession | null;
  /** Whether user post-race session is loading */
  loadingUserPostRaceSession: boolean;
  /** Handler to manually open post-race interview - accepts optional raceId/raceData to avoid stale closure issues */
  handleOpenPostRaceInterviewManually: (overrideRaceId?: string, overrideRaceData?: SelectedRaceDataForInterview) => Promise<void>;
  /** Handler called when a race is completed (triggers interview) */
  handleRaceComplete: (sessionId: string, raceName: string, raceId?: string) => Promise<void>;
  /** Handler called when interview is completed */
  handlePostRaceInterviewComplete: () => void;
  /** Handler to close the interview modal */
  handleClosePostRaceInterview: () => void;
  /** Setter for showPostRaceInterview (for external control) */
  setShowPostRaceInterview: React.Dispatch<React.SetStateAction<boolean>>;
  /** Setter for completedRaceName (for external control) */
  setCompletedRaceName: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Hook for managing post-race interview flow
 */
export function usePostRaceInterview({
  selectedRaceId,
  selectedRaceData,
  user,
  refetch,
}: UsePostRaceInterviewParams): UsePostRaceInterviewReturn {
  // Post-race interview state
  const [showPostRaceInterview, setShowPostRaceInterview] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const [completedRaceName, setCompletedRaceName] = useState<string>('');
  const [completedRaceId, setCompletedRaceId] = useState<string | null>(null);
  const [completedSessionGpsPoints, setCompletedSessionGpsPoints] = useState<number>(0);
  const [userPostRaceSession, setUserPostRaceSession] = useState<RaceTimerSession | null>(null);
  const [loadingUserPostRaceSession, setLoadingUserPostRaceSession] = useState(false);

  // Load user's most recent race timer session for the selected race
  const loadUserPostRaceSession = useCallback(async () => {
    logger.debug('[POST_RACE_LOAD] loadUserPostRaceSession called', {
      selectedRaceId,
      userId: user?.id,
    });

    if (!user?.id || !isPersistedRaceId(selectedRaceId)) {
      // Guards: no user, no id, demo/sample id, or an in-flight optimistic
      // `temp-` id. Any of those would produce a 400 on `regatta_id=eq.{id}`.
      logger.debug('[POST_RACE_LOAD] Skipping — missing userId or non-persisted raceId, clearing session');
      setUserPostRaceSession(null);
      return;
    }

    setLoadingUserPostRaceSession(true);
    try {
      let data: any[] | null = null;
      let error: any = null;
      const primary = await supabase
        .from('race_timer_sessions')
        .select('*')
        .eq('regatta_id', selectedRaceId)
        .eq('sailor_id', user.id)
        .order('end_time', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      data = primary.data;
      error = primary.error;

      if (isMissingIdColumn(error, 'race_timer_sessions', 'regatta_id')) {
        const fallback = await supabase
          .from('race_timer_sessions')
          .select('*')
          .eq('race_id', selectedRaceId)
          .eq('sailor_id', user.id)
          .order('end_time', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1);
        data = fallback.data;
        error = fallback.error;
      }

      logger.debug('[POST_RACE_LOAD] Query result', {
        error: error ? { message: error.message, code: error.code } : null,
        rowCount: data?.length ?? 0,
        sessionData: data?.[0] ? {
          id: data[0].id,
          self_reported_position: data[0].self_reported_position,
          self_reported_fleet_size: data[0].self_reported_fleet_size,
          key_moment: data[0].key_moment,
          notes: data[0].notes?.substring(0, 50),
        } : null,
      });

      if (error) {
        logger.warn('[usePostRaceInterview] Unable to load user race session', {
          error,
          selectedRaceId,
        });
        setUserPostRaceSession(null);
        return;
      }

      setUserPostRaceSession(data && data.length > 0 ? (data[0] as RaceTimerSession) : null);
    } catch (error) {
      logger.warn('[usePostRaceInterview] Unexpected error loading user race session', error);
      setUserPostRaceSession(null);
    } finally {
      setLoadingUserPostRaceSession(false);
    }
  }, [selectedRaceId, user?.id]);

  // Load user session when race selection changes
  useEffect(() => {
    loadUserPostRaceSession();
  }, [loadUserPostRaceSession]);

  // Handler to manually open post-race interview (creates session if needed)
  // Accepts optional overrideRaceId/overrideRaceData to avoid stale closure issues when called from setTimeout
  const handleOpenPostRaceInterviewManually = useCallback(async (
    overrideRaceId?: string,
    overrideRaceData?: SelectedRaceDataForInterview
  ) => {
    // Use overrides if provided (fixes stale closure issues when called from setTimeout)
    const effectiveRaceId = overrideRaceId || selectedRaceId;
    const effectiveRaceData = overrideRaceData || selectedRaceData;

    logger.debug('[POST_RACE_OPEN] handleOpenPostRaceInterviewManually called', {
      userId: user?.id,
      selectedRaceId,
      effectiveRaceId,
      hasSelectedRaceData: !!selectedRaceData,
      hasEffectiveRaceData: !!effectiveRaceData,
      usedOverride: !!overrideRaceId,
      existingSessionId: userPostRaceSession?.id,
    });

    if (!user?.id) {
      showAlert('Post-Race Interview', 'You need to be signed in to add post-race notes.');
      return;
    }

    if (!effectiveRaceId || !effectiveRaceData) {
      showAlert('Post-Race Interview', 'Select a race first to add your post-race interview.');
      return;
    }

    setLoadingUserPostRaceSession(true);
    try {
      // ALWAYS fetch fresh session data to avoid creating duplicates
      // This is critical because another component (StructuredDebriefInterview) may have
      // created a session since we last loaded, and we want to use that same session
      logger.debug('[POST_RACE_OPEN] Fetching fresh session data to avoid duplicates');
      let freshSessions: any[] | null = null;
      let fetchError: any = null;
      const primaryFresh = await supabase
        .from('race_timer_sessions')
        .select('*')
        .eq('regatta_id', effectiveRaceId)
        .eq('sailor_id', user.id)
        .order('end_time', { ascending: false })
        .limit(1);
      freshSessions = primaryFresh.data;
      fetchError = primaryFresh.error;

      if (isMissingIdColumn(fetchError, 'race_timer_sessions', 'regatta_id')) {
        const fallbackFresh = await supabase
          .from('race_timer_sessions')
          .select('*')
          .eq('race_id', effectiveRaceId)
          .eq('sailor_id', user.id)
          .order('end_time', { ascending: false })
          .limit(1);
        freshSessions = fallbackFresh.data;
        fetchError = fallbackFresh.error;
      }

      let session: RaceTimerSession | null = null;

      if (fetchError) {
        logger.warn('[POST_RACE_OPEN] Error fetching fresh session, falling back to state', fetchError);
        session = userPostRaceSession;
      } else {
        session = freshSessions && freshSessions.length > 0 ? (freshSessions[0] as RaceTimerSession) : null;
        logger.debug('[POST_RACE_OPEN] Fresh session lookup result', {
          foundSession: !!session,
          sessionId: session?.id,
          hasDebriefResponses: !!(session as any)?.debrief_responses,
          hasSelfReportedPosition: !!(session as any)?.self_reported_position,
        });
      }

      // Create a new session if one doesn't exist
      if (!session) {
        logger.debug('[POST_RACE_OPEN] No existing session, creating new one');
        const nowIso = new Date().toISOString();
        const startTime = effectiveRaceData.start_date || nowIso;

        const primaryCreate = await supabase
          .from('race_timer_sessions')
          .insert({
            sailor_id: user.id,
            regatta_id: effectiveRaceId,
            start_time: startTime,
            end_time: nowIso,
            duration_seconds: 0,
          })
          .select()
          .single();
        let createdSession = primaryCreate.data;
        let error = primaryCreate.error;

        if (isMissingIdColumn(error, 'race_timer_sessions', 'regatta_id')) {
          const fallbackCreate = await supabase
            .from('race_timer_sessions')
            .insert({
              sailor_id: user.id,
              race_id: effectiveRaceId,
              start_time: startTime,
              end_time: nowIso,
              duration_seconds: 0,
            })
            .select()
            .single();
          createdSession = fallbackCreate.data;
          error = fallbackCreate.error;
        }

        if (error) {
          logger.error('[POST_RACE_OPEN] Failed to create session', error);
          throw error;
        }

        logger.debug('[POST_RACE_OPEN] Created new session', { sessionId: createdSession?.id });
        session = createdSession as RaceTimerSession;
        // Update state session so subsequent calls use this session
        setUserPostRaceSession(createdSession as RaceTimerSession);
      } else {
        logger.debug('[POST_RACE_OPEN] Using existing session', { sessionId: session.id });
      }

      if (!session?.id) {
        throw new Error('Missing race timer session');
      }

      logger.debug('[POST_RACE_OPEN] Setting completedSessionId', { sessionId: session.id });
      setCompletedSessionId(session.id);
      setCompletedRaceName(effectiveRaceData.name ?? 'Race');
      setCompletedRaceId(effectiveRaceId);
      setShowPostRaceInterview(true);
    } catch (error: any) {
      logger.error('[usePostRaceInterview] Failed to open post-race interview manually', error);
      showAlert(
        'Post-Race Interview',
        error?.message
          ? `Unable to open interview: ${error.message}`
          : 'We could not open the post-race interview. Please try again.'
      );
    } finally {
      setLoadingUserPostRaceSession(false);
    }
  }, [selectedRaceData, selectedRaceId, user?.id, userPostRaceSession]);

  // Handler for race completion - triggers post-race interview
  const handleRaceComplete = useCallback(async (sessionId: string, raceName: string, raceId?: string) => {
    logger.debug('Race completed:', sessionId, raceName, raceId);

    // Fetch GPS point count from the session
    try {
      const { data: session } = await supabase
        .from('race_timer_sessions')
        .select('track_points')
        .eq('id', sessionId)
        .single();

      const pointCount = Array.isArray(session?.track_points) ? session.track_points.length : 0;
      setCompletedSessionGpsPoints(pointCount);
    } catch (error) {
      logger.warn('Failed to fetch GPS points count', error);
      setCompletedSessionGpsPoints(0);
    }

    setCompletedSessionId(sessionId);
    setCompletedRaceName(raceName);
    setCompletedRaceId(raceId || null);
    setShowPostRaceInterview(true);
  }, []);

  // Handler for post-race interview completion
  const handlePostRaceInterviewComplete = useCallback(() => {
    logger.debug('Post-race interview completed');
    setShowPostRaceInterview(false);
    setCompletedSessionId(null);
    setCompletedRaceName('');
    setCompletedRaceId(null);
    setCompletedSessionGpsPoints(0);
    loadUserPostRaceSession();
    // Refresh races data to show updated analysis
    refetch?.();
  }, [loadUserPostRaceSession, refetch]);

  // Handler to close the interview modal
  const handleClosePostRaceInterview = useCallback(() => {
    setShowPostRaceInterview(false);
    setCompletedSessionId(null);
    setCompletedRaceName('');
    setCompletedRaceId(null);
    setCompletedSessionGpsPoints(0);
  }, []);

  return {
    showPostRaceInterview,
    completedSessionId,
    completedRaceName,
    completedRaceId,
    completedSessionGpsPoints,
    userPostRaceSession,
    loadingUserPostRaceSession,
    handleOpenPostRaceInterviewManually,
    handleRaceComplete,
    handlePostRaceInterviewComplete,
    handleClosePostRaceInterview,
    setShowPostRaceInterview,
    setCompletedRaceName,
  };
}

export default usePostRaceInterview;
