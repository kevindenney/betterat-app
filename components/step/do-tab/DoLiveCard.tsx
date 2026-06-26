import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getInterestDoTabConfig } from '@/lib/interest-config';
import type { DoCaptureItem } from './doCaptureModel';
import { sortCapturesNewestFirst } from './doCaptureModel';
import { DoStepContextStrip } from './DoStepContextStrip';
import { DoStream } from './DoStream';
import { StreamComposer } from './StreamComposer';
import { CaptureTypesSheet } from './CaptureTypesSheet';

export interface DoLiveCardProps {
  stepId?: string;
  /** Captures shown in the stream — pre-sorted or unsorted; newest is rendered at top. */
  captures: DoCaptureItem[];
  /** Step title rendered in the quiet context strip. */
  stepTitle: string;
  /** Trailing context segments rendered after the step title (e.g. ["Race 4", "beat 2"]). */
  contextSegments?: string[];
  /** Elapsed time since activity started, in milliseconds. Retained for callers; no longer surfaced. */
  elapsedMs?: number;
  /** When true the composer + edit/delete affordances are hidden/disabled. */
  readOnly?: boolean;
  interestId?: string;
  interestName?: string;
  interestSlug?: string;
  /** Now-anchor for "ago" labels; pass through for test determinism. */
  nowMs?: number;
  /** Retained for callers; the live timer/stop chrome has been removed. */
  hideTimer?: boolean;
  /** Inline composer note submit — fired with the trimmed body on Return/send. */
  onQuickNoteSubmit?: (text: string) => void;
  /** Composer add-photo button callback. */
  onAddPhoto?: () => void;
  /** Composer add-voice (mic) button callback. */
  onAddVoiceNote?: () => void;
  /** "+" sheet → Video: open the in-app recorder. */
  onSelectVideo?: () => void;
  /** "+" sheet → Scan: open the barcode / QR scanner. */
  onSelectScan?: () => void;
  /** "+" sheet → Measurement: open the manual measurement form. */
  onSelectMeasurement?: () => void;
  /** Retained for callers; the Stop-capturing CTA has been removed. */
  onStopCapturing?: () => void;
  /** Play callback forwarded to each voice capture row. */
  onPressPlayVoice?: (captureId: string) => void;
  /** Edit callback forwarded to each capture row (hidden when omitted). */
  onEditCapture?: (captureId: string) => void;
  /** Delete callback forwarded to each capture row (hidden when omitted). */
  onDeleteCapture?: (captureId: string) => void;
  onTagCapture?: (captureId: string) => void;
}

/**
 * Do tab capture card.
 *
 * Composes the quiet step-context strip, reverse-chronological capture stream,
 * and the hovering composer. The live-recording chrome (pulsing coral "Doing"
 * header + Stop-capturing CTA) was removed — the Do tab is a calm, passive
 * capture surface, not a stopwatch session. Timing data still lives in the
 * controller; this surface just no longer renders the recording affect.
 */
export function DoLiveCard({
  stepId,
  captures,
  stepTitle,
  contextSegments,
  readOnly,
  interestId,
  interestName,
  interestSlug,
  nowMs,
  onQuickNoteSubmit,
  onAddPhoto,
  onAddVoiceNote,
  onSelectVideo,
  onSelectScan,
  onSelectMeasurement,
  onPressPlayVoice,
  onEditCapture,
  onDeleteCapture,
  onTagCapture,
}: DoLiveCardProps) {
  const ordered = sortCapturesNewestFirst(captures);
  const config = getInterestDoTabConfig({ interestId, interestName, interestSlug });
  const [captureTypesVisible, setCaptureTypesVisible] = useState(false);

  return (
    <View style={styles.card} accessibilityLabel="Do — capture">
      <DoStepContextStrip stepTitle={stepTitle} contextSegments={contextSegments} />

      <DoStream
        captures={ordered}
        stepId={stepId}
        nowMs={nowMs}
        readOnly={readOnly}
        emptyMessage={config.captureEmptyMessage}
        onCaptureLongPress={onTagCapture}
        onPressPlayVoice={onPressPlayVoice}
        onEditCapture={onEditCapture}
        onDeleteCapture={onDeleteCapture}
      />

      <View style={styles.composerWrap}>
        <StreamComposer
          readOnly={readOnly}
          onAddPress={() => setCaptureTypesVisible(true)}
          onSubmitNote={onQuickNoteSubmit}
          onAddPhoto={onAddPhoto}
          onAddVoiceNote={onAddVoiceNote}
        />
      </View>

      <CaptureTypesSheet
        visible={captureTypesVisible}
        onDismiss={() => setCaptureTypesVisible(false)}
        onSelectVideo={
          onSelectVideo
            ? () => {
                setCaptureTypesVisible(false);
                onSelectVideo();
              }
            : undefined
        }
        onSelectScan={
          onSelectScan
            ? () => {
                setCaptureTypesVisible(false);
                onSelectScan();
              }
            : undefined
        }
        onSelectMeasurement={
          onSelectMeasurement
            ? () => {
                setCaptureTypesVisible(false);
                onSelectMeasurement();
              }
            : undefined
        }
      />
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
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
  },
});
