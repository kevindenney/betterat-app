import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useBlueprintSubscribers, useBlueprintCoSubscriberProgress, useBlueprintWithAuthor } from '@/hooks/useBlueprint';
import { CrewFinderService } from '@/services/CrewFinderService';
import { FilterStrip } from '@/components/timelines';

type FleetFilter = 'all' | 'fleet' | 'in-progress' | 'settled';

interface PeerStep {
  step_title: string;
  status: string;
  capabilities?: string[];
}

function initials(name?: string | null) {
  return (name ?? 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function currentStep(steps: PeerStep[]): PeerStep | undefined {
  return (
    steps.find((step) => step.status === 'current') ??
    steps.find((step) => step.status === 'planned')
  );
}

function currentStepLabel(steps: PeerStep[]) {
  const cur = currentStep(steps);
  return cur ? cur.step_title : 'No active step yet';
}

function currentWhenLabel(steps: PeerStep[]) {
  if (steps.some((step) => step.status === 'current')) return 'this week';
  if (steps.some((step) => step.status === 'planned')) return 'next up';
  if (steps.length > 0 && steps.every((step) => step.status === 'settled')) return 'all settled';
  return 'settled';
}

function tagsForPeer(steps: PeerStep[]): string[] {
  const cur = currentStep(steps);
  const tags = cur?.capabilities ?? [];
  return tags.slice(0, 2);
}

function peerOverallStatus(steps: PeerStep[]): 'in-progress' | 'settled' | 'planned' {
  if (steps.some((step) => step.status === 'current')) return 'in-progress';
  if (steps.length > 0 && steps.every((step) => step.status === 'settled')) return 'settled';
  return 'planned';
}

export function CoPractitionerList({ blueprintId }: { blueprintId: string }) {
  const { user } = useAuth();
  const { data: blueprint } = useBlueprintWithAuthor(blueprintId);
  const { data: subscribers = [], isLoading: loadingSubscribers } = useBlueprintSubscribers(blueprintId);
  const { data: progress = [], isLoading: loadingProgress } = useBlueprintCoSubscriberProgress(blueprintId);
  const { data: fleetMateIds = [] } = useQuery({
    queryKey: ['phase7-fleetmates', user?.id],
    queryFn: async () => {
      const fleets = await CrewFinderService.getFleetMatesForUser(user!.id);
      return Array.from(
        new Set(
          fleets.flatMap((fleet) => fleet.members.map((member) => member.userId)),
        ),
      );
    },
    enabled: Boolean(user?.id),
  });
  const [filter, setFilter] = React.useState<FleetFilter>('all');

  const peers = React.useMemo(() => {
    return subscribers
      .filter((subscriber) => subscriber.subscriber_id !== user?.id)
      .map((subscriber) => {
        const subscriberProgress = progress.find(
          (row) => row.subscriber_id === subscriber.subscriber_id,
        );
        const steps = (subscriberProgress?.steps ?? []) as PeerStep[];
        return {
          subscriber,
          steps,
          inFleet: fleetMateIds.includes(subscriber.subscriber_id),
          overall: peerOverallStatus(steps),
        };
      });
  }, [subscribers, progress, fleetMateIds, user?.id]);

  const counts = React.useMemo(() => ({
    all: peers.length,
    fleet: peers.filter((p) => p.inFleet).length,
    inProgress: peers.filter((p) => p.overall === 'in-progress').length,
    settled: peers.filter((p) => p.overall === 'settled').length,
  }), [peers]);

  const visiblePeers = React.useMemo(() => {
    switch (filter) {
      case 'fleet':
        return peers.filter((p) => p.inFleet);
      case 'in-progress':
        return peers.filter((p) => p.overall === 'in-progress');
      case 'settled':
        return peers.filter((p) => p.overall === 'settled');
      default:
        return peers;
    }
  }, [peers, filter]);

  if (loadingSubscribers || loadingProgress) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Co-practitioners</Text>
        <Text style={styles.title}>{blueprint?.title ?? 'Blueprint'}</Text>
        <Text style={styles.subtitle}>
          {counts.all} active{counts.settled > 0 ? ` · ${counts.settled} settled` : ''}
        </Text>
      </View>

      <FilterStrip
        options={[
          { key: 'all', label: `All ${counts.all}` },
          { key: 'fleet', label: `In your fleet ${counts.fleet}` },
          { key: 'in-progress', label: `In progress ${counts.inProgress}` },
          { key: 'settled', label: `Settled ${counts.settled}` },
        ]}
        selectedKey={filter}
        onSelect={(key) => setFilter(key as FleetFilter)}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {visiblePeers.length === 0 ? (
          <Text style={styles.empty}>
            {filter === 'fleet'
              ? 'No subscribers from your fleet yet.'
              : filter === 'in-progress'
                ? 'No subscribers actively working through this blueprint right now.'
                : filter === 'settled'
                  ? 'No subscribers have settled every step yet.'
                  : 'No other subscribers on this path yet.'}
          </Text>
        ) : (
          visiblePeers.map(({ subscriber, steps, inFleet }) => {
            const tags = tagsForPeer(steps);
            return (
              <Pressable
                key={subscriber.id}
                style={styles.row}
                onPress={() => router.push(`/discover/u/${subscriber.subscriber_id}` as any)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(subscriber.subscriber_name)}</Text>
                </View>
                <View style={styles.copy}>
                  <Text style={styles.name}>{subscriber.subscriber_name ?? 'Subscriber'}</Text>
                  <Text style={styles.affiliation}>
                    {inFleet ? 'In your fleet' : 'Subscriber'}
                  </Text>
                  <Text style={styles.stepLine} numberOfLines={1}>
                    {currentStepLabel(steps)}
                  </Text>
                  <Text style={styles.when}>{currentWhenLabel(steps)}</Text>
                  {tags.length > 0 && (
                    <View style={styles.tagRow}>
                      {tags.map((tag) => (
                        <View key={tag} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <Text style={styles.view}>View ›</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
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
    fontSize: 28,
    lineHeight: 34,
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
    paddingTop: 10,
    paddingBottom: 32,
    gap: 12,
  },
  empty: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 32,
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#4338CA',
    fontWeight: '700',
    fontSize: 14,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  affiliation: {
    fontSize: 12,
    color: '#6B7280',
  },
  stepLine: {
    fontSize: 13,
    color: '#374151',
    marginTop: 4,
  },
  when: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    color: '#6B7280',
  },
  view: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 4,
  },
});
