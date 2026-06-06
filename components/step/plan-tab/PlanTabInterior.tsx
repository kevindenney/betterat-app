import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import type { RacePlan, StepPlanData, SubStep } from '@/types/step-detail';
import { SubStepEditor } from '../SubStepEditor';
import { ConversationalCapture } from '../ConversationalCapture';
import { getPlanInteriorState, isPlanReady } from './planState';
import { PlanCoachCard } from './PlanCoachCard';
import { PlanFieldCard } from './PlanFieldCard';
import { PlanOptionalAddOns } from './PlanOptionalAddOns';
import { PlanTimedToggleRow } from './PlanTimedToggleRow';
import { PlanStepRaceSelector } from './PlanStepRaceSelector';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import {
  BeforeTheShiftCard,
  type BeforeShiftItem,
} from '@/components/step/v2/plan/BeforeTheShiftCard';
import { LibraryBeforePicker } from '@/components/library/picker/LibraryBeforePicker';
import { StepPlanScrollMemory } from '@/services/StepPlanScrollMemory';

interface PlanTabInteriorProps {
  /**
   * Step id — used to key scroll-position memory so an Atlas round-trip
   * from "Pick on map" can restore the previous scroll on remount. Optional
   * because new-step composers don't have a stepId yet.
   */
  stepId?: string;
  planData: StepPlanData;
  onUpdate: (data: Partial<StepPlanData>) => void;
  readOnly?: boolean;
  doStarted?: boolean;
  interestId?: string;
  interestName?: string;
  stepTitle?: string;
  stepCategory?: string;
  onConversationalCreate?: (planData: Partial<StepPlanData>, suggestedTitle?: string) => void;
  optionalAddOns?: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Per-step timing toggle wiring. Both must be provided for the toggle row
   * to render. Visibility is also gated on FEATURE_FLAGS.PRACTICE_DO_TAB_PER_STEP_TIMING
   * so flag-off builds never show the toggle.
   */
  isTimed?: boolean;
  onToggleTimed?: (next: boolean) => void;
  /**
   * Phase N.4 Step/Race selector. When provided, renders the Step ⟷ Race
   * choice at the top of the composer (sailing only). `onToggleRace` persists
   * to timeline_steps.is_race; `onOpenRaceCourse` opens the course authoring
   * flow when Race is selected.
   */
  isRace?: boolean;
  onToggleRace?: (next: boolean) => void;
  onOpenRaceCourse?: () => void;
  onOpenRaceCourseAtlas?: () => void;
  /** One-line summary of the saved race plan, shown on the reveal row. */
  courseSummary?: string;
  /** Saved race plan; drives the schematic course map once an area is set. */
  racePlan?: Pick<RacePlan, 'area_id' | 'area_name' | 'course_label' | 'laps'>;
  /**
   * D37 "Before the shift" library checklist. When items exist, renders
   * a card above the manual fields. Pass items + onToggle from the
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
}

export function PlanTabInterior({
  stepId,
  planData,
  onUpdate,
  readOnly,
  doStarted,
  interestId,
  interestName,
  stepTitle,
  stepCategory,
  onConversationalCreate,
  optionalAddOns,
  footer,
  isTimed,
  onToggleTimed,
  isRace,
  onToggleRace,
  onOpenRaceCourse,
  onOpenRaceCourseAtlas,
  courseSummary,
  racePlan,
  libraryBefore,
}: PlanTabInteriorProps) {
  const showRaceSelector = typeof isRace === 'boolean' && Boolean(onToggleRace);
  const showTimedToggle =
    FEATURE_FLAGS.PRACTICE_DO_TAB_PER_STEP_TIMING &&
    typeof isTimed === 'boolean' &&
    Boolean(onToggleTimed);
  const state = getPlanInteriorState({ planData, readOnly, doStarted });
  const [manualExpanded, setManualExpanded] = useState(state !== 'empty');
  const [coachOpen, setCoachOpen] = useState(false);
  const effectiveInterestName = interestName?.trim() || 'this interest';
  const canUseCoach = Boolean(interestId && onConversationalCreate && !readOnly);
  const coachDisabledReason = !interestId
    ? 'AI Coach needs a step interest before it can draft a plan.'
    : !onConversationalCreate
      ? 'AI Coach is unavailable for this step.'
      : readOnly
        ? 'AI Coach is unavailable in read-only mode.'
        : undefined;

  const hasWhat = Boolean(planData.what_will_you_do?.trim());
  const hasHow = Boolean(planData.how_sub_steps?.some((step) => step.text.trim()));
  const hasWhy = Boolean(planData.why_reasoning?.trim());
  const ready = useMemo(() => isPlanReady(planData), [planData]);

  const handleSubStepsChange = (subSteps: SubStep[]) => {
    onUpdate({ how_sub_steps: subSteps });
  };

  // Scroll-position memory: PlanWhereCard's "Pick on map" pushes to Atlas
  // which unmounts this screen. Without this, router.back() lands the
  // user at y=0 and they have to re-find the WHERE section to confirm
  // the location saved. onScroll continuously updates the memory; the
  // mount effect restores any saved y for this stepId.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (!stepId) return;
    const y = StepPlanScrollMemory.take(stepId);
    if (y == null || y <= 0) return;
    // Defer to next frame so the ScrollView's children have laid out.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  }, [stepId]);
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!stepId) return;
    StepPlanScrollMemory.remember(stepId, e.nativeEvent.contentOffset.y);
  };

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={handleScroll}
      scrollEventThrottle={120}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {showRaceSelector && (
        <View style={styles.raceSelectorSlot}>
          <PlanStepRaceSelector
            isRace={isRace!}
            onChange={onToggleRace!}
            readOnly={readOnly}
            onOpenRaceCourse={onOpenRaceCourse}
            onOpenRaceCourseAtlas={onOpenRaceCourseAtlas}
            courseSummary={courseSummary}
            racePlan={racePlan}
          />
        </View>
      )}

      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Plan</Text>
          <Text style={styles.title}>{state === 'empty' ? 'Start with a clear plan.' : 'Shape the plan before you do it.'}</Text>
        </View>
        {ready && (
          <View style={styles.readyPill} accessibilityLabel="Plan ready">
            <Ionicons name="checkmark-circle" size={15} color={STEP_COLORS.accent} />
            <Text style={styles.readyText}>Plan ready</Text>
          </View>
        )}
      </View>

      <PlanCoachCard
        state={state}
        onPress={canUseCoach ? () => setCoachOpen(true) : undefined}
        disabledReason={coachDisabledReason}
      />

      {state === 'empty' && !manualExpanded && (
        <Pressable style={styles.manualToggle} onPress={() => setManualExpanded(true)}>
          <View style={styles.manualLine} />
          <Text style={styles.manualToggleText}>or fill in manually</Text>
          <View style={styles.manualLine} />
        </Pressable>
      )}

      {libraryBefore ? (
        <View style={styles.libraryBeforeSlot}>
          <BeforeTheShiftCard
            items={libraryBefore.items}
            totalEstimate={libraryBefore.totalEstimate}
            onToggle={libraryBefore.onToggle}
            onAddFromLibrary={libraryBefore.onAddFromLibrary}
          />
        </View>
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

      {(manualExpanded || state !== 'empty') && (
        <View style={styles.fields}>
          <PlanFieldCard label="WHAT WILL YOU DO?" complete={hasWhat}>
            <TextInput
              style={[styles.textArea, readOnly && styles.readOnlyInput]}
              value={planData.what_will_you_do ?? ''}
              onChangeText={readOnly ? undefined : (text) => onUpdate({ what_will_you_do: text })}
              placeholder={readOnly ? '' : 'Name the work in one or two sentences...'}
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              multiline
              textAlignVertical="top"
              editable={!readOnly}
            />
          </PlanFieldCard>

          <PlanFieldCard label="HOW WILL YOU DO IT?" complete={hasHow}>
            <SubStepEditor
              subSteps={planData.how_sub_steps ?? []}
              onChange={readOnly ? () => {} : handleSubStepsChange}
              readOnly={readOnly}
            />
          </PlanFieldCard>

          <PlanFieldCard label="WHY IS THIS NEXT?" complete={hasWhy}>
            <TextInput
              style={[styles.textArea, readOnly && styles.readOnlyInput]}
              value={planData.why_reasoning ?? ''}
              onChangeText={readOnly ? undefined : (text) => onUpdate({ why_reasoning: text })}
              placeholder={readOnly ? '' : 'Connect this to the next capability, race, shift, or edge...'}
              placeholderTextColor={IOS_COLORS.tertiaryLabel}
              multiline
              textAlignVertical="top"
              editable={!readOnly}
            />
          </PlanFieldCard>
        </View>
      )}

      {showTimedToggle && (
        <PlanTimedToggleRow
          isTimed={isTimed!}
          onToggle={onToggleTimed!}
          disabled={readOnly}
        />
      )}

      <PlanOptionalAddOns>{optionalAddOns}</PlanOptionalAddOns>
      {footer}

      {canUseCoach && (
        <Modal visible={coachOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCoachOpen(false)}>
          <View style={styles.coachModal}>
            <View style={styles.coachHeader}>
              <Pressable onPress={() => setCoachOpen(false)} hitSlop={10}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.coachTitle}>AI Coach</Text>
              <View style={styles.headerSpacer} />
            </View>
            {/* Gate-render the child so closing the modal unmounts the
                conversation — its useEffect cleanup flips a cancelled ref
                that prevents in-flight edge responses from writing to a
                closed surface. */}
            {coachOpen && (
              <ConversationalCapture
                interestId={interestId!}
                interestName={effectiveInterestName}
                stepTitle={stepTitle || planData.what_will_you_do || 'New step'}
                onCreateStep={(data, suggestedTitle) => {
                  onConversationalCreate!(data, suggestedTitle);
                  setManualExpanded(true);
                  setCoachOpen(false);
                }}
                embedded
                stepCategory={stepCategory}
                autoFocus
              />
            )}
          </View>
        </Modal>
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: IOS_SPACING.sm,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: STEP_COLORS.label,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(52,199,89,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  readyText: {
    fontSize: 12,
    fontWeight: '700',
    color: STEP_COLORS.accent,
  },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  manualLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.systemGray4,
  },
  manualToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  fields: {
    gap: IOS_SPACING.sm,
  },
  libraryBeforeSlot: {
    marginBottom: IOS_SPACING.sm,
  },
  raceSelectorSlot: {
    marginBottom: IOS_SPACING.xs,
  },
  textArea: {
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemGray5,
    padding: IOS_SPACING.sm,
    minHeight: 86,
  },
  readOnlyInput: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    paddingHorizontal: 0,
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
    paddingHorizontal: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.systemGray5,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  coachTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  headerSpacer: {
    width: 52,
  },
});
