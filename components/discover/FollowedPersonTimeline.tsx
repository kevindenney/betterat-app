import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useToast } from '@/components/ui/AppToast';
import { supabase } from '@/services/supabase';
import { AddToTimelineSheet, TimelineStepCard } from '@/components/timelines';
import { addToTimeline, saveToDeck, type TimelineAddPreview } from '@/services/AddToTimelineService';
import type { TimelineStepRecord } from '@/types/timeline-steps';

type PublicTimelinePayload = {
  person: {
    id: string;
    name: string;
  };
  steps: TimelineStepRecord[];
};

function extractPreview(step: TimelineStepRecord, sourceLabel: string): TimelineAddPreview {
  const plan = (step.metadata?.plan ?? {}) as Record<string, unknown>;
  return {
    sourceLabel,
    title: step.title,
    body:
      String(plan.what_will_you_do || '').trim() ||
      String(plan.why_is_this_next || '').trim() ||
      step.description ||
      '',
    capabilities: ((plan.capability_goals as string[] | undefined) ?? []).slice(0, 5),
  };
}

async function loadFollowedPersonTimeline(handle: string, interestId?: string | null): Promise<PublicTimelinePayload> {
  const userId = handle;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle();
  const { data: userRow } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', userId)
    .maybeSingle();

  let query = supabase
    .from('timeline_steps')
    .select('*')
    .eq('user_id', userId)
    .eq('visibility', 'public')
    .eq('status', 'settled')
    .order('completed_at', { ascending: false })
    .limit(5);
  if (interestId) query = query.eq('interest_id', interestId);

  const { data: steps, error } = await query;
  if (error) throw error;

  return {
    person: {
      id: userId,
      name: (profile as any)?.full_name || (userRow as any)?.full_name || 'Practitioner',
    },
    steps: (steps ?? []) as TimelineStepRecord[],
  };
}

export function FollowedPersonTimeline({ handle }: { handle: string }) {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['phase7-followed-person', handle, currentInterest?.id],
    queryFn: () => loadFollowedPersonTimeline(handle, currentInterest?.id),
    enabled: Boolean(handle),
  });
  const [pendingStep, setPendingStep] = React.useState<TimelineStepRecord | null>(null);
  const [forkedIds, setForkedIds] = React.useState<Record<string, 'forked' | 'saw-it'>>({});

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Followed person</Text>
        <Text style={styles.title}>{data?.person.name ?? 'Practitioner'}</Text>
        <Text style={styles.subtitle}>Public settled steps only</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {(data?.steps ?? []).map((step) => (
          <TimelineStepCard
            key={step.id}
            pillState="settled"
            title={step.title}
            metaLabel={step.description ?? 'Settled step'}
            metaWhen={step.completed_at ? new Date(step.completed_at).toLocaleDateString() : 'Settled'}
            capabilityChips={extractPreview(step, '').capabilities}
            addState={forkedIds[step.id] ?? 'fork'}
            onAddPress={() => setPendingStep(step)}
          />
        ))}
      </ScrollView>

      <AddToTimelineSheet
        visible={Boolean(pendingStep)}
        preview={
          pendingStep
            ? extractPreview(pendingStep, `From ${data?.person.name ?? 'person'}`)
            : { sourceLabel: '', title: '', body: '', capabilities: [] }
        }
        onDismiss={() => setPendingStep(null)}
        onAdd={async (placement, date) => {
          if (!pendingStep || !user?.id || !currentInterest?.id) return;
          await addToTimeline({
            userId: user.id,
            interestId: currentInterest.id,
            preview: extractPreview(pendingStep, `From ${data?.person.name ?? 'person'}`),
            placement,
            sourceType: 'user_fork',
            sourceId: pendingStep.id,
            sourceUserId: pendingStep.user_id,
            date,
          });
          setForkedIds((prev) => ({ ...prev, [pendingStep.id]: 'forked' }));
          setPendingStep(null);
          toast.show('Forked into your timeline', 'success');
        }}
        onSaveToDeck={async () => {
          if (!pendingStep || !user?.id || !currentInterest?.id) return;
          await saveToDeck({
            userId: user.id,
            interestId: currentInterest.id,
            preview: extractPreview(pendingStep, `From ${data?.person.name ?? 'person'}`),
            sourceType: 'user_fork',
            sourceId: pendingStep.id,
            sourceUserId: pendingStep.user_id,
          } as any);
          setForkedIds((prev) => ({ ...prev, [pendingStep.id]: 'saw-it' }));
          setPendingStep(null);
          toast.show('Saved to deck', 'success');
        }}
      />
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
    backgroundColor: '#F2F2F7',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6D5EF7',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
});
