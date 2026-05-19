import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatePill } from '@/components/step-loop';
import { GRAY_6 } from '@/lib/design-tokens-step-loop-ios';
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

  if (controller.loading || controller.missing) {
    return <View style={styles.container} />;
  }

  const view = controller.reflectViewProps;
  const settled = view.state === 'settled';

  const body = (
    <>
      <StatePill
        variant={settled ? 'settled' : 'reflect'}
        label={settled ? view.config.settledPillLabel : view.config.statePillLabel}
      />

      <SynthesisPrompt
        capturesCount={view.capturesCount}
        copy={view.config.synthesisDraftCopy(view.capturesCount)}
        state={view.synthesisState}
        onDraft={view.onDraftSynthesis}
        onDismiss={view.onDismissSynthesis}
      />

      <View style={styles.fieldStack}>
        {view.fields.map((field) => (
          <ReflectField
            key={field.id}
            id={field.id}
            qEye={field.prompt}
            value={field.value}
            isDrafted={field.isDrafted}
            readOnly={view.readOnly}
            onFocus={() => view.onFocusField(field.id)}
            onChangeText={(value) => view.onChangeField(field.id, value)}
            onMarkAsConceptSeed={() => view.onMarkFieldAsConceptSeed(field.id)}
          />
        ))}
      </View>

      <CapabilitiesPracticed
        rows={view.capabilities}
        capturesCount={view.capturesCount}
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
        <>
          <MicPrompt
            activeFieldId={view.activeFieldId}
            onTranscript={view.onTranscript}
            onSpawnAnythingElseField={view.onSpawnAnythingElseField}
          />
          <SaveAndSettleCTA
            enabled={view.saveEnabled}
            label={view.config.saveCtaLabel}
            disabledHint={view.disabledHint}
            onSettle={view.onSettle}
          />
        </>
      ) : null}

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
    gap: 12,
  },
  fieldStack: {
    gap: 10,
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
