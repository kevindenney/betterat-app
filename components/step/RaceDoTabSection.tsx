/**
 * RaceDoTabSection — the two race controls that sit at the top of the standard
 * Do tab for a race step: the START SEQUENCE card and the LIVE TRACKING card.
 *
 * This replaces the earlier full-screen atmospheric cockpit takeover of the Do
 * tab (kept only as the standalone /race/ios/water route). The Do tab is now
 * the mostly-standard capture surface; these two cards are prepended above it
 * in the app's normal light theme. A compact "add to local knowledge" row lets
 * the sailor stamp a note in the moment — the local-knowledge layer itself is
 * homed on the race area in Atlas; this only appends to it.
 *
 * The start sequence and live tracking are coupled (the gun fires GPS capture),
 * so all state lives in the shared useRaceStartTracking hook.
 */

import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useStepDetail } from '@/hooks/useStepDetail';
import { useRaceStartTracking } from '@/hooks/useRaceStartTracking';
import { RaceLocalKnowledgeAdder } from './RaceLocalKnowledgeAdder';
import type { StepActData, StepMetadata } from '@/types/step-detail';

const RACE = '#2563EB';

interface RaceDoTabSectionProps {
  stepId: string;
  readOnly?: boolean;
}

export function RaceDoTabSection({ stepId, readOnly }: RaceDoTabSectionProps) {
  const { data: step } = useStepDetail(stepId);

  if (!step) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={RACE} />
      </View>
    );
  }

  return <SectionBody step={step} readOnly={readOnly} />;
}

function SectionBody({
  step,
  readOnly,
}: {
  step: NonNullable<ReturnType<typeof useStepDetail>['data']>;
  readOnly?: boolean;
}) {
  const metadata = (step.metadata ?? {}) as StepMetadata;
  const act = useMemo(
    () => ((metadata.act ?? (step.metadata as any)?.act_data ?? {}) as StepActData) ?? {},
    [metadata.act, step.metadata],
  );

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
  } = useRaceStartTracking(step, act);

  return (
    <View style={styles.wrap}>
      {/* START SEQUENCE */}
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>START SEQUENCE</Text>
          <Text style={styles.headMeta}>5 · 4 · 1 · 0</Text>
        </View>
        {isCountingDown && sequenceTime !== null ? (
          <View style={styles.countdownBlock}>
            <Text style={[styles.countdownTime, { color: getCountdownColor(sequenceTime) }]}>
              {formatCountdown(sequenceTime)}
            </Text>
            <Text style={styles.countdownSignal}>{countdownSignal(sequenceTime)}</Text>
            <Pressable style={styles.cancelBtn} onPress={cancelCountdown} hitSlop={6}>
              <Ionicons name="close-circle-outline" size={15} color={IOS_COLORS.secondaryLabel} />
              <Text style={styles.cancelText}>Cancel sequence</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.body}>
              Run the 5-minute start sequence. GPS track capture begins
              automatically at the gun.
            </Text>
            <Pressable
              style={[styles.primaryBtn, (isTracking || readOnly) && styles.btnDisabled]}
              onPress={() => {
                void startCountdown();
              }}
              disabled={isTracking || readOnly}
            >
              <Ionicons name="timer-outline" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Start 5:00 sequence</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* LIVE TRACKING */}
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>LIVE TRACKING</Text>
          <Text style={[styles.headMeta, isTracking && styles.headMetaLive]}>
            {liveTrackingStatus.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.body}>
          Start phone GPS capture from this step, then use the same step for
          replay and post-race notes later.
        </Text>
        {isTracking ? (
          <View style={styles.trackPointRow}>
            <View style={styles.liveDot} />
            <Text style={styles.trackPointText}>{trackPointCount} GPS points</Text>
          </View>
        ) : null}
        <Pressable
          style={[styles.primaryBtn, isTracking && styles.stopBtn, (trackingBusy || readOnly) && styles.btnDisabled]}
          onPress={isTracking ? handleStopTracking : handleStartTracking}
          disabled={trackingBusy || readOnly}
        >
          <Ionicons
            name={isTracking ? 'stop-circle-outline' : 'radio-outline'}
            size={16}
            color="#FFFFFF"
          />
          <Text style={styles.primaryBtnText}>
            {trackingBusy
              ? 'Working…'
              : isTracking
                ? 'Stop live tracking'
                : 'Start live tracking'}
          </Text>
        </Pressable>
      </View>

      {/* Add to local knowledge (homed in Atlas; this just appends) */}
      <RaceLocalKnowledgeAdder stepId={step.id} phase="live" readOnly={readOnly} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (seconds <= 10) return secs.toString();
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getCountdownColor(seconds: number | null): string {
  if (seconds === null) return IOS_COLORS.secondaryLabel;
  if (seconds <= 10) return '#FF3B30';
  if (seconds <= 60) return '#FF9500';
  return IOS_COLORS.label;
}

function countdownSignal(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds > 240) return 'WARNING SIGNAL · 5 MINUTES';
  if (seconds > 60) return 'PREP SIGNAL · 4 MINUTES';
  if (seconds > 0) return 'ONE MINUTE';
  return 'START';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: IOS_SPACING.md,
    paddingTop: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
  },
  loading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(37,99,235,0.35)',
    backgroundColor: 'rgba(37,99,235,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: RACE,
  },
  headMeta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: IOS_COLORS.secondaryLabel,
  },
  headMetaLive: {
    color: '#FF3B30',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
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
    color: IOS_COLORS.secondaryLabel,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: RACE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  stopBtn: {
    backgroundColor: '#FF3B30',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  trackPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  trackPointText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    fontVariant: ['tabular-nums'],
  },
});

export default RaceDoTabSection;
