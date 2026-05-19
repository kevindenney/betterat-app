/**
 * Surface C · Step Discussion route.
 *
 * Reads StepDiscussionService.getStepDiscussion() and projects rows into
 * the StepDiscussionView shape. Tapping a reaction toggles it; submitting
 * the composer posts a root note.
 *
 * For the HKDW sample (boat-speed) this falls back to a mock feed so the
 * canonical is reviewable without round-tripping the database.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  StepDiscussionView,
  type StepDiscussionNote,
  type StepDiscussionReaction,
} from '@/components/onboarding';
import { useAuth } from '@/providers/AuthProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import {
  getStepDiscussion,
  postStepNote,
  toggleStepReaction,
} from '@/services/StepDiscussionService';

const HKDW_SAMPLE_STEP_IDS = new Set(['boat-speed']);

const HKDW_DISCUSSION_MOCK: StepDiscussionNote[] = [
  {
    id: 'mock-phyl',
    authorInitials: 'PL',
    authorColorKey: 'green',
    authorName: 'Phyl Loong',
    when: '2h',
    subContext: 'Captured Saturday · 12–16 kt',
    body:
      '“Hit target on close reach (5.8 kt) but lost 0.3 kt on the broad reach — traveller was probably too high. Trying again Wednesday with the kicker on harder.”',
    evidence: [
      { kind: 'voice', label: '2:14 voice' },
      { kind: 'photo', label: '3 photos' },
      { kind: 'data', label: 'polar data' },
    ],
    coachReply: {
      authorInitials: 'KD',
      authorName: 'Kevin Denney',
      body:
        'Good catch on the traveller. Try 3–40 mm down from the kingpost on the broad reach with the kicker pulled on. Should pull the leech tight without stalling the top batten.',
    },
    reactions: { fire: 12, insight: 4, question: 3 },
    viewerReactions: ['fire'],
  },
  {
    id: 'mock-sara',
    authorInitials: 'SN',
    authorColorKey: 'brown',
    authorName: 'Sara Nilsson',
    when: '5h',
    subContext: 'Reflecting · first attempt',
    body:
      '“Anyone else finding the upwind numbers feel faster than the polar predicts when we\'re flat? Trying to figure out if it\'s the boat or the breeze reading.”',
    reactions: { fire: 5, insight: 9, question: 7 },
    viewerReactions: ['insight'],
  },
];

export default function StepDiscussionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const flagOn =
    FEATURE_FLAGS.HKDW_REDEEM_FLOW || FEATURE_FLAGS.STEP_DISCUSSION_V1;
  const isSample = Boolean(id && HKDW_SAMPLE_STEP_IDS.has(id));
  const realEnabled = Boolean(id && flagOn && !isSample);

  // Phase 10 PR-2b — the canonical Discussion surface is now the 4th tab
  // on the main step card (StepDiscussionInline). For real (non-sample)
  // step IDs, redirect here straight into the step's tab view rather than
  // duplicating the discussion experience. The HKDW sample step still
  // renders the rich fullscreen view as a design preview.
  useEffect(() => {
    if (!id || isSample) return;
    if (!flagOn) return;
    router.replace(`/step/${id}?tab=discussion` as any);
  }, [id, isSample, flagOn]);

  const { data: feedRows, isLoading } = useQuery({
    queryKey: ['phase10-step-discussion', id, user?.id],
    queryFn: () => getStepDiscussion(id!, user?.id ?? null),
    enabled: realEnabled,
  });

  const reactMutation = useMutation({
    mutationFn: async (input: {
      discussionId: string;
      kind: StepDiscussionReaction;
      shouldSet: boolean;
    }) => {
      if (!user?.id) throw new Error('Sign in to react.');
      if (isSample) return;
      await toggleStepReaction({
        discussionId: input.discussionId,
        userId: user.id,
        kind: input.kind,
        shouldSet: input.shouldSet,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['phase10-step-discussion', id] });
    },
  });

  const postMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!user?.id) throw new Error('Sign in to post.');
      if (isSample) return;
      await postStepNote({ stepId: id!, userId: user.id, body });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['phase10-step-discussion', id] });
    },
  });

  const [optimisticReactionsByNote, setOptimisticReactionsByNote] = useState<
    Record<string, StepDiscussionReaction[]>
  >({});

  const viewerInitials = useMemo(() => {
    const name = user?.user_metadata?.full_name as string | undefined;
    if (!name) return 'YO';
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('') || 'YO'
    );
  }, [user?.user_metadata?.full_name]);

  const viewNotes = useMemo<StepDiscussionNote[]>(() => {
    const baseRows = isSample ? null : feedRows ?? [];
    if (isSample) {
      // Layer optimistic viewer reactions on top of mock data.
      return HKDW_DISCUSSION_MOCK.map((n) => {
        const opt = optimisticReactionsByNote[n.id];
        return opt ? { ...n, viewerReactions: opt } : n;
      });
    }
    return (baseRows ?? []).map((row) => {
      const opt = optimisticReactionsByNote[row.id];
      return {
        id: row.id,
        authorInitials: row.author_initials ?? '?',
        authorName: row.author_name ?? 'Sailor',
        when: shortAgo(row.created_at),
        body: row.body,
        evidence: row.evidence,
        reactions: row.reaction_counts,
        viewerReactions: opt ?? row.viewer_reactions,
        coachReply: row.replies?.find((r) => r.is_coach_reply)
          ? {
              authorInitials:
                row.replies.find((r) => r.is_coach_reply)!.author_initials ?? '?',
              authorName:
                row.replies.find((r) => r.is_coach_reply)!.author_name ?? 'Coach',
              body: row.replies.find((r) => r.is_coach_reply)!.body,
            }
          : undefined,
      } as StepDiscussionNote;
    });
  }, [isSample, feedRows, optimisticReactionsByNote]);

  const handleReact = useCallback(
    (noteId: string, kind: StepDiscussionReaction) => {
      const note = viewNotes.find((n) => n.id === noteId);
      if (!note) return;
      const has = note.viewerReactions.includes(kind);
      const next = has
        ? note.viewerReactions.filter((k) => k !== kind)
        : [...note.viewerReactions, kind];
      setOptimisticReactionsByNote((prev) => ({ ...prev, [noteId]: next }));
      reactMutation.mutate({ discussionId: noteId, kind, shouldSet: !has });
    },
    [viewNotes, reactMutation],
  );

  const handleSubmit = useCallback(
    async (body: string) => {
      await postMutation.mutateAsync(body);
    },
    [postMutation],
  );

  const onBack = useCallback(() => router.back(), []);

  if (!flagOn) {
    return (
      <View style={styles.disabled}>
        <Stack.Screen options={{ title: 'Discussion' }} />
        <Text style={styles.disabledTitle}>This discussion view isn't live yet.</Text>
        <Text style={styles.disabledBody}>
          Enable EXPO_PUBLIC_FF_STEP_DISCUSSION_V1 in this environment to preview.
        </Text>
      </View>
    );
  }

  if (!id) return null;

  if (!isSample && isLoading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StepDiscussionView
        topTitle={isSample ? 'Step 4' : 'Step'}
        preTitle={isSample ? 'Step 4 · Discussion' : 'Discussion'}
        stepTitle={
          isSample
            ? 'Boat-speed baseline · all points of sail'
            : 'Step discussion'
        }
        metaLine={
          isSample
            ? "From Kevin's Prepare for the Worlds · 8 sailors on this step"
            : `${viewNotes.length} notes`
        }
        hereNow={
          isSample
            ? {
                avatars: [
                  { initials: 'PL', colorKey: 'navy' },
                  { initials: 'SN', colorKey: 'green' },
                  { initials: 'MO', colorKey: 'purple' },
                  { initials: '+5', colorKey: 'brown' },
                ],
                text: '8 sailors are working through Step 4 right now · 4 captured sessions this week',
              }
            : undefined
        }
        discussionCount={isSample ? 14 : viewNotes.length}
        notes={viewNotes}
        composerPlaceholder={
          isSample ? 'Share your boat-speed reflection…' : 'Share your reflection…'
        }
        viewerInitials={viewerInitials}
        onBack={onBack}
        onReact={handleReact}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

function shortAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const secs = Math.max(0, (Date.now() - ts) / 1000);
  if (secs < 60) return `${Math.round(secs)}s`;
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)}m`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h`;
  const days = hrs / 24;
  if (days < 7) return `${Math.round(days)}d`;
  return new Date(iso).toLocaleDateString();
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
    padding: 24,
    gap: 8,
  },
  disabledTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  disabledBody: {
    fontSize: 14,
    color: '#6B7280',
  },
});
