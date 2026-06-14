import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StatePill } from '@/components/step-loop';
import {
  GRAY_5,
  GRAY_6,
  IOS_PURPLE,
  LABEL_3,
} from '@/lib/design-tokens-step-loop-ios';
import { SynthesisPrompt } from './SynthesisPrompt';
import { ReflectField } from './ReflectField';
import { CapabilitiesPracticed } from './CapabilitiesPracticed';
import { CompetencyPickerModal } from '@/components/competency/CompetencyPickerModal';
import { MicPrompt } from './MicPrompt';
import { SaveAndSettleCTA } from './SaveAndSettleCTA';
import { useStepReflectController } from './useStepReflectController';
import { StepCompleteCelebration } from '@/components/step/StepCompleteCelebration';
import { useStepDetail } from '@/hooks/useStepDetail';
import { useStepBlueprintChrome } from '@/hooks/useStepBlueprintChrome';
import { useStepCompleteCelebration } from '@/hooks/useStepCompleteCelebration';
import { useContinueToNextBlueprintStep } from '@/hooks/useContinueToNextBlueprintStep';
import { useInterest } from '@/providers/InterestProvider';
import { getVisibilityLabels } from '@/lib/vocabulary';
import { encodeHingeId } from '@/services/HingeBuildService';

export interface ReflectTabIOSRegisterShellProps {
  stepId: string;
  readOnly?: boolean;
  onGoToDo?: () => void;
  onNextStepCreated?: (newStepId: string) => void;
  footer?: React.ReactNode;
  /** When true, render without flex:1 ScrollView — parent owns scroll. */
  embedded?: boolean;
}

export function ReflectTabIOSRegisterShell({
  stepId,
  readOnly,
  onGoToDo,
  onNextStepCreated,
  footer,
  embedded,
}: ReflectTabIOSRegisterShellProps) {
  // The step-complete celebration is a transient *moment* fired by the act of
  // settling, not a persistent view of a done step. We raise it from the
  // controller's onSettled callback and clear it on dismiss / hinge tap.
  const [celebrating, setCelebrating] = React.useState(false);
  const [hingeNextStepId, setHingeNextStepId] = React.useState<string | null>(null);
  // Settling re-sorts the timeline and the parent can re-select a neighbouring
  // step, so the live `stepId` prop drifts off the step we just completed. Pin
  // the celebration to the snapshot the controller hands back at settle time.
  const [celebratedStepId, setCelebratedStepId] = React.useState<string | null>(null);

  const controller = useStepReflectController({
    stepId,
    readOnly,
    onGoToDo,
    onNextStepCreated,
    onSettled: ({ completedStepId, nextStepId }) => {
      setCelebratedStepId(completedStepId);
      setHingeNextStepId(nextStepId);
      setCelebrating(true);
    },
  });

  // Celebration data — all RQ-cached, so these reuse the same queries the rest
  // of the step screen already warmed. blueprintChrome is null for solo steps,
  // which selects the lighter 'solo' celebration variant. Keyed on the pinned
  // completed step so the moment never drifts to a neighbour after the re-sort.
  const dataStepId = celebratedStepId ?? stepId;
  const { data: step } = useStepDetail(dataStepId);
  const { data: blueprintChrome } = useStepBlueprintChrome(dataStepId);
  const stepSourceId =
    (step as { source_id?: string | null } | null)?.source_id ?? null;
  const { data: celebrationData, isLoading: celebrationLoading } =
    useStepCompleteCelebration({
      stepId: dataStepId,
      blueprintId: blueprintChrome?.blueprintId ?? null,
      sourceStepId: stepSourceId,
    });
  const continueNext = useContinueToNextBlueprintStep({
    blueprintId: blueprintChrome?.blueprintId ?? null,
    interestId: step?.interest_id ?? null,
    nextSourceStepId: celebrationData?.next?.sourceStepId ?? null,
    alreadyAdoptedStepId: celebrationData?.next?.alreadyAdoptedStepId ?? null,
  });
  const { currentInterest } = useInterest();

  const view = controller.reflectViewProps;
  const settled = view.state === 'settled';
  const scaffoldedReview = Boolean(view.config.headerLabel);
  const seedSummary =
    view.capturesCount > 0
      ? `✨ seeded from ${view.capturesCount} capture${view.capturesCount === 1 ? '' : 's'}`
      : null;

  if (controller.loading || controller.missing) {
    return <View style={styles.container} />;
  }

  if (celebrating) {
    const celebration = (
      <StepCompleteCelebration
        variant={blueprintChrome ? 'blueprint' : 'solo'}
        stepNumber={blueprintChrome?.stepNumber ?? null}
        totalSteps={blueprintChrome?.totalSteps ?? null}
        stepTitle={step?.title ?? 'This step'}
        sessionCount={celebrationData?.sessionCount ?? 0}
        fleet={celebrationData?.fleet ?? { ahead: 0, sameStep: 0, behind: 0 }}
        next={
          celebrationData?.next
            ? {
                stepNumber: celebrationData.next.stepNumber,
                title: celebrationData.next.title,
              }
            : null
        }
        isLoadingNext={celebrationLoading || !stepSourceId}
        onContinue={continueNext.handleContinue}
        isContinuing={continueNext.isContinuing}
        groupLabel={getVisibilityLabels(currentInterest?.slug).fleet.toLowerCase()}
        onTakeABeat={
          hingeNextStepId
            ? () => {
                setCelebrating(false);
                router.push(
                  `/practice/hinges/${encodeHingeId(dataStepId, hingeNextStepId)}` as never,
                );
              }
            : undefined
        }
        onDismiss={() => {
          setCelebrating(false);
          setCelebratedStepId(null);
        }}
      />
    );
    if (embedded) {
      return <View style={styles.contentEmbedded}>{celebration}</View>;
    }
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {celebration}
      </ScrollView>
    );
  }

  const body = (
    <>
      {!scaffoldedReview ? (
        <StatePill
          variant={settled ? 'settled' : 'reflect'}
          label={settled ? view.config.settledPillLabel : view.config.statePillLabel}
        />
      ) : null}

      {!scaffoldedReview ? (
        <SynthesisPrompt
          capturesCount={view.capturesCount}
          copy={view.config.synthesisDraftCopy(view.capturesCount)}
          state={view.synthesisState}
          onDraft={view.onDraftSynthesis}
          onDismiss={view.onDismissSynthesis}
        />
      ) : null}

      {view.config.headerLabel ? (
        <View style={styles.reviewHeaderRow}>
          <Text style={styles.reviewHeader}>{view.config.headerLabel}</Text>
          {seedSummary ? <Text style={styles.seedSummary}>{seedSummary}</Text> : null}
        </View>
      ) : null}

      <View style={styles.fieldStack}>
        {view.fields.map((field, index) => (
          <ReflectField
            key={field.id}
            id={field.id}
            qEye={field.prompt}
            index={scaffoldedReview ? index + 1 : undefined}
            value={field.value}
            seedSuggestion={field.seedSuggestion}
            seedLabel={scaffoldedReview ? '✨' : undefined}
            isLast={index === view.fields.length - 1}
            isDrafted={field.isDrafted}
            readOnly={view.readOnly}
            onFocus={() => view.onFocusField(field.id)}
            onChangeText={(value) => view.onChangeField(field.id, value)}
            onUseSeed={
              field.seedSuggestion
                ? () => view.onChangeField(field.id, field.seedSuggestion ?? '')
                : undefined
            }
            onMarkAsConceptSeed={() => view.onMarkFieldAsConceptSeed(field.id)}
          />
        ))}
      </View>

      <CapabilitiesPracticed
        rows={view.capabilities}
        capturesCount={view.capturesCount}
        suggestState={view.capabilitySuggestState}
        onSuggest={view.onSuggestCapabilities}
        onToggleConfirm={view.onToggleCapability}
        onChangeStrength={view.onChangeCapabilityStrength}
        onAddCapability={view.onAddCapability}
      />

      {view.capabilityPickerInterestId ? (
        <CompetencyPickerModal
          visible={view.capabilityPickerVisible}
          onClose={view.onCloseCapabilityPicker}
          selectedIds={view.capabilities.map((row) => row.capabilityId)}
          interestId={view.capabilityPickerInterestId}
          selectedSuggestedLabels={view.capabilities.map((row) => row.capabilityName)}
          onToggle={view.onPickCompetency}
          onToggleSuggested={view.onPickCapabilityLabel}
        />
      ) : null}

      {view.conceptPrompts.length > 0 ? (
        <View style={styles.conceptPromptWrap}>
          {view.conceptPrompts.map((prompt) => (
            <View key={prompt.conceptId} style={styles.conceptPromptCard}>
              <View style={styles.conceptPromptHead}>
                <View style={styles.conceptPromptDot} />
                <Text style={styles.conceptPromptEye}>Concept check</Text>
              </View>
              <Text style={styles.conceptPromptText}>
                Did this step deepen your understanding of “{prompt.title}”?
              </Text>
              <View style={styles.conceptPromptActions}>
                <Pressable
                  style={[
                    styles.conceptPromptButton,
                    prompt.answer === true && styles.conceptPromptButtonOn,
                  ]}
                  onPress={() => view.onAnswerConceptPrompt(prompt.conceptId, true)}
                >
                  <Text
                    style={[
                      styles.conceptPromptButtonText,
                      prompt.answer === true && styles.conceptPromptButtonTextOn,
                    ]}
                  >
                    Yes
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.conceptPromptButton,
                    prompt.answer === false && styles.conceptPromptButtonOff,
                  ]}
                  onPress={() => view.onAnswerConceptPrompt(prompt.conceptId, false)}
                >
                  <Text style={styles.conceptPromptButtonText}>No</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!settled ? (
        <MicPrompt
          activeFieldId={view.activeFieldId}
          onTranscript={view.onTranscript}
          onSpawnAnythingElseField={view.onSpawnAnythingElseField}
        />
      ) : null}

      {settled ? (
        <View style={styles.settledFooter}>
          <Text style={styles.settledFooterLabel}>Marked done</Text>
        </View>
      ) : (
        <SaveAndSettleCTA
          enabled={view.saveEnabled}
          label={view.config.saveCtaLabel}
          disabledHint={view.disabledHint}
          onSettle={view.onSettle}
        />
      )}

      {footer}
    </>
  );

  if (embedded) {
    return <View style={styles.contentEmbedded}>{body}</View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GRAY_6,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 96,
    gap: 12,
  },
  contentEmbedded: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 190,
    gap: 12,
  },
  settledFooter: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF8F1',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#BFE8CB',
  },
  settledFooterLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#248A3D',
  },
  fieldStack: {
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: GRAY_5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 2,
  },
  reviewHeader: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: LABEL_3,
    lineHeight: 14,
  },
  seedSummary: {
    maxWidth: 150,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    color: IOS_PURPLE,
    textAlign: 'right',
    letterSpacing: 0,
  },
  conceptPromptWrap: {
    gap: 10,
  },
  conceptPromptCard: {
    backgroundColor: '#FFFFFF',
    borderColor: GRAY_6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  conceptPromptHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conceptPromptDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C4DFF',
  },
  conceptPromptEye: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: '#7C4DFF',
  },
  conceptPromptText: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 22,
  },
  conceptPromptActions: {
    flexDirection: 'row',
    gap: 8,
  },
  conceptPromptButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  conceptPromptButtonOn: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  conceptPromptButtonOff: {
    backgroundColor: '#FFFFFF',
  },
  conceptPromptButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  conceptPromptButtonTextOn: {
    color: '#FFFFFF',
  },
});
