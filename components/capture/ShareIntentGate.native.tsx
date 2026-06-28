/**
 * ShareIntentGate (native) — the OS share-sheet → Inbox capture path.
 *
 * Registered as a share target via the `expo-share-intent` config plugin
 * (app.config.js). When the user picks "Share → BetterAt" from Safari,
 * YouTube, etc., the shared URL/text arrives here and drops straight into the
 * Inbox (`playbook_insights`, status unsorted) with no classification — the
 * lowest-friction capture per BETTERAT_INBOX_SPEC.md. Triage happens later in
 * /library?zone=inbox.
 *
 * Renders nothing; it lives in the root stack as a sibling effect-gate (like
 * AuthGate) so it's mounted inside the auth + query providers it depends on.
 *
 * NOTE: not yet verified on-device — needs an EAS dev build with the share
 * extension. The web sibling (ShareIntentGate.tsx) is a no-op.
 */

import { useEffect, useRef } from 'react';
import { useShareIntent } from 'expo-share-intent';
import { useAuth } from '@/providers/AuthProvider';
import { useDropLink, useDropNote } from '@/hooks/useInbox';
import { useToast } from '@/components/ui/AppToast';
import { logger } from '@/lib/logger';

const URL_RE = /^https?:\/\/[^\s]+$/i;

export function ShareIntentGate() {
  const { user } = useAuth();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    resetOnBackground: true,
  });
  // Interest is intentionally undefined → the capture lands with interest_id
  // null (cross-craft), tagged at triage rather than at capture.
  const dropLink = useDropLink(undefined);
  const dropNote = useDropNote(undefined);
  const toast = useToast();
  // Guards against the effect firing twice for one share before the async
  // drop completes and resetShareIntent() clears hasShareIntent.
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!hasShareIntent || !user?.id || handlingRef.current) return;
    handlingRef.current = true;

    const url = shareIntent.webUrl?.trim() || null;
    const text = shareIntent.text?.trim() || null;

    const finish = () => {
      resetShareIntent();
      handlingRef.current = false;
    };
    const onSuccess = () => {
      toast.show('Saved to your Inbox', 'success');
      finish();
    };
    const onError = (err: Error) => {
      logger.error('Share-intent inbox drop failed', err);
      toast.show("Couldn't save that — try again", 'error');
      finish();
    };

    if (url) {
      dropLink.mutate({ url }, { onSuccess, onError });
    } else if (text && URL_RE.test(text)) {
      dropLink.mutate({ url: text }, { onSuccess, onError });
    } else if (text) {
      dropNote.mutate({ text }, { onSuccess, onError });
    } else {
      // Media/file shares aren't handled yet — drop them silently so the
      // share intent still clears instead of wedging the gate.
      finish();
    }
  }, [hasShareIntent, shareIntent, user?.id, dropLink, dropNote, resetShareIntent, toast]);

  return null;
}
