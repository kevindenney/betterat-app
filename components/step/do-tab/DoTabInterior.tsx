import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IOS_SPACING } from '@/lib/design-tokens-ios';
import type { StepPlanData } from '@/types/step-detail';
import type { DoCaptureItem } from './doCaptureModel';
import type { DoInteriorState } from './doState';
import { DoStartCard } from './DoStartCard';
import { PlanStartingFrameRow } from './PlanStartingFrameRow';
import { DoLiveCard } from './DoLiveCard';

export interface DoTabInteriorProps {
  state: DoInteriorState;
  planData: StepPlanData;
  captures: DoCaptureItem[];
  readOnly?: boolean;
  summaryText?: string;
  evidenceSelections?: string[];
  /** Step title rendered in Frame 2's quiet context strip. */
  stepTitle?: string;
  /** Trailing context segments rendered after the step title in Frame 2. */
  contextSegments?: string[];
  /** Activity-elapsed ms; drives the Frame 2 live header stat. Defaults to 0. */
  elapsedMs?: number;
  /** Optional now-anchor for relative-ago labels; pass for deterministic tests. */
  nowMs?: number;
  onVoiceNote?: () => void;
  onPhotoOrVideo?: () => void;
  onQuickNote?: () => void;
  onAutoSummarizePlan?: () => void;
  onTagCapture?: (captureId: string) => void;
  onMoveToReflect?: () => void;
  onRefineSummary?: () => void;
  /** Stop-capturing CTA callback for Frame 2's reverse-polarity button. */
  onStopCapturing?: () => void;
  /** Voice-play callback forwarded to Frame 2 capture rows. */
  onPressPlayVoice?: (captureId: string) => void;
  /** Edit callback forwarded to Frame 2 capture rows (wired in Commit 6). */
  onEditCapture?: (captureId: string) => void;
  /** Delete callback forwarded to Frame 2 capture rows (wired in Commit 6). */
  onDeleteCapture?: (captureId: string) => void;
  footer?: React.ReactNode;
}

export function DoTabInterior({
  state,
  planData,
  captures,
  readOnly,
  stepTitle,
  contextSegments,
  elapsedMs = 0,
  nowMs,
  onVoiceNote,
  onPhotoOrVideo,
  onQuickNote,
  onAutoSummarizePlan,
  onStopCapturing,
  onPressPlayVoice,
  onEditCapture,
  onDeleteCapture,
  footer,
}: DoTabInteriorProps) {
  if (state === 'live') {
    return (
      <View style={styles.container}>
        <DoLiveCard
          captures={captures}
          stepTitle={stepTitle ?? ''}
          contextSegments={contextSegments}
          elapsedMs={elapsedMs}
          readOnly={readOnly}
          nowMs={nowMs}
          onAddQuickNote={onQuickNote}
          onAddPhoto={onPhotoOrVideo}
          onAddVoiceNote={onVoiceNote}
          onStopCapturing={onStopCapturing}
          onPressPlayVoice={onPressPlayVoice}
          onEditCapture={onEditCapture}
          onDeleteCapture={onDeleteCapture}
        />
        {footer}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {state === 'pre_activity' && (
        <>
          <DoStartCard
            readOnly={readOnly}
            onVoiceNote={onVoiceNote}
            onPhotoOrVideo={onPhotoOrVideo}
            onQuickNote={onQuickNote}
          />
          <PlanStartingFrameRow
            planData={planData}
            onPress={readOnly ? undefined : onAutoSummarizePlan}
            disabled={readOnly}
          />
        </>
      )}

      {state === 'post_activity' && <View />}

      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: IOS_SPACING.md,
    paddingBottom: 96,
    gap: IOS_SPACING.sm,
  },
});
