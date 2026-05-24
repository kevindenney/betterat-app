/**
 * /account/subscriptions — buyer's list of marketplace subscriptions.
 *
 * Authenticated route (AuthGate guards). Lists each row with title,
 * author, status chip, amount/cadence, period-end, and a Cancel CTA
 * that hits the marketplace-cancel-subscription edge function.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useMySubscriptions, MySubscription } from '@/hooks/useMySubscriptions';

const STATUS_TONE: Record<
  MySubscription['status'],
  { bg: string; fg: string; label: string }
> = {
  trialing: { bg: 'rgba(40, 64, 107, 0.10)', fg: '#28406B', label: 'Trial' },
  active: { bg: 'rgba(30, 143, 71, 0.12)', fg: '#1E8F47', label: 'Active' },
  past_due: { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632', label: 'Past due' },
  canceled: { bg: 'rgba(60, 60, 67, 0.10)', fg: '#596477', label: 'Canceled' },
  incomplete: { bg: 'rgba(201, 150, 50, 0.14)', fg: '#C99632', label: 'Incomplete' },
  incomplete_expired: { bg: 'rgba(192, 57, 43, 0.10)', fg: '#C0392B', label: 'Expired' },
  paused: { bg: 'rgba(60, 60, 67, 0.10)', fg: '#596477', label: 'Paused' },
  unpaid: { bg: 'rgba(192, 57, 43, 0.10)', fg: '#C0392B', label: 'Unpaid' },
};

function formatMoney(cents: number, currency: string): string {
  return `${currency.toUpperCase()} $${(cents / 100).toFixed(2)}`;
}

function formatCadence(c: MySubscription['cadence']): string {
  if (c === 'monthly') return '/month';
  if (c === 'annual') return '/year';
  return ' one-time';
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SubscriptionsPage() {
  const { subscriptions, loading, cancel } = useMySubscriptions();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const handleCancel = (id: string) => {
    setPendingId(id);
    cancel.mutate(id, {
      onSettled: () => setPendingId(null),
    });
  };

  return (
    <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
      <View style={s.header}>
        <Text style={s.eyebrow}>Your subscriptions</Text>
        <Text style={s.h1}>Marketplace blueprints</Text>
        <Text style={s.lede}>
          Subscriptions you've started through the BetterAt marketplace. Cancel any time —
          access stays through the end of your current billing period.
        </Text>
      </View>

      {loading ? (
        <View style={s.loadingCard}>
          <ActivityIndicator color="#28406B" />
          <Text style={s.loadingText}>Loading subscriptions…</Text>
        </View>
      ) : subscriptions.length === 0 ? (
        <View style={s.emptyCard}>
          <Ionicons name="card-outline" size={28} color="rgba(60, 60, 67, 0.4)" />
          <Text style={s.emptyTitle}>No marketplace subscriptions yet</Text>
          <Text style={s.emptyCopy}>
            Browse the marketplace to find blueprints from independent authors.
          </Text>
          <Pressable
            style={s.btnPrimary}
            onPress={() => router.push('/marketplace' as any)}
          >
            <Text style={s.btnPrimaryText}>Browse marketplace</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {subscriptions.map((sub) => {
            const tone = STATUS_TONE[sub.status];
            const periodEnd = formatDate(sub.currentPeriodEnd);
            const trialEnd = formatDate(sub.trialEndsAt);
            const canceledAt = formatDate(sub.canceledAt);
            const cancelable =
              (sub.status === 'active' || sub.status === 'trialing') &&
              !sub.cancelAtPeriodEnd;
            return (
              <View key={sub.id} style={s.subCard}>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Link href={`/marketplace/${sub.blueprintId}` as any} asChild>
                    <Pressable>
                      <Text style={s.subTitle} numberOfLines={1}>
                        {sub.blueprintTitle}
                      </Text>
                    </Pressable>
                  </Link>
                  <Text style={s.subAuthor} numberOfLines={1}>
                    {sub.authorName}
                    {sub.orgName ? ` · ${sub.orgName}` : ''}
                  </Text>
                  <Text style={s.subMeta}>
                    {formatMoney(sub.unitAmountCents, sub.currency)}
                    {formatCadence(sub.cadence)}
                    {trialEnd && sub.status === 'trialing' ? ` · trial ends ${trialEnd}` : ''}
                    {periodEnd && sub.status === 'active' && !sub.cancelAtPeriodEnd
                      ? ` · renews ${periodEnd}`
                      : ''}
                    {periodEnd && sub.cancelAtPeriodEnd
                      ? ` · access through ${periodEnd}`
                      : ''}
                    {canceledAt && sub.status === 'canceled'
                      ? ` · canceled ${canceledAt}`
                      : ''}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {sub.cancelAtPeriodEnd && sub.status !== 'canceled' ? (
                    <View style={[s.chip, { backgroundColor: 'rgba(201, 150, 50, 0.14)' }]}>
                      <Text style={[s.chipText, { color: '#C99632' }]}>
                        Cancels {formatDate(sub.currentPeriodEnd) ?? 'end of period'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[s.chip, { backgroundColor: tone.bg }]}>
                      <Text style={[s.chipText, { color: tone.fg }]}>{tone.label}</Text>
                    </View>
                  )}
                  {cancelable ? (
                    <Pressable
                      style={[s.btnGhost, pendingId === sub.id && { opacity: 0.55 }]}
                      disabled={pendingId === sub.id}
                      onPress={() => handleCancel(sub.id)}
                    >
                      <Text style={s.btnGhostText}>
                        {pendingId === sub.id ? 'Canceling…' : 'Cancel'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 60,
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
    gap: 24,
  },
  header: { gap: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  h1: { fontSize: 28, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.4, marginTop: 4 },
  lede: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.75)', lineHeight: 19, marginTop: 4 },
  loadingCard: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  loadingText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.7)' },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginTop: 4 },
  emptyCopy: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 360,
  },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  subTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  subAuthor: { fontSize: 12, color: 'rgba(60, 60, 67, 0.75)' },
  subMeta: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: { fontSize: 11, fontWeight: '600' },
  btnPrimary: {
    backgroundColor: '#28406B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  btnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
  },
  btnGhostText: { color: '#28406B', fontSize: 12, fontWeight: '600' },
});
