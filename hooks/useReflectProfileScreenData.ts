import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useReflectProfile } from '@/hooks/useReflectProfile';
import {
  mapReflectProfileToProfileScreen,
  type ProfilePreferenceState,
} from '@/lib/reflect/mapReflectProfile';
import {
  getCapabilityMap,
  type CapabilityMapEntry,
} from '@/services/CapabilityAggregationService';
import {
  getArcData,
  type BecomingArcData,
} from '@/services/BecomingArcService';

const EMPTY_ARC_PATH = 'M 4 100 L 316 100';
const DEFAULT_CAPABILITY_EMPTY_STATE = {
  title: 'No confirmed capability evidence yet',
  body: 'Settle a Reflect step and the capability spine will start surfacing here.',
};
const UNAVAILABLE_CAPABILITY_EMPTY_STATE = {
  title: 'Capability evidence unavailable in this environment',
  body: 'This backend cannot load capability evidence right now, so the spine is showing an empty baseline instead of real evidence.',
};

export function useReflectProfileScreenData() {
  const profile = useReflectProfile();
  const refreshProfileData = profile.refresh;
  const { user } = useAuth();
  const { userInterests, currentInterest } = useInterest();
  const isSailing = currentInterest?.slug === 'sail-racing';
  const [windUnit, setWindUnit] = useState<ProfilePreferenceState['windUnit']>(
    isSailing ? 'knots' : 'm/s',
  );
  const [distanceUnit, setDistanceUnit] = useState<
    ProfilePreferenceState['distanceUnit']
  >(isSailing ? 'nautical' : 'metric');
  const [weeklyDigestOn, setWeeklyDigestOn] = useState(true);
  const [resurfaceOldCapturesOn, setResurfaceOldCapturesOn] = useState(true);
  const [privateModeOn, setPrivateModeOn] = useState(false);
  const [capabilityMap, setCapabilityMap] = useState<CapabilityMapEntry[]>([]);
  const [becomingArc, setBecomingArc] = useState<BecomingArcData | null>(null);
  const [capabilityUnavailable, setCapabilityUnavailable] = useState(false);

  const loadCapabilityData = useCallback(async () => {
    if (!user?.id || !currentInterest?.id) {
      setCapabilityMap([]);
      setBecomingArc(null);
      setCapabilityUnavailable(false);
      return;
    }

    const [mapResult, arcResult] = await Promise.allSettled([
      getCapabilityMap(user.id, currentInterest.id),
      getArcData(user.id, currentInterest.id),
    ]);

    if (mapResult.status === 'fulfilled') {
      setCapabilityMap(mapResult.value);
    } else {
      setCapabilityMap([]);
    }

    if (arcResult.status === 'fulfilled') {
      setBecomingArc(arcResult.value);
    } else {
      setBecomingArc(null);
    }

    setCapabilityUnavailable(
      mapResult.status === 'rejected' ||
        arcResult.status === 'rejected' ||
        capabilityQueryLooksUnavailable(mapResult, arcResult),
    );
  }, [currentInterest?.id, user?.id]);

  useEffect(() => {
    loadCapabilityData().catch(() => {
      setCapabilityMap([]);
      setBecomingArc(null);
      setCapabilityUnavailable(false);
    });
  }, [loadCapabilityData]);

  const props = useMemo(() => {
    if (!profile.data) return null;
    const base = mapReflectProfileToProfileScreen(
      profile.data,
      userInterests,
      currentInterest,
      {
        windUnit,
        distanceUnit,
        weeklyDigestOn,
        resurfaceOldCapturesOn,
        privateModeOn,
      },
    );

    const fallbackStartedAt =
      profile.data.stats?.memberSince ?? new Date().toISOString();
    const arc = becomingArc ?? {
      startedAt: fallbackStartedAt,
      evidencePoints: [],
      settledRanges: [],
      nowAt: new Date().toISOString(),
      bezierPath: EMPTY_ARC_PATH,
      settledWashPath: null,
      plotPoints: [],
      settledMarkers: [],
      nowPoint: { x: 316, y: 100 },
      yearTicks: buildFallbackYearTicks(fallbackStartedAt),
    };

    return {
      ...base,
      capabilityMap,
      capabilityEmptyState: capabilityUnavailable
        ? UNAVAILABLE_CAPABILITY_EMPTY_STATE
        : DEFAULT_CAPABILITY_EMPTY_STATE,
      becoming:
        currentInterest
          ? {
              interestName: currentInterest.name,
              startedAt: arc.startedAt,
              evidencePoints: arc.evidencePoints,
              settledRanges: arc.settledRanges,
              nowAt: arc.nowAt,
              bezierPath: arc.bezierPath,
              settledWashPath: arc.settledWashPath,
              plotPoints: arc.plotPoints,
              settledMarkers: arc.settledMarkers,
              nowPoint: arc.nowPoint,
              yearTicks: arc.yearTicks,
              capabilityCount: capabilityMap.length,
              evidenceCount: capabilityMap.reduce(
                (sum, entry) => sum + entry.evidenceCount,
                0,
              ),
              pathsSettledCount: arc.settledRanges.length,
            }
          : undefined,
    };
  }, [
    becomingArc,
    capabilityMap,
    capabilityUnavailable,
    currentInterest,
    distanceUnit,
    privateModeOn,
    profile.data,
    resurfaceOldCapturesOn,
    userInterests,
    weeklyDigestOn,
    windUnit,
  ]);

  const refresh = useCallback(async () => {
    await refreshProfileData();
    await loadCapabilityData();
  }, [loadCapabilityData, refreshProfileData]);

  return {
    props,
    loading: profile.loading,
    error: profile.error,
    refresh,
    handlers: {
      setWindUnit,
      setDistanceUnit,
      setWeeklyDigestOn,
      setResurfaceOldCapturesOn,
      setPrivateModeOn,
    },
  };
}

export type UseReflectProfileScreenDataResult = ReturnType<
  typeof useReflectProfileScreenData
>;

function buildFallbackYearTicks(startedAt: string) {
  const start = new Date(startedAt);
  const end = new Date();
  if (Number.isNaN(start.getTime())) {
    return [{ x: 316, label: String(end.getFullYear()) }];
  }

  const firstYear = start.getFullYear();
  const lastYear = end.getFullYear();
  const totalYears = Math.max(1, lastYear - firstYear);

  return Array.from({ length: totalYears + 1 }, (_, index) => {
    const ratio = totalYears === 0 ? 1 : index / totalYears;
    return {
      x: 4 + ratio * (316 - 4),
      label: String(firstYear + index),
    };
  });
}

function isCapabilityEvidenceUnavailableError(error: unknown) {
  const text = extractErrorText(error).toLowerCase();
  return (
    text.includes('404') ||
    text.includes('step_capability_evidence') ||
    text.includes('does not exist') ||
    text.includes('could not find the table') ||
    text.includes('relation')
  );
}

function extractErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return '';
  const message =
    'message' in error && typeof error.message === 'string' ? error.message : '';
  const details =
    'details' in error && typeof error.details === 'string' ? error.details : '';
  const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const status =
    'status' in error &&
    (typeof error.status === 'number' || typeof error.status === 'string')
      ? String(error.status)
      : '';
  return [message, details, hint, code, status].filter(Boolean).join(' ');
}

function capabilityQueryLooksUnavailable(
  mapResult: PromiseSettledResult<CapabilityMapEntry[]>,
  arcResult: PromiseSettledResult<BecomingArcData>,
) {
  if (mapResult.status === 'rejected' && isCapabilityEvidenceUnavailableError(mapResult.reason)) {
    return true;
  }
  if (arcResult.status === 'rejected' && isCapabilityEvidenceUnavailableError(arcResult.reason)) {
    return true;
  }
  return false;
}
