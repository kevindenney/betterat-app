/**
 * useConnectedServices — local-only persistence for the v3 Phase E
 * Connect WhatsApp / Telegram preview flow.
 *
 * The flow is intentionally UI-only at v1 — no BSP webhook, no code
 * verification, no message ingestion. This hook just remembers whether
 * the reviewer tapped "Mark as connected" on the WhatsApp pane so they
 * can walk the confirmed-state UX (Screen 17 with the three toggles)
 * without a backend.
 *
 * Production wiring will replace AsyncStorage with a Supabase row on
 * a `whatsapp_links` table keyed by auth.users.id; the hook signature
 * stays the same so callers don't have to change.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'betterat.connected-services.v3';

const KEYS = {
  whatsappConnected: `${KEY_PREFIX}.whatsapp.connected`,
  whatsappPeerSuggestions: `${KEY_PREFIX}.whatsapp.toggle.peer-suggestions`,
  whatsappDailyPrompt: `${KEY_PREFIX}.whatsapp.toggle.daily-prompt`,
  whatsappShgBridge: `${KEY_PREFIX}.whatsapp.toggle.shg-bridge`,
} as const;

type ToggleKey =
  | 'peerSuggestions'
  | 'dailyPrompt'
  | 'shgBridge';

const TOGGLE_KEY_MAP: Record<ToggleKey, string> = {
  peerSuggestions: KEYS.whatsappPeerSuggestions,
  dailyPrompt: KEYS.whatsappDailyPrompt,
  shgBridge: KEYS.whatsappShgBridge,
};

async function readBoolean(key: string, fallback: boolean): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

async function writeBoolean(key: string, value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* swallow — local mock, not load-bearing */
  }
}

export function useIsConnectedToWhatsApp() {
  const [isConnected, setIsConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    readBoolean(KEYS.whatsappConnected, false).then((v) => {
      setIsConnected(v);
      setLoaded(true);
    });
  }, []);

  const markConnected = useCallback(async (value: boolean) => {
    setIsConnected(value);
    await writeBoolean(KEYS.whatsappConnected, value);
    // Default the three toggles to on the first time the user connects so
    // the confirmed state matches the design (all switches on by default).
    if (value) {
      await Promise.all([
        writeBoolean(KEYS.whatsappPeerSuggestions, true),
        writeBoolean(KEYS.whatsappDailyPrompt, true),
        writeBoolean(KEYS.whatsappShgBridge, true),
      ]);
    }
  }, []);

  return { isConnected, isLoaded: loaded, markConnected };
}

export function useWhatsAppToggles() {
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    peerSuggestions: true,
    dailyPrompt: true,
    shgBridge: true,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      readBoolean(TOGGLE_KEY_MAP.peerSuggestions, true),
      readBoolean(TOGGLE_KEY_MAP.dailyPrompt, true),
      readBoolean(TOGGLE_KEY_MAP.shgBridge, true),
    ]).then(([peerSuggestions, dailyPrompt, shgBridge]) => {
      setToggles({ peerSuggestions, dailyPrompt, shgBridge });
      setLoaded(true);
    });
  }, []);

  const setToggle = useCallback(async (key: ToggleKey, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
    await writeBoolean(TOGGLE_KEY_MAP[key], value);
  }, []);

  return { toggles, isLoaded: loaded, setToggle };
}
