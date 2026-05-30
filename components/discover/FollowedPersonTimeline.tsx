import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

function initials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
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
  const personName = data?.person.name ?? 'Practitioner';
  const interestLabel = data?.person.interestName ?? null;
  const settledCount = data?.person.settledCount ?? 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/(tabs)/watch' as never)
          }
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.backLink}
        >
          <Ionicons name="chevron-back" size={18} color="#007AFF" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(personName)}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.title}>{personName}</Text>
            <Text style={styles.subtitle}>
              {settledCount === 0
                ? 'No public settled steps yet'
                : `${settledCount} public settled step${settledCount === 1 ? '' : 's'}`}
              {interestLabel ? ` · ${interestLabel}` : ''}
            </Text>
          </View>
          {data?.person.isFollowing ? (
            <View style={styles.followingPill}>
              <Ionicons name="checkmark" size={11} color="#4338CA" />
              <Text style={styles.followingPillText}>Following</Text>
            </View>
          ) : null}
        </View>
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
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="lock-closed-outline" size={22} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyTitle}>Nothing public yet</Text>
            <Text style={styles.emptyBody}>
              {personName.split(/\s+/)[0] ?? 'They'} hasn't marked any settled
              steps as public{interestLabel ? ` in ${interestLabel}` : ''}. Follow
              them to be notified when they do.
            </Text>
          </View>
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
            ? extractPreview(pendingStep, `From ${personName}`)
            : { sourceLabel: '', title: '', body: '', capabilities: [] }
        }
        onDismiss={() => setPendingStep(null)}
        onAdd={async (placement, date) => {
          if (!pendingStep || !user?.id || !currentInterest?.id) return;
          await addToTimeline({
            userId: user.id,
            interestId: currentInterest.id,
            preview: extractPreview(pendingStep, `From ${personName}`),
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
            preview: extractPreview(pendingStep, `From ${personName}`),
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
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#4338CA',
    fontWeight: '700',
    fontSize: 16,
  },
  identityCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  followingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0E7FF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  followingPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  emptyWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: 22,
    marginTop: 12,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
});
