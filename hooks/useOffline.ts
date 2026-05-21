/**
 * useOffline Hook
 * 
 * Easy integration of offline capabilities into components.
 * Shows offline status, sync progress, and provides caching methods.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { offlineService, OfflineStatus } from '@/services/offlineService';

// The action surface (everything except the OfflineStatus fields) is bound
// once at module load. Returning new `.bind()` references every render caused
// any useEffect that listed these methods in its deps to re-fire infinitely,
// which surfaced as a runaway-loop of /rest/v1/regattas requests from
// races.tsx's cacheNextRace effect — see commit log.
const offlineActions = {
  cacheNextRace: offlineService.cacheNextRace.bind(offlineService),
  cacheVenue: offlineService.cacheVenue.bind(offlineService),
  setHomeVenue: offlineService.setHomeVenue.bind(offlineService),
  cacheUpcomingRaces: offlineService.cacheUpcomingRaces.bind(offlineService),
  cacheSailingDocuments: offlineService.cacheSailingDocuments.bind(offlineService),
  cacheCourseVisualizations: offlineService.cacheCourseVisualizations.bind(offlineService),

  getCachedRace: offlineService.getCachedRace.bind(offlineService),
  getCachedVenue: offlineService.getCachedVenue.bind(offlineService),
  getCachedStrategy: offlineService.getCachedStrategy.bind(offlineService),
  getCachedTuningGuides: offlineService.getCachedTuningGuides.bind(offlineService),
  getCachedWeather: offlineService.getCachedWeather.bind(offlineService),
  getCachedUpcomingRaces: offlineService.getCachedUpcomingRaces.bind(offlineService),
  getCachedDocuments: offlineService.getCachedDocuments.bind(offlineService),
  getCachedVisualizations: offlineService.getCachedVisualizations.bind(offlineService),

  saveGPSTrack: offlineService.saveGPSTrack.bind(offlineService),
  logRaceEvent: offlineService.logRaceEvent.bind(offlineService),

  forceSyncNow: offlineService.forceSyncNow.bind(offlineService),
  clearExpiredCache: offlineService.clearExpiredCache.bind(offlineService),
  clearCache: offlineService.clearCache.bind(offlineService),
} as const;

export function useOffline() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: true,
    isSyncing: false,
    queueLength: 0,
    lastSync: null,
    failedItems: 0,
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = offlineService.subscribe((next) => {
      if (!isMountedRef.current) return;
      setStatus(next);
    });

    void offlineService.getOfflineStatus().then((next) => {
      if (!isMountedRef.current) return;
      setStatus(next);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return useMemo(() => ({ ...status, ...offlineActions }), [status]);
}
