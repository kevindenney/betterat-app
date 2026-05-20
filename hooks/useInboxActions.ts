/**
 * useInboxActions — three mutations behind the Inbox row actions.
 *
 *   accept   → fork source step into recipient's timeline_steps (or place
 *              the existing deck row); mark step_suggestions.status='adopted'
 *   save     → create step_deck row (or no-op for already-on-deck);
 *              mark step_suggestions.status='saved'
 *   dismiss  → mark step_suggestions.status='dismissed' (or discard deck row)
 *
 * Each mutation invalidates the inbox list + count queries so the row
 * drops out on next refetch. Callers can also drive an optimistic
 * dismissal in component-local state for instant feedback.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/components/ui/AppToast';
import {
  addToTimeline,
  saveToDeck as saveToDeckService,
  placeDeckItem,
  discardDeck,
} from '@/services/AddToTimelineService';
import type { InboxItem } from '@/components/practice/types';

interface UseInboxActionsResult {
  accept: (item: InboxItem) => Promise<void>;
  save: (item: InboxItem) => Promise<void>;
  dismiss: (item: InboxItem) => Promise<void>;
}

async function updateSuggestionStatus(
  suggestionId: string,
  status: 'adopted' | 'saved' | 'dismissed',
): Promise<void> {
  const { error } = await supabase
    .from('step_suggestions')
    .update({ status })
    .eq('id', suggestionId);
  if (error) throw error;
}

export function useInboxActions(): UseInboxActionsResult {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['practice-inbox-items'] });
    qc.invalidateQueries({ queryKey: ['practice-inbox-count'] });
    // Race / Plan / Reflect surfaces all read from ['timeline-steps', …];
    // accept and on-deck place mutate the recipient's timeline so every
    // consumer of that key needs to refetch.
    qc.invalidateQueries({ queryKey: ['timeline-steps'] });
  }, [qc]);

  const accept = useCallback(
    async (item: InboxItem) => {
      if (!user?.id) return;
      try {
        if (!item.raw.interestId) {
          toast.show('Missing interest for this step', 'error');
          return;
        }
        const preview = {
          sourceLabel: item.fromContext,
          title: item.title,
          body: item.blurb || item.raw.sourceDescription || '',
          capabilities: [],
        };
        if (item.kind === 'on_deck') {
          await placeDeckItem(item.id, {
            userId: user.id,
            interestId: item.raw.interestId,
            preview,
            placement: 'preempt',
            sourceType: 'user_fork',
            sourceId: item.raw.sourceStepId,
          });
        } else {
          await addToTimeline({
            userId: user.id,
            interestId: item.raw.interestId,
            preview,
            placement: 'preempt',
            sourceType: 'suggestion',
            sourceId: item.raw.sourceStepId,
            sourceUserId: item.raw.sourceUserId ?? undefined,
          });
          await updateSuggestionStatus(item.id, 'adopted');
        }
        toast.show('Added to your timeline', 'success');
      } catch (err) {
        toast.show('Could not add to timeline', 'error');
        throw err;
      } finally {
        invalidate();
      }
    },
    [user?.id, toast, invalidate],
  );

  const save = useCallback(
    async (item: InboxItem) => {
      if (!user?.id) return;
      try {
        if (item.kind === 'on_deck') {
          // Already on deck — treat as a no-op success.
          toast.show('Already on your deck', 'success');
          return;
        }
        if (!item.raw.interestId) {
          toast.show('Missing interest for this step', 'error');
          return;
        }
        await saveToDeckService({
          userId: user.id,
          interestId: item.raw.interestId,
          preview: {
            sourceLabel: item.fromContext,
            title: item.title,
            body: item.blurb || item.raw.sourceDescription || '',
            capabilities: [],
          },
          sourceType: 'suggestion',
          sourceId: item.raw.sourceStepId,
          sourceUserId: item.raw.sourceUserId ?? undefined,
        });
        await updateSuggestionStatus(item.id, 'saved');
        toast.show('Saved to deck', 'success');
      } catch (err) {
        toast.show('Could not save to deck', 'error');
        throw err;
      } finally {
        invalidate();
      }
    },
    [user?.id, toast, invalidate],
  );

  const dismiss = useCallback(
    async (item: InboxItem) => {
      if (!user?.id) return;
      try {
        if (item.kind === 'on_deck') {
          await discardDeck(item.id);
        } else {
          await updateSuggestionStatus(item.id, 'dismissed');
        }
      } catch (err) {
        toast.show('Could not dismiss', 'error');
        throw err;
      } finally {
        invalidate();
      }
    },
    [user?.id, toast, invalidate],
  );

  return { accept, save, dismiss };
}
