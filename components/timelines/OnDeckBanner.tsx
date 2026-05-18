/**
 * OnDeckBanner — smart wrapper around <OnDeckZone> that handles the
 * Place / Discard flow against StepDeckService. Renders nothing when the
 * user has no on-deck items. Drop into any screen above the user's own
 * timeline; the placement sheet stays self-contained.
 */

import React from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useToast } from '@/components/ui/AppToast';
import { OnDeckZone } from './OnDeckZone';
import { AddToTimelineSheet } from './AddToTimelineSheet';
import { useOnDeck, useDiscardOnDeck, useMarkOnDeckPlaced } from '@/hooks/useOnDeck';
import { addToTimeline, type TimelinePlacement } from '@/services/AddToTimelineService';
import type { StepDeckRecord } from '@/services/StepDeckService';

function friendlyAddedAt(addedAt: string): string {
  const then = new Date(addedAt).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(addedAt).toLocaleDateString();
}

function provenanceFor(item: StepDeckRecord): string {
  switch (item.source_type) {
    case 'blueprint':
      return 'From blueprint';
    case 'user_fork':
      return 'From someone you follow';
    case 'suggestion':
      return 'From a suggestion';
    default:
      return 'On deck';
  }
}

export function OnDeckBanner() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const toast = useToast();
  const { data: items = [] } = useOnDeck(currentInterest?.id);
  const discardMutation = useDiscardOnDeck(currentInterest?.id);
  const placeMutation = useMarkOnDeckPlaced(currentInterest?.id);
  const [pending, setPending] = React.useState<StepDeckRecord | null>(null);

  if (!user?.id || !currentInterest?.id) return null;

  const onPlace = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (target) setPending(target);
  };

  const onDiscard = (id: string) => {
    discardMutation.mutate(id, {
      onSuccess: () => toast.show('Removed from deck', 'info'),
    });
  };

  const onConfirmPlacement = async (placement: TimelinePlacement, date?: string) => {
    if (!pending || !user?.id || !currentInterest?.id) return;
    try {
      await addToTimeline({
        userId: user.id,
        interestId: currentInterest.id,
        preview: {
          sourceLabel: provenanceFor(pending),
          title: pending.title,
          body: pending.body ?? '',
          capabilities: [],
        },
        placement,
        sourceType: pending.source_type,
        sourceId: pending.source_id,
        date,
      });
      await placeMutation.mutateAsync(pending.id);
      toast.show('Added to your timeline', 'success');
      setPending(null);
    } catch (err) {
      toast.show('Could not place this step', 'error');
    }
  };

  return (
    <>
      <OnDeckZone
        items={items.map((item) => ({
          id: item.id,
          title: item.title,
          provenance: provenanceFor(item),
          addedAt: friendlyAddedAt(item.added_at),
        }))}
        onPlace={onPlace}
        onDiscard={onDiscard}
      />

      <AddToTimelineSheet
        visible={Boolean(pending)}
        preview={
          pending
            ? {
                sourceLabel: provenanceFor(pending),
                title: pending.title,
                body: pending.body ?? '',
                capabilities: [],
              }
            : { sourceLabel: '', title: '', body: '', capabilities: [] }
        }
        onDismiss={() => setPending(null)}
        onAdd={onConfirmPlacement}
        onSaveToDeck={() => setPending(null)}
      />
    </>
  );
}
