/**
 * /marketplace/[id] — marketplace blueprint detail.
 *
 * Anonymously browsable: header + price + author + Subscribe CTA.
 * When the viewer has access (active subscription, is the author, or
 * org admin), the Steps preview block also renders.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplaceBlueprint } from '@/hooks/useMarketplaceBlueprint';
import { useMarketplaceCheckout } from '@/hooks/useMarketplaceBlueprints';

const CATEGORY_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  procedural: { bg: 'rgba(139, 90, 60, 0.12)', fg: '#8B5A3C', label: 'Procedural' },
  assessment: { bg: 'rgba(90, 107, 139, 0.14)', fg: '#5A6B8B', label: 'Assessment' },
  communication: { bg: 'rgba(110, 139, 90, 0.14)', fg: '#6E8B5A', label: 'Communication' },
  reasoning: { bg: 'rgba(122, 90, 139, 0.14)', fg: '#7A5A8B', label: 'Reasoning' },
  other: { bg: 'rgba(40, 64, 107, 0.10)', fg: '#28406B', label: 'Other' },
};

function formatPrice(cents: number, cadence: 'monthly' | 'annual' | 'one_time'): string {
  const dollars = (cents / 100).toFixed(0);
  if (cadence === 'one_time') return `$${dollars}`;
  if (cadence === 'annual') return `$${dollars}/yr`;
  return `$${dollars}/mo`;
}

export default function MarketplaceBlueprintPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const { user, isGuest } = useAuth();
  const signedIn = !!user && !isGuest;
  const { result, loading } = useMarketplaceBlueprint(id);
  const checkout = useMarketplaceCheckout();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  if (loading || !result) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#28406B" />
        <Text style={s.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!result.ok) {
    return (
      <View style={s.center}>
        <View style={s.icoBad}>
          <Ionicons name="search-outline" size={28} color="#C0392B" />
        </View>
        <Text style={s.h1}>
          {result.reason === 'not_listed'
            ? "This blueprint isn't on the marketplace"
            : 'Blueprint not found'}
        </Text>
        <Text style={s.copy}>
          {result.reason === 'not_listed'
            ? 'Independent authors list their blueprints to Stripe before they appear here.'
            : 'Check the link — or browse the marketplace for similar blueprints.'}
        </Text>
        <Pressable
          style={s.btnPrimary}
          onPress={() => router.replace('/marketplace' as any)}
        >
          <Text style={s.btnPrimaryText}>Browse marketplace</Text>
        </Pressable>
      </View>
    );
  }

  const { blueprint, hasAccess, subscription, steps } = result;
  const subscribeLabel = `Subscribe · ${formatPrice(blueprint.pricePerSeatCents, blueprint.billingCadence)}`;

  const handleSubscribe = () => {
    if (!signedIn) {
      const returnTo = `/marketplace/${blueprint.id}`;
      router.replace(`/(auth)/login?returnTo=${encodeURIComponent(returnTo)}` as any);
      return;
    }
    setPending(true);
    setError(null);
    checkout.mutate(blueprint.id, {
      onSuccess: ({ url }) => {
        setPending(false);
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      },
      onError: (err: unknown) => {
        setPending(false);
        setError(err instanceof Error ? err.message : 'Checkout failed');
      },
    });
  };

  return (
    <ScrollView
      style={s.body}
      contentContainerStyle={[
        s.bodyInner,
        isCompact && { paddingHorizontal: 16, paddingTop: 24, gap: 16 },
      ]}
    >
      <View style={s.header}>
        <View style={s.eyebrowRow}>
          <Pressable onPress={() => router.replace('/marketplace' as any)} hitSlop={8}>
            <Text style={s.eyebrow}>← Marketplace</Text>
          </Pressable>
          {hasAccess && subscription ? (
            <View
              style={[
                s.statusChip,
                subscription.cancelAtPeriodEnd
                  ? { backgroundColor: 'rgba(201, 150, 50, 0.14)' }
                  : { backgroundColor: 'rgba(30, 143, 71, 0.12)' },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={12}
                color={subscription.cancelAtPeriodEnd ? '#C99632' : '#1E8F47'}
              />
              <Text
                style={[
                  s.statusChipText,
                  { color: subscription.cancelAtPeriodEnd ? '#C99632' : '#1E8F47' },
                ]}
              >
                {subscription.cancelAtPeriodEnd
                  ? `Access through ${formatDate(subscription.currentPeriodEnd)}`
                  : subscription.status === 'trialing'
                    ? 'On trial'
                    : 'Subscribed'}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[s.h1, isCompact && { fontSize: 24 }]}>{blueprint.title}</Text>
        <Text style={s.author}>
          {blueprint.authorName}
          {blueprint.orgName ? ` · ${blueprint.orgName}` : ''}
        </Text>
        {blueprint.description ? <Text style={s.lede}>{blueprint.description}</Text> : null}
      </View>

      {!hasAccess ? (
        <View
          style={[
            s.subscribeCard,
            isCompact && { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.priceMain}>
              {formatPrice(blueprint.pricePerSeatCents, blueprint.billingCadence)}
            </Text>
            {blueprint.trialDays > 0 && blueprint.billingCadence !== 'one_time' ? (
              <Text style={s.priceSub}>
                {blueprint.trialDays}-day free trial · cancel anytime
              </Text>
            ) : (
              <Text style={s.priceSub}>Cancel anytime · 70% to author</Text>
            )}
          </View>
          <Pressable
            style={[s.btnPrimary, pending && { opacity: 0.55 }]}
            disabled={pending}
            onPress={handleSubscribe}
          >
            <Ionicons name={pending ? 'sync' : 'card-outline'} size={14} color="#FFFFFF" />
            <Text style={s.btnPrimaryText}>
              {pending ? 'Opening Stripe…' : signedIn ? subscribeLabel : 'Sign in to subscribe'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <View style={s.errorBox}>
          <Ionicons name="warning" size={14} color="#C0392B" />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={s.stepsCard}>
        <View style={s.stepsHead}>
          <Text style={s.eyebrow}>Steps</Text>
          <Text style={s.h2}>
            {hasAccess
              ? `What you'll work through · ${steps.length} step${steps.length === 1 ? '' : 's'}`
              : 'Subscribe to see the full step list'}
          </Text>
        </View>
        {hasAccess ? (
          steps.length === 0 ? (
            <Text style={s.muted}>This blueprint has no steps published yet.</Text>
          ) : (
            <View style={{ gap: 10 }}>
              {steps.map((step, idx) => {
                const tone = CATEGORY_TONE[step.category] ?? CATEGORY_TONE.other;
                const status = step.buyerStatus;
                const statusTone =
                  status === 'completed'
                    ? { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47', label: 'Done' }
                    : status === 'in_progress'
                      ? { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632', label: 'In progress' }
                      : status === 'skipped'
                        ? { bg: 'rgba(89, 100, 119, 0.12)', fg: '#596477', label: 'Skipped' }
                        : status === 'pending'
                          ? { bg: 'rgba(40, 64, 107, 0.08)', fg: '#28406B', label: 'In your timeline' }
                          : null;
                return (
                  <View key={step.id} style={s.stepRow}>
                    <View style={s.stepIndex}>
                      <Text style={s.stepIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={s.stepTitle}>{step.title}</Text>
                      {step.description ? (
                        <Text style={s.stepDescription}>{step.description}</Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <View style={[s.categoryChip, { backgroundColor: tone.bg }]}>
                          <Text style={[s.categoryChipText, { color: tone.fg }]}>
                            {tone.label}
                          </Text>
                        </View>
                        {statusTone ? (
                          <View style={[s.categoryChip, { backgroundColor: statusTone.bg }]}>
                            <Text style={[s.categoryChipText, { color: statusTone.fg }]}>
                              {statusTone.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ) : (
          <View style={s.lockedBox}>
            <Ionicons name="lock-closed" size={18} color="rgba(60, 60, 67, 0.5)" />
            <Text style={s.lockedText}>
              The full step-by-step playbook unlocks the moment you subscribe.
              {blueprint.trialDays > 0 && blueprint.billingCadence !== 'one_time'
                ? ` Try it free for ${blueprint.trialDays} days.`
                : ''}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return 'period end';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 60,
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
    gap: 22,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F5F4EE',
    gap: 14,
  },
  loadingText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.7)' },

  header: { gap: 6 },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28406B',
  },
  h1: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  h2: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.2, marginTop: 4 },
  author: { fontSize: 13, color: 'rgba(60, 60, 67, 0.75)', marginTop: 4 },
  lede: { fontSize: 14, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 20, marginTop: 8 },
  copy: {
    fontSize: 13.5,
    lineHeight: 19,
    color: 'rgba(60, 60, 67, 0.85)',
    textAlign: 'center',
  },

  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: { fontSize: 11.5, fontWeight: '600' },

  subscribeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  priceMain: { fontSize: 26, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.4 },
  priceSub: { fontSize: 12, color: 'rgba(60, 60, 67, 0.7)', marginTop: 4 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#28406B',
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '600' },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(192, 57, 43, 0.10)',
  },
  errorText: { flex: 1, fontSize: 12, color: '#C0392B' },

  stepsCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 14,
  },
  stepsHead: { gap: 2 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: '#F5F4EE',
    borderRadius: 10,
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28406B',
  },
  stepIndexText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  stepTitle: { fontSize: 13.5, fontWeight: '600', color: '#1C1C1E' },
  stepDescription: { fontSize: 12, color: 'rgba(60, 60, 67, 0.75)', lineHeight: 18 },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 2,
  },
  categoryChipText: { fontSize: 10.5, fontWeight: '600' },

  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(60, 60, 67, 0.06)',
    borderRadius: 10,
  },
  lockedText: { flex: 1, fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 18 },
  muted: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.6)' },

  icoBad: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(192, 57, 43, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
