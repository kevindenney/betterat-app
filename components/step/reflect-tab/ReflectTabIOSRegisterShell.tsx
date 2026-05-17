import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
}

export function ReflectTabIOSRegisterShell({
  stepId,
  readOnly,
  onGoToDo,
  onNextStepCreated,
  footer,
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
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
  fieldStack: {
    gap: 10,
  },
});
