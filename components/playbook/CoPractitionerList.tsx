import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useBlueprintSubscribers, useBlueprintSubscriberProgress, useBlueprintWithAuthor } from '@/hooks/useBlueprint';
import { CrewFinderService } from '@/services/CrewFinderService';
import { FilterStrip } from '@/components/timelines';

type FleetFilter = 'all' | 'fleet';

function initials(name?: string | null) {
  return (name ?? 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function currentStepLabel(steps: { step_title: string; status: string }[]) {
  const current = steps.find((step) => step.status === 'in_progress') ?? steps.find((step) => step.status === 'pending');
  return current ? current.step_title : 'No active step yet';
}

function currentWhenLabel(steps: { status: string }[]) {
  if (steps.some((step) => step.status === 'in_progress')) return 'this week';
  if (steps.some((step) => step.status === 'pending')) return 'next up';
  return 'settled';
}

export function CoPractitionerList({ blueprintId }: { blueprintId: string }) {
  const { user } = useAuth();
  const { data: blueprint } = useBlueprintWithAuthor(blueprintId);
  const { data: subscribers = [], isLoading: loadingSubscribers } = useBlueprintSubscribers(blueprintId);
  const { data: progress = [], isLoading: loadingProgress } = useBlueprintSubscriberProgress(blueprintId);
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

  const filtered = subscribers
    .filter((subscriber) => subscriber.subscriber_id !== user?.id)
    .filter((subscriber) => filter === 'all' || fleetMateIds.includes(subscriber.subscriber_id));

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
          {filtered.length} subscriber{filtered.length === 1 ? '' : 's'} on this path
        </Text>
      </View>

      <FilterStrip
        options={[
          { key: 'all', label: 'All subscribers' },
          { key: 'fleet', label: 'My fleet' },
        ]}
        selectedKey={filter}
        onSelect={(key) => setFilter(key as FleetFilter)}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {filtered.map((subscriber) => {
          const subscriberProgress = progress.find((row) => row.subscriber_id === subscriber.subscriber_id);
          const steps = (subscriberProgress?.steps ?? []) as { step_title: string; status: string }[];
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
                  {fleetMateIds.includes(subscriber.subscriber_id) ? 'In your fleet' : 'Subscriber'}
                </Text>
                <Text style={styles.stepLine} numberOfLines={1}>
                  {currentStepLabel(steps)}
                </Text>
                <Text style={styles.when}>{currentWhenLabel(steps)}</Text>
              </View>
              <Text style={styles.view}>View</Text>
            </Pressable>
          );
        })}
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
    paddingTop: 10,
    paddingBottom: 32,
    gap: 12,
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  when: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  view: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
});
