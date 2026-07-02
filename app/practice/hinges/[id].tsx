import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { usePlaybook, useRefinePlaybookInsight } from '@/hooks/usePlaybook';
import { useToast } from '@/components/ui/AppToast';
import { HingeSurface, type HingeSuggestionView } from '@/components/practice';
import { buildHinge, decodeHingeId, type HingeDayEntry } from '@/services/HingeBuildService';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { useInboxItems } from '@/hooks/useInboxItems';
import { useInboxActions } from '@/hooks/useInboxActions';
import { useUniversalPlus } from '@/components/capture';
import type { InboxItem } from '@/components/practice/types';

export default function HingeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const { currentInterest } = useInterest();
  const { data: playbook } = usePlaybook(currentInterest?.id);
  const refineInsight = useRefinePlaybookInsight(currentInterest?.id, playbook?.id);
  const [savingEntryId, setSavingEntryId] = React.useState<string | null>(null);
  const [savedEntryIds, setSavedEntryIds] = React.useState<Set<string>>(new Set());
  const [adoptingSuggestionId, setAdoptingSuggestionId] = React.useState<string | null>(null);

  const { data: inboxItems } = useInboxItems();
  const inboxActions = useInboxActions();
  const universalPlus = useUniversalPlus();

  const decoded = id ? decodeHingeId(id) : null;
  const flagOn = FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER;
  const enabled = Boolean(decoded && user?.id && flagOn);

  const { data: hinge, isLoading } = useQuery({
    queryKey: ['phase9-hinge', id, user?.id],
    queryFn: () =>
      buildHinge({
        userId: user!.id,
        previousStepId: decoded!.previousStepId,
        nextStepId: decoded!.nextStepId,
      }),
    enabled,
  });

  const handleSaveToLibrary = React.useCallback(
    async (entry: HingeDayEntry) => {
      if (!entry.refinable) return;
      if (!currentInterest?.id || !playbook?.id) {
        toast.show('Pick an interest before saving to your library', 'info');
        return;
      }
      setSavingEntryId(entry.id);
      try {
        await refineInsight.mutateAsync({ insightId: entry.sourceId });
        setSavedEntryIds((prev) => new Set(prev).add(entry.id));
        toast.show('Saved to library', 'success');
      } catch {
        toast.show('Could not save to library', 'error');
      } finally {
        setSavingEntryId(null);
      }
    },
    [currentInterest?.id, playbook?.id, refineInsight, toast],
  );

  // Pending mentor/peer suggestions become adoptable "next step" cards. Scope
  // to the current interest's timeline so they match the hinge we're in, and
  // float mentor/coach suggestions to the top.
  const suggestionItems = React.useMemo<InboxItem[]>(() => {
    const rows = (inboxItems ?? []).filter(
      (item) =>
        item.kind === 'suggestion' &&
        (!currentInterest?.id || item.raw.interestId === currentInterest.id),
    );
    return rows.sort((a, b) => {
      const am = /mentor|coach/i.test(a.fromContext) ? 0 : 1;
      const bm = /mentor|coach/i.test(b.fromContext) ? 0 : 1;
      return am - bm;
    });
  }, [inboxItems, currentInterest?.id]);

  const suggestions = React.useMemo<HingeSuggestionView[]>(
    () =>
      suggestionItems.map((item) => ({
        id: item.id,
        title: item.title,
        fromLabel: item.fromContext,
        blurb: item.blurb,
        isMentor: /mentor|coach/i.test(item.fromContext),
      })),
    [suggestionItems],
  );

  const handleAdoptSuggestion = React.useCallback(
    async (suggestionId: string) => {
      const item = suggestionItems.find((s) => s.id === suggestionId);
      if (!item) return;
      setAdoptingSuggestionId(suggestionId);
      try {
        await inboxActions.accept(item);
        router.replace(`/(tabs)/races?selected=${item.raw.sourceStepId}` as never);
      } catch {
        // accept() already surfaces a toast on failure.
      } finally {
        setAdoptingSuggestionId(null);
      }
    },
    [suggestionItems, inboxActions],
  );

  const handleAddNextStep = React.useCallback(() => {
    universalPlus.open();
  }, [universalPlus]);

  if (!flagOn) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Hinge', headerShown: true }} />
        <Text style={styles.disabledTitle}>Hinge surface is part of an upcoming refresh.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_PRACTICE_STEP_LOOP_IOS_REGISTER to preview.
        </Text>
      </View>
    );
  }

  if (!decoded) return null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {isLoading || !hinge ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <HingeSurface
          hinge={hinge}
          onBack={() => router.back()}
          onPreviousStep={() =>
            router.replace(`/(tabs)/races?selected=${hinge.previousStepId}` as never)
          }
          onNextStep={() =>
            router.replace(`/(tabs)/races?selected=${hinge.nextStepId}` as never)
          }
          onSaveEntryToLibrary={handleSaveToLibrary}
          savingEntryId={savingEntryId}
          savedEntryIds={savedEntryIds}
          suggestions={suggestions}
          onAdoptSuggestion={handleAdoptSuggestion}
          adoptingSuggestionId={adoptingSuggestionId}
          onAddNextStep={handleAddNextStep}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 24,
    gap: 8,
  },
  disabledTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  disabledBody: {
    fontSize: 14,
    color: '#6B7280',
  },
});
