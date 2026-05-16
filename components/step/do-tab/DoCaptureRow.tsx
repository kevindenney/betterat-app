import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatClockTime, formatRelativeAgo } from './doCaptureModel';
import type { DoCaptureItem } from './doCaptureModel';
import {
  PhotoCapturePreview,
  QuickNoteCapturePreview,
  TimeMarkerCapturePreview,
  VoiceCapturePreview,
} from './DoCapturePreview';

const IOS_BLUE = '#007AFF';
const CORAL = '#FF6B6B';
const CORAL_DEEP = '#E54848';
const CORAL_TINT = 'rgba(255, 107, 107, 0.10)';
const GRAY_3 = '#C7C7CC';
const GRAY_5 = '#E5E5EA';
const LABEL = '#1C1C1E';
const LABEL_2 = '#3C3C43';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';
const LABEL_4 = 'rgba(60, 60, 67, 0.30)';
const FRESH_GLOW = 'rgba(255, 107, 107, 0.14)';
const FRESH_BG = '#FFFBF9';

const PULSE_DURATION_MS = 1400;

const ACCENT_BY_KIND: Record<string, string> = {
  voice: IOS_BLUE,
  note: GRAY_3,
  photo: LABEL_2,
  video: LABEL_2,
  media_link: GRAY_3,
  flag: CORAL,
};

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  voice: { icon: 'mic', label: 'Voice' },
  note: { icon: 'create-outline', label: 'Quick note' },
  photo: { icon: 'camera-outline', label: 'Photo' },
  video: { icon: 'videocam-outline', label: 'Video' },
  media_link: { icon: 'link-outline', label: 'Link' },
  flag: { icon: 'flag', label: 'Flag' },
};

export interface DoCaptureRowProps {
  capture: DoCaptureItem;
  /** When true the topmost capture renders the warm wash + 14% coral ring. */
  fresh?: boolean;
  /**
   * Frame 3 post-activity render. When true the row suppresses the
   * fresh wash regardless of {@link fresh} and renders chips with the
   * neutral gray-6 variant (per anatomy callout E) instead of the
   * live coral-tint variant Frame 2 uses.
   */
  frozen?: boolean;
  /** Optional now-anchor for the "ago" label so test snapshots stay deterministic. */
  nowMs?: number;
  /** Voice play callback forwarded to {@link VoiceCapturePreview}. */
  onPressPlayVoice?: (captureId: string) => void;
  /**
   * Edit handler — wired in Phase B.7 Commit 6 to StepDrawContent's
   * existing observation edit / media caption update paths. When omitted
   * the affordance is hidden, preserving the read-only render.
   */
  onEdit?: (captureId: string) => void;
  /**
   * Delete handler — wired in Phase B.7 Commit 6 to StepDrawContent's
   * existing observation/media remove paths. Hidden when omitted.
   */
  onDelete?: (captureId: string) => void;
}

/**
 * Frame 2 · C — Capture row.
 * 40 / 1fr / auto grid via flex shims: ts column, body column, chip column.
 * Dispatches the body slot on capture.kind; voice gets the inline waveform,
 * photo gets the image frame, time_marker short-circuits to the divider.
 */
export function DoCaptureRow({
  capture,
  fresh,
  frozen,
  nowMs,
  onPressPlayVoice,
  onEdit,
  onDelete,
}: DoCaptureRowProps) {
  if (capture.kind === 'time_marker') {
    return <TimeMarkerCapturePreview capture={capture} />;
  }

  const showFresh = fresh && !frozen;

  const accent = ACCENT_BY_KIND[capture.kind] ?? GRAY_3;
  const meta = TYPE_META[capture.kind] ?? TYPE_META.note;
  const clock = formatClockTime(capture.capturedAt);
  const ago = formatRelativeAgo(capture.capturedAt, nowMs);
  const isVoice = capture.kind === 'voice';
  const isPhoto = capture.kind === 'photo' || capture.kind === 'video';

  return (
    <View
      style={[styles.row, { borderLeftColor: accent }, showFresh && styles.rowFresh]}
      accessibilityRole="text"
    >
      <View style={styles.tsCol}>
        {clock ? <Text style={styles.ts}>{clock}</Text> : null}
        {ago ? <Text style={styles.ago}>{ago}</Text> : null}
      </View>

      <View style={styles.bodyCol}>
        {capture.body ? (
          <Text style={[styles.body, isVoice && styles.bodyVoice]}>{capture.body}</Text>
        ) : null}

        {isVoice ? (
          <VoiceCapturePreview capture={capture} onPressPlay={onPressPlayVoice} />
        ) : null}
        {isPhoto ? <PhotoCapturePreview capture={capture} /> : null}
        {!isVoice && !isPhoto && capture.kind === 'note' ? (
          // QuickNote's body text already renders above; preview retains the slot for parity.
          <QuickNoteCapturePreview capture={capture} />
        ) : null}

        <View style={styles.meta}>
          <View style={styles.metaType}>
            <Ionicons name={meta.icon} size={11} color={LABEL_3} />
            <Text style={styles.metaText}>{meta.label}</Text>
          </View>
          {capture.beatLabel ? (
            <>
              <Text style={styles.sep}>·</Text>
              <Text style={[styles.metaText, styles.beat]}>{capture.beatLabel}</Text>
            </>
          ) : null}
          {capture.metaSubtitle ? (
            <>
              <Text style={styles.sep}>·</Text>
              <Text style={styles.metaText}>{capture.metaSubtitle}</Text>
            </>
          ) : null}
          {onEdit ? (
            <>
              <Text style={styles.sep}>·</Text>
              <Pressable
                onPress={() => onEdit(capture.id)}
                accessibilityRole="button"
                accessibilityLabel="Edit capture"
                hitSlop={6}
              >
                <Text style={[styles.metaText, styles.metaAction]}>Edit</Text>
              </Pressable>
            </>
          ) : null}
          {onDelete ? (
            <>
              <Text style={styles.sep}>·</Text>
              <Pressable
                onPress={() => onDelete(capture.id)}
                accessibilityRole="button"
                accessibilityLabel="Delete capture"
                hitSlop={6}
              >
                <Text style={[styles.metaText, styles.metaAction]}>Delete</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {capture.chipLabel ? (
        <CaptureChip
          label={capture.chipLabel}
          live={!frozen && capture.chipLive}
          neutral={frozen}
        />
      ) : null}
    </View>
  );
}

function CaptureChip({ label, live, neutral }: { label: string; live?: boolean; neutral?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!live) return undefined;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: PULSE_DURATION_MS,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.65, 0, 0] });

  return (
    <View
      style={[styles.chip, live && styles.chipLive, neutral && styles.chipNeutral]}
      accessibilityLabel={label}
    >
      {live ? (
        <View style={styles.chipDotWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.chipDotRing,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
          <View style={styles.chipDot} />
        </View>
      ) : null}
      <Text
        style={[
          styles.chipLbl,
          live && styles.chipLblLive,
          neutral && styles.chipLblNeutral,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
    borderLeftWidth: 2.5,
    borderLeftColor: GRAY_3,
    borderRadius: 12,
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 11,
    paddingLeft: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.025,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  rowFresh: {
    backgroundColor: FRESH_BG,
    borderColor: FRESH_GLOW,
    shadowOpacity: 0.04,
  },
  tsCol: {
    width: 40,
    paddingTop: 1,
  },
  ts: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.05,
    color: LABEL_3,
    fontVariant: ['tabular-nums'],
  },
  ago: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 0.1,
    color: LABEL_4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  bodyCol: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
    color: LABEL,
  },
  bodyVoice: {
    fontStyle: 'italic',
  },
  meta: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 10,
    letterSpacing: -0.02,
    color: LABEL_3,
  },
  beat: {
    fontWeight: '500',
  },
  metaAction: {
    color: IOS_BLUE,
    fontWeight: '600',
  },
  sep: {
    fontSize: 10,
    color: LABEL_4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
    paddingRight: 8,
    paddingBottom: 3,
    paddingLeft: 8,
    borderRadius: 999,
    backgroundColor: CORAL_TINT,
    alignSelf: 'flex-start',
  },
  chipLive: {
    backgroundColor: CORAL,
    paddingLeft: 6,
  },
  chipNeutral: {
    backgroundColor: '#F2F2F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  chipDotWrap: {
    width: 5,
    height: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  chipDotRing: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  chipLbl: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: CORAL_DEEP,
  },
  chipLblLive: {
    color: '#FFFFFF',
  },
  chipLblNeutral: {
    color: LABEL_2,
  },
});
