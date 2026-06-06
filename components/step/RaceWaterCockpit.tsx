/**
 * RaceWaterCockpit — the live on-water capture surface for a race step.
 *
 * Atmospheric slate-blue ground (conditions become the surface), a
 * continuous 5-4-1-0 start sequence that fires GPS capture at the gun,
 * live tracking, a pinned permission rule, a local-knowledge note layer,
 * and a reverse-chronological running log.
 *
 * Used two ways:
 *   - Full screen at /race/ios/water/{stepId} (route renders it bare).
 *   - Embedded inside the Do tab for race steps (`embedded`), which drops
 *     the standalone top chrome / back row and lets the surrounding tab
 *     chrome own navigation.
 *
 * Wire-up status:
 *   Real data: step title, act observations + media → running log,
 *   capture count, live-tracking session + GPS point count.
 *   Placeholder: pinned permission rule (no step_rules schema yet),
 *   "watching" pulse, hero-mic composer affordances, beat tags.
 */

import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
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
import { useStepDetail } from '@/hooks/useStepDetail';
import { useRaceStartTracking } from '@/hooks/useRaceStartTracking';
import {
  LOCAL_KNOWLEDGE_TEMPLATES,
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

interface RaceWaterCockpitProps {
  stepId: string | undefined;
  /** When true, drops the standalone top chrome / back row for in-tab use. */
  embedded?: boolean;
  readOnly?: boolean;
}

export function RaceWaterCockpit({ stepId, embedded, readOnly }: RaceWaterCockpitProps) {
  const actualId = Array.isArray(stepId) ? stepId[0] : stepId;
  const { data: step, isLoading, error } = useStepDetail(actualId);

  if (!actualId || error) {
    return <ErrorState message={error?.message ?? 'No step id provided'} embedded={embedded} />;
  }

  if (isLoading || !step) {
    if (embedded) {
      return (
        <AtmosphericBackground style={styles.embeddedLoading}>
          <ActivityIndicator color="#FFFFFF" />
        </AtmosphericBackground>
      );
    }
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

  return <CockpitBody step={step} act={act} metadata={metadata} embedded={embedded} readOnly={readOnly} />;
}

function CockpitBody({
  step,
  act,
  metadata,
  embedded,
  readOnly,
}: {
  step: NonNullable<ReturnType<typeof useStepDetail>['data']>;
  act: StepActData;
  metadata: StepMetadata;
  embedded?: boolean;
  readOnly?: boolean;
}) {
  const logItems = useMemo(() => buildLogItems(act), [act]);
  const atlasData = useMemo(() => getAtlasStepData(metadata), [metadata]);
  const liveNotes = (atlasData?.local_knowledge_notes ?? []).filter(
    (note) => note.phase === 'live',
  );

  const eyebrow = buildEyebrow(step.title, step.starts_at);
  const inProgress = !step.completed_at;

  const {
    sequenceTime,
    isCountingDown,
    trackPointCount,
    trackingBusy,
    isTracking,
    liveTrackingStatus,
    startCountdown,
    cancelCountdown,
    handleStartTracking,
    handleStopTracking,
    appendStampedNote,
  } = useRaceStartTracking(step, act);

  const body = (
    <>
      {/* Top chrome row — standalone screen only; in-tab use inherits
          the surrounding tab navigation. */}
      {!embedded ? (
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
            ) : null}

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
                    disabled={isTracking || readOnly}
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
                  {liveTrackingStatus.toUpperCase()}
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
                disabled={trackingBusy || readOnly}
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
                    disabled={readOnly}
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
    </>
  );

  // Embedded in the Do tab: the surrounding StepCard already owns a single
  // scroll, so the cockpit must size intrinsically — no inner ScrollView,
  // no flex:1 (see StepCard scrollAsUnit). Keep the atmospheric ground as a
  // content-height block.
  if (embedded) {
    return <AtmosphericBackground style={styles.embeddedBg}>{body}</AtmosphericBackground>;
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <AtmosphericBackground>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {body}
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

function ErrorState({ message, embedded }: { message: string; embedded?: boolean }) {
  if (embedded) {
    return (
      <AtmosphericBackground style={styles.embeddedLoading}>
        <Ionicons
          name="alert-circle-outline"
          size={40}
          color={IOS_REGISTER.accentMarkedContent}
        />
        <Text style={styles.errorText}>{message}</Text>
      </AtmosphericBackground>
    );
  }
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
  // Embedded variants size to content (no flex:1) so the cockpit can sit
  // inside the StepCard's single scroll without collapsing.
  embeddedBg: {
    flex: 0,
    borderRadius: 16,
    overflow: 'hidden',
    paddingTop: 8,
  },
  embeddedLoading: {
    flex: 0,
    minHeight: 220,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 24,
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

export default RaceWaterCockpit;
