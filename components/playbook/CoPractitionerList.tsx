import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { useBlueprintSubscribers, useBlueprintCoSubscriberProgress, useBlueprintWithAuthor } from '@/hooks/useBlueprint';
import { CrewFinderService } from '@/services/CrewFinderService';
import { FilterStrip } from '@/components/timelines';
import { useInterest } from '@/providers/InterestProvider';
import { getVisibilityLabels } from '@/lib/vocabulary';

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

function tagsForPeer(steps: PeerStep[]): string[] {
  const cur =
    steps.find((step) => step.status === 'current') ??
    steps.find((step) => step.status === 'planned');
  return (cur?.capabilities ?? []).slice(0, 2);
}

function peerOverallStatus(steps: PeerStep[]): 'in-progress' | 'settled' | 'planned' | 'idle' {
  if (steps.length === 0) return 'idle';
  if (steps.some((step) => step.status === 'current')) return 'in-progress';
  if (steps.every((step) => step.status === 'settled')) return 'settled';
  if (steps.some((step) => step.status === 'planned')) return 'planned';
  return 'idle';
}

/**
 * Render the activity line that summarises where a peer stands relative
 * to this Blueprint. Each branch produces ONE sentence — the legacy
 * pattern of "current step title" + a separate "when" label often
 * collided ("No active step yet · settled") because the two labels were
 * computed independently.
 */
function peerActivityLine({
  steps,
  overall,
}: {
  steps: PeerStep[];
  overall: 'in-progress' | 'settled' | 'planned' | 'idle';
}): string {
  if (overall === 'settled') return `Settled all ${steps.length} steps`;
  if (overall === 'in-progress') {
    const current = steps.find((step) => step.status === 'current');
    return current ? `Working on “${current.step_title}”` : 'Working through it';
  }
  if (overall === 'planned') {
    const planned = steps.find((step) => step.status === 'planned');
    return planned ? `Next up · ${planned.step_title}` : 'Steps planned, none started';
  }
  return 'Just subscribed — no steps adopted yet';
}

export function CoPractitionerList({ blueprintId }: { blueprintId: string }) {
  const { user } = useAuth();
  const { allInterests, currentInterest } = useInterest();
  const { data: blueprint } = useBlueprintWithAuthor(blueprintId);
  const fleetLabel = getVisibilityLabels(
    allInterests.find((i) => i.id === (blueprint as { interest_id?: string } | null)?.interest_id)
      ?.slug ?? currentInterest?.slug,
  ).fleet.toLowerCase();
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
        <Pressable
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace(`/(tabs)/library/blueprints/${blueprintId}` as never)
          }
          accessibilityRole="button"
          accessibilityLabel="Back to Blueprint"
          hitSlop={8}
          style={styles.backLink}
        >
          <Ionicons name="chevron-back" size={18} color="#007AFF" />
          <Text style={styles.backText}>Blueprint</Text>
        </Pressable>
        <Text style={styles.eyebrow}>Co-practitioners</Text>
        <Text style={styles.title}>{blueprint?.title ?? 'Blueprint'}</Text>
        <Text style={styles.subtitle}>
          {counts.all === 0
            ? "You're the only one on this path so far."
            : `${counts.all} other ${counts.all === 1 ? 'practitioner' : 'practitioners'}${
                counts.settled > 0 ? ` · ${counts.settled} settled` : ''
              }`}
        </Text>
      </View>

      <FilterStrip
        options={[
          { key: 'all', label: `All ${counts.all}` },
          { key: 'fleet', label: `In your ${fleetLabel} ${counts.fleet}` },
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
              ? `No co-practitioners from your ${fleetLabel} yet.`
              : filter === 'in-progress'
                ? "Nobody's actively working through this right now."
                : filter === 'settled'
                  ? "Nobody's settled every step yet."
                  : "No other practitioners on this Blueprint yet — you're early."}
          </Text>
        ) : (
          visiblePeers.map(({ subscriber, steps, inFleet, overall }) => {
            const tags = tagsForPeer(steps);
            const activity = peerActivityLine({ steps, overall });
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
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {subscriber.subscriber_name ?? 'Practitioner'}
                    </Text>
                    {inFleet ? (
                      <View style={styles.fleetPill}>
                        <Ionicons name="people" size={10} color="#4338CA" />
                        <Text style={styles.fleetPillText}>Fleet</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.activity} numberOfLines={1}>
                    {activity}
                  </Text>
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
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
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
    paddingTop: 12,
    paddingBottom: 8,
    gap: 4,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 4,
  },
  backText: {
    fontSize: 17,
    color: '#007AFF',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6D5EF7',
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 8,
  },
  empty: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 32,
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#4338CA',
    fontWeight: '700',
    fontSize: 13,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 0,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  fleetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0E7FF',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  fleetPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338CA',
    letterSpacing: 0.2,
  },
  activity: {
    fontSize: 13,
    color: '#4B5563',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    color: '#6B7280',
  },
});
