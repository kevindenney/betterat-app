/**
 * Subscriber Detail — Blueprint Progress
 *
 * Shows one subscriber's progress on a blueprint: adopted steps, stats,
 * review status, and ability to drill into each step.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  useBlueprintById,
  useBlueprintSubscriberProgress,
  useSubscriberAdoptedSteps,
} from '@/hooks/useBlueprint';
import { useAuth } from '@/providers/AuthProvider';
import { NotificationService } from '@/services/NotificationService';
import { SuggestStepSheet } from '@/components/creator/SuggestStepSheet';
import type { SubscriberProgress, SubscriberStepProgress } from '@/types/blueprint';
import type { SubscriberAdoptedStep } from '@/services/BlueprintService';

// ---------------------------------------------------------------------------
// Design tokens (shared with app/creator/[id].tsx)
// ---------------------------------------------------------------------------

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
  purple: '#7C3AED',
  purpleBg: '#F3E8FF',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

type FilterKey = 'all' | 'needs_review' | 'completed' | 'in_progress';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_review', label: 'Needs Review' },
  { key: 'completed', label: 'Completed' },
  { key: 'in_progress', label: 'In Progress' },
];

function getStatusPill(action: SubscriberStepProgress['action'], status: string) {
  if (action === 'dismissed') return { label: 'Dismissed', bg: C.grayBg, color: C.gray };
  if (action === 'adopted') {
    if (status === 'completed' || status === 'done')
      return { label: 'Completed', bg: C.greenBg, color: C.green };
    if (status === 'in_progress')
      return { label: 'In Progress', bg: C.blueBg, color: C.blue };
    return { label: 'Adopted', bg: C.accentBg, color: C.accent };
  }
  return { label: 'Seen', bg: C.orangeBg, color: C.orange };
}

function isNeedsReview(step: SubscriberAdoptedStep): boolean {
  return (
    step.step.status === 'completed' &&
    !step.step.metadata?.review?.instructor_review_status
  );
}

function renderStars(rating: number) {
  const stars: React.ReactNode[] = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Ionicons
        key={i}
        name={i <= rating ? 'star' : 'star-outline'}
        size={12}
        color={i <= rating ? '#F59E0B' : C.labelLight}
      />,
    );
  }
  return stars;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SubscriberDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { subscriberId, blueprintId } = useLocalSearchParams<{
    subscriberId: string;
    blueprintId: string;
  }>();

  const {
    data: blueprint,
    isLoading: bpLoading,
    refetch: refetchBp,
  } = useBlueprintById(blueprintId);

  const {
    data: subscriberProgress,
    isLoading: progressLoading,
    refetch: refetchProgress,
  } = useBlueprintSubscriberProgress(blueprintId);

  const {
    data: adoptedSteps,
    isLoading: stepsLoading,
    refetch: refetchSteps,
  } = useSubscriberAdoptedSteps(blueprintId, subscriberId);

  const {
    data: sentSuggestions,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ['sent-suggestions', user?.id, subscriberId],
    queryFn: () => NotificationService.getSentSuggestions(user!.id, subscriberId!),
    enabled: !!user?.id && !!subscriberId,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showSuggest, setShowSuggest] = useState(false);

  // Find this subscriber's progress summary
  const subscriber = useMemo<SubscriberProgress | undefined>(
    () => subscriberProgress?.find((s) => s.subscriber_id === subscriberId),
    [subscriberProgress, subscriberId],
  );

  // Compute stats
  const stats = useMemo(() => {
    const adopted = adoptedSteps?.length ?? 0;
    const completed =
      adoptedSteps?.filter(
        (s) => s.step.status === 'completed' || s.step.status === 'done',
      ).length ?? 0;
    const needsReview = adoptedSteps?.filter(isNeedsReview).length ?? 0;
    const dismissed = subscriber?.dismissed_count ?? 0;
    return { adopted, completed, needsReview, dismissed };
  }, [adoptedSteps, subscriber]);

  // Filter steps
  const filteredSteps = useMemo(() => {
    if (!adoptedSteps) return [];
    switch (filter) {
      case 'needs_review':
        return adoptedSteps.filter(isNeedsReview);
      case 'completed':
        return adoptedSteps.filter(
          (s) => s.step.status === 'completed' || s.step.status === 'done',
        );
      case 'in_progress':
        return adoptedSteps.filter((s) => s.step.status === 'in_progress');
      default:
        return adoptedSteps;
    }
  }, [adoptedSteps, filter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBp(), refetchProgress(), refetchSteps(), refetchSuggestions()]);
    setRefreshing(false);
  }, [refetchBp, refetchProgress, refetchSteps, refetchSuggestions]);

  const isLoading = bpLoading || progressLoading || (stepsLoading && !adoptedSteps);

  // ---------------------------------------------------------------------------
  // Loading / empty states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>Loading subscriber...</Text>
      </View>
    );
  }

  if (!subscriber) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="person-outline" size={40} color={C.labelLight} />
        <Text style={styles.emptyTitle}>Subscriber not found</Text>
        <Text style={styles.emptySubtitle}>
          This person may have unsubscribed from the blueprint.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const subscriberName = subscriber.name || 'Anonymous';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={C.labelDark} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {subscriberName}
            </Text>
            {blueprint && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {blueprint.title}
              </Text>
            )}
          </View>
          {/* Spacer to balance the back button */}
          <View style={{ width: 22 }} />
        </View>

        {/* Stats Row */}
        <View style={styles.statsGrid}>
          <StatCard value={stats.adopted} label="Adopted" color={C.accent} />
          <StatCard value={stats.completed} label="Completed" color={C.green} />
          <StatCard value={stats.needsReview} label="Needs Review" color={C.orange} />
          <StatCard value={stats.dismissed} label="Dismissed" color={C.gray} />
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    active && styles.filterPillTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Step List */}
        <View style={styles.section}>
          {stepsLoading ? (
            <ActivityIndicator
              size="small"
              color={C.accent}
              style={{ paddingVertical: 20 }}
            />
          ) : filteredSteps.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={36} color={C.labelLight} />
              <Text style={styles.emptyTitle}>
                {filter === 'all' ? 'No adopted steps yet' : `No ${FILTERS.find((f) => f.key === filter)?.label?.toLowerCase()} steps`}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'all'
                  ? 'This subscriber hasn\'t adopted any steps from the blueprint yet.'
                  : 'Try a different filter to see other steps.'}
              </Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              {filteredSteps.map((adoptedStep, idx) => {
                const step = adoptedStep.step;
                const review = step.metadata?.review;
                const rating = review?.overall_rating as number | undefined;
                const reviewStatus = review?.instructor_review_status as
                  | string
                  | undefined;

                // Determine status pill using the same logic as creator/[id]
                const stepStatus = step.status ?? 'not_started';
                const action: SubscriberStepProgress['action'] = 'adopted';
                const pill = getStatusPill(action, stepStatus);

                return (
                  <React.Fragment key={adoptedStep.adopted_step_id}>
                    {idx > 0 && <View style={styles.listDivider} />}
                    <Pressable
                      style={styles.stepItem}
                      onPress={() =>
                        router.push(
                          `/creator/subscriber-step/${adoptedStep.adopted_step_id}?blueprintId=${blueprintId}&subscriberId=${subscriberId}`,
                        )
                      }
                    >
                      {/* Step number */}
                      <Text style={styles.stepIndex}>
                        {adoptedStep.sort_order}
                      </Text>

                      {/* Title + meta */}
                      <View style={styles.stepContent}>
                        <Text style={styles.stepItemTitle} numberOfLines={1}>
                          {step.title}
                        </Text>

                        <View style={styles.stepMeta}>
                          {/* Status pill */}
                          <View
                            style={[
                              styles.statusPill,
                              { backgroundColor: pill.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                { color: pill.color },
                              ]}
                            >
                              {pill.label}
                            </Text>
                          </View>

                          {/* Rating stars */}
                          {typeof rating === 'number' && rating > 0 && (
                            <View style={styles.starsRow}>
                              {renderStars(rating)}
                            </View>
                          )}

                          {/* Review badge */}
                          {reviewStatus === 'approved' && (
                            <View
                              style={[
                                styles.reviewBadge,
                                { backgroundColor: C.greenBg },
                              ]}
                            >
                              <Ionicons
                                name="checkmark-circle"
                                size={11}
                                color={C.green}
                              />
                              <Text
                                style={[
                                  styles.reviewBadgeText,
                                  { color: C.green },
                                ]}
                              >
                                Approved
                              </Text>
                            </View>
                          )}
                          {reviewStatus === 'needs_revision' && (
                            <View
                              style={[
                                styles.reviewBadge,
                                { backgroundColor: C.orangeBg },
                              ]}
                            >
                              <Ionicons
                                name="alert-circle"
                                size={11}
                                color={C.orange}
                              />
                              <Text
                                style={[
                                  styles.reviewBadgeText,
                                  { color: C.orange },
                                ]}
                              >
                                Needs Revision
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Chevron */}
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={C.labelLight}
                      />
                    </Pressable>
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </View>

        {/* Suggestions Sent */}
        {sentSuggestions && sentSuggestions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.suggestionsSectionHeader}>
              <Ionicons name="bulb-outline" size={16} color={C.labelMid} />
              <Text style={styles.suggestionsSectionTitle}>Suggestions Sent</Text>
            </View>
            <View style={styles.listCard}>
              {sentSuggestions.map((suggestion, idx) => (
                <React.Fragment key={suggestion.id}>
                  {idx > 0 && <View style={styles.listDivider} />}
                  <View style={styles.suggestionItem}>
                    <Ionicons
                      name="send-outline"
                      size={14}
                      color={C.labelLight}
                    />
                    <View style={styles.suggestionContent}>
                      <Text style={styles.suggestionTitle} numberOfLines={1}>
                        {suggestion.stepTitle}
                      </Text>
                      <Text style={styles.suggestionDate}>
                        {formatRelativeDate(suggestion.createdAt)}
                      </Text>
                    </View>
                    <View style={[
                      styles.seenBadge,
                      { backgroundColor: suggestion.isRead ? C.greenBg : C.blueBg },
                    ]}>
                      <Ionicons
                        name={suggestion.isRead ? 'checkmark-circle' : 'ellipse'}
                        size={11}
                        color={suggestion.isRead ? C.green : C.blue}
                      />
                      <Text style={[
                        styles.seenBadgeText,
                        { color: suggestion.isRead ? C.green : C.blue },
                      ]}>
                        {suggestion.isRead ? 'Seen' : 'Sent'}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Suggest Step Button */}
      <View style={styles.bottomBar}>
        <Pressable
          style={styles.suggestBtn}
          onPress={() => setShowSuggest(true)}
        >
          <Ionicons name="bulb-outline" size={18} color="#FFFFFF" />
          <Text style={styles.suggestBtnText}>Suggest Step</Text>
        </Pressable>
      </View>

      {/* Suggest Step Sheet */}
      {blueprintId && subscriberId && (
        <SuggestStepSheet
          visible={showSuggest}
          onClose={() => setShowSuggest(false)}
          blueprintId={blueprintId}
          targetUserId={subscriberId}
          targetUserName={subscriberName}
          interestId={blueprint?.interest_id}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : undefined]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  flex1: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.select({ web: 20, default: 60 }),
    paddingBottom: 12,
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.labelDark,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: C.labelMid,
    textAlign: 'center',
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
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

  // Filter pills
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.grayBg,
  },
  filterPillActive: {
    backgroundColor: C.accent,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.labelMid,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Section
  section: {
    marginTop: 16,
    gap: 8,
  },

  // Step list
  listCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 42,
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
    gap: 4,
  },
  stepItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.labelDark,
  },
  stepMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
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
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 3,
  },
  reviewBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Empty state
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

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.select({ web: 12, default: 34 }),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    paddingVertical: 14,
    borderRadius: 12,
  },
  suggestBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Suggestions Sent
  suggestionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  suggestionsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  suggestionContent: {
    flex: 1,
    gap: 2,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: C.labelDark,
  },
  suggestionDate: {
    fontSize: 11,
    color: C.labelLight,
  },
  seenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 3,
  },
  seenBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
