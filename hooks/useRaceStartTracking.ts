/**
 * useRaceStartTracking — the shared start-sequence + live-GPS-tracking engine
 * for a race step.
 *
 * The 5-4-1-0 start sequence and live tracking are coupled: the countdown
 * fires GPS capture automatically at the gun, so the two cards can't be
 * independent self-loading components. This hook owns that coupled state and
 * the metadata writes so both surfaces stay in sync:
 *   - the full-screen on-water cockpit (RaceWaterCockpit), and
 *   - the two cards prepended to the standard Do tab (RaceDoTabSection).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { RaceTimerService } from '@/services/RaceTimerService';
import {
  appendAtlasRaceNote,
  buildObservation,
  getAtlasStepData,
} from '@/lib/atlasRaceStep';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { AtlasRaceNotePhase, StepActData, StepMetadata } from '@/types/step-detail';

// Standard sailing start: one continuous 5-minute sequence with the
// 4-minute (prep) and 1-minute signals as milestones, gun at 0:00.
export const SEQUENCE_SECONDS = 5 * 60;

// expo-location is native-only; on web this stays null and the sequence
// runs as a pure timer (RaceTimerService.startSession also no-ops on web).
let LocationModule: typeof import('expo-location') | null = null;

async function getLocationModule() {
  if (Platform.OS === 'web') return null;
  if (!LocationModule) {
    LocationModule = await import('expo-location');
  }
  return LocationModule;
}

export interface UseRaceStartTracking {
  /** Seconds remaining in the start sequence, or null when idle. */
  sequenceTime: number | null;
  isCountingDown: boolean;
  trackPointCount: number;
  trackingBusy: boolean;
  isTracking: boolean;
  liveTrackingStatus: string;
  startCountdown: () => Promise<void>;
  cancelCountdown: () => void;
  handleStartTracking: () => Promise<void>;
  handleStopTracking: () => Promise<void>;
  /**
   * Stamp a local-knowledge note onto Do observations + the Atlas note layer.
   * `phase` distinguishes in-the-moment ('live') from post-race ('review')
   * captures; the local-knowledge layer itself is homed on the race area in
   * Atlas — this only appends to it.
   */
  appendStampedNote: (text: string, phase?: AtlasRaceNotePhase) => void;
}

export function useRaceStartTracking(
  step: TimelineStepRecord,
  act: StepActData,
): UseRaceStartTracking {
  const updateMetadata = useUpdateStepMetadata(step.id);
  const { user } = useAuth();
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [sequenceTime, setSequenceTime] = useState<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [trackPointCount, setTrackPointCount] = useState(0);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTrackingRef = useRef<() => void>(() => {});

  const atlasData = useMemo(
    () => getAtlasStepData(step.metadata as StepMetadata),
    [step.metadata],
  );
  const liveTracking = atlasData?.live_tracking;
  const isTracking = liveTracking?.status === 'tracking';

  const appendStampedNote = useCallback(
    (text: string, phase: AtlasRaceNotePhase = 'live') => {
      const obs = buildObservation(text);
      const existingNotes = act.notes ?? '';
      const stamp = new Date(obs.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const formatted = `[${stamp}] ${obs.text}`;
      const nextAtlas = appendAtlasRaceNote(atlasData, {
        text,
        phase,
        kind: 'general',
        source: 'water_preview',
        lat: step.location_lat ?? undefined,
        lng: step.location_lng ?? undefined,
        focus_label: atlasData?.next_event?.label ?? step.location_name ?? step.title ?? undefined,
      });
      updateMetadata.mutate({
        act: {
          ...act,
          observations: [...(act.observations ?? []), obs],
          notes: existingNotes ? `${existingNotes}\n${formatted}` : formatted,
        },
        atlas: nextAtlas,
      });
    },
    [act, atlasData, step.location_lat, step.location_lng, step.location_name, step.title, updateMetadata],
  );

  const handleStartTracking = useCallback(async () => {
    if (!user?.id || trackingBusy) {
      if (!user?.id) showAlert('Sign in required', 'Sign in to attach GPS tracking to this race step.');
      return;
    }
    setTrackingBusy(true);
    const plannedAt = liveTracking?.planned_at ?? new Date().toISOString();
    try {
      const session = await RaceTimerService.startSession(
        user.id,
        atlasData?.next_event?.event_id ?? undefined,
      );
      if (!session) {
        updateMetadata.mutate({
          atlas: {
            ...(atlasData ?? {}),
            live_tracking: {
              ...(liveTracking ?? {}),
              status: 'planned',
              provider: 'betterat_phone_gps',
              planned_at: plannedAt,
            },
          },
        });
        showAlert(
          'Tracking planned',
          'GPS tracking could not start on this device, but this step is now marked for live tracking.',
        );
        return;
      }

      const startedAt = new Date().toISOString();
      updateMetadata.mutate({
        act: {
          ...act,
          started_at: act.started_at ?? startedAt,
        },
        atlas: {
          ...(atlasData ?? {}),
          live_tracking: {
            ...(liveTracking ?? {}),
            status: 'tracking',
            provider: 'betterat_phone_gps',
            planned_at: plannedAt,
            started_at: startedAt,
            session_id: session.id,
          },
        },
      });
      showAlert('Live tracking started', 'GPS track capture is now attached to this step.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start live tracking.';
      showAlert('Tracking failed', message);
    } finally {
      setTrackingBusy(false);
    }
  }, [act, atlasData, liveTracking, trackingBusy, updateMetadata, user?.id]);

  const handleStopTracking = useCallback(async () => {
    if (trackingBusy) return;
    setTrackingBusy(true);
    try {
      if (liveTracking?.session_id) {
        await RaceTimerService.endSession(liveTracking.session_id);
      }
      updateMetadata.mutate({
        atlas: {
          ...(atlasData ?? {}),
          live_tracking: {
            ...(liveTracking ?? {}),
            status: 'completed',
            stopped_at: new Date().toISOString(),
          },
        },
      });
      showAlert('Tracking saved', 'This GPS session is now attached to the step for replay and debrief.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not stop live tracking cleanly.';
      showAlert('Tracking stop failed', message);
    } finally {
      setTrackingBusy(false);
    }
  }, [atlasData, liveTracking, trackingBusy, updateMetadata]);

  // Keep a stable ref to the latest start-tracking handler so the countdown
  // interval (which captures a closure at start time) fires the current one.
  useEffect(() => {
    startTrackingRef.current = () => {
      void handleStartTracking();
    };
  }, [handleStartTracking]);

  // Surface the live GPS track-point count while a session is recording.
  useEffect(() => {
    if (liveTracking?.status !== 'tracking') return;
    setTrackPointCount(RaceTimerService.getTrackPointCount());
    const poll = setInterval(() => {
      setTrackPointCount(RaceTimerService.getTrackPointCount());
    }, 2000);
    return () => clearInterval(poll);
  }, [liveTracking?.status]);

  useEffect(() => {
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, []);

  const cancelCountdown = useCallback(() => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setIsCountingDown(false);
    setSequenceTime(null);
  }, []);

  const startCountdown = useCallback(async () => {
    // Pre-warm location permission now (5 min out) rather than at the gun.
    const Location = await getLocationModule();
    if (Location) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showAlert(
            'GPS permission denied',
            'The start sequence will still run, but GPS track capture needs location access to record your race.',
          );
        }
      } catch {
        /* permission flow unavailable — run the timer without GPS */
      }
    }

    setSequenceTime(SEQUENCE_SECONDS);
    setIsCountingDown(true);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    countdownInterval.current = setInterval(() => {
      setSequenceTime((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          setIsCountingDown(false);
          // Gun: begin GPS capture against this step.
          startTrackingRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  return {
    sequenceTime,
    isCountingDown,
    trackPointCount,
    trackingBusy,
    isTracking,
    liveTrackingStatus: liveTracking?.status ?? 'idle',
    startCountdown,
    cancelCountdown,
    handleStartTracking,
    handleStopTracking,
    appendStampedNote,
  };
}

export default useRaceStartTracking;
