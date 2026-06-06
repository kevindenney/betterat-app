import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { MicPrompt } from './MicPrompt';
import { SaveAndSettleCTA } from './SaveAndSettleCTA';
import { useStepReflectController } from './useStepReflectController';

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
  const controller = useStepReflectController({
    stepId,
    readOnly,
    onGoToDo,
    onNextStepCreated,
  });

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
