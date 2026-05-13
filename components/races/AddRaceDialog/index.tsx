/**
 * AddRaceDialog Component
 *
 * Multi-step wizard for adding races with support for all 4 race types.
 * Step 1: Choose race type (Fleet, Distance, Match, Team)
 * Step 2: Choose input method (AI extraction or Manual)
 * Step 3a: AI extraction flow (AIQuickEntry → Progress → Results)
 * Step 3b: Manual entry form
 *
 * NOTE: When USE_TUFTE_ADD_RACE_FORM feature flag is enabled,
 * this renders TufteAddRaceForm instead (single-page form).
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,

  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, X } from 'lucide-react-native';
import { RaceType, RACE_TYPE_COLORS } from '../RaceTypeSelector';
import { IOS_COLORS } from '@/components/cards/constants';
import { RaceTypeStep } from './RaceTypeStep';
import { InputMethodStep, InputMethod } from './InputMethodStep';
import { AIExtractionStep } from './AIExtractionStep';
import { RaceDetailsStep, RaceFormData } from './RaceDetailsStep';
import { TufteAddRaceForm } from './TufteAddRaceForm';
import { IOSAddRaceForm } from './IOSAddRaceForm';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import type { ExtractedRaceData } from '../ExtractionResults';
import { createLogger } from '@/lib/utils/logger';

interface AddRaceDialogProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: RaceFormData) => Promise<void>;
}

type Step = 'type' | 'input-method' | 'ai-extraction' | 'details';
const logger = createLogger('AddRaceDialog');

export function AddRaceDialog({ visible, onClose, onSave }: AddRaceDialogProps) {
  // Use iOS HIG-style form when feature flag is enabled (native only)
  if (FEATURE_FLAGS.USE_IOS_ADD_RACE_FORM && Platform.OS !== 'web') {
    return <IOSAddRaceForm visible={visible} onClose={onClose} onSave={onSave} />;
  }

  // Use Tufte-style single-page form when feature flag is enabled
  if (FEATURE_FLAGS.USE_TUFTE_ADD_RACE_FORM) {
    return <TufteAddRaceForm visible={visible} onClose={onClose} onSave={onSave} />;
  }

  // Legacy multi-step wizard (below)
  return <LegacyAddRaceDialog visible={visible} onClose={onClose} onSave={onSave} />;
}

/**
 * Legacy Multi-Step Add Race Dialog
 * Kept for fallback when feature flag is disabled
 */
function LegacyAddRaceDialog({ visible, onClose, onSave }: AddRaceDialogProps) {
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<RaceType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedRaceData | null>(null);

  const handleClose = useCallback(() => {
    setStep('type');
    setSelectedType(null);
    setExtractedData(null);
    onClose();
  }, [onClose]);

  const handleTypeSelect = useCallback((type: RaceType) => {
    setSelectedType(type);
  }, []);

  const handleNext = useCallback(() => {
    if (selectedType) {
      setStep('input-method');
    }
  }, [selectedType]);

  const handleInputMethodSelect = useCallback((method: InputMethod) => {
    if (method === 'ai') {
      setStep('ai-extraction');
    } else {
      setStep('details');
    }
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'input-method') {
      setStep('type');
    } else if (step === 'ai-extraction' || step === 'details') {
      setStep('input-method');
      setExtractedData(null);
    }
  }, [step]);

  const handleAIExtracted = useCallback((data: ExtractedRaceData) => {
    setExtractedData(data);
    setStep('details');
  }, []);

  const handleManualEntry = useCallback(() => {
    setExtractedData(null);
    setStep('details');
  }, []);

  const handleSave = useCallback(async (data: RaceFormData) => {
    setIsSaving(true);
    try {
      await onSave(data);
      handleClose();
    } catch (error) {
      logger.error('Failed to save race', error);
      const message =
        (error as any)?.message && typeof (error as any).message === 'string'
          ? (error as any).message
          : 'Unable to save race right now. Please try again.';
      showAlert('Save failed', message);
    } finally {
      setIsSaving(false);
    }
  }, [onSave, handleClose]);

  const getStepTitle = () => {
    if (step === 'type') return 'Add Race';
    if (step === 'input-method') return 'Add Race';
    if (step === 'ai-extraction') return 'Extract';
    if (selectedType) {
      const titles: Record<RaceType, string> = {
        fleet: 'Fleet Racing',
        distance: 'Distance Racing',
        match: 'Match Racing',
        team: 'Team Racing',
      };
      return titles[selectedType];
    }
    return 'Race Details';
  };

  const getStepNumber = () => {
    switch (step) {
      case 'type': return 1;
      case 'input-method': return 2;
      case 'ai-extraction': return 2;
      case 'details': return 3;
      default: return 1;
    }
  };

  // Use iOS blue for progress indicator, race type colors for badges
  const accentColor = IOS_COLORS.blue;
  const typeColor = selectedType ? RACE_TYPE_COLORS[selectedType].primary : IOS_COLORS.blue;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header - hide during AI extraction (has its own header) */}
          {step !== 'ai-extraction' && (
            <View style={styles.header}>
              {step !== 'type' ? (
                <Pressable style={styles.backButton} onPress={handleBack}>
                  <ChevronLeft size={24} color={IOS_COLORS.blue} />
                </Pressable>
              ) : (
                <View style={styles.backButton} />
              )}

              <View style={styles.titleContainer}>
                <Text style={styles.title}>{getStepTitle()}</Text>
                {(step === 'details' || step === 'input-method') && selectedType && (
                  <View style={[styles.typeBadge, { backgroundColor: RACE_TYPE_COLORS[selectedType].badge }]}>
                    <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
                  </View>
                )}
              </View>

              <Pressable style={styles.closeButton} onPress={handleClose}>
                <X size={24} color={IOS_COLORS.gray} />
              </Pressable>
            </View>
          )}

          {/* Step indicator - hide during AI extraction */}
          {step !== 'ai-extraction' && (
            <View style={styles.stepIndicator}>
              {/* Step 1: Race Type */}
              <View style={[
                styles.stepDot,
                getStepNumber() >= 1 && styles.stepDotActive,
                { backgroundColor: getStepNumber() >= 1 ? accentColor : IOS_COLORS.gray5 }
              ]} />
              <View style={[styles.stepLine, { backgroundColor: getStepNumber() >= 2 ? accentColor : IOS_COLORS.gray5 }]} />

              {/* Step 2: Input Method */}
              <View style={[
                styles.stepDot,
                getStepNumber() >= 2 && styles.stepDotActive,
                { backgroundColor: getStepNumber() >= 2 ? accentColor : IOS_COLORS.gray5 }
              ]} />
              <View style={[styles.stepLine, { backgroundColor: getStepNumber() >= 3 ? accentColor : IOS_COLORS.gray5 }]} />

              {/* Step 3: Details */}
              <View style={[
                styles.stepDot,
                getStepNumber() >= 3 && styles.stepDotActive,
                { backgroundColor: getStepNumber() >= 3 ? accentColor : IOS_COLORS.gray5 }
              ]} />
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {step === 'type' && (
              <RaceTypeStep
                selectedType={selectedType}
                onSelect={handleTypeSelect}
                onNext={handleNext}
              />
            )}

            {step === 'input-method' && selectedType && (
              <InputMethodStep
                raceType={selectedType}
                onSelectMethod={handleInputMethodSelect}
              />
            )}

            {step === 'ai-extraction' && selectedType && (
              <AIExtractionStep
                raceType={selectedType}
                onExtracted={handleAIExtracted}
                onManualEntry={handleManualEntry}
                onCancel={handleBack}
              />
            )}

            {step === 'details' && selectedType && (
              <RaceDetailsStep
                raceType={selectedType}
                onSave={handleSave}
                onCancel={handleClose}
                isSaving={isSaving}
                initialData={extractedData}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  typeBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingBottom: 4,
    gap: 4,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepLine: {
    width: 32,
    height: 2,
    borderRadius: 1,
  },
  content: {
    flex: 1,
  },
});

export default AddRaceDialog;
