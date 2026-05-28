/**
 * /p/[userId] — the cross-interest portfolio member view.
 *
 * Per the plan: this is the hero surface across every demo. Same
 * screen shows a Dean what her nursing student is doing across her
 * other lives; shows Pitroda what Savitri is building beyond lac
 * craft; shows Bram who his fleet-mate is the rest of the time.
 *
 * Access is enforced server-side by the get_member_portfolio_* RPCs
 * Codex ships in Wave 1. Until then, the page renders a typed
 * "demo backend not deployed" message rather than crashing.
 *
 * URL params:
 *   /p/{userId}                    → full cross-interest view (RPC
 *                                    enforces self or opt-in public)
 *   /p/{userId}?org={orgId}        → org-scoped view (admin lens)
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMemberPortfolio } from '@/hooks/useMemberPortfolio';
import {
  PortfolioAccessDeniedError,
  PortfolioRpcUnavailableError,
  type MemberPortfolio,
  type PortfolioInterest,
} from '@/services/PortfolioService';

export default function MemberPortfolioScreen() {
  const params = useLocalSearchParams<{ userId?: string; org?: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : null;
  const orgId = typeof params.org === 'string' ? params.org : null;

  const { data, isLoading, error } = useMemberPortfolio(userId, orgId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ headerShown: false, title: 'Portfolio' }} />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        {orgId ? (
          <View style={styles.scopePill}>
            <Ionicons name="business-outline" size={12} color="#475569" />
            <Text style={styles.scopePillText}>Org-scoped view</Text>
          </View>
        ) : null}
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? <LoadingState /> : null}

        {!isLoading && error ? <ErrorState error={error} /> : null}

        {!isLoading && !error && data ? (
          <PortfolioContent portfolio={data} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="small" color="#64748B" />
      <Text style={styles.centerText}>Loading portfolio…</Text>
    </View>
  );
}

function ErrorState({ error }: { error: unknown }) {
  let title = 'Could not load portfolio';
  let body = 'Try again in a moment.';

  if (error instanceof PortfolioRpcUnavailableError) {
    title = 'Portfolio backend not yet deployed';
    body =
      'The get_member_portfolio_* RPCs ship in Wave 1. Until then this page renders this state instead of crashing — the UI is ready when the backend lands.';
  } else if (error instanceof PortfolioAccessDeniedError) {
    title = 'This portfolio is private';
    body =
      'Ask the person to share it, or sign in as someone with permission to view it.';
  } else if (error instanceof Error) {
    body = error.message;
  }

  return (
    <View style={styles.errorCard}>
      <Ionicons name="lock-closed-outline" size={26} color="#94A3B8" />
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorBody}>{body}</Text>
    </View>
  );
}

function PortfolioContent({ portfolio }: { portfolio: MemberPortfolio }) {
  const { user, interests } = portfolio;
  const interestCount = interests.length;
  const totalPlans = useMemo(
    () => interests.reduce((sum, i) => sum + i.totalPlans, 0),
    [interests],
  );
  const totalSteps = useMemo(
    () => interests.reduce((sum, i) => sum + i.totalSteps, 0),
    [interests],
  );

  return (
    <View style={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroAvatarWrap}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.heroAvatar} />
          ) : (
            <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
              <Text style={styles.heroAvatarInitial}>{user.initial}</Text>
            </View>
          )}
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroName}>{user.displayName}</Text>
          {user.bio ? (
            <Text style={styles.heroBio} numberOfLines={3}>
              {user.bio}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatPill label="Interests" value={interestCount} />
        <StatPill label="Plans" value={totalPlans} />
        <StatPill label="Steps" value={totalSteps} />
      </View>

      {interestCount === 0 ? (
        <View style={styles.emptyInterests}>
          <Text style={styles.emptyInterestsTitle}>
            No interests in scope yet
          </Text>
          <Text style={styles.emptyInterestsBody}>
            When this person adds interests, they appear here as portfolio
            cards.
          </Text>
        </View>
      ) : (
        <View style={styles.interestStack}>
          {interests.map((interest) => (
            <InterestCard key={interest.interestId} interest={interest} />
          ))}
        </View>
      )}
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InterestCard({ interest }: { interest: PortfolioInterest }) {
  const accent = interest.accentColor;
  const plan = interest.activePlan;
  return (
    <View style={styles.interestCard}>
      <View style={styles.interestHeader}>
        <View style={[styles.interestAccent, { backgroundColor: accent }]} />
        <Text style={[styles.interestEyebrow, { color: accent }]}>
          {interest.interestName.toUpperCase()}
        </Text>
        <Text style={styles.interestMeta}>
          {interest.totalPlans} {interest.totalPlans === 1 ? 'plan' : 'plans'}
          {' · '}
          {interest.totalSteps} {interest.totalSteps === 1 ? 'step' : 'steps'}
        </Text>
      </View>

      {plan ? (
        <>
          {plan.visionStatement ? (
            <Text style={styles.interestVision}>
              {`"${plan.visionStatement.trim()}"`}
            </Text>
          ) : (
            <Text style={styles.interestVisionEmpty}>
              No vision set for this journey yet.
            </Text>
          )}

          {plan.recentSteps.length > 0 ? (
            <View style={styles.recentSteps}>
              <Text style={styles.recentStepsEyebrow}>RECENT</Text>
              {plan.recentSteps.slice(0, 3).map((step) => (
                <View key={step.id} style={styles.recentStepRow}>
                  <Text style={styles.recentStepStatus}>
                    {step.statusLabel}
                  </Text>
                  <Text style={styles.recentStepTitle} numberOfLines={1}>
                    {step.title}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {plan.cohortPeek ? (
            <View style={styles.cohortPeek}>
              <Ionicons
                name="chatbubbles-outline"
                size={14}
                color="#64748B"
              />
              <Text style={styles.cohortPeekText} numberOfLines={1}>
                {plan.cohortPeek.totalPosts > 0 && plan.cohortPeek.latestPostBy
                  ? `${plan.cohortPeek.latestPostBy} posted in cohort`
                  : `${plan.cohortPeek.cohortSize} ${plan.cohortPeek.cohortSize === 1 ? 'sailor' : 'others'} on this plan`}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.interestNoPlan}>
          No active plan in this interest yet.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarSpacer: { flex: 1 },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  scopePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.2,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },
  center: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 10,
  },
  centerText: {
    fontSize: 13,
    color: '#64748B',
  },
  errorCard: {
    marginTop: 40,
    padding: 22,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
  },
  content: { gap: 22 },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingTop: 8,
  },
  heroAvatarWrap: { padding: 2 },
  heroAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  heroAvatarFallback: {
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroText: { flex: 1, paddingTop: 6, gap: 6 },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  heroBio: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statPill: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#64748B',
  },
  emptyInterests: {
    padding: 22,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  emptyInterestsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptyInterestsBody: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  interestStack: { gap: 12 },
  interestCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  interestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  interestAccent: {
    width: 4,
    height: 14,
    borderRadius: 2,
  },
  interestEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    flex: 1,
  },
  interestMeta: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  interestVision: {
    fontSize: 15,
    lineHeight: 20,
    color: '#0F172A',
    fontStyle: 'italic',
  },
  interestVisionEmpty: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  interestNoPlan: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  recentSteps: {
    gap: 6,
    marginTop: 4,
  },
  recentStepsEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#94A3B8',
  },
  recentStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentStepStatus: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#64748B',
    width: 64,
  },
  recentStepTitle: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  cohortPeek: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  cohortPeekText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
  },
});
