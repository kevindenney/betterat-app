/**
 * BlueprintProgressStrip — Renders BELOW the user's timeline grid.
 * Shows one section per subscribed blueprint, each containing:
 *   1. Blueprint header with title + progress + overflow menu
 *   2. Horizontal scroll of the blueprint's curated steps (with adopt/added status)
 *   3. Peer followers on that blueprint (reuses PeerMiniTimeline pattern)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  useSubscribedBlueprints,
  useSuggestedNextSteps,
  useBlueprintSteps,
  useUnsubscribe,
  useAdoptBlueprintStep,
} from '@/hooks/useBlueprint';
import { usePeerTimelines, type PeerBlueprintGroup } from '@/hooks/usePeerTimelines';
import { useAuth } from '@/providers/AuthProvider';
import { adoptStep } from '@/services/TimelineStepService';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { SuggestedStepsBar } from './SuggestedStepsBar';
import { fontFamily } from '@/lib/design-tokens-editorial';
import type { BlueprintSuggestedNextStep, SubscribedBlueprintInfo, PeerTimeline, PeerTimelineStep } from '@/types/blueprint';
import type { TimelineStepRecord } from '@/types/timeline-steps';

// =============================================================================
// PERSISTENCE HELPERS
// =============================================================================

const COLLAPSED_KEY = 'blueprint_collapsed_sections';
const PINNED_PEERS_KEY = 'blueprint_pinned_peers';

function usePersistedSet(storageKey: string) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (raw) {
        try { setIds(new Set(JSON.parse(raw))); } catch {}
      }
      setLoaded(true);
    });
  }, [storageKey]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }, [storageKey]);

  return { ids, toggle, loaded };
}

// =============================================================================
// COLORS
// =============================================================================

const C = {
  bg: 'rgba(255,255,255,0.96)',
  border: '#E5E4E1',
  accent: '#007AFF',
  accentBg: 'rgba(37,99,235,0.06)',
  accentLight: '#DBEAFE',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  completed: '#16A34A',
  completedBg: 'rgba(22,163,74,0.08)',
  inProgress: '#0D9488',
  pending: '#D4D4D4',
} as const;

// =============================================================================
// PROPS
// =============================================================================

interface BlueprintProgressStripProps {
  interestId?: string | null;
  /** User's adopted timeline steps — used to detect which blueprint steps are already adopted */
  mySteps?: TimelineStepRecord[] | null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BlueprintProgressStrip({
  interestId,
  mySteps,
}: BlueprintProgressStripProps) {
  const { data: subscribed } = useSubscribedBlueprints(interestId);
  const { data: suggestedNext } = useSuggestedNextSteps(interestId);
  const { groups: peerGroups } = usePeerTimelines(interestId);

  // Build a set of source step IDs that the user has already adopted
  const adoptedSourceIds = useMemo(() => {
    const set = new Set<string>();
    (mySteps ?? []).forEach((s: any) => {
      if (s.source_id) set.add(s.source_id);
    });
    return set;
  }, [mySteps]);

  // Map progress by blueprint_id
  const progressMap = useMemo(() => {
    const m = new Map<string, BlueprintSuggestedNextStep>();
    (suggestedNext ?? []).forEach((s) => m.set(s.blueprint_id, s));
    return m;
  }, [suggestedNext]);

  // Map peer groups by blueprint_id
  const peerMap = useMemo(() => {
    const m = new Map<string, PeerBlueprintGroup>();
    peerGroups.forEach((g) => m.set(g.blueprintId, g));
    return m;
  }, [peerGroups]);

  const hasBlueprints = Boolean(subscribed?.length);

  const { ids: collapsedIds, toggle: toggleCollapsed } = usePersistedSet(COLLAPSED_KEY);
  const { ids: pinnedPeerIds, toggle: togglePinned } = usePersistedSet(PINNED_PEERS_KEY);

  return (
    <View>
      {/* Mentor-suggested steps bar — always shown if suggestions exist */}
      <SuggestedStepsBar interestId={interestId} />

      {/* Blueprint sections */}
      {hasBlueprints && subscribed!.map((bp) => (
        <BlueprintSection
          key={bp.subscription_id}
          blueprint={bp}
          progress={progressMap.get(bp.blueprint_id)}
          peerGroup={peerMap.get(bp.blueprint_id)}
          adoptedSourceIds={adoptedSourceIds}
          interestId={interestId}
          isCollapsed={collapsedIds.has(bp.blueprint_id)}
          onToggleCollapse={() => toggleCollapsed(bp.blueprint_id)}
          pinnedPeerIds={pinnedPeerIds}
          onTogglePinPeer={togglePinned}
        />
      ))}
    </View>
  );
}

// =============================================================================
// BLUEPRINT SECTION
// =============================================================================

function BlueprintSection({
  blueprint,
  progress,
  peerGroup,
  adoptedSourceIds,
  interestId,
  isCollapsed,
  onToggleCollapse,
  pinnedPeerIds,
  onTogglePinPeer,
}: {
  blueprint: SubscribedBlueprintInfo;
  progress?: BlueprintSuggestedNextStep;
  peerGroup?: PeerBlueprintGroup;
  adoptedSourceIds: Set<string>;
  interestId?: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pinnedPeerIds: Set<string>;
  onTogglePinPeer: (id: string) => void;
}) {
  const router = useRouter();
  const unsubscribeMutation = useUnsubscribe();
  const adoptMutation = useAdoptBlueprintStep();
  const { data: steps } = useBlueprintSteps(blueprint.blueprint_id);
  const [adoptingStepId, setAdoptingStepId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [localAdoptedIds, setLocalAdoptedIds] = useState<Set<string>>(new Set());

  const adoptedCount = progress?.adopted_count ?? 0;
  const totalSteps = progress?.total_steps ?? steps?.length ?? 0;

  const handleAdopt = useCallback(
    async (stepId: string) => {
      setAdoptingStepId(stepId);
      try {
        await adoptMutation.mutateAsync({
          sourceStepId: stepId,
          interestId: interestId ?? '',
          subscriptionId: blueprint.subscription_id,
          blueprintId: blueprint.blueprint_id,
        });
        setLocalAdoptedIds((prev) => new Set(prev).add(stepId));
      } finally {
        setAdoptingStepId(null);
      }
    },
    [adoptMutation, interestId, blueprint.subscription_id, blueprint.blueprint_id],
  );

  const handleUnsubscribe = useCallback(() => {
    showConfirm(
      'Unsubscribe',
      `Stop following "${blueprint.blueprint_title}"?`,
      () => unsubscribeMutation.mutateAsync(blueprint.blueprint_id),
    );
  }, [unsubscribeMutation, blueprint.blueprint_id, blueprint.blueprint_title]);

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Pressable style={styles.collapseBtn} onPress={onToggleCollapse}>
          <Ionicons
            name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
            size={14}
            color={C.labelMid}
          />
        </Pressable>
        <Pressable
          style={styles.headerLeft}
          onPress={() => router.push(`/blueprint/${blueprint.blueprint_slug}` as any)}
        >
          <Ionicons name="layers-outline" size={14} color={C.accent} />
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {blueprint.blueprint_title}
          </Text>
        </Pressable>
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>
            {adoptedCount}/{totalSteps}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable
          style={styles.overflowBtn}
          onPress={() => setShowMenu((v) => !v)}
        >
          <Ionicons name="ellipsis-horizontal" size={14} color={C.labelLight} />
        </Pressable>
      </View>

      {/* Overflow menu */}
      {showMenu && (
        <View style={styles.menuContainer}>
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                router.push(`/blueprint/${blueprint.blueprint_slug}` as any);
              }}
            >
              <Ionicons name="open-outline" size={14} color={C.labelDark} />
              <Text style={styles.menuItemText}>View Blueprint</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                handleUnsubscribe();
              }}
            >
              <Ionicons name="close-circle-outline" size={14} color={C.labelMid} />
              <Text style={[styles.menuItemText, { color: C.labelMid }]}>Unsubscribe</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Collapsible body */}
      {!isCollapsed && (
        <>
          {/* Blueprint step cards */}
          {steps && steps.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.stepScroll}
            >
              {steps.map((step) => {
                const isAdopted = adoptedSourceIds.has(step.id) || localAdoptedIds.has(step.id);
                const isAdopting = adoptingStepId === step.id;

                return (
                  <View key={step.id} style={styles.stepCard}>
                    <View style={[
                      styles.stepBadge,
                      { backgroundColor: isAdopted ? C.completedBg : C.accentBg },
                    ]}>
                      <View style={[
                        styles.stepDot,
                        { backgroundColor: isAdopted ? C.completed : C.accent },
                      ]} />
                      <Text style={[
                        styles.stepBadgeText,
                        { color: isAdopted ? C.completed : C.accent },
                      ]}>
                        {isAdopted ? 'Added' : 'Available'}
                      </Text>
                    </View>
                    <Text style={styles.stepTitle} numberOfLines={2}>
                      {(step as any).title}
                    </Text>
                    <View style={styles.cardActionRow}>
                      {isAdopted ? (
                        <View style={styles.adoptedLabel}>
                          <Ionicons name="checkmark-circle" size={12} color={C.completed} />
                          <Text style={[styles.actionText, { color: C.completed }]}>Added</Text>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.adoptBtn}
                          onPress={() => handleAdopt(step.id)}
                          disabled={isAdopting}
                        >
                          {isAdopting ? (
                            <ActivityIndicator size={10} color={C.accent} />
                          ) : (
                            <>
                              <Ionicons name="add-circle-outline" size={12} color={C.accent} />
                              <Text style={[styles.actionText, { color: C.accent }]}>Adopt</Text>
                            </>
                          )}
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Peer timelines for this blueprint */}
          {peerGroup && peerGroup.peers.length > 0 && (
            <PeerSection
              peerGroup={peerGroup}
              interestId={interestId}
              pinnedPeerIds={pinnedPeerIds}
              onTogglePinPeer={onTogglePinPeer}
            />
          )}
        </>
      )}
    </View>
  );
}

// =============================================================================
// PEER SECTION — collapsible + filterable by pinned peers
// =============================================================================

function PeerSection({
  peerGroup,
  interestId,
  pinnedPeerIds,
  onTogglePinPeer,
}: {
  peerGroup: PeerBlueprintGroup;
  interestId?: string | null;
  pinnedPeerIds: Set<string>;
  onTogglePinPeer: (id: string) => void;
}) {
  const [peersCollapsed, setPeersCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const hasPinned = peerGroup.peers.some((p) => pinnedPeerIds.has(p.subscriber_id));

  // If any peers are pinned, default to showing only pinned unless "Show all" is toggled
  const visiblePeers = useMemo(() => {
    if (!hasPinned || showAll) return peerGroup.peers;
    return peerGroup.peers.filter((p) => pinnedPeerIds.has(p.subscriber_id));
  }, [peerGroup.peers, pinnedPeerIds, hasPinned, showAll]);

  const hiddenCount = peerGroup.peers.length - visiblePeers.length;

  return (
    <View style={styles.peerSection}>
      <Pressable
        style={styles.peerSectionHeader}
        onPress={() => setPeersCollapsed((v) => !v)}
      >
        <Ionicons
          name={peersCollapsed ? 'chevron-forward' : 'chevron-down'}
          size={11}
          color={C.labelMid}
        />
        <Ionicons name="people-outline" size={11} color={C.labelMid} />
        <Text style={styles.peerSectionTitle}>
          {peerGroup.peers.length} peer{peerGroup.peers.length !== 1 ? 's' : ''} following
        </Text>
        {hasPinned && !peersCollapsed && (
          <Pressable
            style={styles.filterToggle}
            onPress={(e) => {
              e.stopPropagation?.();
              setShowAll((v) => !v);
            }}
          >
            <Ionicons
              name={showAll ? 'funnel' : 'funnel-outline'}
              size={10}
              color={C.accent}
            />
            <Text style={styles.filterToggleText}>
              {showAll ? 'Pinned only' : 'Show all'}
            </Text>
          </Pressable>
        )}
      </Pressable>

      {!peersCollapsed && (
        <>
          {visiblePeers.map((peer) => (
            <PeerMiniTimeline
              key={peer.subscriber_id}
              peer={peer}
              interestId={interestId}
              isPinned={pinnedPeerIds.has(peer.subscriber_id)}
              onTogglePin={() => onTogglePinPeer(peer.subscriber_id)}
            />
          ))}
          {hiddenCount > 0 && !showAll && (
            <Pressable
              style={styles.showMoreBtn}
              onPress={() => setShowAll(true)}
            >
              <Text style={styles.showMoreText}>
                + {hiddenCount} more peer{hiddenCount !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

// =============================================================================
// PEER MINI TIMELINE (reused from PeerTimelinesFooter pattern)
// =============================================================================

function PeerMiniTimeline({
  peer,
  interestId,
  isPinned,
  onTogglePin,
}: {
  peer: PeerTimeline;
  interestId?: string | null;
  isPinned: boolean;
  onTogglePin: () => void;
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
    ? peer.subscriber_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <View style={styles.peerBlock}>
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
        <Pressable
          style={styles.pinBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            onTogglePin();
          }}
          hitSlop={8}
        >
          <Ionicons
            name={isPinned ? 'star' : 'star-outline'}
            size={12}
            color={isPinned ? '#EAB308' : C.labelLight}
          />
        </Pressable>
        <Text style={styles.fraction}>
          {peer.completed_count}/{peer.total_count}
        </Text>
        <Ionicons name="chevron-forward" size={12} color={C.labelLight} />
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stepScroll}
      >
        {peer.steps.map((step) => {
          const statusColor =
            step.status === 'completed' ? C.completed
              : step.status === 'in_progress' ? C.inProgress
                : C.pending;
          const statusLabel =
            step.status === 'completed' ? 'Done'
              : step.status === 'in_progress' ? 'Active'
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
                      <ActivityIndicator size={10} color={C.accent} />
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={12} color={C.accent} />
                        <Text style={[styles.actionText, { color: C.accent }]}>Adopt</Text>
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
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  collapseBtn: {
    padding: 2,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
    flexShrink: 1,
  },
  progressBadge: {
    backgroundColor: C.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  progressText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: C.accent,
  },
  overflowBtn: {
    padding: 6,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  menuContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 4,
    alignSelf: 'flex-end',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' as any },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.labelDark,
  },
  // -- Step cards --
  stepScroll: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
    paddingBottom: 4,
  },
  stepCard: {
    width: 160,
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
    fontFamily: fontFamily.mono,
    fontSize: 9,
    fontWeight: '500',
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
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
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
  // -- Peer section --
  peerSection: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  peerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: C.accentBg,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  filterToggleText: {
    fontSize: 9,
    fontWeight: '600',
    color: C.accent,
  },
  showMoreBtn: {
    paddingVertical: 6,
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  showMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.accent,
  },
  pinBtn: {
    padding: 2,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  peerSectionTitle: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  peerBlock: {
    marginBottom: 8,
  },
  peerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E4E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 9,
    fontWeight: '600',
    color: C.labelDark,
  },
  peerName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: C.labelDark,
  },
  fraction: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: C.labelMid,
  },
});
