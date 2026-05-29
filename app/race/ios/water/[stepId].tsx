/**
 * On the Water — iOS register preview
 *
 * Third iOS-register preview surface — the live-capture mode during a
 * step. Atmospheric slate-blue ground (conditions become the surface),
 * pinned permission rule with "watching" pulse, reverse-chronological
 * running log on the ground (no card chrome), hero-mic composer with
 * camera + flag satellites at the foot.
 *
 * Carries the design's load-bearing argument: for surfaces where the
 * user is acting in conditions, the conditions should BE the surface.
 * The cool slate-blue gradient is data rendered as a feeling that
 * requires no reading.
 *
 * Wire-up status:
 *   Real data:
 *     - Step title (kept off-screen; surface is action-mode chrome)
 *     - act_data.observations + media_uploads → running log, reverse-
 *       chronological (newest first)
 *     - Capture count + race-in-progress status from data
 *
 *   Placeholder:
 *     - Pinned permission rule (no step_rules schema yet)
 *     - "Watching" pulse + ack line — UI only, no real condition tracking
 *     - Composer affordances are visual only (no recording, no camera
 *       wiring, no flag insertion — would need new mutations)
 *     - Beat tags on log entries (no beat-tagging schema yet)
 *
 * Open at /race/ios/water/{stepId}.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import {
  AtmosphericBackground,
  HeroMicComposer,
  LogEntry,
  PermissionRuleCallout,
  type LogEntryKind,
} from '@/components/ios-register';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { useStepDetail, useUpdateStepMetadata } from '@/hooks/useStepDetail';
import { RaceTimerService } from '@/services/RaceTimerService';
import {
  LOCAL_KNOWLEDGE_TEMPLATES,
  appendAtlasRaceNote,
  buildObservation,
  getAtlasStepData,
} from '@/lib/atlasRaceStep';
import type {
  StepMetadata,
  StepActData,
  Observation,
  MediaUpload,
} from '@/types/step-detail';

interface LogItem {
  id: string;
  kind: LogEntryKind;
  time: string;
  timestamp: string;
  text?: string;
  photoUri?: string;
  photoCaption?: string;
}

// Standard sailing start: one continuous 5-minute sequence with the
// 4-minute (prep) and 1-minute signals as milestones, gun at 0:00.
const SEQUENCE_SECONDS = 5 * 60;

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

export default function WaterIosPreview() {
  const { stepId } = useLocalSearchParams<{ stepId: string }>();
  const actualId = Array.isArray(stepId) ? stepId[0] : stepId;
  const { data: step, isLoading, error } = useStepDetail(actualId);

  if (!actualId || error) {
    return <ErrorState message={error?.message ?? 'No step id provided'} />;
  }

  if (isLoading || !step) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <Stack.Screen options={{ headerShown: false }} />
        <AtmosphericBackground style={styles.loadingBg}>
          <ActivityIndicator color="#FFFFFF" />
        </AtmosphericBackground>
      </SafeAreaView>
    );
  }

  const metadata = (step.metadata ?? {}) as StepMetadata;
  const act = ((metadata.act ?? (step.metadata as any)?.act_data ?? {}) as StepActData) ?? {};

  return <WaterBody step={step} act={act} metadata={metadata} />;
}

function WaterBody({
  step,
  act,
  metadata,
}: {
  step: NonNullable<ReturnType<typeof useStepDetail>['data']>;
  act: StepActData;
  metadata: StepMetadata;
}) {
  const updateMetadata = useUpdateStepMetadata(step.id);
  const { user } = useAuth();
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [sequenceTime, setSequenceTime] = useState<number | null>(null);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [trackPointCount, setTrackPointCount] = useState(0);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTrackingRef = useRef<() => void>(() => {});
  const logItems = useMemo(() => buildLogItems(act), [act]);
  const atlasData = useMemo(() => getAtlasStepData(metadata), [metadata]);
  const liveTracking = atlasData?.live_tracking;
  const liveNotes = (atlasData?.local_knowledge_notes ?? []).filter(
    (note) => note.phase === 'live',
  );

  const eyebrow = buildEyebrow(step.title, step.starts_at);
  const inProgress = !step.completed_at;

  const appendStampedNote = useCallback(
    (text: string) => {
      const obs = buildObservation(text);
      const existingNotes = act.notes ?? '';
      const stamp = new Date(obs.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const formatted = `[${stamp}] ${obs.text}`;
      const nextAtlas = appendAtlasRaceNote(atlasData, {
        text,
        phase: 'live',
        kind: 'general',
        source: 'water_preview',
        lat: step.location_lat ?? undefined,
        lng: step.location_lng ?? undefined,
        focus_label: atlasData?.next_event?.label ?? step.location_name ?? step.title,
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

  const isTracking = liveTracking?.status === 'tracking';

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <AtmosphericBackground>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Top chrome row */}
            <View style={styles.topChrome}>
              <Pressable
                style={styles.back}
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/')
                }
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                <Text style={styles.backLabel}>Race</Text>
              </Pressable>
              <View style={styles.rightGlyphs}>
                <Pressable style={styles.glyphBtn} hitSlop={8}>
                  <Ionicons name="search" size={20} color="#FFFFFF" />
                </Pressable>
                <Pressable style={styles.glyphBtn} hitSlop={8}>
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color="#FFFFFF"
                  />
                </Pressable>
              </View>
            </View>

            <PreviewBanner />

            {/* Start sequence — single continuous 5-4-1-0 countdown.
                GPS capture fires automatically at the gun. */}
            <View style={styles.startCard}>
              <View style={styles.trackingHead}>
                <Text style={styles.trackingEyebrow}>START SEQUENCE</Text>
                <Text style={styles.trackingStatus}>5 · 4 · 1 · 0</Text>
              </View>
              {isCountingDown && sequenceTime !== null ? (
                <View style={styles.countdownBlock}>
                  <Text
                    style={[
                      styles.countdownTime,
                      { color: getCountdownColor(sequenceTime) },
                    ]}
                  >
                    {formatCountdown(sequenceTime)}
                  </Text>
                  <Text style={styles.countdownSignal}>
                    {countdownSignal(sequenceTime)}
                  </Text>
                  <Pressable
                    style={styles.cancelCountdownBtn}
                    onPress={cancelCountdown}
                    hitSlop={6}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.cancelCountdownText}>Cancel sequence</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={styles.trackingBody}>
                    Run the 5-minute start sequence. GPS track capture begins
                    automatically at the gun.
                  </Text>
                  <Pressable
                    style={[styles.trackingButton, isTracking && styles.trackingButtonDisabled]}
                    onPress={() => {
                      void startCountdown();
                    }}
                    disabled={isTracking}
                  >
                    <Ionicons name="timer-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.trackingButtonText}>Start 5:00 sequence</Text>
                  </Pressable>
                </>
              )}
            </View>

            <View style={styles.trackingCard}>
              <View style={styles.trackingHead}>
                <Text style={styles.trackingEyebrow}>LIVE TRACKING</Text>
                <Text style={styles.trackingStatus}>
                  {(liveTracking?.status ?? 'idle').toUpperCase()}
                </Text>
              </View>
              <Text style={styles.trackingBody}>
                Start phone GPS capture from this step, then use the same step for replay and post-race notes later.
              </Text>
              {isTracking ? (
                <View style={styles.trackPointRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.trackPointText}>{trackPointCount} GPS points</Text>
                </View>
              ) : null}
              <Pressable
                style={[
                  styles.trackingButton,
                  isTracking && styles.trackingButtonStop,
                ]}
                onPress={isTracking ? handleStopTracking : handleStartTracking}
                disabled={trackingBusy}
              >
                <Ionicons
                  name={isTracking ? 'stop-circle-outline' : 'radio-outline'}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.trackingButtonText}>
                  {trackingBusy
                    ? 'Working...'
                    : isTracking
                      ? 'Stop live tracking'
                      : 'Start live tracking'}
                </Text>
              </Pressable>
            </View>

            {/* Race status eyebrow with live-dot */}
            <View style={styles.statusRow}>
              <View style={styles.liveDot} />
              <Text style={styles.statusEyebrow}>{eyebrow}</Text>
            </View>

            {/* Pinned permission rule — load-bearing for action */}
            <View style={styles.ruleWrap}>
              <PermissionRuleCallout
                variant="pinned"
                label="YOUR PERMISSION RULE · PLACEHOLDER"
                text="If the left fills in past ten degrees on starboard, I commit."
                ack="Left at 8°. Rule not yet triggered."
                watching
              />
            </View>

            <View style={styles.localKnowledgeCard}>
              <Text style={styles.localKnowledgeEyebrow}>LOCAL KNOWLEDGE LAYER</Text>
              <Text style={styles.localKnowledgeBody}>
                Tap a note in the moment. It saves to Do observations and stays attached to this course as a separate note layer.
              </Text>
              <View style={styles.localKnowledgeChipRow}>
                {LOCAL_KNOWLEDGE_TEMPLATES.map((template) => (
                  <Pressable
                    key={template.kind}
                    style={styles.localKnowledgeChip}
                    onPress={() => appendStampedNote(template.text)}
                  >
                    <Text style={styles.localKnowledgeChipText}>{template.label}</Text>
                  </Pressable>
                ))}
              </View>
              {liveNotes.length > 0 ? (
                <View style={styles.localKnowledgeList}>
                  {liveNotes.slice(-3).map((note) => (
                    <Text key={note.id} style={styles.localKnowledgeListItem}>
                      • {note.text}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Running log header */}
            <View style={styles.logHead}>
              <Text style={styles.logHeadTitle}>RUNNING LOG</Text>
              <Text style={styles.logHeadCount}>
                {logItems.length} {logItems.length === 1 ? 'capture' : 'captures'}
                {inProgress ? ' · in progress' : ''}
              </Text>
            </View>

            {/* Running log — reverse chronological */}
            {logItems.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>
                  No captures yet. Use the mic, camera, or flag below to
                  capture as you go.
                </Text>
              </View>
            ) : (
              <View>
                {logItems.map((item) => (
                  <LogEntry
                    key={item.id}
                    kind={item.kind}
                    time={item.time}
                    text={item.text}
                    photoUri={item.photoUri}
                    photoCaption={item.photoCaption}
                  />
                ))}
              </View>
            )}

            {/* Hero-mic composer */}
            <HeroMicComposer prompt="Capture." />

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </AtmosphericBackground>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLogItems(act: StepActData): LogItem[] {
  const items: LogItem[] = [];

  for (const obs of act.observations ?? []) {
    items.push(observationToLog(obs));
  }
  for (const media of act.media_uploads ?? []) {
    const log = mediaToLog(media);
    if (log) items.push(log);
  }

  // Reverse chronological — newest first per the design.
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return items;
}

function observationToLog(obs: Observation): LogItem {
  return {
    id: obs.id,
    kind: obs.source === 'voice' ? 'voice' : 'note',
    time: formatLogTime(obs.timestamp),
    timestamp: obs.timestamp,
    text: obs.text,
  };
}

function mediaToLog(media: MediaUpload): LogItem | null {
  if (!media.created_at) return null;
  return {
    id: media.id,
    kind: 'photo',
    time: formatLogTime(media.created_at),
    timestamp: media.created_at,
    photoUri: media.uri,
    photoCaption: media.caption,
  };
}

function formatLogTime(iso: string): string {
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return '';
  }
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (seconds <= 10) return secs.toString();
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getCountdownColor(seconds: number | null): string {
  if (seconds === null) return 'rgba(255, 255, 255, 0.6)';
  if (seconds <= 10) return '#FF453A';
  if (seconds <= 60) return '#FFD60A';
  return '#FFFFFF';
}

function countdownSignal(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds > 240) return 'WARNING SIGNAL · 5 MINUTES';
  if (seconds > 60) return 'PREP SIGNAL · 4 MINUTES';
  if (seconds > 0) return 'ONE MINUTE';
  return 'START';
}

function buildEyebrow(title: string, startsAt: string | null): string {
  const parts: string[] = [];
  if (startsAt) {
    try {
      parts.push(format(parseISO(startsAt), 'EEEE').toUpperCase());
    } catch {
      /* skip */
    }
  }
  parts.push((title ?? 'Step').toUpperCase());
  parts.push('IN PROGRESS');
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function PreviewBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons
        name="information-circle"
        size={14}
        color="rgba(255, 255, 255, 0.78)"
      />
      <Text style={styles.bannerText}>
        Preview: log entries are wired to real act_data. Pinned permission
        rule, watching pulse, and composer affordances are placeholder.
      </Text>
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.page}>
      <AtmosphericBackground>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <Stack.Screen options={{ headerShown: false }} />
          <View style={styles.errorWrap}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={IOS_REGISTER.accentMarkedContent}
            />
            <Text style={styles.errorText}>{message}</Text>
          </View>
        </SafeAreaView>
      </AtmosphericBackground>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  loadingSafe: {
    flex: 1,
  },
  loadingBg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
  },
  scroll: {
    paddingTop: 4,
  },
  topChrome: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingRight: 6,
  },
  backLabel: {
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  rightGlyphs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glyphBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 8,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.86)',
    letterSpacing: -0.1,
  },
  startCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 12,
    gap: 8,
  },
  countdownBlock: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
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
    color: 'rgba(255, 255, 255, 0.86)',
  },
  cancelCountdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  cancelCountdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  trackPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackPointText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.86)',
    fontVariant: ['tabular-nums'],
  },
  trackingButtonDisabled: {
    opacity: 0.45,
  },
  trackingCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 12,
    gap: 8,
  },
  trackingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  trackingEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255, 255, 255, 0.86)',
  },
  trackingStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_REGISTER.accentMarkedContent,
  },
  trackingBody: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.82)',
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  trackingButtonStop: {
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
  },
  trackingButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOS_REGISTER.accentMarkedContent,
  },
  statusEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.86)',
  },
  ruleWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  localKnowledgeCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    gap: 10,
  },
  localKnowledgeEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255, 255, 255, 0.86)',
  },
  localKnowledgeBody: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  localKnowledgeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  localKnowledgeChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  localKnowledgeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  localKnowledgeList: {
    gap: 4,
  },
  localKnowledgeListItem: {
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.76)',
  },
  logHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 8,
  },
  logHeadTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: 'rgba(255, 255, 255, 0.86)',
  },
  logHeadCount: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.56)',
    letterSpacing: 0.2,
  },
  emptyWrap: {
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.72)',
    textAlign: 'center',
  },
});
