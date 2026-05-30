/**
 * <RaceStartGpsCard> — Do-tab race start sequence + GPS track capture.
 *
 * Renders only for steps whose interest resolves to the sailing persona.
 * Runs the standard one-continuous 5-minute start sequence (5-4-1-0, with
 * the prep + one-minute signals as milestones) and fires phone-GPS track
 * capture automatically at the gun. The same card also exposes a manual
 * start/stop for tracking outside the countdown.
 *
 * State lives on the step's `metadata.atlas.live_tracking`; the sibling
 * water-preview surface (`/race/ios/water`) reads the same field so a track
 * started here is visible there for replay/debrief. GPS itself is native-
 * only — on web RaceTimerService.startSession no-ops and the sequence runs
 * as a pure timer.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Radio, Square, Timer, X } from 'lucide-react-native';
import { GRAY_5, IOS_BLUE, IOS_CORAL, LABEL, LABEL_2 } from '@/lib/design-tokens-step-loop-ios';
import { resolveInterestVocab } from '@/components/ios-register/timeline-zoom/interestVocab';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { useAuth } from '@/providers/AuthProvider';
import { RaceTimerService } from '@/services/RaceTimerService';
import { getAtlasStepData } from '@/lib/atlasRaceStep';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

const ACCENT = IOS_BLUE;

// Standard sailing start: one continuous 5-minute sequence with the
// 4-minute (prep) and 1-minute signals as milestones, gun at 0:00.
const SEQUENCE_SECONDS = 5 * 60;

// expo-location is native-only; on web this stays null and the sequence runs
// as a pure timer (RaceTimerService.startSession also no-ops on web).
let LocationModule: typeof import('expo-location') | null = null;

async function getLocationModule() {
  if (Platform.OS === 'web') return null;
  if (!LocationModule) {
    LocationModule = await import('expo-location');
  }
  return LocationModule;
}

interface RaceStartGpsCardProps {
  stepId: string;
  interestId?: string | null;
  interestName?: string | null;
  interestSlug?: string | null;
}

export function RaceStartGpsCard({
  stepId,
  interestId,
  interestName,
  interestSlug,
}: RaceStartGpsCardProps) {
  const { data: step } = useStepDetail(stepId);
  const { user } = useAuth();
  const updateMetadata = useUpdateStepMetadata(stepId);

  const resolvedInterestId = interestId ?? step?.interest_id ?? null;
  const vocab = useMemo(
    () => resolveInterestVocab(resolvedInterestId, interestName ?? null, interestSlug ?? null),
    [resolvedInterestId, interestName, interestSlug],
  );
  const isSailing = vocab.id === 'sailing';

  const atlasData = useMemo(() => getAtlasStepData(step?.metadata), [step?.metadata]);
  const liveTracking = atlasData?.live_tracking;
  const isTracking = liveTracking?.status === 'tracking';

  const [trackingBusy, setTrackingBusy] = useState(false);
  const [sequenceTime, setSequenceTime] = useState<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [trackPointCount, setTrackPointCount] = useState(0);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTrackingRef = useRef<() => void>(() => {});

  const handleStartTracking = useCallback(async () => {
    if (!user?.id || trackingBusy) {
      if (!user?.id) {
        showAlert('Sign in required', 'Sign in to attach GPS tracking to this race step.');
      }
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start live tracking.';
      showAlert('Tracking failed', message);
    } finally {
      setTrackingBusy(false);
    }
  }, [atlasData, liveTracking, trackingBusy, updateMetadata, user?.id]);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not stop live tracking cleanly.';
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
    if (!isTracking) return;
    setTrackPointCount(RaceTimerService.getTrackPointCount());
    const poll = setInterval(() => {
      setTrackPointCount(RaceTimerService.getTrackPointCount());
    }, 2000);
    return () => clearInterval(poll);
  }, [isTracking]);

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

  // Hooks must run unconditionally; bail on render after they're set up.
  if (!isSailing) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.eye}>
          <Timer size={12} color={ACCENT} />
          <Text style={styles.eyeText}>Race start · 5 · 4 · 1 · 0</Text>
        </View>
        <Text style={styles.status}>{(liveTracking?.status ?? 'idle').toUpperCase()}</Text>
      </View>

      {isCountingDown && sequenceTime !== null ? (
        <View style={styles.countdownBlock}>
          <Text style={[styles.countdownTime, { color: getCountdownColor(sequenceTime) }]}>
            {formatCountdown(sequenceTime)}
          </Text>
          <Text style={styles.countdownSignal}>{countdownSignal(sequenceTime)}</Text>
          <Pressable style={styles.cancelBtn} onPress={cancelCountdown} hitSlop={6}>
            <X size={14} color={LABEL_2} />
            <Text style={styles.cancelText}>Cancel sequence</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.body}>
            Start the 5:00 sequence and GPS tracking begins automatically at the gun. To track
            without the timer, tap Track now to start recording right away.
          </Text>
          {isTracking ? (
            <View style={styles.trackPointRow}>
              <View style={styles.liveDot} />
              <Text style={styles.trackPointText}>{trackPointCount} GPS points</Text>
            </View>
          ) : null}
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, isTracking && styles.buttonDisabled]}
              onPress={() => {
                void startCountdown();
              }}
              disabled={isTracking}
              accessibilityRole="button"
              accessibilityLabel="Start 5 minute sequence"
            >
              <Timer size={15} color="#FFFFFF" />
              <Text style={styles.buttonText}>Start 5:00 sequence</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonSecondary, isTracking && styles.buttonStop]}
              onPress={isTracking ? handleStopTracking : handleStartTracking}
              disabled={trackingBusy}
              accessibilityRole="button"
              accessibilityLabel={isTracking ? 'Stop live tracking' : 'Start live tracking'}
            >
              {trackingBusy ? (
                <ActivityIndicator size="small" color={isTracking ? '#FFFFFF' : ACCENT} />
              ) : (
                <>
                  {isTracking ? (
                    <Square size={14} color="#FFFFFF" />
                  ) : (
                    <Radio size={15} color={ACCENT} />
                  )}
                  <Text style={[styles.buttonText, !isTracking && styles.buttonTextSecondary]}>
                    {isTracking ? 'Stop tracking' : 'Track now'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (seconds <= 10) return secs.toString();
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getCountdownColor(seconds: number | null): string {
  if (seconds === null) return LABEL_2;
  if (seconds <= 10) return IOS_CORAL;
  if (seconds <= 60) return '#C28A2A';
  return LABEL;
}

function countdownSignal(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds > 240) return 'WARNING SIGNAL · 5 MINUTES';
  if (seconds > 60) return 'PREP SIGNAL · 4 MINUTES';
  if (seconds > 0) return 'ONE MINUTE';
  return 'START';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eye: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyeText: {
    fontSize: 10,
    fontWeight: '700',
    color: LABEL_2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  status: {
    fontSize: 10,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 0.6,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: LABEL_2,
    marginBottom: 10,
  },
  countdownBlock: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  countdownTime: {
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  countdownSignal: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: LABEL_2,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: GRAY_5,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: LABEL_2,
  },
  trackPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  trackPointText: {
    fontSize: 12,
    fontWeight: '600',
    color: LABEL_2,
    fontVariant: ['tabular-nums'],
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOS_CORAL,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 10,
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT,
  },
  buttonStop: {
    backgroundColor: IOS_CORAL,
    borderColor: IOS_CORAL,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: ACCENT,
  },
});
