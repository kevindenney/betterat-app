import { createChannelName, realtimeService } from '@/services/RealtimeService';
import { supabase } from '@/services/supabase';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '@/lib/utils/logger';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';

const logger = createLogger('RaceResults');

/**
 * Validates if a string is a valid UUID format
 */
const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

type TrackedSubscription = {
  name: string;
  callback: (payload: any) => void;
  runId: number;
  attempts: number;
};

const UNSUBSCRIBE_TIMEOUT_MS = 4000;

async function unsubscribeWithTimeout(
  channelName: string,
  callback: (payload: any) => void
): Promise<void> {
  await Promise.race([
    realtimeService.unsubscribe(channelName, callback),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`unsubscribe timeout for ${channelName}`)), UNSUBSCRIBE_TIMEOUT_MS)
    ),
  ]);
}

async function unsubscribeTrackedSubscriptions(
  tracked: TrackedSubscription[],
  context: string
): Promise<TrackedSubscription[]> {
  const MAX_UNSUBSCRIBE_RETRIES = 2;
  const failed: TrackedSubscription[] = [];

  await Promise.all(
    tracked.map(async (entry) => {
      try {
        await unsubscribeWithTimeout(entry.name, entry.callback);
      } catch (err) {
        if (entry.attempts + 1 < MAX_UNSUBSCRIBE_RETRIES) {
          failed.push({ ...entry, attempts: entry.attempts + 1 });
        }
        logger.error(`${context}:`, err);
      }
    })
  );

  return failed;
}

function mergeTrackedSubscriptions(
  current: TrackedSubscription[],
  incoming: TrackedSubscription[]
): TrackedSubscription[] {
  if (incoming.length === 0) return current;

  const merged = [...current];
  incoming.forEach((entry) => {
    const existingIndex = merged.findIndex(
      (candidate) =>
        candidate.runId === entry.runId &&
        candidate.name === entry.name &&
        candidate.callback === entry.callback
    );

    if (existingIndex === -1) {
      merged.push(entry);
      return;
    }

    if (entry.attempts > merged[existingIndex].attempts) {
      merged[existingIndex] = entry;
    }
  });

  return merged;
}

export interface RaceResult {
  id: string;
  regatta_id?: string;
  race_id?: string;
  race_number?: number;
  sailor_id: string;
  position: number;
  points: number;
  finish_time?: string;
  dnf?: boolean;
  dsq?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Race {
  id: string;
  regatta_id: string;
  race_number: number;
  created_by?: string;
  start_date?: string;
  scheduled_start: string;
  actual_start?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'abandoned';
  course_config?: any;
  weather_snapshot?: any;
}

/**
 * Hook for real-time race results updates
 */
export function useRaceResults(raceId?: string) {
  const [results, setResults] = useState<RaceResult[]>([]);
  const [race, setRace] = useState<Race | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const loadRunIdRef = useRef(0);
  const subscriptionsRef = useRef<TrackedSubscription[]>([]);
  const effectRunIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      loadRunIdRef.current += 1;
      effectRunIdRef.current += 1;
      const tracked = [...subscriptionsRef.current];
      subscriptionsRef.current = [];
      void unsubscribeTrackedSubscriptions(
        tracked,
        'Error unsubscribing race results channel during unmount'
      );
    };
  }, []);

  // Load initial results
  const loadResults = useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === loadRunIdRef.current;

    if (!raceId || !isValidUUID(raceId)) {
      // Skip Supabase query for missing or demo race IDs
      if (!canCommit()) return;
      setResults([]);
      setRace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load race/regatta details
      const { data: raceData, error: raceError } = await supabase
        .from('regattas')
        .select('*')
        .eq('id', raceId)
        .single();

      if (raceError) throw raceError;
      if (!canCommit()) return;
      setRace(raceData);

      // Load results
      const primaryResults = await supabase
        .from('race_results')
        .select('*')
        .eq('regatta_id', raceId)
        .order('position', { ascending: true });
      let resultsData = primaryResults.data;
      let resultsError = primaryResults.error;
      if (resultsError && isMissingIdColumn(resultsError, 'race_results', 'regatta_id')) {
        const fallbackResults = await supabase
          .from('race_results')
          .select('*')
          .eq('race_id', raceId)
          .order('position', { ascending: true });
        resultsData = fallbackResults.data;
        resultsError = fallbackResults.error;
      }

      if (resultsError) throw resultsError;
      if (!canCommit()) return;
      setResults(resultsData || []);
    } catch (err) {
      logger.error('Error loading results:', err);
      if (!canCommit()) return;
      setError(err as Error);
    } finally {
      if (!canCommit()) return;
      setLoading(false);
    }
  }, [raceId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!raceId || !isValidUUID(raceId)) {
      loadRunIdRef.current += 1; // invalidate any in-flight load for previous race id
      if (!isMountedRef.current) return;
      setResults([]);
      setRace(null);
      setError(null);
      setLoading(false);
      return;
    }

    let effectDisposed = false;
    const currentRunId = ++effectRunIdRef.current;
    const isActiveRun = () =>
      isMountedRef.current && !effectDisposed && effectRunIdRef.current === currentRunId;

    const teardownChannels = async () => {
      const tracked = subscriptionsRef.current.filter((entry) => entry.runId === currentRunId);
      subscriptionsRef.current = subscriptionsRef.current.filter((entry) => entry.runId !== currentRunId);
      const failed = await unsubscribeTrackedSubscriptions(
        tracked,
        'Error unsubscribing race results channel'
      );
      if (failed.length > 0 && isActiveRun()) {
        subscriptionsRef.current = mergeTrackedSubscriptions(subscriptionsRef.current, failed);
      }
    };

    const staleTracked = subscriptionsRef.current.filter((entry) => entry.runId !== currentRunId);
    if (staleTracked.length > 0) {
      subscriptionsRef.current = subscriptionsRef.current.filter((entry) => entry.runId === currentRunId);
      void unsubscribeTrackedSubscriptions(
        staleTracked,
        'Error unsubscribing stale race results channel'
      ).then((failed) => {
        if (failed.length > 0 && isMountedRef.current) {
          subscriptionsRef.current = mergeTrackedSubscriptions(subscriptionsRef.current, failed);
        }
      });
    }

    const registerSubscription = (name: string, callback: (payload: any) => void) => {
      if (!isActiveRun()) {
        void realtimeService.unsubscribe(name, callback).catch((err) => {
          logger.error(`Error unsubscribing stale ${name} channel:`, err);
        });
        return;
      }
      const next: TrackedSubscription = { name, callback, runId: currentRunId, attempts: 0 };
      subscriptionsRef.current = mergeTrackedSubscriptions(subscriptionsRef.current, [next]);
    };

    void loadResults();

    const channelName = createChannelName('race-results', raceId);
    const onRaceResultsPayload = (payload: any) => {
      if (!isActiveRun()) return;
      const payloadRaceId = payload?.new?.regatta_id || payload?.new?.race_id || payload?.old?.regatta_id || payload?.old?.race_id;
      if (payloadRaceId !== raceId) return;

      if (payload.eventType === 'INSERT') {
        setResults((prev) => {
          const next = payload.new as RaceResult;
          if (!next?.id || prev.some((item) => item.id === next.id)) {
            return prev;
          }
          return [...prev, next].sort((a, b) => a.position - b.position);
        });
      } else if (payload.eventType === 'UPDATE') {
        setResults((prev) => {
          const next = payload.new as RaceResult;
          if (!next?.id) return prev;
          const index = prev.findIndex((item) => item.id === next.id);
          if (index === -1) {
            return [...prev, next].sort((a, b) => a.position - b.position);
          }
          const updated = [...prev];
          updated[index] = next;
          return updated.sort((a, b) => a.position - b.position);
        });
      } else if (payload.eventType === 'DELETE') {
        setResults((prev) => prev.filter((r) => r.id !== payload.old.id));
      }
    };

    const safeSubscribe = (
      name: string,
      config: { table: string; filter?: string },
      callback: (payload: any) => void
    ): boolean => {
      try {
        realtimeService.subscribe(
          name,
          config,
          callback
        );
        registerSubscription(name, callback);
        return true;
      } catch (err) {
        logger.error(`Error setting up ${name} realtime subscription:`, err);
        return false;
      }
    };

    // Subscribe to race results updates (both legacy race_id and canonical regatta_id)
    // to support schema drift without listening to the full table.
    const raceResultsByRegattaSubscribed = safeSubscribe(
      `${channelName}:regatta`,
      {
        table: 'race_results',
        filter: `regatta_id=eq.${raceId}`,
      },
      onRaceResultsPayload
    );
    const raceResultsByRaceSubscribed = safeSubscribe(
      `${channelName}:race`,
      {
        table: 'race_results',
        filter: `race_id=eq.${raceId}`,
      },
      onRaceResultsPayload
    );

    // Subscribe to race status updates
    const raceChannelName = createChannelName('race-status', raceId);
    const onRaceStatusPayload = (payload: any) => {
      if (!isActiveRun()) return;
      if (payload.eventType === 'UPDATE') {
        setRace(payload.new as Race);
      }
    };
    const raceStatusSubscribed = safeSubscribe(
      raceChannelName,
      {
        table: 'regattas',
        filter: `id=eq.${raceId}`,
      },
      onRaceStatusPayload
    );
    if ((!raceResultsByRegattaSubscribed && !raceResultsByRaceSubscribed) || !raceStatusSubscribed) {
      void teardownChannels();
      setError(new Error('Realtime race updates unavailable. Pull to refresh.'));
    }

    return () => {
      effectDisposed = true;
      void teardownChannels();
    };
  }, [raceId, loadResults]);

  return {
    results,
    race,
    loading,
    error,
    refresh: loadResults,
  };
}

/**
 * Hook for monitoring live race updates across multiple races
 */
export function useLiveRaces(userId?: string) {
  const [liveRaces, setLiveRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);
  const loadRunIdRef = useRef(0);
  const collaboratorRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionsRef = useRef<TrackedSubscription[]>([]);
  const effectRunIdRef = useRef(0);
  const trackedRaceIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      loadRunIdRef.current += 1;
      effectRunIdRef.current += 1;
      const tracked = [...subscriptionsRef.current];
      subscriptionsRef.current = [];
      void unsubscribeTrackedSubscriptions(
        tracked,
        'Error unsubscribing live races channel during unmount'
      );
      if (collaboratorRefreshTimeoutRef.current) {
        clearTimeout(collaboratorRefreshTimeoutRef.current);
        collaboratorRefreshTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    trackedRaceIdsRef.current = new Set(liveRaces.map((race) => race.id).filter(Boolean));
  }, [liveRaces]);

  // Reset data/loading state when auth context switches users or logs out.
  useEffect(() => {
    hasLoadedRef.current = false;
    loadRunIdRef.current += 1; // invalidate in-flight loaders from previous user context
    if (!isMountedRef.current) return;
    setLiveRaces([]);
    setIsRefreshing(false);
    setLoading(Boolean(userId));
  }, [userId]);

  const loadLiveRaces = useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === loadRunIdRef.current;

    if (!userId) {
      if (!canCommit()) return;
      setLiveRaces([]);
      setIsRefreshing(false);
      hasLoadedRef.current = false;
      setLoading(false);
      return;
    }

    // Only show full loading skeleton on the first fetch.
    // Subsequent fetches (tab re-focus, pull-to-refresh) keep existing data visible.
    if (!hasLoadedRef.current) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const racesById = new Map<string, Race>();
      const addRaces = (races: any[] | null | undefined) => {
        races?.forEach((race: any) => {
          if (race?.id) {
            racesById.set(race.id, race);
          }
        });
      };

      // Stage 1: fire all five independent "which regattas touch this user"
      // lookups concurrently. Previously these ran sequentially and dominated
      // the Race page's cold-load latency on a hard refresh.
      const [
        createdResult,
        participantRowsResult,
        sessionsPrimaryResult,
        raceEventsResult,
        collaboratorRowsResult,
      ] = await Promise.all([
        // Regattas the user created
        supabase
          .from('regattas')
          .select('*')
          .eq('created_by', userId)
          .order('start_date', { ascending: true })
          .limit(100),
        // Regattas the user is registered for (excluding withdrawn)
        supabase
          .from('race_participants')
          .select('regatta_id')
          .eq('user_id', userId)
          .not('regatta_id', 'is', null)
          .neq('status', 'withdrawn')
          .limit(100),
        // Regattas where the user has logged timer sessions
        supabase
          .from('race_timer_sessions')
          .select('regatta_id')
          .eq('sailor_id', userId)
          .not('regatta_id', 'is', null)
          .order('end_time', { ascending: false })
          .limit(200),
        // Race events created by the user (user-created races via add race flow)
        supabase
          .from('race_events')
          .select('*')
          .eq('user_id', userId)
          .order('start_time', { ascending: true })
          .limit(100),
        // Regattas where the user is a collaborator (accepted or pending)
        supabase
          .from('race_collaborators')
          .select('regatta_id, id, access_level, status')
          .eq('user_id', userId)
          .in('status', ['accepted', 'pending']),
      ]);

      const { data: createdRaces, error: createdError } = createdResult;
      if (createdError) {
        logger.warn('Returning empty due to regatta query error:', createdError);
        if (!canCommit()) return;
        setLiveRaces([]);
        setIsRefreshing(false);
        setLoading(false);
        return;
      }
      addRaces(createdRaces as any[]);

      const { data: participantRows, error: participantRegError } = participantRowsResult;
      if (participantRegError) {
        logger.warn('Unable to load registered regattas from race_participants:', participantRegError);
      }

      // Timer sessions — fall back to legacy `race_id` column if `regatta_id`
      // isn't present (older schema). Only runs when stage-1 errored with that
      // specific missing-column signal.
      let sessionRows: { regatta_id?: string | null; race_id?: string | null }[] | null =
        sessionsPrimaryResult.data as any;
      let sessionsError: any = sessionsPrimaryResult.error;
      if (
        sessionsError &&
        isMissingIdColumn(sessionsError, 'race_timer_sessions', 'regatta_id')
      ) {
        const fallbackSessions = await supabase
          .from('race_timer_sessions')
          .select('race_id')
          .eq('sailor_id', userId)
          .not('race_id', 'is', null)
          .order('end_time', { ascending: false })
          .limit(200);
        sessionRows = (fallbackSessions.data as any[] | null)?.map((row: any) => ({
          regatta_id: row.race_id,
          race_id: row.race_id,
        })) || null;
        sessionsError = fallbackSessions.error;
      }
      if (sessionsError) {
        logger.warn('Unable to load participant regattas from race_timer_sessions:', sessionsError);
      }

      const { data: userRaceEvents, error: raceEventsError } = raceEventsResult;
      if (raceEventsError) {
        logger.warn('Unable to load user race_events:', raceEventsError);
      } else {
        const normalizedRaceEvents = (userRaceEvents || []).map((event: any) => ({
          ...event,
          // Map race_events fields to regatta-like structure
          start_date: event.start_time || event.event_date,
          race_name: event.name,
          created_by: event.user_id,
          // Map location to metadata.venue_name so useEnrichedRaces can find it
          metadata: {
            ...(event.metadata || {}),
            venue_name: event.location || event.metadata?.venue_name || null,
            venue: event.location || event.metadata?.venue || null,
          },
          _source: 'race_events',
        }));
        addRaces(normalizedRaceEvents);
      }

      // Map to track collaboration info for each race
      const collaborationInfo = new Map<string, {
        isCollaborator: boolean;
        isPendingInvite: boolean;
        accessLevel: string;
        collaboratorId: string;
      }>();

      const { data: collaboratorRows, error: collaboratorError } = collaboratorRowsResult;
      if (collaboratorError) {
        logger.warn('Unable to load collaborator regattas:', collaboratorError);
      } else {
        (collaboratorRows ?? []).forEach((row) => {
          if (row.regatta_id) {
            collaborationInfo.set(row.regatta_id, {
              isCollaborator: row.status === 'accepted',
              isPendingInvite: row.status === 'pending',
              accessLevel: row.access_level,
              collaboratorId: row.id,
            });
          }
        });
      }

      // Stage 2: batch the three "resolve missing regatta IDs → full row"
      // lookups concurrently. Each input list may be empty, in which case we
      // skip that query entirely.
      const participantRegattaIds = Array.from(
        new Set((participantRows ?? []).map((row) => row.regatta_id).filter(Boolean))
      ) as string[];
      const uniqueSessionRegattaIds = Array.from(
        new Set((sessionRows ?? []).map((row) => row.regatta_id || row.race_id).filter(Boolean))
      ) as string[];
      const collaboratorRegattaIds = Array.from(
        new Set((collaboratorRows ?? []).map((row) => row.regatta_id).filter(Boolean))
      ) as string[];

      const missingParticipantIds = participantRegattaIds.filter((id) => !racesById.has(id));
      const missingSessionIds = uniqueSessionRegattaIds.filter((id) => !racesById.has(id));
      const missingCollaboratorIds = collaboratorRegattaIds.filter((id) => !racesById.has(id));

      const lookupRegattas = (ids: string[]) =>
        ids.length === 0
          ? Promise.resolve({ data: [] as any[], error: null as any })
          : supabase
              .from('regattas')
              .select('*')
              .in('id', ids)
              .order('start_date', { ascending: true });

      const [participantLookup, sessionLookup, collaboratorLookup] = await Promise.all([
        lookupRegattas(missingParticipantIds),
        lookupRegattas(missingSessionIds),
        lookupRegattas(missingCollaboratorIds),
      ]);

      if (participantLookup.error) {
        logger.warn('Unable to load regattas for registered participants:', participantLookup.error);
      } else {
        addRaces(participantLookup.data as any[]);
      }
      if (sessionLookup.error) {
        logger.warn('Unable to load regattas for participant sessions:', sessionLookup.error);
      } else {
        addRaces(sessionLookup.data as any[]);
      }
      if (collaboratorLookup.error) {
        logger.warn('Unable to load regattas for collaborators:', collaboratorLookup.error);
      } else {
        addRaces(collaboratorLookup.data as any[]);
      }

      // Add ownership/collaboration flags to all races
      const merged = Array.from(racesById.values()).map((race: any) => {
        const collabInfo = collaborationInfo.get(race.id);
        return {
          ...race,
          // Ownership flags
          isOwner: race.created_by === userId,
          isCollaborator: collabInfo?.isCollaborator ?? false,
          isPendingInvite: collabInfo?.isPendingInvite ?? false,
          accessLevel: collabInfo?.accessLevel ?? (race.created_by === userId ? 'full' : undefined),
          collaboratorId: collabInfo?.collaboratorId ?? undefined,
        };
      }).sort((a: any, b: any) => {
        const aTime = a?.start_date ? new Date(a.start_date).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b?.start_date ? new Date(b.start_date).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });

      if (!canCommit()) return;
      setLiveRaces(merged);
      hasLoadedRef.current = true;
    } catch (err) {
      logger.error('Error loading races:', err);
      if (!canCommit()) return;
      setLiveRaces([]);
    } finally {
      if (!canCommit()) return;
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let effectDisposed = false;
    const currentRunId = ++effectRunIdRef.current;
    const isActiveRun = () =>
      isMountedRef.current && !effectDisposed && effectRunIdRef.current === currentRunId;

    const teardownChannels = async () => {
      const tracked = subscriptionsRef.current.filter((entry) => entry.runId === currentRunId);
      subscriptionsRef.current = subscriptionsRef.current.filter((entry) => entry.runId !== currentRunId);
      const failed = await unsubscribeTrackedSubscriptions(
        tracked,
        'Error unsubscribing live races channel'
      );
      if (failed.length > 0 && isActiveRun()) {
        subscriptionsRef.current = mergeTrackedSubscriptions(subscriptionsRef.current, failed);
      }
    };

    const staleTracked = subscriptionsRef.current.filter((entry) => entry.runId !== currentRunId);
    if (staleTracked.length > 0) {
      subscriptionsRef.current = subscriptionsRef.current.filter((entry) => entry.runId === currentRunId);
      void unsubscribeTrackedSubscriptions(
        staleTracked,
        'Error unsubscribing stale live races channel'
      ).then((failed) => {
        if (failed.length > 0 && isMountedRef.current) {
          subscriptionsRef.current = mergeTrackedSubscriptions(subscriptionsRef.current, failed);
        }
      });
    }

    const registerSubscription = (name: string, callback: (payload: any) => void) => {
      if (!isActiveRun()) {
        void realtimeService.unsubscribe(name, callback).catch((err) => {
          logger.error(`Error unsubscribing stale ${name} channel:`, err);
        });
        return;
      }
      const next: TrackedSubscription = { name, callback, runId: currentRunId, attempts: 0 };
      subscriptionsRef.current = mergeTrackedSubscriptions(subscriptionsRef.current, [next]);
    };

    const safeSubscribe = (
      name: string,
      config: { table: string; filter?: string },
      callback: (payload: any) => void
    ): boolean => {
      try {
        realtimeService.subscribe(name, config, callback);
        registerSubscription(name, callback);
        return true;
      } catch (err) {
        logger.error(`Error setting up ${name} realtime subscription:`, err);
        return false;
      }
    };

    void loadLiveRaces();

    // Subscribe to regatta changes for the user (INSERT, UPDATE, DELETE)
    // Only set up subscription if we successfully loaded races
    const channelName = createChannelName('user-regattas', userId);
    const onRegattasPayload = (payload: any) => {
      if (!isActiveRun()) return;
      try {
        const raceId = payload?.new?.id || payload?.old?.id;
        const isTrackedRace = raceId ? trackedRaceIdsRef.current.has(raceId) : false;

        if (payload.eventType === 'INSERT') {
          // Add new race to the list
          const newRace = payload.new as Race;
          const isRelevantToUser =
            newRace?.created_by === userId ||
            (newRace as any)?.isOwner ||
            (newRace as any)?.isCollaborator ||
            (newRace as any)?.isPendingInvite;
          if (!isRelevantToUser && !isTrackedRace) {
            return;
          }
          setLiveRaces((prev) => {
            // Ignore unrelated races to avoid broad-table churn
            if (!isRelevantToUser && !prev.some((r) => r.id === newRace.id)) {
              return prev;
            }
            // Check if race already exists to avoid duplicates
            if (prev.some((r) => r.id === newRace.id)) {
              return prev;
            }
            // Add and sort by start_date
            return [...prev, newRace].sort((a: any, b: any) =>
              new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
            );
          });
        } else if (payload.eventType === 'UPDATE') {
          // Update existing race
          const updatedRace = payload.new as Race;
          const isRelevantToUser =
            updatedRace?.created_by === userId ||
            (updatedRace as any)?.isOwner ||
            (updatedRace as any)?.isCollaborator ||
            (updatedRace as any)?.isPendingInvite;
          if (!isRelevantToUser && !isTrackedRace) {
            return;
          }
          setLiveRaces((prev) => {
            if (!isRelevantToUser && !prev.some((r) => r.id === updatedRace.id)) {
              return prev;
            }
            const index = prev.findIndex((r) => r.id === updatedRace.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = updatedRace;
              return updated.sort((a: any, b: any) =>
                new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
              );
            }
            return prev;
          });
        } else if (payload.eventType === 'DELETE') {
          // Remove deleted race
          if (!isTrackedRace) {
            return;
          }
          setLiveRaces((prev) => prev.filter((r) => r.id !== payload.old.id));
        }
      } catch (err) {
        logger.error('Error handling realtime event:', err);
      }
    };

    const onRaceEventsPayload = (payload: any) => {
      if (!isActiveRun()) return;
      try {
        if (payload.eventType === 'INSERT') {
          const newEvent = payload.new as any;
          // Normalize to match regatta structure
          const normalizedEvent = {
            ...newEvent,
            start_date: newEvent.start_time || newEvent.event_date,
            race_name: newEvent.name,
            created_by: newEvent.user_id,
            metadata: {
              ...(newEvent.metadata || {}),
              venue_name: newEvent.location || newEvent.metadata?.venue_name || null,
              venue: newEvent.location || newEvent.metadata?.venue || null,
            },
            _source: 'race_events',
          };
          setLiveRaces((prev) => {
            if (prev.some((r) => r.id === normalizedEvent.id)) {
              return prev;
            }
            return [...prev, normalizedEvent].sort((a: any, b: any) =>
              new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
            );
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedEvent = payload.new as any;
          const normalizedEvent = {
            ...updatedEvent,
            start_date: updatedEvent.start_time || updatedEvent.event_date,
            race_name: updatedEvent.name,
            created_by: updatedEvent.user_id,
            metadata: {
              ...(updatedEvent.metadata || {}),
              venue_name: updatedEvent.location || updatedEvent.metadata?.venue_name || null,
              venue: updatedEvent.location || updatedEvent.metadata?.venue || null,
            },
            _source: 'race_events',
          };
          setLiveRaces((prev) => {
            const index = prev.findIndex((r) => r.id === normalizedEvent.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = normalizedEvent;
              return updated.sort((a: any, b: any) =>
                new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
              );
            }
            return prev;
          });
        } else if (payload.eventType === 'DELETE') {
          setLiveRaces((prev) => prev.filter((r) => r.id !== payload.old.id));
        }
      } catch (err) {
        logger.error('Error handling race_events realtime event:', err);
      }
    };

    const regattasSubscribed = safeSubscribe(
      channelName,
      {
        table: 'regattas',
      },
      onRegattasPayload
    );

    // Also subscribe to race_events for user-created races
    const raceEventsChannelName = createChannelName('user-race-events', userId);
    const raceEventsSubscribed = safeSubscribe(
      raceEventsChannelName,
      {
        table: 'race_events',
        filter: `user_id=eq.${userId}`,
      },
      onRaceEventsPayload
    );

    // Subscribe to race_collaborators changes for this user
    // This handles when user receives a new invite or when their invite status changes
    const collaboratorsChannelName = createChannelName('user-collaborators', userId);
    const onCollaboratorsPayload = (payload: any) => {
      if (!isActiveRun()) return;
      const scheduleRefresh = () => {
        if (collaboratorRefreshTimeoutRef.current) {
          clearTimeout(collaboratorRefreshTimeoutRef.current);
        }
        collaboratorRefreshTimeoutRef.current = setTimeout(() => {
          if (!isActiveRun()) {
            collaboratorRefreshTimeoutRef.current = null;
            return;
          }
          collaboratorRefreshTimeoutRef.current = null;
          void loadLiveRaces();
        }, 250);
      };

      try {
        // For any collaborator change, refresh the races list to get updated data.
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          scheduleRefresh();
        }
      } catch (err) {
        logger.error('Error handling race_collaborators realtime event:', err);
      }
    };

    // Subscribe to race_participants changes for this user to keep timeline membership
    // in sync (joins, withdrawals, re-joins).
    const participantsChannelName = createChannelName('user-participants', userId);
    const onParticipantsPayload = (payload: any) => {
      if (!isActiveRun()) return;
      try {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          if (collaboratorRefreshTimeoutRef.current) {
            clearTimeout(collaboratorRefreshTimeoutRef.current);
          }
          collaboratorRefreshTimeoutRef.current = setTimeout(() => {
            if (!isActiveRun()) {
              collaboratorRefreshTimeoutRef.current = null;
              return;
            }
            collaboratorRefreshTimeoutRef.current = null;
            void loadLiveRaces();
          }, 250);
        }
      } catch (err) {
        logger.error('Error handling race_participants realtime event:', err);
      }
    };
    const collaboratorsSubscribed = safeSubscribe(
      collaboratorsChannelName,
      {
        table: 'race_collaborators',
        filter: `user_id=eq.${userId}`,
      },
      onCollaboratorsPayload
    );
    const participantsSubscribed = safeSubscribe(
      participantsChannelName,
      {
        table: 'race_participants',
        filter: `user_id=eq.${userId}`,
      },
      onParticipantsPayload
    );

    if (!regattasSubscribed || !raceEventsSubscribed || !collaboratorsSubscribed || !participantsSubscribed) {
      void teardownChannels();
    }

    return () => {
      effectDisposed = true;
      if (collaboratorRefreshTimeoutRef.current) {
        clearTimeout(collaboratorRefreshTimeoutRef.current);
        collaboratorRefreshTimeoutRef.current = null;
      }
      void teardownChannels();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadLiveRaces is stable for a given userId; including it causes infinite re-renders
  }, [userId]);

  return {
    liveRaces,
    loading,
    isRefreshing,
    refresh: loadLiveRaces,
  };
}

/**
 * Withdraw from a race (hide it from timeline)
 * This sets the race_participants status to 'withdrawn' for the user
 */
export async function withdrawFromRace(userId: string, regattaId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('race_participants')
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('regatta_id', regattaId);

    if (error) {
      logger.error('Error withdrawing from race:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    logger.error('Exception withdrawing from race:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

/**
 * Re-register for a race (unhide it)
 * This sets the race_participants status back to 'registered'
 */
export async function rejoinRace(userId: string, regattaId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('race_participants')
      .update({ status: 'registered', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('regatta_id', regattaId);

    if (error) {
      logger.error('Error rejoining race:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    logger.error('Exception rejoining race:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

// ============================================================================
// USER RACE RESULTS
// ============================================================================

export interface UserRaceResult {
  regattaId: string;
  position: number;
  points: number;
  fleetSize: number;
  status: 'finished' | 'dnf' | 'dns' | 'dsq' | 'ocs' | 'ret';
  seriesPosition?: number;
  totalRaces?: number;
}

/**
 * Fetch race results for a specific user across their regattas
 * Returns a map of regattaId -> UserRaceResult
 */
export async function fetchUserResults(userId: string, regattaIds: string[]): Promise<Map<string, UserRaceResult>> {
  const resultsMap = new Map<string, UserRaceResult>();

  // Filter out demo race IDs (non-UUIDs) before querying Supabase
  const validRegattaIds = regattaIds.filter(isValidUUID);

  if (!userId || validRegattaIds.length === 0) {
    return resultsMap;
  }

  try {
    // First, try to get results from series_standings (for series races)
    const { data: standings, error: standingsError } = await supabase
      .from('series_standings')
      .select(`
        regatta_id,
        rank,
        net_points,
        races_sailed,
        race_scores,
        sailor_id
      `)
      .in('regatta_id', validRegattaIds);

    if (!standingsError && standings) {
      // Filter standings for this user and map to results
      for (const standing of standings) {
        // Check if this standing belongs to the user
        if (standing.sailor_id === userId) {
          // Get fleet size from counting all standings in same regatta
          const fleetSize = standings.filter(s => s.regatta_id === standing.regatta_id).length;
          
          resultsMap.set(standing.regatta_id, {
            regattaId: standing.regatta_id,
            position: standing.rank,
            points: standing.net_points,
            fleetSize,
            status: 'finished',
            seriesPosition: standing.rank,
            totalRaces: standing.races_sailed,
          });
        }
      }
    }

    // Also check race_results table for individual race results
    let raceResults: {
      id: string;
      regatta_id?: string | null;
      race_id?: string | null;
      race_number?: number | null;
      sailor_id: string;
      position?: number | null;
      points?: number | null;
      status_code?: string | null;
    }[] | null = null;
    let raceResultsError: any = null;
    const primaryRaceResults = await supabase
      .from('race_results')
      .select(`
        id,
        regatta_id,
        race_number,
        sailor_id,
        position,
        points,
        status_code
      `)
      .eq('sailor_id', userId);
    raceResults = primaryRaceResults.data as any;
    raceResultsError = primaryRaceResults.error;

    if (
      raceResultsError &&
      isMissingIdColumn(raceResultsError, 'race_results', 'regatta_id')
    ) {
      const fallbackRaceResults = await supabase
        .from('race_results')
        .select(`
          id,
          race_id,
          race_number,
          sailor_id,
          position,
          points,
          status_code
        `)
        .eq('sailor_id', userId);
      raceResults = fallbackRaceResults.data as any;
      raceResultsError = fallbackRaceResults.error;
    }

    if (!raceResultsError && raceResults) {
      // First-wins dedup of the results we still need (mirrors the old
      // `!resultsMap.has(regattaId)` guard, which also skipped duplicates).
      const pending = new Map<string, (typeof raceResults)[number]>();
      for (const result of raceResults) {
        const regattaId = result.regatta_id || result.race_id;
        if (
          regattaId &&
          validRegattaIds.includes(regattaId) &&
          !resultsMap.has(regattaId) &&
          !pending.has(regattaId)
        ) {
          pending.set(regattaId, result);
        }
      }

      if (pending.size > 0) {
        const pendingRegattaIds = [...pending.keys()];

        // One batched read of every fleet row for the regattas we care about,
        // then count (regatta_id, race_number) client-side — replaces the
        // per-result count query (N+1).
        const fleetCounts = new Map<string, number>();
        const tallyRows = (
          rows: { regatta_id?: string | null; race_id?: string | null; race_number?: number | null }[] | null,
          idKey: 'regatta_id' | 'race_id'
        ) => {
          for (const row of rows ?? []) {
            const rid = row[idKey];
            if (!rid) continue;
            const key = `${rid}:${row.race_number ?? ''}`;
            fleetCounts.set(key, (fleetCounts.get(key) ?? 0) + 1);
          }
        };

        const primaryFleet = await supabase
          .from('race_results')
          .select('regatta_id, race_number')
          .in('regatta_id', pendingRegattaIds);

        if (
          primaryFleet.error &&
          isMissingIdColumn(primaryFleet.error, 'race_results', 'regatta_id')
        ) {
          const fallbackFleet = await supabase
            .from('race_results')
            .select('race_id, race_number')
            .in('race_id', pendingRegattaIds);
          tallyRows(fallbackFleet.data as any, 'race_id');
        } else {
          tallyRows(primaryFleet.data as any, 'regatta_id');
        }

        for (const [regattaId, result] of pending) {
          const count = fleetCounts.get(`${regattaId}:${result.race_number ?? ''}`) ?? 0;
          const normalizedPosition = result.position ?? 0;
          const normalizedPoints = result.points ?? normalizedPosition;
          resultsMap.set(regattaId, {
            regattaId,
            position: normalizedPosition,
            points: normalizedPoints,
            fleetSize: count,
            status: (result.status_code?.toLowerCase() || 'finished') as UserRaceResult['status'],
          });
        }
      }
    }

    // For demo purposes, also check race_participants for any mock results
    const { data: participants, error: participantsError } = await supabase
      .from('race_participants')
      .select('regatta_id, finish_position, points_scored, status')
      .eq('user_id', userId)
      .in('regatta_id', validRegattaIds)
      .not('finish_position', 'is', null);

    if (!participantsError && participants) {
      for (const participant of participants) {
        if (!resultsMap.has(participant.regatta_id) && participant.finish_position) {
          // Get fleet size
          const { count } = await supabase
            .from('race_participants')
            .select('*', { count: 'exact', head: true })
            .eq('regatta_id', participant.regatta_id)
            .not('finish_position', 'is', null);

          resultsMap.set(participant.regatta_id, {
            regattaId: participant.regatta_id,
            position: participant.finish_position,
            points: participant.points_scored || participant.finish_position,
            fleetSize: count || 0,
            status: 'finished',
          });
        }
      }
    }

    logger.debug(`[fetchUserResults] Found results for ${resultsMap.size} regattas`);
  } catch (err) {
    logger.error('[fetchUserResults] Error fetching user results:', err);
  }

  return resultsMap;
}

/**
 * Hook to fetch and cache user race results
 */
export function useUserRaceResults(userId?: string, regattaIds?: string[]) {
  const [results, setResults] = useState<Map<string, UserRaceResult>>(new Map());
  const [loading, setLoading] = useState(false);
  const isMountedRef = useRef(true);
  const loadRunIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      loadRunIdRef.current += 1;
    };
  }, []);

  const loadResults = useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === loadRunIdRef.current;

    if (!userId || !regattaIds || regattaIds.length === 0) {
      if (!canCommit()) return;
      setResults(new Map());
      setLoading(false);
      return;
    }

    if (!canCommit()) return;
    setLoading(true);
    try {
      const fetchedResults = await fetchUserResults(userId, regattaIds);
      if (!canCommit()) return;
      setResults(fetchedResults);
    } finally {
      if (!canCommit()) return;
      setLoading(false);
    }
  }, [userId, regattaIds]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  return {
    results,
    loading,
    refresh: loadResults,
  };
}
