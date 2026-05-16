import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { DoCaptureItem } from './doCaptureModel';
import { sortCapturesNewestFirst } from './doCaptureModel';
import { DoLiveHeader } from './DoLiveHeader';
import { DoStepContextStrip } from './DoStepContextStrip';
import { DoCaptureRow } from './DoCaptureRow';
import { DoComposer } from './DoComposer';
import { DoStopCapturingButton } from './DoStopCapturingButton';

const CORAL = '#FF6B6B';
const CORAL_DEEP = '#E54848';
const GRAY_5 = '#E5E5EA';
const GRAY_6 = '#F2F2F7';
const LABEL_3 = 'rgba(60, 60, 67, 0.60)';
const LABEL_4 = 'rgba(60, 60, 67, 0.30)';

export interface DoLiveCardProps {
  /** Captures shown in the stream — pre-sorted or unsorted; newest is rendered at top. */
  captures: DoCaptureItem[];
  /** Step title rendered in the quiet context strip. */
  stepTitle: string;
  /** Trailing context segments rendered after the step title (e.g. ["Race 4", "beat 2"]). */
  contextSegments?: string[];
  /** Elapsed time since activity started, in milliseconds — drives the live header stat. */
  elapsedMs: number;
  /** When true the composer + stop CTA + edit/delete affordances are hidden/disabled. */
  readOnly?: boolean;
  /** Now-anchor for "ago" labels; pass through for test determinism. */
  nowMs?: number;
  /** Composer add-quick-note button callback. */
  onAddQuickNote?: () => void;
  /** Composer add-photo button callback. */
  onAddPhoto?: () => void;
  /** Composer add-voice (mic) button callback. */
  onAddVoiceNote?: () => void;
  /** Stop-capturing CTA callback — terminates the live session. */
  onStopCapturing?: () => void;
  /** Play callback forwarded to each voice capture row. */
  onPressPlayVoice?: (captureId: string) => void;
  /** Edit callback forwarded to each capture row (hidden when omitted). */
  onEditCapture?: (captureId: string) => void;
  /** Delete callback forwarded to each capture row (hidden when omitted). */
  onDeleteCapture?: (captureId: string) => void;
}

/**
 * Phase B.7 · Frame 2 · Live capturing card.
 *
 * Composes the live header, quiet step-context strip, reverse-chronological
 * capture stream, hovering composer, and reverse-polarity stop CTA. The
 * surface is purely presentational — capture persistence remains in
 * StepDrawContent today, with Phase B.7 Commit 6 wiring composer/stop/edit
 * callbacks through to existing handlers via a thin capture controller.
 */
export function DoLiveCard({
  captures,
  stepTitle,
  contextSegments,
  elapsedMs,
  readOnly,
  nowMs,
  onAddQuickNote,
  onAddPhoto,
  onAddVoiceNote,
  onStopCapturing,
  onPressPlayVoice,
  onEditCapture,
  onDeleteCapture,
}: DoLiveCardProps) {
  const ordered = sortCapturesNewestFirst(captures);
  const nonMarkerCount = ordered.reduce(
    (acc, c) => acc + (c.kind === 'time_marker' ? 0 : 1),
    0,
  );

  return (
    <View style={styles.card} accessibilityLabel="Do — live capturing">
      <DoLiveHeader captureCount={nonMarkerCount} elapsedMs={elapsedMs} />

      <DoStepContextStrip stepTitle={stepTitle} contextSegments={contextSegments} />

      <View style={styles.streamWrap}>
        <View style={styles.streamEyebrow}>
          <Text style={styles.streamEyebrowLbl}>
            <Text style={styles.streamEyebrowArrow}>↓ </Text>
            NEWEST FIRST
          </Text>
          {ordered.length > 0 ? (
            <View style={styles.freshest} accessibilityElementsHidden importantForAccessibility="no">
              <View style={styles.freshestDot} />
              <Text style={styles.freshestText}>Just now</Text>
            </View>
          ) : null}
        </View>

        {ordered.length === 0 ? (
          <View style={styles.emptyStream}>
            <Text style={styles.emptyStreamText}>
              Captures will appear here as you record them.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.stream}
            contentContainerStyle={styles.streamContent}
            showsVerticalScrollIndicator={false}
          >
            {ordered.map((c, i) => (
              <DoCaptureRow
                key={c.id}
                capture={c}
                fresh={i === 0 && c.kind !== 'time_marker'}
                nowMs={nowMs}
                onPressPlayVoice={onPressPlayVoice}
                onEdit={readOnly ? undefined : onEditCapture}
                onDelete={readOnly ? undefined : onDeleteCapture}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.composerWrap}>
        <DoComposer
          readOnly={readOnly}
          onAddQuickNote={onAddQuickNote}
          onAddPhoto={onAddPhoto}
          onAddVoiceNote={onAddVoiceNote}
        />
      </View>

      <View style={styles.stopWrap}>
        <DoStopCapturingButton onPress={onStopCapturing} disabled={readOnly} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
    flex: 1,
  },
  streamWrap: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  streamEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
    marginHorizontal: 4,
    marginBottom: 6,
  },
  streamEyebrowLbl: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.7,
    color: LABEL_3,
  },
  streamEyebrowArrow: {
    color: LABEL_4,
  },
  freshest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freshestDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: CORAL,
  },
  freshestText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: CORAL_DEEP,
  },
  stream: {
    flex: 1,
  },
  streamContent: {
    gap: 10,
    paddingBottom: 8,
  },
  emptyStream: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: GRAY_6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GRAY_5,
  },
  emptyStreamText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: LABEL_3,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  stopWrap: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
  },
});
