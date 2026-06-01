import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createLogger } from '@/lib/utils/logger';
import {
  FleetActivityEntry,
  FleetMembership,
  FleetOverview,
  FleetRosterEntry,
  fleetService,
} from '../services/fleetService';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

const logger = createLogger('useFleetData');
export function useUserFleets(userId?: string | null) {
  const [state, setState] = useState<AsyncState<FleetMembership[]>>({
    data: null,
    loading: Boolean(userId),
    error: null,
  });
  const isMountedRef = useRef(true);
  const fetchRunIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null | undefined>(userId);

  useEffect(() => {
    activeUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRunIdRef.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    const runId = ++fetchRunIdRef.current;
    const targetUserId = userId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === fetchRunIdRef.current &&
      activeUserIdRef.current === targetUserId;
    const refreshStartTime = Date.now();
    logger.debug(`[useUserFleets] ========== REFRESH STARTED at ${new Date().toISOString()} ==========`);
    logger.debug('[useUserFleets] Refresh start timestamp:', refreshStartTime);
    logger.debug('[useUserFleets] User ID:', targetUserId);

    if (!targetUserId) {
      logger.debug('[useUserFleets] No userId, setting loading to false');
      if (!canCommit()) return;
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    logger.debug('[useUserFleets] Setting loading to true, calling fleetService.getFleetsForUser()...');
    if (!canCommit()) return;
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const serviceCallStart = Date.now();
      const fleets = await fleetService.getFleetsForUser(targetUserId);
      const serviceCallEnd = Date.now();
      const serviceCallDuration = serviceCallEnd - serviceCallStart;

      logger.debug('[useUserFleets] ========== SERVICE CALL COMPLETED ==========');
      logger.debug('[useUserFleets] Service call duration:', serviceCallDuration, 'ms');
      logger.debug('[useUserFleets] Fleets count:', fleets.length);
      logger.debug('[useUserFleets] Fleet IDs:', fleets.map(f => f.fleet.id));
      logger.debug('[useUserFleets] Fleet names:', fleets.map(f => f.fleet.name));
      logger.debug('[useUserFleets] Fleet data:', fleets);

      if (!canCommit()) return;
      setState({ data: fleets, loading: false, error: null });

      const refreshEndTime = Date.now();
      const totalDuration = refreshEndTime - refreshStartTime;
      logger.debug('[useUserFleets] ========== REFRESH COMPLETED ==========');
      logger.debug('[useUserFleets] Refresh end timestamp:', refreshEndTime);
      logger.debug('[useUserFleets] Total refresh duration:', totalDuration, 'ms');
    } catch (error) {
      const errorTime = Date.now();
      logger.error('[useUserFleets] ========== REFRESH FAILED ==========');
      logger.error('[useUserFleets] Error timestamp:', errorTime);
      logger.error('[useUserFleets] Error fetching fleets:', error);
      if (!canCommit()) return;
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [userId]);

  useEffect(() => {
    logger.debug('[useUserFleets] useEffect triggered, calling refresh');
    void refresh();
  }, [refresh]);

  const result = useMemo(() => ({
    fleets: state.data ?? [],
    loading: state.loading,
    error: state.error,
    refresh,
  }), [state, refresh]);

  logger.debug('[useUserFleets] Returning result:', result);

  return result;
}

export function useFleetOverview(fleetId?: string | null) {
  const [state, setState] = useState<AsyncState<FleetOverview>>({
    data: null,
    loading: Boolean(fleetId),
    error: null,
  });
  const isMountedRef = useRef(true);
  const fetchRunIdRef = useRef(0);
  const activeFleetIdRef = useRef<string | null | undefined>(fleetId);

  useEffect(() => {
    activeFleetIdRef.current = fleetId;
  }, [fleetId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRunIdRef.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    const runId = ++fetchRunIdRef.current;
    const targetFleetId = fleetId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === fetchRunIdRef.current &&
      activeFleetIdRef.current === targetFleetId;

    if (!targetFleetId) {
      if (!canCommit()) return;
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    if (!canCommit()) return;
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const overview = await fleetService.getFleetOverview(targetFleetId);
      if (!canCommit()) return;
      setState({ data: overview, loading: false, error: null });
    } catch (error) {
      if (!canCommit()) return;
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [fleetId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(() => ({
    overview: state.data,
    loading: state.loading,
    error: state.error,
    refresh,
  }), [state, refresh]);
}

export function useFleetActivity(fleetId?: string | null, options?: { limit?: number }) {
  const [state, setState] = useState<AsyncState<FleetActivityEntry[]>>({
    data: null,
    loading: Boolean(fleetId),
    error: null,
  });
  const requestOptions = useMemo(
    () => (options?.limit != null ? { limit: options.limit } : undefined),
    [options?.limit]
  );
  const isMountedRef = useRef(true);
  const fetchRunIdRef = useRef(0);
  const activeFleetIdRef = useRef<string | null | undefined>(fleetId);

  useEffect(() => {
    activeFleetIdRef.current = fleetId;
  }, [fleetId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRunIdRef.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    const runId = ++fetchRunIdRef.current;
    const targetFleetId = fleetId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === fetchRunIdRef.current &&
      activeFleetIdRef.current === targetFleetId;

    if (!targetFleetId) {
      if (!canCommit()) return;
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    if (!canCommit()) return;
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const activity = await fleetService.getFleetActivity(targetFleetId, requestOptions);
      if (!canCommit()) return;
      setState({ data: activity, loading: false, error: null });
    } catch (error) {
      if (!canCommit()) return;
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [fleetId, requestOptions]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(() => ({
    activity: state.data ?? [],
    loading: state.loading,
    error: state.error,
    refresh,
  }), [state, refresh]);
}

export function useFleetRoster(fleetId?: string | null) {
  const [state, setState] = useState<AsyncState<FleetRosterEntry[]>>({
    data: null,
    loading: Boolean(fleetId),
    error: null,
  });
  const isMountedRef = useRef(true);
  const fetchRunIdRef = useRef(0);
  const activeFleetIdRef = useRef<string | null | undefined>(fleetId);

  useEffect(() => {
    activeFleetIdRef.current = fleetId;
  }, [fleetId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRunIdRef.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    const runId = ++fetchRunIdRef.current;
    const targetFleetId = fleetId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === fetchRunIdRef.current &&
      activeFleetIdRef.current === targetFleetId;

    if (!targetFleetId) {
      if (!canCommit()) return;
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    if (!canCommit()) return;
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const roster = await fleetService.getFleetRoster(targetFleetId);
      if (!canCommit()) return;
      setState({ data: roster, loading: false, error: null });
    } catch (error) {
      if (!canCommit()) return;
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [fleetId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(() => ({
    roster: state.data ?? [],
    loading: state.loading,
    error: state.error,
    refresh,
  }), [state, refresh]);
}
