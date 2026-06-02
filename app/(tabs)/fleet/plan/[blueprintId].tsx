/**
 * Fleet Plan detail — a member browses a captain's published season plan and
 * SELECTIVELY adopts the steps they want (never the whole season; the plan is a
 * menu, not a calendar — see feedback_plan_is_menu_not_calendar). Subscribing
 * enables the discussion + suggestion machinery and follows the captain so the
 * steps become adoptable. Order is the captain's sequence (sort_order), not date.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import {
  PLAN_ITEM_KIND_LABELS,
  type FleetPlanStep,
  type PlanItemKind,
  adoptPlanStep,
  getFleetPlanSteps,
  isSubscribedToFleetPlan,
  subscribeToFleetPlan,
} from '@/services/fleetPlanService';

const COLORS = {
  background: '#FBF9F4',
  text: '#3D3832',
  secondaryText: '#6B7280',
  tertiaryText: '#9CA3AF',
  sectionLabel: '#8E8E93',
  hairline: '#E5E7EB',
  activeBlue: '#007AFF',
  successGreen: '#16A34A',
  chipBg: '#F3F4F6',
};

function formatStepDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FleetPlanDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const params = useLocalSearchParams<{
    blueprintId?: string;
    fleetName?: string;
    title?: string;
    isAuthor?: string;
    canEdit?: string;
  }>();
  const blueprintId = params.blueprintId ?? '';
  const fleetName = params.fleetName ?? 'fleet';
  const planTitle = params.title ?? 'Season plan';
  const isAuthor = params.isAuthor === 'true';
  // Fleet plans are co-editable by any of the fleet's captains (owner/captain/
  // coach), not just the author. The fleet hub passes canEdit based on role.
  const canEdit = params.canEdit === 'true' || isAuthor;
  const interestId = currentInterest?.id ?? '';

  const [steps, setSteps] = useState<FleetPlanStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!blueprintId || !user?.id) return;
    setLoading(true);
    try {
      const [rows, sub] = await Promise.all([
        getFleetPlanSteps(blueprintId),
        isSubscribedToFleetPlan(user.id, blueprintId),
      ]);
      setSteps(rows);
      // Subscription is orthogonal to edit-rights: a captain authors the plan
      // but still subscribes (like any member) to pull its steps into their own
      // timeline. Don't treat editors as auto-subscribed.
      setSubscribed(sub);
    } catch (err: any) {
      showAlert('Could not load plan', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [blueprintId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubscribe = useCallback(async () => {
    if (!user?.id || !blueprintId) return;
    setSubscribing(true);
    try {
      await subscribeToFleetPlan(user.id, blueprintId);
      setSubscribed(true);
      await load();
    } catch (err: any) {
      showAlert('Could not subscribe', err?.message ?? 'Please try again.');
    } finally {
      setSubscribing(false);
    }
  }, [user?.id, blueprintId, load]);

  const handleAdopt = useCallback(
    async (step: FleetPlanStep) => {
      if (!user?.id || !blueprintId || !interestId) return;
      setAdoptingId(step.step_id);
      try {
        await adoptPlanStep({
          subscriberId: user.id,
          blueprintId,
          sourceStepId: step.step_id,
          interestId,
        });
        setSteps((prev) =>
          prev.map((s) => (s.step_id === step.step_id ? { ...s, viewer_adopted: true } : s)),
        );
      } catch (err: any) {
        showAlert('Could not add step', err?.message ?? 'Please try again.');
      } finally {
        setAdoptingId(null);
      }
    },
    [user?.id, blueprintId, interestId],
  );

  const openDiscussion = useCallback(
    (stepId: string) => {
      router.push(`/practice/step/${stepId}/discussion` as any);
    },
    [router],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: planTitle }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>SEASON PLAN · {fleetName.toUpperCase()}</Text>
        <Text style={styles.helpText}>
          Pick the steps you want — races and the prep between them. Adding a step puts it in your
          own timeline. You don&apos;t have to take the whole season.
        </Text>

        {canEdit && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/fleet/plan/builder',
                params: { blueprintId, fleetName, fleetId: '' },
              } as any)
            }
          >
            <Text style={styles.secondaryButtonText}>Edit plan</Text>
          </TouchableOpacity>
        )}

        {!subscribed && (
          <TouchableOpacity
            style={[styles.primaryButton, subscribing && styles.buttonDisabled]}
            onPress={handleSubscribe}
            disabled={subscribing}
          >
            {subscribing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Subscribe to follow this plan</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        {loading ? (
          <ActivityIndicator color={COLORS.activeBlue} style={{ marginVertical: 24 }} />
        ) : steps.length === 0 ? (
          <Text style={styles.emptyText}>This plan has no steps yet.</Text>
        ) : (
          <View style={styles.stepList}>
            {steps.map((step) => {
              const dateLabel = formatStepDate(step.starts_at);
              const meta = [dateLabel, step.location_name].filter(Boolean).join(' · ');
              return (
                <View key={step.step_id} style={styles.stepRow}>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepKind}>
                      {PLAN_ITEM_KIND_LABELS[step.category as PlanItemKind] ?? step.category}
                    </Text>
                    <Text style={styles.stepTitle}>{step.title ?? 'Untitled step'}</Text>
                    {!!meta && <Text style={styles.stepMeta}>{meta}</Text>}
                    {!!step.description && (
                      <Text style={styles.stepDesc} numberOfLines={3}>
                        {step.description}
                      </Text>
                    )}
                    <View style={styles.stepActions}>
                      {step.viewer_adopted ? (
                        <View style={styles.adoptedPill}>
                          <Text style={styles.adoptedPillText}>✓ In your timeline</Text>
                        </View>
                      ) : subscribed ? (
                        <TouchableOpacity
                          style={[
                            styles.adoptButton,
                            adoptingId === step.step_id && styles.buttonDisabled,
                          ]}
                          onPress={() => handleAdopt(step)}
                          disabled={adoptingId === step.step_id}
                        >
                          {adoptingId === step.step_id ? (
                            <ActivityIndicator color={COLORS.activeBlue} size="small" />
                          ) : (
                            <Text style={styles.adoptButtonText}>+ Add to my timeline</Text>
                          )}
                        </TouchableOpacity>
                      ) : null}
                      {subscribed && (
                        <TouchableOpacity onPress={() => openDiscussion(step.step_id)}>
                          <Text style={styles.discussText}>Discuss</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.sectionLabel,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 4,
  },
  helpText: { fontSize: 14, color: COLORS.secondaryText, lineHeight: 20, marginBottom: 16 },
  primaryButton: {
    backgroundColor: COLORS.activeBlue,
    paddingVertical: 13,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.activeBlue,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: COLORS.activeBlue },
  buttonDisabled: { opacity: 0.6 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.hairline, marginVertical: 20 },
  emptyText: { fontSize: 14, color: COLORS.tertiaryText, fontStyle: 'italic' },
  stepList: { backgroundColor: '#FFFFFF', borderRadius: 8, overflow: 'hidden' },
  stepRow: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hairline,
  },
  stepBody: { gap: 4 },
  stepKind: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.tertiaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stepTitle: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  stepMeta: { fontSize: 12, color: COLORS.secondaryText },
  stepDesc: { fontSize: 13, color: COLORS.secondaryText, lineHeight: 18, marginTop: 2 },
  stepActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  adoptButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.activeBlue,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  adoptButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.activeBlue },
  adoptedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  adoptedPillText: { fontSize: 12, fontWeight: '700', color: COLORS.successGreen },
  discussText: { fontSize: 13, fontWeight: '600', color: COLORS.secondaryText },
});
