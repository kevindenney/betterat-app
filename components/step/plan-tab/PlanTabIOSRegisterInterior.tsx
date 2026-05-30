/**
 * <PlanTabIOSRegisterInterior> — Phase 1 Plan body for the step-loop register.
 *
 * Gated by PRACTICE_STEP_LOOP_IOS_REGISTER. Composes the six new primitives
 * (AIHelperLine, FieldCard, CapabilityChipSet, SuggestionsRow, WithRow,
 * BottomCTA) into the canonical layout from
 * step-loop-integration-canonical.html §1 and becoming-loop-canonical.html §2.
 *
 * The WITH row is hoisted into the StepCard's `belowTitle` slot by the
 * consumer (PlanTab.tsx / StepPlanQuestions.tsx) — this component renders
 * the scroll body and the bottom CTA.
 *
 * Off-flag: this component never mounts. PlanTab continues to route through
 * the existing PlanTabInterior (or the pre-PLAN_TAB legacy questions cards
 * when both flags are off).
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GRAY_5,
  IOS_GREEN,
  LABEL_2,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';
import { IOS_SPACING } from '@/lib/design-tokens-ios';
import type { StepPlanData, SubStep } from '@/types/step-detail';
import { SubStepEditor } from '../SubStepEditor';
import { ConversationalCapture } from '../ConversationalCapture';
import { AIHelperLine } from './AIHelperLine';
import { FieldCard } from './FieldCard';
import { CapabilityChipSet, type CapabilityChip } from './CapabilityChipSet';
import { SuggestionsRow, type SuggestionRowItem } from './SuggestionsRow';
import { BottomCTA } from './BottomCTA';
import { deriveAIHelperState } from './aiHelperState';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { WorkingWithConcepts } from './WorkingWithConcepts';
import {
  BeforeTheShiftCard,
  type BeforeShiftItem,
} from '@/components/step/v2/plan/BeforeTheShiftCard';
import { LibraryBeforePicker } from '@/components/library/picker/LibraryBeforePicker';

export interface PlanTabIOSRegisterInteriorProps {
  planData: StepPlanData;
  onUpdate: (data: Partial<StepPlanData>) => void;
  readOnly?: boolean;
  interestId?: string;
  interestName?: string;
  stepTitle?: string;
  stepCategory?: string;
  onConversationalCreate?: (
    planData: Partial<StepPlanData>,
    suggestedTitle?: string,
  ) => void;
  /** Capability chips. Caller resolves competency_ids → labels. */
  capabilities?: CapabilityChip[];
  onRemoveCapability?: (id: string) => void;
  onAddCapabilityPress?: () => void;
  /** Source-of-tagging hint beneath chips (e.g. blueprint name). */
  capabilityAutoTagSource?: string;
  /** Suggestion rows. Empty → SuggestionsRow hides. */
  suggestions?: SuggestionRowItem[];
  onSeeAllSuggestions?: () => void;
  workingWithConcepts?: { id: string; title: string }[];
  onPressWorkingConcept?: (conceptId: string) => void;
  /** Optional extra plan-context rows (e.g. with whom / where) rendered in-body. */
  contextRows?: React.ReactNode;
  /** Card rendered right after the WHAT FieldCard — e.g. resources/concepts for this step. */
  belowWhatCard?: React.ReactNode;
  /** Per-step timing. Both must be set for the quiet toggle to render in More Options. */
  isTimed?: boolean;
  onToggleTimed?: (next: boolean) => void;
  /** Additional rows rendered inside More Options below the timed-row. */
  optionalAddOns?: React.ReactNode;
  /** Pressed on the bottom CTA when enabled. */
  onNextPhase?: () => void;
  /** Inert footer slot rendered below the CTA (e.g. comments). */
  footer?: React.ReactNode;
  /**
   * When true, the interior renders inside a plain `<View>` instead of its
   * own `<ScrollView>`. Set this when the caller already provides a parent
   * ScrollView (e.g. RaceSummaryCard's carousel card). Without this, the
   * inner ScrollView swallows scroll gestures and the parent's chrome /
   * title / tabs can never scroll off-screen.
   */
  embedded?: boolean;
  /**
   * When true, the What FieldCard focuses on mount — used by the post-create
   * landing flow so a freshly added step opens with the cursor in the
   * "What will you do?" field, ready to elaborate.
   */
  autoFocusWhat?: boolean;
  /**
   * D37 "Before the shift" library checklist. When items exist, renders
   * above the WHAT FieldCard. Pass items + onToggle from the
   * useLibraryBeforeBinding(stepId) hook.
   */
  libraryBefore?: {
    items: BeforeShiftItem[];
    totalEstimate?: string;
    onToggle?: (rowId: string) => void;
    onAddFromLibrary?: () => void;
    picker?: {
      visible: boolean;
      onClose: () => void;
      onSelect: (libraryItemId: string) => void;
      attachedItemIds: string[];
      interestId?: string;
    };
  };
  testID?: string;
}

const WHAT_PLACEHOLDER = 'Race 4, holding right-side discipline in shifty light air…';
const HOW_PLACEHOLDER = 'List 2–4 sub-steps…';
const WHY_PLACEHOLDER = 'What makes this the right next step?';

export function PlanTabIOSRegisterInterior({
  planData,
  onUpdate,
  readOnly,
  interestId,
  interestName,
  stepTitle,
  stepCategory,
  onConversationalCreate,
  capabilities = [],
  onRemoveCapability,
  onAddCapabilityPress,
  capabilityAutoTagSource,
  suggestions = [],
  onSeeAllSuggestions,
  workingWithConcepts = [],
  onPressWorkingConcept,
  contextRows,
  belowWhatCard,
  isTimed,
  onToggleTimed,
  optionalAddOns,
  onNextPhase,
  footer,
  embedded,
  autoFocusWhat,
  libraryBefore,
  testID,
}: PlanTabIOSRegisterInteriorProps) {
  const [coachOpen, setCoachOpen] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);

  const helperState = useMemo(() => deriveAIHelperState(planData), [planData]);

  const what = planData.what_will_you_do ?? '';
  const why = planData.why_reasoning ?? '';
  const subSteps = planData.how_sub_steps ?? [];
  const hasWhat = Boolean(what.trim());

  const showTimedToggle =
    FEATURE_FLAGS.PRACTICE_DO_TAB_PER_STEP_TIMING &&
    typeof isTimed === 'boolean' &&
    typeof onToggleTimed === 'function';

  const canUseCoach = Boolean(interestId && onConversationalCreate && !readOnly);

  const handleSubStepsChange = (next: SubStep[]) => {
    onUpdate({ how_sub_steps: next });
  };

  const optionalAddOnsContent = (
    <>
      {showTimedToggle ? (
        <View style={styles.timedRow}>
          <View style={styles.timedCopy}>
            <Text style={styles.timedEye}>Will this be timed?</Text>
            <Text style={styles.timedBody}>
              Do tab will show a running timer and Stop. Default off.
            </Text>
          </View>
          <Switch
            value={!!isTimed}
            onValueChange={onToggleTimed}
            disabled={readOnly}
            trackColor={{ true: IOS_GREEN, false: undefined as any }}
            accessibilityLabel="Track elapsed time on this step"
          />
        </View>
      ) : null}
      {optionalAddOns}
    </>
  );

  const hasMoreContent = Boolean(showTimedToggle || optionalAddOns);
  const ctaDisabled = !hasWhat || !onNextPhase;
  const ctaHint = ctaDisabled
    ? 'Add a what to enable'
    : 'Plan looks ready';

  const body = (
    <>
      {libraryBefore ? (
        <BeforeTheShiftCard
          items={libraryBefore.items}
          totalEstimate={libraryBefore.totalEstimate}
          onToggle={libraryBefore.onToggle}
          onAddFromLibrary={libraryBefore.onAddFromLibrary}
        />
      ) : null}

      {libraryBefore?.picker ? (
        <LibraryBeforePicker
          visible={libraryBefore.picker.visible}
          onClose={libraryBefore.picker.onClose}
          onSelect={libraryBefore.picker.onSelect}
          attachedItemIds={libraryBefore.picker.attachedItemIds}
          interestId={libraryBefore.picker.interestId}
        />
      ) : null}

      <FieldCard
        eyebrow="What will you do?"
        icon="bulb"
        placeholder={WHAT_PLACEHOLDER}
        value={what}
        onChangeText={(v) => onUpdate({ what_will_you_do: v })}
        readOnly={readOnly}
        autoFocus={autoFocusWhat}
        footer={
          <AIHelperLine
            state={helperState}
            onOpenCoach={canUseCoach ? () => setCoachOpen(true) : () => {}}
          />
        }
      />

      {belowWhatCard}

      <FieldCard
        eyebrow="How will you do it?"
        icon="list"
        placeholder={HOW_PLACEHOLDER}
        value=""
        readOnly={readOnly}
        renderBody={() => (
          <SubStepEditor
            subSteps={subSteps}
            onChange={readOnly ? () => {} : handleSubStepsChange}
            readOnly={readOnly}
          />
        )}
      />

      {/* v3 screen-designs Phase B.1 — Plan body ordering becomes
          WHAT → HOW → WITH WHOM · WHERE → WHY when the identity-deck
          flag is on. The WITH/WHERE rows come from contextRows so
          flag-off keeps them at their original position below WHY. */}
      {FEATURE_FLAGS.STEP_IDENTITY_DECK_V3 ? contextRows : null}

      <FieldCard
        eyebrow="Why is this next?"
        icon="help"
        placeholder={WHY_PLACEHOLDER}
        value={why}
        onChangeText={(v) => onUpdate({ why_reasoning: v })}
        readOnly={readOnly}
      />

      {FEATURE_FLAGS.STEP_IDENTITY_DECK_V3 ? null : contextRows}

      {(capabilities.length > 0 || onAddCapabilityPress) ? (
        <CapabilityChipSet
          selected={capabilities}
          onRemove={onRemoveCapability ?? (() => {})}
          onAddPress={onAddCapabilityPress ?? (() => {})}
          autoTagSource={capabilityAutoTagSource}
          readOnly={readOnly}
        />
      ) : null}

      <WorkingWithConcepts
        concepts={workingWithConcepts}
        onPressConcept={onPressWorkingConcept}
      />

      <SuggestionsRow items={suggestions} onSeeAll={onSeeAllSuggestions} />

      {hasMoreContent ? (
        <View style={styles.moreWrap}>
          <Pressable
            style={styles.moreHeader}
            onPress={() => setMoreExpanded((prev) => !prev)}
            accessibilityRole="button"
            accessibilityState={{ expanded: moreExpanded }}
            accessibilityLabel="More options"
          >
            <Text style={styles.moreTitle}>More options</Text>
            <Ionicons
              name={moreExpanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={LABEL_3}
            />
          </Pressable>
          {moreExpanded ? <View style={styles.moreBody}>{optionalAddOnsContent}</View> : null}
        </View>
      ) : null}

      {onNextPhase ? (
        <View style={styles.ctaWrap}>
          <BottomCTA
            label="Next: Do"
            hint={ctaHint}
            disabled={ctaDisabled}
            onPress={() => onNextPhase?.()}
          />
        </View>
      ) : null}

      {footer}

      {canUseCoach ? (
        <Modal
          visible={coachOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setCoachOpen(false)}
        >
          <View style={styles.coachModal}>
            <View style={styles.coachHeader}>
              <Pressable onPress={() => setCoachOpen(false)} hitSlop={10}>
                <Text style={styles.coachCancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.coachTitle}>AI Coach</Text>
              <View style={styles.coachSpacer} />
            </View>
            {coachOpen ? (
              <ConversationalCapture
                interestId={interestId!}
                interestName={interestName?.trim() || 'this interest'}
                stepTitle={stepTitle || what || 'New step'}
                onCreateStep={(data, suggestedTitle) => {
                  onConversationalCreate?.(data, suggestedTitle);
                  setCoachOpen(false);
                }}
                embedded
                stepCategory={stepCategory}
                autoFocus
              />
            ) : null}
          </View>
        </Modal>
      ) : null}
    </>
  );

  if (embedded) {
    // Caller provides the scroll container — render as a plain View so the
    // parent's ScrollView owns vertical scroll (chrome + tabs scroll with
    // the body instead of staying pinned).
    return (
      <View style={styles.embeddedBody} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      testID={testID}
    >
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
    gap: 10,
  },
  embeddedBody: {
    padding: 16,
    paddingBottom: 24,
    gap: 10,
  },
  timedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  timedCopy: {
    flex: 1,
    gap: 2,
  },
  timedEye: {
    fontSize: 9.5,
    fontWeight: '700',
    color: LABEL_2,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  timedBody: {
    fontSize: 11.5,
    color: LABEL_3,
    lineHeight: 15,
    letterSpacing: -0.05,
  },
  moreWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GRAY_5,
    marginTop: 2,
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 2,
  },
  moreTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: LABEL_2,
    letterSpacing: -0.1,
  },
  moreBody: {
    paddingTop: 8,
    gap: IOS_SPACING.sm,
  },
  ctaWrap: {
    marginTop: 14,
  },
  coachModal: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  coachHeader: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GRAY_5,
  },
  coachCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  coachTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  coachSpacer: {
    width: 52,
  },
});
