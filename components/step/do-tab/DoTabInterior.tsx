import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { StepPlanData } from '@/types/step-detail';
import type { DoCaptureItem } from './doCaptureModel';
import type { DoInteriorState } from './doState';
import { DoStartCard } from './DoStartCard';
import { PlanStartingFrameRow } from './PlanStartingFrameRow';
import { DoLiveCard } from './DoLiveCard';
import { DoPostActivityCard } from './DoPostActivityCard';
import { StepOutcomeCard } from './StepOutcomeCard';
import { BeatsList } from './BeatsList';
import { useStepBeatsBinding } from '@/hooks/useStepBeats';

export interface DoTabInteriorProps {
  state: DoInteriorState;
  stepId?: string;
  planData: StepPlanData;
  captures: DoCaptureItem[];
  readOnly?: boolean;
  interestId?: string;
  interestName?: string;
  interestSlug?: string;
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
  /** Direct text-submit for the inline quick-note composer. */
  onQuickNoteSubmit?: (text: string) => void;
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
  /** When true, the pre_activity branch drops its inner ScrollView. */
  embedded?: boolean;
}

export function DoTabInterior({
  state,
  stepId,
  planData,
  captures,
  readOnly,
  interestId,
  interestName,
  interestSlug,
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
  onQuickNoteSubmit,
  onAutoSummarizePlan,
  onStopCapturing,
  onPressPlayVoice,
  onEditCapture,
  onDeleteCapture,
  onTagCapture,
  onMoveToReflect,
  onRefineSummary,
  onAddAnotherCapture,
  onDiscardActivity,
  onMarkAsEvidence,
  footer,
  embedded,
}: DoTabInteriorProps) {
  const beats = useStepBeatsBinding(stepId);
  const hasCaptures = captures.some((capture) => capture.kind !== 'time_marker');
  const beatsList = (
    <BeatsList
      beats={beats.beats}
      readOnly={readOnly}
      interestSlug={interestSlug}
      interestName={interestName}
      interestId={interestId}
      onAdd={beats.onAdd}
      onEdit={beats.onEdit}
      onDelete={beats.onDelete}
    />
  );

  if (state === 'live') {
    const liveBody = (
      <>
        <DoLiveCard
          stepId={stepId}
          captures={captures}
          stepTitle={stepTitle ?? ''}
          contextSegments={contextSegments}
          elapsedMs={elapsedMs}
          readOnly={readOnly}
          interestId={interestId}
          interestName={interestName}
          interestSlug={interestSlug}
          nowMs={nowMs}
          hideTimer={!isTimed}
          onAddQuickNote={onQuickNote}
          onAddPhoto={onPhotoOrVideo}
          onAddVoiceNote={onVoiceNote}
          onStopCapturing={onStopCapturing}
          onPressPlayVoice={onPressPlayVoice}
          onEditCapture={onEditCapture}
          onDeleteCapture={onDeleteCapture}
          onTagCapture={onTagCapture}
        />
        {hasCaptures && onMoveToReflect && !readOnly ? (
          <MoveToReviewCTA onPress={onMoveToReflect} />
        ) : null}
        {stepId ? beatsList : null}
        {footer}
      </>
    );
    if (embedded) {
      return <View style={styles.contentEmbedded}>{liveBody}</View>;
    }
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {liveBody}
      </ScrollView>
    );
  }

  if (state === 'post_activity') {
    const postBody = (
      <>
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
        {stepId && !readOnly ? (
          <StepOutcomeCard
            stepId={stepId}
            interestId={interestId}
            interestName={interestName}
            interestSlug={interestSlug}
          />
        ) : null}
        {stepId ? beatsList : null}
        {footer}
      </>
    );
    if (embedded) {
      return <View style={styles.contentEmbedded}>{postBody}</View>;
    }
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {postBody}
      </ScrollView>
    );
  }

  if (embedded) {
    return (
      <View style={styles.contentEmbedded}>
        {state === 'pre_activity' && (
          <>
            <DoStartCard
              readOnly={readOnly}
              onVoiceNote={onVoiceNote}
              onPhotoOrVideo={onPhotoOrVideo}
              onQuickNoteSubmit={onQuickNoteSubmit}
            />
            <PlanStartingFrameRow
              planData={planData}
              onPress={readOnly ? undefined : onAutoSummarizePlan}
              disabled={readOnly}
            />
            {stepId ? beatsList : null}
          </>
        )}
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
            onQuickNoteSubmit={onQuickNoteSubmit}
          />
          <PlanStartingFrameRow
            planData={planData}
            onPress={readOnly ? undefined : onAutoSummarizePlan}
            disabled={readOnly}
          />
          {stepId ? beatsList : null}
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
  contentEmbedded: {
    padding: IOS_SPACING.md,
    gap: IOS_SPACING.sm,
  },
  containerEmbedded: {
    // intrinsic — parent ScrollView owns vertical scroll
  },
  moveToReview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.label,
  },
  moveToReviewPressed: {
    opacity: 0.78,
  },
  moveToReviewText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});

function MoveToReviewCTA({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.moveToReview, pressed && styles.moveToReviewPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Move to Review"
    >
      <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
      <Text style={styles.moveToReviewText}>Move to Review</Text>
      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
    </Pressable>
  );
}
