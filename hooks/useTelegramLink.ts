/**
 * useTelegramLink — current user's active telegram_links row.
 *
 * Mirrors the inline data layer in app/settings/telegram.tsx but exposes it
 * to the v3 Connected Services pane so both surfaces can render real state.
 *
 * Connect / disconnect mutates the same row used by the deployed Telegram
 * webhook (api/telegram/webhook.ts) — disconnecting here stops the bot
 * recognising the user on the next inbound message.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface TelegramLink {
  id: string;
  telegram_user_id: number;
  telegram_username: string | null;
  linked_at: string | null;
  is_active: boolean;
}

export function useTelegramLink() {
  const { user } = useAuth();
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLink(null);
      setIsLoaded(true);
      return;
    }
    const { data } = await supabase
      .from('telegram_links')
      .select('id, telegram_user_id, telegram_username, linked_at, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    setLink((data as TelegramLink | null) ?? null);
    setIsLoaded(true);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = useCallback(async () => {
    if (!link) return;
    await supabase
      .from('telegram_links')
      .update({ is_active: false })
      .eq('id', link.id);
    setLink(null);
  }, [link]);

  return {
    link,
    isConnected: Boolean(link?.linked_at),
    isLoaded,
    refresh: load,
    disconnect,
  };
}

export function telegramBotUsername(): string {
  return process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME || 'betterat_bot';
}

export function telegramBotDeepLink(payload?: string): string {
  const username = telegramBotUsername();
  // The webhook's /start handler only recognises `link_<code>` payloads
  // (api/telegram/webhook.ts:216). Passing a bare user UUID or any other
  // payload falls through to the generic welcome message, which spams the
  // chat on every reopen for already-linked users. Only emit ?start= when
  // the caller passes a properly-prefixed link code.
  if (payload?.startsWith('link_')) {
    return `https://t.me/${username}?start=${encodeURIComponent(payload)}`;
  }
  return `https://t.me/${username}`;
}
