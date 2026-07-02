/**
 * Creator Studio · Subscribers (the roster)
 *
 * The people subscribed to the blueprints this author owns. Each row is one
 * person, showing the blueprints they're on, trial vs active state, and when
 * they joined. Sourced from useStudioSubscribers (studio_author_subscribers
 * RPC). The list is the page — no card chrome, no second column.
 *
 *   StudioShell
 *     ├── sidebar (Blueprints / Subscribers* / Threads / …)
 *     └── main
 *           ├── StudioHeader ("Subscribers", N people · M trialing)
 *           └── subscriber list (full width)
 */

import React from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useProfileMenuData } from '@/hooks/useProfileMenuData';
import { useStudioHomeData } from '@/hooks/useStudioHomeData';
import {
  useStudioSubscribers,
  useStudioSubscriberSteps,
  type StudioSubscriber,
  type StudioSubscriberPlan,
  type StudioSubscriberStep,
} from '@/hooks/useStudioSubscribers';
import {
  StudioShell,
  StudioHeader,
  StudioNavSection,
  STUDIO_COMPACT_BREAKPOINT,
} from '@/components/studio/StudioShell';
import { StudioLoading } from '@/components/studio/StudioLoading';
import { SuggestStepSheet } from '@/components/creator/SuggestStepSheet';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { fontFamily } from '@/lib/design-tokens-editorial';

export default function StudioSubscribersPage() {
  const router = useRouter();
  const { user, userProfile, signOut } = useAuth();
  const menu = useProfileMenuData();
  const home = useStudioHomeData();
  const data = useStudioSubscribers();
  const { width } = useWindowDimensions();
  const compact = width < STUDIO_COMPACT_BREAKPOINT;

  if (!user || menu.loading) {
    return <StudioLoading />;
  }

  const displayName =
    userProfile?.full_name || userProfile?.display_name || user?.email || 'You';
  const initials = getInitials(displayName);
  const activeOrg = menu.activeOrg;
  const isInstitutional = !!activeOrg;

  const navSections: StudioNavSection[] = [
    {
      eyebrow: 'Studio',
      items: [
        {
          key: 'blueprints',
          icon: 'git-branch-outline',
          label: 'Blueprints',
          count: home.blueprintCount || undefined,
          onPress: () => router.push('/studio'),
        },
        {
          key: 'subscribers',
          icon: 'people-outline',
          label: 'Subscribers',
          count: data.totalSubscribers || undefined,
          active: true,
        },
        {
          key: 'threads',
          icon: 'chatbubbles-outline',
          label: 'Threads',
          count: home.threadAwaitingCount || undefined,
          countTone: home.threadAwaitingCount > 0 ? 'coral' : 'neutral',
          onPress: () => router.push('/studio/threads'),
        },
      ],
    },
    {
      eyebrow: 'Money',
      items: [
        {
          key: 'payouts',
          icon: 'cash-outline',
          label: 'Payouts',
          count: isInstitutional ? '—' : undefined,
          onPress: () => router.push('/studio/payouts'),
        },
      ],
    },
    {
      eyebrow: 'Co-authors',
      items: [
        { key: 'co-you', icon: 'person-circle-outline', label: 'You' },
        { key: 'co-invite', icon: 'add', label: 'Invite co-author', cta: true },
      ],
    },
  ];

  const statLine =
    data.totalSubscribers === 0
      ? 'No subscribers yet'
      : `${data.totalSubscribers} ${data.totalSubscribers === 1 ? 'person' : 'people'}` +
        (data.trialingCount > 0 ? ` · ${data.trialingCount} trialing` : '');
  const subtitleParts: React.ReactNode[] = [
    <Text style={styles.subText} key="stat">
      {statLine}
    </Text>,
  ];

  const listBody = data.loading ? (
    <View style={styles.loadingWrap}>
      <Text style={styles.loadingText}>Loading subscribers…</Text>
    </View>
  ) : data.subscribers.length === 0 ? (
    <SubscribersEmptyState />
  ) : (
    <>
      {data.subscribers.map((sub) => (
        <SubscriberRow key={sub.userId} sub={sub} />
      ))}
    </>
  );

  const body = (
    <>
      <StudioHeader
        compact={compact}
        crumbs={['Creator Studio', 'Subscribers']}
        title="Subscribers"
        subtitleParts={subtitleParts}
        pill={
          isInstitutional
            ? { label: `${activeOrg!.org_name.split(' · ')[0]}-managed`, tone: 'purple' }
            : undefined
        }
      />

      <View style={styles.listWrap}>
        {compact ? listBody : <ScrollView showsVerticalScrollIndicator={false}>{listBody}</ScrollView>}
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <StudioShell
        accent="purple"
        org={{
          name: activeOrg ? activeOrg.org_name : 'Personal',
          role: `Studio · ${displayName.split(' ').slice(0, 2).join(' ')}`,
          mono: activeOrg ? activeOrg.org_short_name : initials,
          monoColor: activeOrg ? 'navy' : 'solo',
        }}
        ctxLens="studio"
        onCtxChange={(lens) => {
          if (lens === 'practice') router.push('/');
        }}
        navSections={navSections}
        compactBottomTabs={[
          {
            key: 'blueprints',
            icon: 'git-branch-outline',
            label: 'Blueprints',
            count: home.blueprintCount || undefined,
            onPress: () => router.push('/studio'),
          },
          {
            key: 'subscribers',
            icon: 'people-outline',
            label: 'Subscribers',
            count: data.totalSubscribers || undefined,
            active: true,
          },
          {
            key: 'threads',
            icon: 'chatbubbles-outline',
            label: 'Threads',
            count: home.threadAwaitingCount || undefined,
            onPress: () => router.push('/studio/threads'),
          },
          {
            key: 'payouts',
            icon: 'cash-outline',
            label: 'Payouts',
            onPress: () => router.push('/studio/payouts'),
          },
        ]}
        user={{ name: displayName, email: user?.email ?? '', initials }}
        onUserCardPress={() =>
          showConfirm('Sign out', `Sign out of ${displayName}?`, () => {
            void signOut();
          })
        }
      >
        {compact ? (
          <ScrollView
            style={styles.compactScroll}
            contentContainerStyle={styles.compactScrollInner}
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </StudioShell>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Subscriber row
// ---------------------------------------------------------------------------

function SubscriberRow({ sub }: { sub: StudioSubscriber }) {
  const [expanded, setExpanded] = React.useState(false);
  const planLabel =
    sub.plans.length === 1
      ? sub.plans[0].blueprintTitle
      : `${sub.plans.length} blueprints`;
  return (
    <View style={styles.subRowWrap}>
      <Pressable
        style={({ pressed }) => [styles.subRow, pressed && { backgroundColor: 'rgba(0,0,0,0.02)' }]}
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${sub.name}`}
      >
        <View style={styles.subAvi}>
          <Text style={styles.subAviText}>{sub.initials}</Text>
        </View>
        <View style={styles.subContent}>
          <View style={styles.subTopLine}>
            <Text style={styles.subName} numberOfLines={1}>
              {sub.name}
            </Text>
            {sub.trialing ? (
              <View style={styles.trialPill}>
                <Text style={styles.trialPillText}>Trialing</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.subPlans} numberOfLines={1}>
            {planLabel}
          </Text>
          {sub.plans.length > 1 ? (
            <View style={styles.subPlanChips}>
              {sub.plans.map((p) => (
                <View key={p.blueprintId} style={styles.planChip}>
                  <Text style={styles.planChipText} numberOfLines={1}>
                    {p.blueprintTitle}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.subRightRail}>
          <Text style={styles.subSince}>{sinceLabel(sub.latestSubscribedAt)}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="rgba(60, 60, 67, 0.45)"
          />
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.subExpanded}>
          {sub.plans.map((plan) => (
            <SubscriberPlanMentorPanel
              key={plan.blueprintId}
              subscriber={sub}
              plan={plan}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SubscriberPlanMentorPanel({
  subscriber,
  plan,
}: {
  subscriber: StudioSubscriber;
  plan: StudioSubscriberPlan;
}) {
  const router = useRouter();
  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const stepsQuery = useStudioSubscriberSteps(plan.blueprintId, subscriber.userId);
  const refetchSteps = stepsQuery.refetch;
  const steps = stepsQuery.data ?? [];

  useFocusEffect(
    React.useCallback(() => {
      void refetchSteps();
    }, [refetchSteps]),
  );

  const openStep = (stepId: string) => {
    router.push(
      `/creator/subscriber-step/${stepId}?blueprintId=${plan.blueprintId}&subscriberId=${subscriber.userId}` as any,
    );
  };

  return (
    <View style={styles.planPanel}>
      <View style={styles.planPanelHeader}>
        <View style={styles.planPanelTitleWrap}>
          <Text style={styles.planPanelEyebrow}>Subscribed plan</Text>
          <Text style={styles.planPanelTitle} numberOfLines={1}>
            {plan.blueprintTitle}
          </Text>
        </View>
        <Pressable
          style={styles.suggestBtn}
          onPress={() => setSuggestOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Suggest a next step to ${subscriber.name}`}
        >
          <Ionicons name="sparkles-outline" size={14} color="#4F46E5" />
          <Text style={styles.suggestBtnText}>Suggest next</Text>
        </Pressable>
      </View>

      {stepsQuery.isLoading ? (
        <View style={styles.planLoadingRow}>
          <ActivityIndicator size="small" color="#6F56D9" />
          <Text style={styles.planLoadingText}>Loading copied steps…</Text>
        </View>
      ) : stepsQuery.isError ? (
        <Text style={styles.planErrorText}>
          Could not load subscriber steps. Refresh after the latest database migration is applied.
        </Text>
      ) : steps.length === 0 ? (
        <Text style={styles.planEmptyText}>
          No copied steps yet. When {subscriber.name} adds a step from this blueprint, it appears here for review.
        </Text>
      ) : (
        <View style={styles.stepReviewList}>
          {steps.map((step) => (
            <SubscriberStepReviewRow
              key={step.stepId}
              step={step}
              onPress={() => openStep(step.stepId)}
            />
          ))}
        </View>
      )}

      <SuggestStepSheet
        visible={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        blueprintId={plan.blueprintId}
        targetUserId={subscriber.userId}
        targetUserName={subscriber.name}
      />
    </View>
  );
}

function SubscriberStepReviewRow({
  step,
  onPress,
}: {
  step: StudioSubscriberStep;
  onPress: () => void;
}) {
  const tone = reviewTone(step);
  const reviewAction = step.reviewStatus ? 'Open reviewed step' : 'Review step';

  return (
    <Pressable
      style={({ pressed }) => [styles.stepReviewRow, pressed && { opacity: 0.78 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Review ${step.title}`}
    >
      <View style={styles.stepReviewTopLine}>
        <View style={styles.stepReviewNumber}>
          <Text style={styles.stepReviewNumberText}>{step.sortOrder || '•'}</Text>
        </View>
        <Text style={styles.stepReviewTitle} numberOfLines={2}>
          {step.title}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(60, 60, 67, 0.42)" />
      </View>

      <View style={styles.stepReviewMeta}>
        <View style={[styles.stepReviewPill, { backgroundColor: tone.bg }]}>
          <Ionicons name={tone.icon} size={11} color={tone.fg} />
          <Text style={[styles.stepReviewPillText, { color: tone.fg }]}>
            {tone.label}
          </Text>
        </View>
        <Text style={styles.stepReviewAction}>{reviewAction}</Text>
      </View>

      {step.reviewNote ? (
        <Text style={styles.stepReviewHint} numberOfLines={2}>
          Feedback: {step.reviewNote}
        </Text>
      ) : step.suggestedNext ? (
        <Text style={styles.stepReviewHint} numberOfLines={2}>
          Next: {step.suggestedNext}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SubscribersEmptyState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="people-outline" size={26} color="rgba(107, 91, 191, 0.6)" />
      </View>
      <Text style={styles.emptyTitle}>No subscribers yet</Text>
      <Text style={styles.emptyBody}>
        When someone subscribes to one of your published blueprints, they show
        up here so you can see who you're coaching.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function sinceLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const diffDay = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000),
  );
  if (diffDay === 0) return 'Today';
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.round(diffDay / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function reviewTone(step: StudioSubscriberStep): {
  label: string;
  bg: string;
  fg: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  if (step.reviewStatus === 'approved') {
    return { label: 'Approved', bg: '#DCFCE7', fg: '#15803D', icon: 'checkmark-circle' };
  }
  if (step.reviewStatus === 'needs_revision') {
    return { label: 'Retry requested', bg: '#FFF7ED', fg: '#C2410C', icon: 'refresh-circle' };
  }
  if (step.suggestedNext) {
    return { label: 'Next suggested', bg: '#EEF2FF', fg: '#4F46E5', icon: 'sparkles' };
  }
  if (step.status === 'completed' || step.status === 'settled' || step.completedAt) {
    return { label: 'Ready to review', bg: '#DBEAFE', fg: '#1D4ED8', icon: 'time' };
  }
  if (step.status === 'in_progress') {
    return { label: 'Working', bg: '#FEF3C7', fg: '#B45309', icon: 'ellipse' };
  }
  return { label: 'Queued', bg: 'rgba(0,0,0,0.06)', fg: 'rgba(60, 60, 67, 0.7)', icon: 'ellipse-outline' };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as any) : {}),
  },

  subText: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.6)' },

  compactScroll: { flex: 1 },
  compactScrollInner: { paddingBottom: 24 },

  listWrap: { flex: 1, marginTop: 10 },

  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { fontSize: 13, color: 'rgba(60,60,67,0.5)' },

  // Subscriber row
  subRowWrap: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  subRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subAvi: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6F56D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subAviText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  subContent: { flex: 1, minWidth: 0 },
  subTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', letterSpacing: -0.1 },
  trialPill: {
    paddingHorizontal: 7,
    paddingTop: 1,
    paddingBottom: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(201, 150, 50, 0.14)',
  },
  trialPillText: { fontSize: 10, fontFamily: fontFamily.mono, fontWeight: '500', color: '#C99632' },
  subPlans: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)', marginTop: 3 },
  subPlanChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  planChip: {
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.05)',
    maxWidth: 180,
  },
  planChipText: { fontSize: 10.5, fontFamily: fontFamily.mono, fontWeight: '500', color: 'rgba(60, 60, 67, 0.85)' },
  subRightRail: { alignItems: 'flex-end', gap: 4, marginLeft: 4 },
  subSince: { fontSize: 11, fontFamily: fontFamily.mono, color: 'rgba(60, 60, 67, 0.5)' },

  // Expanded mentoring panel
  subExpanded: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 10,
  },
  planPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10,
  },
  planPanelHeader: {
    gap: 10,
  },
  planPanelTitleWrap: { flex: 1, minWidth: 0 },
  planPanelEyebrow: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: 'rgba(60, 60, 67, 0.45)',
  },
  planPanelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 2,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    alignSelf: 'stretch',
    minHeight: 34,
  },
  suggestBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  planLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  planLoadingText: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.55)' },
  planErrorText: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#B91C1C',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  planEmptyText: {
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(60, 60, 67, 0.58)',
    backgroundColor: '#F8F8FA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepReviewList: { gap: 8 },
  stepReviewRow: {
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F8F7F6',
  },
  stepReviewTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepReviewNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(111, 86, 217, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepReviewNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6F56D9',
  },
  stepReviewTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1C1C1E',
    lineHeight: 18,
  },
  stepReviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    minWidth: 0,
  },
  stepReviewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingTop: 2,
    paddingBottom: 3,
    borderRadius: 999,
  },
  stepReviewPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stepReviewHint: {
    fontSize: 11.5,
    lineHeight: 15,
    color: 'rgba(60, 60, 67, 0.55)',
  },
  stepReviewAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // Empty state
  emptyState: { paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(107, 91, 191, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: fontFamily.serif, fontWeight: '500', color: '#1C1C1E', letterSpacing: -0.3 },
  emptyBody: {
    fontSize: 13,
    color: 'rgba(60, 60, 67, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
});
