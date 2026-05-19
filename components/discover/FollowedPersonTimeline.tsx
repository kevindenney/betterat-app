import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useToast } from '@/components/ui/AppToast';
import { supabase } from '@/services/supabase';
import { AddToTimelineSheet, FilterStrip, TimelineStepCard } from '@/components/timelines';
import { addToTimeline, saveToDeck, type TimelineAddPreview } from '@/services/AddToTimelineService';
import { CrewFinderService } from '@/services/CrewFinderService';
import type { TimelineStepRecord } from '@/types/timeline-steps';

type PublicTimelinePayload = {
  person: {
    id: string;
    name: string;
    isFollowing: boolean;
    settledCount: number;
    interestName: string | null;
  };
  steps: TimelineStepRecord[];
};

type FilterKey = 'all' | 'in-fleet';

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

async function loadFollowedPersonTimeline(
  handle: string,
  viewerId: string | null,
  interestId?: string | null,
): Promise<PublicTimelinePayload> {
  const userId = handle;

  const [profileRes, userRes, stepsRes, settledCountRes, followRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('id', userId).maybeSingle(),
    supabase.from('users').select('id, full_name').eq('id', userId).maybeSingle(),
    (async () => {
      let q = supabase
        .from('timeline_steps')
        .select('*')
        .eq('user_id', userId)
        .eq('visibility', 'public')
        .eq('status', 'settled')
        .order('completed_at', { ascending: false })
        .limit(5);
      if (interestId) q = q.eq('interest_id', interestId);
      return q;
    })(),
    (async () => {
      let q = supabase
        .from('timeline_steps')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('visibility', 'public')
        .eq('status', 'settled');
      if (interestId) q = q.eq('interest_id', interestId);
      return q;
    })(),
    viewerId
      ? supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', viewerId)
          .eq('following_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  if (stepsRes.error) throw stepsRes.error;

  let interestName: string | null = null;
  if (interestId) {
    const { data: interest } = await supabase
      .from('interests')
      .select('name')
      .eq('id', interestId)
      .maybeSingle();
    interestName = (interest as any)?.name ?? null;
  }

  return {
    person: {
      id: userId,
      name: (profileRes.data as any)?.full_name || (userRes.data as any)?.full_name || 'Practitioner',
      isFollowing: Boolean(followRes?.data),
      settledCount: settledCountRes.count ?? 0,
      interestName,
    },
    steps: (stepsRes.data ?? []) as TimelineStepRecord[],
  };
}

export function FollowedPersonTimeline({ handle }: { handle: string }) {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const toast = useToast();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['phase7-followed-person', handle, currentInterest?.id, user?.id],
    queryFn: () => loadFollowedPersonTimeline(handle, user?.id ?? null, currentInterest?.id),
    enabled: Boolean(handle),
  });
  const { data: fleetMateIds = [] } = useQuery({
    queryKey: ['phase7-fleetmates', user?.id],
    queryFn: async () => {
      const fleets = await CrewFinderService.getFleetMatesForUser(user!.id);
      return Array.from(
        new Set(fleets.flatMap((fleet) => fleet.members.map((member) => member.userId))),
      );
    },
    enabled: Boolean(user?.id),
  });
  const [pendingStep, setPendingStep] = React.useState<TimelineStepRecord | null>(null);
  const [forkedIds, setForkedIds] = React.useState<Record<string, 'forked' | 'saw-it'>>({});
  const [filter, setFilter] = React.useState<FilterKey>('all');

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const steps = data?.steps ?? [];
  const sameFleet = fleetMateIds.includes(handle);
  const visibleSteps = filter === 'in-fleet' && sameFleet ? steps : steps;
  const counts = { all: steps.length, fleet: sameFleet ? steps.length : 0 };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.heroTopRow}>
          <Text style={styles.eyebrow}>Followed person</Text>
          {data?.person.isFollowing && (
            <View style={styles.followingPill}>
              <Text style={styles.followingPillText}>Following</Text>
            </View>
          )}
        </View>
        <Text style={styles.title}>{data?.person.name ?? 'Practitioner'}</Text>
        <View style={styles.metaRow}>
          {sameFleet && (
            <>
              <Text style={styles.meta}>same fleet</Text>
              <View style={styles.metaDot} />
            </>
          )}
          <Text style={styles.meta}>{data?.person.settledCount ?? 0} settled steps</Text>
        </View>
        <Text style={styles.section}>
          Recent practice · {data?.person.interestName ?? 'all interests'} · last 30 days · public
        </Text>
      </View>

      <FilterStrip
        options={[
          { key: 'all', label: `All ${counts.all}` },
          { key: 'in-fleet', label: `In fleet ${counts.fleet}` },
        ]}
        selectedKey={filter}
        onSelect={(key) => setFilter(key as FilterKey)}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {visibleSteps.length === 0 ? (
          <Text style={styles.empty}>No public settled steps yet.</Text>
        ) : (
          visibleSteps.map((step) => {
            const preview = extractPreview(step, '');
            return (
              <TimelineStepCard
                key={step.id}
                pillState="settled"
                title={step.title}
                metaLabel={preview.body || 'Settled step'}
                metaWhen={step.completed_at ? new Date(step.completed_at).toLocaleDateString() : 'Settled'}
                capabilityChips={preview.capabilities}
                addState={forkedIds[step.id] ?? 'fork'}
                onAddPress={() => setPendingStep(step)}
              />
            );
          })
        )}
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
          await refetch();
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
    gap: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6D5EF7',
  },
  followingPill: {
    backgroundColor: '#E0E7FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  followingPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#111827',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 13,
    color: '#6B7280',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D1D5DB',
  },
  section: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  empty: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 32,
  },
});
