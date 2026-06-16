/**
 * PeerTimelinesFooter — Rendered below the user's timeline grid.
 * Shows mini timelines of peer blueprint subscribers.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { usePeerTimelines, type PeerBlueprintGroup } from '@/hooks/usePeerTimelines';
import { useAuth } from '@/providers/AuthProvider';
import { adoptStep } from '@/services/TimelineStepService';
import type { PeerTimeline, PeerTimelineStep } from '@/types/blueprint';

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'rgba(255,255,255,0.96)',
  border: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  completed: '#16A34A',
  inProgress: '#0D9488',
  pending: '#D4D4D4',
  sectionAccent: '#007AFF',
  adopt: '#007AFF',
} as const;

// =============================================================================
// PROPS
// =============================================================================

interface PeerTimelinesFooterProps {
  interestId?: string | null;
  interestSlug?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  hasOrg: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PeerTimelinesFooter({
  interestId,
}: PeerTimelinesFooterProps) {
  const { groups } = usePeerTimelines(interestId);

  if (groups.length === 0) return null;

  return (
    <View>
      {groups.map((group) => (
        <PeerBlueprintSection
          key={group.blueprintId}
          group={group}
          interestId={interestId}
        />
      ))}
    </View>
  );
}

// =============================================================================
// PEER BLUEPRINT SECTION
// =============================================================================

function PeerBlueprintSection({
  group,
  interestId,
}: {
  group: PeerBlueprintGroup;
  interestId?: string | null;
}) {
  const router = useRouter();

  if (group.peers.length === 0) return null;

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.sectionHeader}
        onPress={() => router.push(`/blueprint/${group.blueprintSlug}` as any)}
      >
        <Ionicons name="people-outline" size={12} color={C.sectionAccent} />
        <Text style={styles.sectionTitle}>Peers on {group.blueprintTitle}</Text>
        <Text style={styles.sectionCount}>{group.peers.length}</Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={12} color={C.labelLight} />
      </Pressable>
      {group.peers.map((peer) => (
        <PeerMiniTimeline
          key={peer.subscriber_id}
          peer={peer}
          interestId={interestId}
        />
      ))}
    </View>
  );
}

// =============================================================================
// PEER MINI TIMELINE ROW
// =============================================================================

function PeerMiniTimeline({
  peer,
  interestId,
}: {
  peer: PeerTimeline;
  interestId?: string | null;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [adoptedIds, setAdoptedIds] = useState<Set<string>>(new Set());

  const handleAdopt = useCallback(async (step: PeerTimelineStep) => {
    if (!user?.id || !interestId) return;
    setAdoptingId(step.id);
    try {
      await adoptStep(user.id, step.id, interestId);
      setAdoptedIds((prev) => new Set(prev).add(step.id));
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
    } finally {
      setAdoptingId(null);
    }
  }, [user?.id, interestId, queryClient]);

  const initials = peer.subscriber_name
    ? peer.subscriber_name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  return (
    <View style={styles.peerBlock}>
      {/* Peer header row */}
      <Pressable
        style={styles.peerHeader}
        onPress={() => router.push(`/person/${peer.subscriber_id}` as any)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {peer.subscriber_avatar_emoji || initials}
          </Text>
        </View>
        <Text style={styles.peerName} numberOfLines={1}>
          {peer.subscriber_name ?? 'Anonymous'}
        </Text>
        <Text style={styles.fraction}>
          {peer.completed_count}/{peer.total_count}
        </Text>
        <Ionicons name="chevron-forward" size={12} color={C.labelLight} />
      </Pressable>

      {/* Step cards — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stepScroll}
      >
        {peer.steps.map((step) => {
          const statusColor =
            step.status === 'completed'
              ? C.completed
              : step.status === 'in_progress'
                ? C.inProgress
                : C.pending;
          const statusLabel =
            step.status === 'completed'
              ? 'Done'
              : step.status === 'in_progress'
                ? 'Active'
                : 'Planned';
          const isAdopted = adoptedIds.has(step.id);
          const isAdopting = adoptingId === step.id;

          return (
            <View key={step.id} style={styles.stepCard}>
              <View style={[styles.stepBadge, { backgroundColor: statusColor + '18' }]}>
                <View style={[styles.stepDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.stepBadgeText, { color: statusColor }]}>
                  {statusLabel}
                </Text>
              </View>
              <Text style={styles.stepTitle} numberOfLines={2}>
                {step.title}
              </Text>
              {/* Adopt action */}
              <View style={styles.cardActionRow}>
                {isAdopted ? (
                  <View style={styles.adoptedLabel}>
                    <Ionicons name="checkmark-circle" size={12} color={C.completed} />
                    <Text style={[styles.actionText, { color: C.completed }]}>Added</Text>
                  </View>
                ) : (
                  <Pressable
                    style={styles.adoptBtn}
                    onPress={() => handleAdopt(step)}
                    disabled={isAdopting}
                  >
                    {isAdopting ? (
                      <ActivityIndicator size={10} color={C.adopt} />
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={12} color={C.adopt} />
                        <Text style={[styles.actionText, { color: C.adopt }]}>Adopt</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  section: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.sectionAccent,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: '600',
    color: C.labelLight,
  },
  peerBlock: {
    marginBottom: 10,
  },
  peerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E4E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.labelDark,
  },
  peerName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: C.labelDark,
  },
  fraction: {
    fontSize: 11,
    fontWeight: '500',
    color: C.labelMid,
  },
  stepScroll: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
    paddingBottom: 4,
  },
  stepCard: {
    width: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 8,
    marginLeft: 8,
  },
  stepBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  stepDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: C.labelDark,
    lineHeight: 16,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 4,
  },
  cardActionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    marginTop: 2,
  },
  adoptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  adoptedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
