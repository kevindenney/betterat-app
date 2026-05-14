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
import { useStepDetail } from '@/hooks/useStepDetail';
import type {
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

  const act = ((step.metadata?.act_data ?? {}) as StepActData) ?? {};

  return <WaterBody step={step} act={act} />;
}

function WaterBody({
  step,
  act,
}: {
  step: NonNullable<ReturnType<typeof useStepDetail>['data']>;
  act: StepActData;
}) {
  const logItems = useMemo(() => buildLogItems(act), [act]);

  const eyebrow = buildEyebrow(step.title, step.starts_at);
  const inProgress = !step.completed_at;

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
