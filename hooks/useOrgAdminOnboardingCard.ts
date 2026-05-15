/**
 * useOrgAdminOnboardingCard
 *
 * AsyncStorage-backed dismissal state for the Org Admin onboarding card.
 * Dismissal is scoped per organization so an admin who belongs to multiple
 * orgs can see the welcome card the first time in each one.
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'betterat.orgAdminOnboarding.dismissed:';

function storageKey(organizationId: string): string {
  return `${STORAGE_PREFIX}${organizationId}`;
}

async function readDismissed(organizationId: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(storageKey(organizationId)) === '1';
    }
    const value = await AsyncStorage.getItem(storageKey(organizationId));
    return value === '1';
  } catch {
    return false;
  }
}

async function writeDismissed(organizationId: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey(organizationId), '1');
      return;
    }
    await AsyncStorage.setItem(storageKey(organizationId), '1');
  } catch {
    // ignore — non-fatal: card will reappear next render but not crash.
  }
}

export interface UseOrgAdminOnboardingCardResult {
  /** True only when (a) storage has been read and (b) the card is not dismissed. */
  shouldShow: boolean;
  /** True once the initial storage read has resolved. */
  ready: boolean;
  /** Persist dismissal for the current organizationId. */
  dismiss: () => Promise<void>;
}

export function useOrgAdminOnboardingCard(
  organizationId?: string | null,
): UseOrgAdminOnboardingCardResult {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) {
      setReady(true);
      setDismissed(true);
      return () => {
        cancelled = true;
      };
    }

    setReady(false);
    void (async () => {
      const wasDismissed = await readDismissed(organizationId);
      if (cancelled) return;
      setDismissed(wasDismissed);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const dismiss = useCallback(async () => {
    if (!organizationId) return;
    setDismissed(true);
    await writeDismissed(organizationId);
  }, [organizationId]);

  return {
    shouldShow: ready && !dismissed && Boolean(organizationId),
    ready,
    dismiss,
  };
}
