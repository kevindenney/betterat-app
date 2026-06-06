import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import type { StepPlanData } from '@/types/step-detail';
import type { DoCaptureItem } from './doCaptureModel';
import type { DoInteriorState } from './doState';
import { DoStartCard } from './DoStartCard';
import { PlanStartingFrameRow, type SubStepCaptureKind } from './PlanStartingFrameRow';
import { DoLiveCard } from './DoLiveCard';
import { DoPostActivityCard } from './DoPostActivityCard';
import { StepOutcomeCard } from './StepOutcomeCard';
import { RaceStartGpsCard } from './RaceStartGpsCard';
import { BeatsList } from './BeatsList';
import { useStepBeatsBinding } from '@/hooks/useStepBeats';
import { useLibraryBeforeBinding } from '@/hooks/useStepLibraryBefore';
import { BeforeTheShiftCard } from '@/components/step/v2/plan/BeforeTheShiftCard';

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
  /** Direct text-submit for the inline quick-note composer. */
  onQuickNoteSubmit?: (text: string) => void;
  /** Toggle a "how" sub-step's completed flag — renders the plan's How list as a checklist. */
  onToggleSubStep?: (subStepId: string, completed: boolean) => void;
  /** Log an observation / photo / voice note against a specific How sub-step. */
  onSubStepCapture?: (subStepId: string, kind: SubStepCaptureKind) => void;
  /** Inline note submit anchored to a beat or How sub-step (no modal). */
  onSubStepNoteSubmit?: (subStepId: string, text: string) => void;
  /** Captures already anchored to each How sub-step, newest-first, keyed by id. */
  subStepCaptures?: Record<string, DoCaptureItem[]>;
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
  onQuickNoteSubmit,
  onToggleSubStep,
  subStepCaptures,
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
  const library = useLibraryBeforeBinding(stepId, interestId);
  // Do is a do-and-capture surface: beat rows are display-only here. Pinned
  // library items still render, but pinning/unpinning and per-row capture
  // affordances live on Plan. Capture flows through the single bottom bar
  // (DoStartCard) and files against the whole step — people jump between How
  // items and beats non-sequentially, so we don't force a per-row target.
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
      onToggleDone={beats.onToggleDone}
      onReorder={beats.onReorder}
      refsByBeat={library.itemsByBeat}
      capturesByBeat={subStepCaptures}
      onOpenLibraryRef={(libraryItemId) =>
        router.push(`/(tabs)/library/items/${libraryItemId}` as any)
      }
    />
  );
  // Read/watch check-off list of library items already pinned to this step on
  // Plan. Display + toggle only here — pinning is Plan-only, so no
  // onAddFromLibrary and no picker. Renders nothing when nothing is pinned.
  const libraryCard =
    stepId && !readOnly ? (
      <BeforeTheShiftCard
        items={library.items}
        totalEstimate={library.totalEstimate}
        onToggle={library.onToggle}
      />
    ) : null;
  // Per-step business-outcome capture. StepOutcomeCard self-gates on the
  // entrepreneur persona (returns null otherwise), so it can render in every
  // Do state. It must: untimed steps (the entrepreneur default) never expose a
  // Stop-capturing CTA, so they never reach post_activity — scoping the card to
  // that state alone left "This sale" unreachable for the persona it's built for.
  const outcomeCard =
    stepId && !readOnly ? (
      <StepOutcomeCard
        stepId={stepId}
        interestId={interestId}
        interestName={interestName}
        interestSlug={interestSlug}
      />
    ) : null;
  // Sailing-only race start sequence + GPS track capture. Self-gates to the
  // sailing persona (returns null otherwise), so it can render in pre_activity
  // for every interest without leaking into non-sailing surfaces. Also gated
  // on `isTimed` — the 5-4-1-0 sequence is timed machinery, so it follows the
  // same per-step signal as the live timer (a non-race prep step like "compare
  // rig dimensions" shouldn't lead with a race start). When the per-step-timing
  // flag is off, isTimed defaults true and this is unchanged.
  const raceStartCard =
    stepId && !readOnly && isTimed ? (
      <RaceStartGpsCard
        stepId={stepId}
        interestId={interestId}
        interestName={interestName}
        interestSlug={interestSlug}
      />
    ) : null;
  // The plan's How list rendered as a tap-to-check checklist. Persisted across
  // every Do state (not just pre_activity) so the user keeps their plan and can
  // tick off sub-steps while capturing in-play and after the activity.
  const howChecklist = (
    <PlanStartingFrameRow
      planData={planData}
      readOnly={readOnly}
      onToggleSubStep={onToggleSubStep}
      subStepRefs={library.itemsBySubStep}
      onOpenLibraryRef={(libraryItemId) =>
        router.push(`/(tabs)/library/items/${libraryItemId}` as any)
      }
      subStepCaptures={subStepCaptures}
      showWhoWhy={false}
    />
  );

  if (state === 'live') {
    const liveBody = (
      <>
        {raceStartCard}
        {/* Capture is the hero of Do: the live composer + evidence stream lead,
            with the plan (How / Beats) as reference below. */}
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
          onQuickNoteSubmit={onQuickNoteSubmit}
          onAddPhoto={onPhotoOrVideo}
          onAddVoiceNote={onVoiceNote}
          onStopCapturing={onStopCapturing}
          onPressPlayVoice={onPressPlayVoice}
          onEditCapture={onEditCapture}
          onDeleteCapture={onDeleteCapture}
          onTagCapture={onTagCapture}
        />
        {howChecklist}
        {stepId ? beatsList : null}
        {outcomeCard}
        {onMoveToReflect && !readOnly ? (
          <MoveToReflectCTA onPress={onMoveToReflect} />
        ) : null}
        {libraryCard}
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
        {raceStartCard}
        {howChecklist}
        {stepId ? beatsList : null}
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
        {outcomeCard}
        {libraryCard}
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
              onMoveToReflect={onMoveToReflect}
            />
            {howChecklist}
            {stepId ? beatsList : null}
            {raceStartCard}
            {libraryCard}
            {outcomeCard}
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
            onMoveToReflect={onMoveToReflect}
          />
          {howChecklist}
          {stepId ? beatsList : null}
          {raceStartCard}
          {libraryCard}
          {outcomeCard}
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

function MoveToReflectCTA({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.moveToReview, pressed && styles.moveToReviewPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Move to Reflect"
    >
      <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
      <Text style={styles.moveToReviewText}>Move to Reflect</Text>
      <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
    </Pressable>
  );
}
