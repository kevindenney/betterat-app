/**
 * InspirationWizard — multi-step flow for "Inspiration → Interest → Blueprint".
 *
 * Steps:
 *   1. Capture — user pastes URL, text, or describes what inspires them
 *   2. Review Interest — review/edit the AI-proposed interest
 *   3. Review Blueprint — review/edit the generated learning plan
 *   4. Success — confirmation with navigation to the new interest
 */

import React, { useState, useCallback, useRef } from 'react';
import { Modal, View, StyleSheet, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { activateInspiration } from '@/services/InspirationService';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import type {
  InspirationExtraction,
  InspirationBlueprintStep,
  ProposedInterest,
  InspirationContentType,
} from '@/types/inspiration';
import { InspirationCaptureStep } from './InspirationCaptureStep';
import { InspirationInterestStep } from './InspirationInterestStep';
import { InspirationBlueprintStep as BlueprintStepReview } from './InspirationBlueprintStep';
import { InspirationSuccessStep } from './InspirationSuccessStep';

type WizardStep = 'capture' | 'review-interest' | 'review-blueprint' | 'success';

interface InspirationWizardProps {
  visible: boolean;
  onClose: () => void;
}

export function InspirationWizard({ visible, onClose }: InspirationWizardProps) {
  const { user } = useAuth();
  const { userInterests, proposeInterest } = useInterest();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<WizardStep>('capture');
  const [extraction, setExtraction] = useState<InspirationExtraction | null>(null);
  const [interestEdits, setInterestEdits] = useState<Partial<ProposedInterest>>({});
  const [sourceContent, setSourceContent] = useState('');
  const [sourceContentType, setSourceContentType] = useState<InspirationContentType>('url');
  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState<{
    interestSlug: string;
    blueprintSlug: string;
  } | null>(null);

  // Parent-child abort contract: when the capture step has an active
  // extraction in flight, it registers an abort handler here. The wizard
  // calls it before resetting state so a modal close / Cancel / Android
  // back / swipe-down dismiss cancels the network request instead of
  // letting it complete and silently advance to review-interest.
  const captureAbortHandlerRef = useRef<(() => void) | null>(null);
  const registerCaptureAbortHandler = useCallback(
    (handler: (() => void) | null) => {
      captureAbortHandlerRef.current = handler;
    },
    [],
  );

  // Reset state when closing
  const handleClose = useCallback(() => {
    captureAbortHandlerRef.current?.();
    setStep('capture');
    setExtraction(null);
    setInterestEdits({});
    setSourceContent('');
    setSourceContentType('url');
    setActivating(false);
    setResult(null);
    onClose();
  }, [onClose]);

  // Step 1 → Step 2: AI extraction complete
  const handleExtractionComplete = useCallback(
    (ext: InspirationExtraction, content: string, contentType: InspirationContentType) => {
      setExtraction(ext);
      setSourceContent(content);
      setSourceContentType(contentType);
      setStep('review-interest');
    },
    [],
  );

  // Step 2 → Step 3: Interest reviewed
  const handleInterestReviewed = useCallback((edits: Partial<ProposedInterest>) => {
    setInterestEdits(edits);
    setStep('review-blueprint');
  }, []);

  // Step 3 → Step 4: Blueprint reviewed, activate everything
  const handleActivate = useCallback(
    async (steps: InspirationBlueprintStep[]) => {
      if (!extraction || !user?.id) return;

      setActivating(true);

      try {
        const activationResult = await activateInspiration(
          {
            userId: user.id,
            extraction,
            interestEdits,
            editedSteps: steps,
            sourceContent,
            sourceContentType,
          },
          proposeInterest,
        );

        setResult({
          interestSlug: activationResult.interestSlug,
          blueprintSlug: activationResult.blueprintSlug,
        });
        setStep('success');
      } catch (err) {
        console.error('[InspirationWizard] activation failed:', err);
        showAlert(
          'Creation Failed',
          err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        );
      } finally {
        setActivating(false);
      }
    },
    [extraction, user?.id, interestEdits, sourceContent, sourceContentType, proposeInterest],
  );

  const handleBack = useCallback(() => {
    if (step === 'review-interest') setStep('capture');
    else if (step === 'review-blueprint') setStep('review-interest');
  }, [step]);

  const canGoBack = step === 'review-interest' || step === 'review-blueprint';

  const userInterestSlugs = userInterests.map((i) => i.slug);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header — paddingTop respects the top safe-area inset so Cancel
            stays tappable below the status bar / notch on Android. */}
        <View style={[styles.header, { paddingTop: insets.top + IOS_SPACING.m }]}>
          {canGoBack ? (
            <Pressable onPress={handleBack} style={styles.headerButton}>
              <Ionicons name="chevron-back" size={20} color={IOS_COLORS.systemBlue} />
              <Text style={styles.headerButtonText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.headerButton} />
          )}

          <Text style={styles.headerTitle}>
            {step === 'capture' && 'Get Inspired'}
            {step === 'review-interest' && 'Your Interest'}
            {step === 'review-blueprint' && 'Your Plan'}
            {step === 'success' && 'Ready!'}
          </Text>

          <Pressable onPress={handleClose} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Cancel</Text>
          </Pressable>
        </View>

        {/* Step content */}
        {step === 'capture' && (
          <InspirationCaptureStep
            userInterestSlugs={userInterestSlugs}
            onComplete={handleExtractionComplete}
            registerAbortHandler={registerCaptureAbortHandler}
          />
        )}
        {step === 'review-interest' && extraction && (
          <InspirationInterestStep
            extraction={extraction}
            initialEdits={interestEdits}
            onComplete={handleInterestReviewed}
          />
        )}
        {step === 'review-blueprint' && extraction && (
          <BlueprintStepReview
            extraction={extraction}
            activating={activating}
            onActivate={handleActivate}
          />
        )}
        {step === 'success' && result && (
          <InspirationSuccessStep
            extraction={extraction!}
            interestEdits={interestEdits}
            result={result}
            onClose={handleClose}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.m,
    paddingTop: IOS_SPACING.m,
    paddingBottom: IOS_SPACING.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 17,
    color: IOS_COLORS.systemBlue,
  },
});
