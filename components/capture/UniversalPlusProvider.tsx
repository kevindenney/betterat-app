/**
 * <UniversalPlusProvider> — mounts the universal `+` sheet once at app root.
 *
 * Phase 2 · iOS register. Any tab can call `useUniversalPlus().open()` to
 * raise the sheet. The provider wires the sheet's callbacks to
 * QuickCaptureService + router + toast so call sites stay small.
 *
 * Behind PRACTICE_STEP_LOOP_IOS_REGISTER. When the flag is off, `open()` is
 * a no-op and `isAvailable` is false so callers can fall back to the legacy
 * new-step entry point.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { router } from 'expo-router';
import { useToast } from '@/components/ui/AppToast';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import {
  createDraftStep,
  dropInsight,
  type QuickCapturePayload,
} from '@/services/QuickCaptureService';
import { UniversalPlusSheet } from './UniversalPlusSheet';

export interface UniversalPlusContextValue {
  open: () => void;
  close: () => void;
  isAvailable: boolean;
}

const UniversalPlusContext = createContext<UniversalPlusContextValue>({
  open: () => undefined,
  close: () => undefined,
  isAvailable: false,
});

export function useUniversalPlus() {
  return useContext(UniversalPlusContext);
}

export function UniversalPlusProvider({ children }: { children: React.ReactNode }) {
  const enabled = FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER;
  const [visible, setVisible] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
  const { currentInterest } = useInterest();

  const open = useCallback(() => {
    if (!enabled) return;
    setVisible(true);
  }, [enabled]);

  const close = useCallback(() => setVisible(false), []);

  const handleQuickCapture = useCallback(
    async (payload: QuickCapturePayload) => {
      if (!user?.id || !currentInterest?.id) {
        toast.show('Pick an interest before adding a step.', 'info');
        close();
        return;
      }
      try {
        await createDraftStep({
          userId: user.id,
          interestId: currentInterest.id,
          payload,
        });
        toast.show('Draft saved', 'success');
      } catch (err) {
        logger.error('Quick-capture draft creation failed', err);
        toast.show('Could not save draft. Try again.', 'error');
      } finally {
        close();
      }
    },
    [user?.id, currentInterest?.id, toast, close],
  );

  const handleDropConcept = useCallback(
    async (payload: QuickCapturePayload) => {
      if (!user?.id) {
        toast.show('Sign in to save concepts.', 'info');
        close();
        return;
      }
      const isEmpty = payload.content.trim().length === 0 && !payload.audioUri;
      if (isEmpty) {
        // Empty-tap variant: the row was tapped before the user wrote
        // anything. Surface a hint so they know what to do next.
        toast.show('Type or speak a concept above first.', 'info');
        return;
      }
      try {
        await dropInsight({
          userId: user.id,
          interestId: currentInterest?.id ?? null,
          payload,
        });
        toast.show('Concept saved to Playbook', 'success');
      } catch (err) {
        logger.error('Concept drop failed', err);
        toast.show('Could not save concept. Try again.', 'error');
      } finally {
        close();
      }
    },
    [user?.id, currentInterest?.id, toast, close],
  );

  const handleNavigate = useCallback(
    (path: string) => {
      close();
      router.push(path as any);
    },
    [close],
  );

  const value = useMemo<UniversalPlusContextValue>(
    () => ({ open, close, isAvailable: enabled }),
    [open, close, enabled],
  );

  return (
    <UniversalPlusContext.Provider value={value}>
      {children}
      {enabled ? (
        <UniversalPlusSheet
          visible={visible}
          onDismiss={close}
          onQuickCapture={handleQuickCapture}
          onAddFromBlueprint={() => handleNavigate('/playbook/blueprints')}
          onAddFromFollow={() => handleNavigate('/discover/following')}
          onDropConcept={handleDropConcept}
          onShareIdea={() => handleNavigate('/share/idea')}
        />
      ) : null}
    </UniversalPlusContext.Provider>
  );
}
