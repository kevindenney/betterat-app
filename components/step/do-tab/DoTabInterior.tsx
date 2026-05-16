import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IOS_SPACING } from '@/lib/design-tokens-ios';
import type { StepPlanData } from '@/types/step-detail';
import type { DoCaptureItem } from './doCaptureModel';
import type { DoInteriorState } from './doState';
import { DoStartCard } from './DoStartCard';
import { PlanStartingFrameRow } from './PlanStartingFrameRow';
import { DoLiveCard } from './DoLiveCard';
import { DoPostActivityCard } from './DoPostActivityCard';

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
  /** Activity-elapsed ms; drives the Frame 2 live header / Frame 3 final stat. Defaults to 0. */
  elapsedMs?: number;
  /** Final stat override for Frame 3's capture count (defaults to non-marker count). */
  postActivityCaptureCount?: number;
  /** Frame 3 auto-summary step-chip label (e.g. "Light-air starts"). */
  summaryStepChipLabel?: string;
  /** Optional now-anchor for relative-ago labels; pass for deterministic tests. */
  nowMs?: number;
  /**
   * When false the live header timer and Stop-capturing CTA are hidden — the
   * step is a passive capture surface, not a stopwatch activity. Defaults true
   * for backwards compatibility with the existing timed flow. Per-step timing
   * is gated by FEATURE_FLAGS.PRACTICE_DO_TAB_PER_STEP_TIMING upstream.
   */
  isTimed?: boolean;
  onVoiceNote?: () => void;
  onPhotoOrVideo?: () => void;
  onQuickNote?: () => void;
  onAutoSummarizePlan?: () => void;
  onTagCapture?: (captureId: string) => void;
  onMoveToReflect?: () => void;
  onRefineSummary?: () => void;
  /** Stop-capturing CTA callback for Frame 2's reverse-polarity button. */
  onStopCapturing?: () => void;
  /** Voice-play callback forwarded to Frame 2/3 capture rows. */
  onPressPlayVoice?: (captureId: string) => void;
  /** Edit callback forwarded to Frame 2 capture rows (wired in Commit 6). */
  onEditCapture?: (captureId: string) => void;
  /** Delete callback forwarded to Frame 2 capture rows (wired in Commit 6). */
  onDeleteCapture?: (captureId: string) => void;
  /** Frame 3 secondary additive action — re-opens capture stream. */
  onAddAnotherCapture?: () => void;
  /** Frame 3 secondary destructive action — drops the activity (long-press confirm upstream). */
  onDiscardActivity?: () => void;
  /**
   * Frame 3 mark-as-evidence trigger. When provided, each frozen capture
   * row becomes a Pressable that fires this callback with the row's id.
   * Hidden when omitted.
   */
  onMarkAsEvidence?: (captureId: string) => void;
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
  postActivityCaptureCount,
  summaryText,
  summaryStepChipLabel,
  nowMs,
  isTimed = true,
  onVoiceNote,
  onPhotoOrVideo,
  onQuickNote,
  onAutoSummarizePlan,
  onStopCapturing,
  onPressPlayVoice,
  onEditCapture,
  onDeleteCapture,
  onMoveToReflect,
  onRefineSummary,
  onAddAnotherCapture,
  onDiscardActivity,
  onMarkAsEvidence,
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
          hideTimer={!isTimed}
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

  if (state === 'post_activity') {
    return (
      <View style={styles.container}>
        <DoPostActivityCard
          captures={captures}
          stepTitle={stepTitle ?? ''}
          contextSegments={contextSegments}
          elapsedMs={elapsedMs}
          captureCount={postActivityCaptureCount}
          summaryText={summaryText}
          summaryStepChipLabel={summaryStepChipLabel}
          readOnly={readOnly}
          nowMs={nowMs}
          onPressPlayVoice={onPressPlayVoice}
          onMoveToReflect={onMoveToReflect}
          onRefineSummary={onRefineSummary}
          onAddAnotherCapture={onAddAnotherCapture}
          onDiscardActivity={onDiscardActivity}
          onMarkAsEvidence={onMarkAsEvidence}
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
