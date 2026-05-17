import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getInterestDoTabConfig } from '@/lib/interest-config';
import type { DoCaptureItem } from './doCaptureModel';
import { sortCapturesNewestFirst } from './doCaptureModel';
import { DoLiveHeader } from './DoLiveHeader';
import { DoStepContextStrip } from './DoStepContextStrip';
import { DoStream } from './DoStream';
import { StreamComposer } from './StreamComposer';
import { StopCapturingCTA } from './StopCapturingCTA';
import { CaptureTypesSheet } from './CaptureTypesSheet';

export interface DoLiveCardProps {
  stepId?: string;
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
  interestId?: string;
  interestName?: string;
  interestSlug?: string;
  /** Now-anchor for "ago" labels; pass through for test determinism. */
  nowMs?: number;
  /**
   * Hide the live header timer + the bottom Stop-capturing CTA. Used by the
   * untimed-step path (per-step timing flag) where the Do tab is just a
   * passive capture surface — no elapsed-time data, no explicit stop event.
   */
  hideTimer?: boolean;
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
  onTagCapture?: (captureId: string) => void;
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
  stepId,
  captures,
  stepTitle,
  contextSegments,
  elapsedMs,
  readOnly,
  interestId,
  interestName,
  interestSlug,
  nowMs,
  hideTimer,
  onAddQuickNote,
  onAddPhoto,
  onAddVoiceNote,
  onStopCapturing,
  onPressPlayVoice,
  onEditCapture,
  onDeleteCapture,
  onTagCapture,
}: DoLiveCardProps) {
  const ordered = sortCapturesNewestFirst(captures);
  const nonMarkerCount = ordered.reduce(
    (acc, c) => acc + (c.kind === 'time_marker' ? 0 : 1),
    0,
  );
  const config = getInterestDoTabConfig({ interestId, interestName, interestSlug });
  const timerStorageKey = stepId ? `do_tab_timer_visible:${stepId}` : null;
  const [timerVisible, setTimerVisible] = useState(config.showElapsedByDefault);
  const [captureTypesVisible, setCaptureTypesVisible] = useState(false);

  useEffect(() => {
    if (!timerStorageKey || typeof globalThis.localStorage === 'undefined') {
      setTimerVisible(config.showElapsedByDefault);
      return;
    }
    const saved = globalThis.localStorage.getItem(timerStorageKey);
    setTimerVisible(saved == null ? config.showElapsedByDefault : saved === 'true');
  }, [config.showElapsedByDefault, timerStorageKey]);

  const handleToggleTimer = () => {
    setTimerVisible((current) => {
      const next = !current;
      if (timerStorageKey && typeof globalThis.localStorage !== 'undefined') {
        globalThis.localStorage.setItem(timerStorageKey, String(next));
      }
      return next;
    });
  };

  return (
    <View style={styles.card} accessibilityLabel="Do — live capturing">
      {hideTimer ? null : (
        <DoLiveHeader
          captureCount={nonMarkerCount}
          elapsedMs={elapsedMs}
          liveLabel={config.statePillLabel}
          timerVisible={timerVisible}
          onToggleTimer={handleToggleTimer}
        />
      )}

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
          onAddQuickNote={onAddQuickNote}
          onAddPhoto={onAddPhoto}
          onAddVoiceNote={onAddVoiceNote}
        />
      </View>

      {hideTimer ? null : (
        <View style={styles.stopWrap}>
          <StopCapturingCTA
            state="capturing"
            label={config.stopCtaLabel}
            onStop={onStopCapturing}
            readOnly={readOnly}
          />
        </View>
      )}

      <CaptureTypesSheet
        visible={captureTypesVisible}
        onDismiss={() => setCaptureTypesVisible(false)}
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
    paddingBottom: 6,
  },
  stopWrap: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
  },
});
