/**
 * Blueprint Detail — Subscribers & Progress
 *
 * Shows subscriber list with per-subscriber step progress for a single blueprint.
 * Allows editing the blueprint and viewing individual subscriber engagement.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import {
  useBlueprintById,
  useBlueprintSteps,
  useBlueprintSubscriberProgress,
  useRemoveStepFromBlueprint,
} from '@/hooks/useBlueprint';
import { PublishBlueprintSheet } from '@/components/blueprint/PublishBlueprintSheet';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import type { SubscriberProgress, SubscriberStepProgress } from '@/types/blueprint';
import type { TimelineStepRecord } from '@/types/timeline-steps';

const C = {
  bg: '#FFFFFF',
  card: '#F8F7F6',
  accent: '#00897B',
  accentBg: 'rgba(0,137,123,0.08)',
  border: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  green: '#16A34A',
  greenBg: '#DCFCE7',
  blue: '#007AFF',
  blueBg: '#DBEAFE',
  orange: '#EA580C',
  orangeBg: '#FFF7ED',
  gray: '#6B7280',
  grayBg: '#F3F4F6',
} as const;

function getStatusPill(action: SubscriberStepProgress['action'], status: string) {
  if (action === 'dismissed') return { label: 'Dismissed', bg: C.grayBg, color: C.gray };
  if (action === 'adopted') {
    if (status === 'completed' || status === 'done') return { label: 'Completed', bg: C.greenBg, color: C.green };
    if (status === 'in_progress') return { label: 'In Progress', bg: C.blueBg, color: C.blue };
    return { label: 'Adopted', bg: C.accentBg, color: C.accent };
  }
  return { label: 'Seen', bg: C.orangeBg, color: C.orange };
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function relativeDate(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function BlueprintDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: _user } = useAuth();
  const { data: blueprint, isLoading: bpLoading, refetch: refetchBp } = useBlueprintById(id);
  const { data: blueprintSteps, isLoading: stepsLoading, refetch: refetchSteps } = useBlueprintSteps(id);
  const { data: subscriberProgress, isLoading: subLoading, refetch: refetchSubs } = useBlueprintSubscriberProgress(id);
  const removeStep = useRemoveStepFromBlueprint();

  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBp(), refetchSteps(), refetchSubs()]);
    setRefreshing(false);
  }, [refetchBp, refetchSteps, refetchSubs]);

  const handleRemoveStep = useCallback((step: TimelineStepRecord) => {
    if (!id) return;
    showConfirm(
      'Remove Step',
      `Remove "${step.title}" from this blueprint? Existing subscribers will keep their copies.`,
      () => removeStep.mutate({ blueprintId: id, stepId: step.id }),
    );
  }, [id, removeStep]);

  const stats = useMemo(() => {
    if (!subscriberProgress) return { subscribers: 0, adopted: 0, completed: 0, dismissed: 0 };
    return {
      subscribers: subscriberProgress.length,
      adopted: subscriberProgress.reduce((s, p) => s + p.adopted_count, 0),
      completed: subscriberProgress.reduce((s, p) => s + p.completed_count, 0),
      dismissed: subscriberProgress.reduce((s, p) => s + p.dismissed_count, 0),
    };
  }, [subscriberProgress]);

  const handleShare = useCallback(async () => {
    if (!blueprint) return;
    const url = `https://better.at/blueprint/${blueprint.slug}`;
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    } else {
      Share.share({ url, message: `Check out "${blueprint.title}" on BetterAt` });
    }
  }, [blueprint]);

  const isLoading = bpLoading || (stepsLoading && !blueprintSteps) || subLoading;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading blueprint...</Text>
      </View>
    );
  }

  if (!blueprint) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={40} color={C.labelLight} />
        <Text style={styles.emptyTitle}>Blueprint not found</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={C.labelDark} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{blueprint.title}</Text>
          <Pressable onPress={() => setShowEditSheet(true)} hitSlop={12}>
            <Ionicons name="create-outline" size={20} color={C.accent} />
          </Pressable>
        </View>

        {/* Blueprint info */}
        <View style={styles.infoRow}>
          <View style={[styles.accessBadge, blueprint.is_published ? styles.publishedBadge : styles.draftBadge]}>
            <Text style={[styles.accessBadgeText, blueprint.is_published ? styles.publishedText : styles.draftText]}>
              {blueprint.is_published ? 'Published' : 'Draft'}
            </Text>
          </View>
          <Text style={styles.infoDetail}>
            {blueprint.access_level === 'public' ? 'Free' :
             blueprint.access_level === 'org_members' ? 'Members Only' :
             blueprint.price_cents ? `$${(blueprint.price_cents / 100).toFixed(2)}${blueprint.pricing_type === 'recurring' ? '/mo' : ''}` : 'Paid'}
          </Text>
          <Pressable onPress={handleShare} hitSlop={8} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={16} color={C.accent} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard value={stats.subscribers} label="Subscribers" />
          <StatCard value={stats.adopted} label="Adopted" color={C.accent} />
          <StatCard value={stats.completed} label="Completed" color={C.green} />
          <StatCard value={stats.dismissed} label="Dismissed" color={C.gray} />
        </View>

        {/* Blueprint Steps */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Steps{blueprintSteps?.length ? ` (${blueprintSteps.length})` : ''}
            </Text>
            <Pressable
              onPress={() => setShowEditSheet(true)}
              hitSlop={8}
              style={styles.sectionAction}
            >
              <Ionicons name="pencil-outline" size={14} color={C.accent} />
              <Text style={styles.sectionActionText}>Edit Steps</Text>
            </Pressable>
          </View>
          {stepsLoading ? (
            <ActivityIndicator size="small" color={C.accent} style={{ paddingVertical: 20 }} />
          ) : !blueprintSteps || blueprintSteps.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={36} color={C.labelLight} />
              <Text style={styles.emptyTitle}>No steps yet</Text>
              <Text style={styles.emptySubtitle}>
                Add steps from your timeline, or tap "Edit Steps" to curate your blueprint.
              </Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              {blueprintSteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  {idx > 0 && <View style={styles.listDivider} />}
                  <BlueprintStepRow
                    step={step}
                    index={idx}
                    onRemove={() => handleRemoveStep(step)}
                  />
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Subscribers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscribers</Text>
          {(!subscriberProgress || subscriberProgress.length === 0) ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={36} color={C.labelLight} />
              <Text style={styles.emptyTitle}>No subscribers yet</Text>
              <Text style={styles.emptySubtitle}>Share your blueprint to get your first subscriber.</Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              {subscriberProgress.map((sub, idx) => (
                <React.Fragment key={sub.subscriber_id}>
                  {idx > 0 && <View style={styles.listDivider} />}
                  <SubscriberRow
                    subscriber={sub}
                    isExpanded={expandedId === sub.subscriber_id}
                    onToggle={() => setExpandedId(prev => prev === sub.subscriber_id ? null : sub.subscriber_id)}
                    onViewDetails={() => router.push(`/creator/subscriber/${sub.subscriber_id}?blueprintId=${id}` as any)}
                  />
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Blueprint Sheet */}
      {showEditSheet && (
        <PublishBlueprintSheet
          visible={showEditSheet}
          onClose={() => { setShowEditSheet(false); refetchBp(); refetchSteps(); }}
          interestId={blueprint.interest_id}
          interestName=""
          existingBlueprint={blueprint}
        />
      )}
    </>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SubscriberRow({
  subscriber,
  isExpanded,
  onToggle,
  onViewDetails,
}: {
  subscriber: SubscriberProgress;
  isExpanded: boolean;
  onToggle: () => void;
  onViewDetails: () => void;
}) {
  const name = subscriber.name || 'Anonymous';
  const initials = getInitials(name);
  const progressSummary = [
    subscriber.adopted_count > 0 && `${subscriber.adopted_count} adopted`,
    subscriber.completed_count > 0 && `${subscriber.completed_count} completed`,
    subscriber.dismissed_count > 0 && `${subscriber.dismissed_count} dismissed`,
  ].filter(Boolean).join(', ') || 'No activity yet';

  return (
    <View>
      <Pressable style={styles.subscriberItem} onPress={onToggle}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.subscriberContent}>
          <Text style={styles.subscriberName} numberOfLines={1}>{name}</Text>
          <Text style={styles.subscriberMeta} numberOfLines={1}>
            {relativeDate(subscriber.subscribed_at)} {'\u00B7'} {progressSummary}
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={C.labelLight}
        />
      </Pressable>

      {/* Expanded: per-step progress + view details link */}
      {isExpanded && subscriber.steps.length > 0 && (
        <View style={styles.stepsExpanded}>
          {subscriber.steps.map((step) => {
            const pill = getStatusPill(step.action, step.status);
            return (
              <View key={step.source_step_id} style={styles.stepRow}>
                <Text style={styles.stepTitle} numberOfLines={1}>{step.step_title}</Text>
                <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                  <Text style={[styles.statusPillText, { color: pill.color }]}>{pill.label}</Text>
                </View>
              </View>
            );
          })}
          <Pressable style={styles.viewDetailsBtn} onPress={onViewDetails}>
            <Text style={styles.viewDetailsBtnText}>View Details & Mentor</Text>
            <Ionicons name="arrow-forward" size={14} color={C.accent} />
          </Pressable>
        </View>
      )}
      {isExpanded && subscriber.steps.length === 0 && (
        <View style={styles.stepsExpanded}>
          <Text style={styles.noStepsText}>No step activity recorded</Text>
        </View>
      )}
    </View>
  );
}

function BlueprintStepRow({
  step,
  index,
  onRemove,
}: {
  step: TimelineStepRecord;
  index: number;
  onRemove: () => void;
}) {
  const categoryIcon =
    step.category === 'learn' ? 'book-outline' :
    step.category === 'practice' ? 'fitness-outline' :
    step.category === 'reflect' ? 'chatbubble-ellipses-outline' :
    'document-text-outline';

  return (
    <View style={styles.stepItem}>
      <Text style={styles.stepIndex}>{index + 1}</Text>
      <Ionicons name={categoryIcon as any} size={18} color={C.labelMid} />
      <View style={styles.stepContent}>
        <Text style={styles.stepItemTitle} numberOfLines={1}>{step.title}</Text>
        {!!step.description && (
          <Text style={styles.stepItemDesc} numberOfLines={1}>{step.description}</Text>
        )}
      </View>
      <Pressable onPress={onRemove} hitSlop={10} style={styles.removeBtn}>
        <Ionicons name="close-circle" size={20} color={C.labelLight} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: C.labelMid,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: C.labelDark,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
  },
  accessBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  publishedBadge: { backgroundColor: C.greenBg },
  draftBadge: { backgroundColor: C.grayBg },
  accessBadgeText: { fontSize: 11, fontWeight: '600' },
  publishedText: { color: C.green },
  draftText: { color: C.gray },
  infoDetail: {
    fontSize: 13,
    color: C.labelMid,
    flex: 1,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '47%',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: C.labelDark,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  section: {
    marginTop: 24,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.labelDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  stepIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: C.labelLight,
    width: 18,
    textAlign: 'center',
  },
  stepContent: {
    flex: 1,
    gap: 1,
  },
  stepItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.labelDark,
  },
  stepItemDesc: {
    fontSize: 12,
    color: C.labelMid,
  },
  removeBtn: {
    padding: 4,
  },
  listCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 56,
  },
  subscriberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.accent,
  },
  subscriberContent: {
    flex: 1,
    gap: 2,
  },
  subscriberName: {
    fontSize: 15,
    fontWeight: '600',
    color: C.labelDark,
  },
  subscriberMeta: {
    fontSize: 12,
    color: C.labelMid,
  },
  stepsExpanded: {
    paddingLeft: 62,
    paddingRight: 14,
    paddingBottom: 12,
    gap: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepTitle: {
    flex: 1,
    fontSize: 13,
    color: C.labelDark,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  noStepsText: {
    fontSize: 12,
    color: C.labelLight,
    fontStyle: 'italic',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  viewDetailsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.labelDark,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.labelMid,
    textAlign: 'center',
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
