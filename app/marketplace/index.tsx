/**
 * /marketplace — public discovery surface for independent blueprints.
 *
 * Anonymously browsable. Each card has a Subscribe CTA that creates a
 * real Stripe Checkout session via marketplace-blueprint-checkout and
 * opens the hosted page in a new tab (signed-in only — signed-out
 * users route to /(auth)/login?returnTo=/marketplace first).
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
import {
  useMarketplaceBlueprints,
  useMarketplaceCheckout,
  MarketplaceBlueprint,
  AuthorTone,
} from '@/hooks/useMarketplaceBlueprints';

function aviTone(tone: AuthorTone): string {
  switch (tone) {
    case 'brown':
      return '#8B5A3C';
    case 'warm':
      return '#B8855A';
    case 'green':
      return '#6E8B5A';
    case 'purple':
      return '#7A5A8B';
    default:
      return '#28406B';
  }
}

function formatPrice(cents: number, cadence: 'monthly' | 'annual' | 'one_time'): string {
  const dollars = (cents / 100).toFixed(0);
  if (cadence === 'one_time') return `$${dollars}`;
  if (cadence === 'annual') return `$${dollars}/yr`;
  return `$${dollars}/mo`;
}

export default function MarketplacePage() {
  const { user, isGuest } = useAuth();
  const signedIn = !!user && !isGuest;
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const params = useLocalSearchParams<{ stripe?: string; bp?: string }>();
  const { blueprints, loading } = useMarketplaceBlueprints();
  const checkout = useMarketplaceCheckout();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [errorByBp, setErrorByBp] = React.useState<Record<string, string>>({});

  // Surface a banner when Stripe redirected back from a Checkout
  // session. The flag dismisses on the user's click or after 10s.
  const [returnBanner, setReturnBanner] = React.useState<
    { kind: 'success' | 'cancelled'; bpId: string | null } | null
  >(null);
  React.useEffect(() => {
    const stripe = params.stripe;
    const bpId = (params.bp as string | undefined) ?? null;
    if (stripe === 'success') setReturnBanner({ kind: 'success', bpId });
    else if (stripe === 'cancelled') setReturnBanner({ kind: 'cancelled', bpId });
  }, [params.stripe, params.bp]);
  React.useEffect(() => {
    if (!returnBanner) return;
    const t = setTimeout(() => setReturnBanner(null), 10_000);
    return () => clearTimeout(t);
  }, [returnBanner]);
  const returnBp = returnBanner?.bpId
    ? blueprints.find((b) => b.id === returnBanner.bpId)
    : null;

  const handleSubscribe = (bp: MarketplaceBlueprint) => {
    if (!signedIn) {
      router.replace(`/(auth)/login?returnTo=${encodeURIComponent('/marketplace')}` as any);
      return;
    }
    setPendingId(bp.id);
    setErrorByBp((prev) => ({ ...prev, [bp.id]: '' }));
    checkout.mutate(bp.id, {
      onSuccess: ({ url }) => {
        setPendingId(null);
        if (typeof window !== 'undefined') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      },
      onError: (err: unknown) => {
        setPendingId(null);
        const msg = err instanceof Error ? err.message : 'Checkout failed';
        setErrorByBp((prev) => ({ ...prev, [bp.id]: msg }));
      },
    });
  };

  return (
    <ScrollView
      style={s.body}
      contentContainerStyle={[
        s.bodyInner,
        isCompact && { paddingHorizontal: 16, paddingTop: 24, gap: 20 },
      ]}
    >
      {returnBanner ? (
        <View
          style={[
            s.returnBanner,
            returnBanner.kind === 'success' ? s.returnBannerOk : s.returnBannerWarn,
          ]}
        >
          <Ionicons
            name={returnBanner.kind === 'success' ? 'checkmark-circle' : 'warning'}
            size={18}
            color={returnBanner.kind === 'success' ? '#1E8F47' : '#C99632'}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.returnBannerTitle}>
              {returnBanner.kind === 'success'
                ? `You're subscribed${returnBp ? ` to ${returnBp.title}` : ''}.`
                : 'Subscription canceled before completion.'}
            </Text>
            <Text style={s.returnBannerCopy}>
              {returnBanner.kind === 'success'
                ? 'The steps are now in your timeline. Open the blueprint to start practicing.'
                : 'No charge was made. You can subscribe again any time.'}
            </Text>
          </View>
          {returnBanner.kind === 'success' && returnBp ? (
            <Pressable
              style={s.returnBannerCta}
              onPress={() => router.push(`/marketplace/${returnBp.id}` as any)}
            >
              <Text style={s.returnBannerCtaText}>Open</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setReturnBanner(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color="rgba(60, 60, 67, 0.55)" />
          </Pressable>
        </View>
      ) : null}

      <View style={s.header}>
        <Text style={s.eyebrow}>Marketplace</Text>
        <Text style={[s.h1, isCompact && { fontSize: 22 }]}>
          Blueprints from independent authors
        </Text>
        <Text style={s.lede}>
          Practical step-by-step playbooks you can subscribe to month-to-month. Authored by
          practitioners; payouts route via Stripe Connect.
        </Text>
      </View>

      {loading ? (
        <View style={s.loadingCard}>
          <ActivityIndicator color="#28406B" />
          <Text style={s.loadingText}>Loading marketplace…</Text>
        </View>
      ) : blueprints.length === 0 ? (
        <View style={s.emptyCard}>
          <Ionicons name="storefront-outline" size={28} color="rgba(60, 60, 67, 0.4)" />
          <Text style={s.emptyTitle}>No marketplace blueprints yet</Text>
          <Text style={s.emptyCopy}>
            Authors haven't listed any independent blueprints to Stripe yet. Check back soon —
            or, if you're an author, switch your blueprint to Independent and click "List on
            Stripe" in the Studio editor.
          </Text>
        </View>
      ) : (
        <View style={[s.grid, isCompact && { gap: 12 }]}>
          {blueprints.map((bp) => {
            const err = errorByBp[bp.id];
            const isPending = pendingId === bp.id;
            return (
              <View key={bp.id} style={[s.card, isCompact && s.cardCompact]}>
                <View style={s.cardCover}>
                  <View style={[s.cardCoverInk, { backgroundColor: aviTone(bp.authorTone) }]} />
                  <Text style={s.cardCoverTitle} numberOfLines={3}>
                    {bp.title}
                  </Text>
                </View>
                <View style={s.cardBody}>
                  <View style={s.authorRow}>
                    <View style={[s.avi, { backgroundColor: aviTone(bp.authorTone) }]}>
                      <Text style={s.aviText}>{bp.authorInitials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.authorName} numberOfLines={1}>
                        {bp.authorName}
                      </Text>
                      {bp.orgName ? (
                        <Text style={s.authorOrg} numberOfLines={1}>
                          {bp.orgName}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {bp.description ? (
                    <Text style={s.cardDesc} numberOfLines={3}>
                      {bp.description}
                    </Text>
                  ) : null}
                  <View style={s.priceRow}>
                    <Text style={s.priceMain}>
                      {formatPrice(bp.pricePerSeatCents, bp.billingCadence)}
                    </Text>
                    {bp.trialDays > 0 && bp.billingCadence !== 'one_time' ? (
                      <Text style={s.priceTrial}>· {bp.trialDays}-day trial</Text>
                    ) : null}
                  </View>
                  {err ? (
                    <View style={s.errorBox}>
                      <Ionicons name="warning" size={12} color="#C0392B" />
                      <Text style={s.errorText}>{err}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    style={[s.btnPrimary, isPending && { opacity: 0.6 }]}
                    disabled={isPending}
                    onPress={() => handleSubscribe(bp)}
                  >
                    <Ionicons
                      name={isPending ? 'sync' : 'card-outline'}
                      size={13}
                      color="#FFFFFF"
                    />
                    <Text style={s.btnPrimaryText}>
                      {isPending
                        ? 'Opening Stripe…'
                        : signedIn
                          ? `Subscribe · ${formatPrice(bp.pricePerSeatCents, bp.billingCadence)}`
                          : 'Sign in to subscribe'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={s.footer}>
        <Text style={s.footerCopy}>
          Payouts route via real Stripe Connect — authors keep up to 70%; the platform takes a
          30% application fee + handles refunds + 1099s. Stripe handles all card data; BetterAt
          never touches it.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#F5F4EE' },
  bodyInner: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 60,
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    gap: 28,
  },
  returnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  returnBannerOk: {
    backgroundColor: 'rgba(30, 143, 71, 0.10)',
    borderColor: 'rgba(30, 143, 71, 0.25)',
  },
  returnBannerWarn: {
    backgroundColor: 'rgba(201, 150, 50, 0.12)',
    borderColor: 'rgba(201, 150, 50, 0.30)',
  },
  returnBannerTitle: { fontSize: 13.5, fontWeight: '600', color: '#1C1C1E' },
  returnBannerCopy: { fontSize: 12, color: 'rgba(60, 60, 67, 0.7)', marginTop: 2 },
  returnBannerCta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#28406B',
  },
  returnBannerCtaText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '600' },

  header: { gap: 6, maxWidth: 640 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.6)',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  h1: { fontSize: 30, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.5, marginTop: 4 },
  lede: {
    fontSize: 14,
    color: 'rgba(60, 60, 67, 0.75)',
    lineHeight: 20,
    marginTop: 6,
  },
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
    padding: 28,
    gap: 8,
    alignItems: 'center',
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
    maxWidth: 460,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    width: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  cardCompact: { width: '100%' as const },
  cardCover: {
    height: 140,
    backgroundColor: '#28406B',
    padding: 16,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  cardCoverInk: {
    position: 'absolute',
    inset: 0,
    opacity: 0.85,
  },
  cardCoverTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    zIndex: 2,
  },
  cardBody: { padding: 16, gap: 12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avi: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  authorName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  authorOrg: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)', marginTop: 2 },
  cardDesc: {
    fontSize: 12.5,
    color: 'rgba(60, 60, 67, 0.75)',
    lineHeight: 18,
    minHeight: 36,
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  priceMain: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', letterSpacing: -0.3 },
  priceTrial: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(192, 57, 43, 0.10)',
  },
  errorText: { fontSize: 11.5, color: '#C0392B', flex: 1 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#28406B',
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  footer: {
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  footerCopy: {
    fontSize: 12,
    color: 'rgba(60, 60, 67, 0.6)',
    lineHeight: 18,
    maxWidth: 640,
  },
});
