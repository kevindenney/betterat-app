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
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { WebMeta } from '@/components/marketplace/WebMeta';
import {
  useMarketplaceBlueprints,
  useMarketplaceCheckout,
  blueprintDetailHref,
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

// Timeline-source plans have no Stripe price — their CTA opens the public
// blueprint page (where the subscribe/adopt happens), so the label/icon
// differ from the Stripe checkout path.
function subscribeCta(
  bp: MarketplaceBlueprint,
  signedIn: boolean,
  pending: boolean,
): { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] } {
  if (bp.source === 'timeline') {
    return { label: 'View plan', icon: 'arrow-forward' };
  }
  if (pending) return { label: 'Opening Stripe…', icon: 'sync' };
  if (!signedIn) return { label: 'Sign in to subscribe', icon: 'card-outline' };
  return {
    label: `Subscribe · ${formatPrice(bp.pricePerSeatCents, bp.billingCadence)}`,
    icon: 'card-outline',
  };
}

export default function MarketplacePage() {
  const { user, isGuest } = useAuth();
  const signedIn = !!user && !isGuest;
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const params = useLocalSearchParams<{ stripe?: string; bp?: string; author?: string; interest?: string }>();
  const authorScope = (params.author as string | undefined) ?? null;
  const interestScope = (params.interest as string | undefined) ?? null;
  const { blueprints, loading } = useMarketplaceBlueprints();
  const checkout = useMarketplaceCheckout();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [errorByBp, setErrorByBp] = React.useState<Record<string, string>>({});

  // Surface a banner when Stripe redirected back from a Checkout
  // session. The flag dismisses on the user's click or after 10s.
  const [search, setSearch] = React.useState('');
  const [trialOnly, setTrialOnly] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return blueprints.filter((bp) => {
      if (authorScope && bp.authorUserId !== authorScope) return false;
      if (interestScope && bp.interestSlug !== interestScope) return false;
      if (trialOnly && (bp.trialDays <= 0 || bp.billingCadence === 'one_time')) return false;
      if (!q) return true;
      return (
        bp.title.toLowerCase().includes(q) ||
        bp.authorName.toLowerCase().includes(q) ||
        (bp.orgName ?? '').toLowerCase().includes(q) ||
        (bp.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [blueprints, search, trialOnly, authorScope, interestScope]);

  const scopedInterestName = React.useMemo(() => {
    if (!interestScope) return null;
    const match = blueprints.find((b) => b.interestSlug === interestScope);
    return match?.interestName ?? interestScope;
  }, [interestScope, blueprints]);

  const scopedAuthor = React.useMemo(
    () => (authorScope ? blueprints.find((b) => b.authorUserId === authorScope) ?? null : null),
    [authorScope, blueprints],
  );

  const stats = React.useMemo(() => {
    const authors = new Set<string>();
    let subscribers = 0;
    for (const bp of blueprints) {
      if (bp.authorUserId) authors.add(bp.authorUserId);
      subscribers += bp.activeSubscriberCount;
    }
    return { blueprints: blueprints.length, authors: authors.size, subscribers };
  }, [blueprints]);

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
    // Timeline-source plans have no Stripe price; route to their public
    // blueprint page, which carries the subscribe/adopt CTA.
    if (bp.source === 'timeline') {
      router.push(blueprintDetailHref(bp) as any);
      return;
    }
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
      <WebMeta
        title="Marketplace · BetterAt"
        description="Practical step-by-step blueprints from independent authors. Subscribe monthly, cancel anytime, payouts route via Stripe Connect."
        ogType="website"
        url={typeof window !== 'undefined' ? window.location.href : undefined}
      />
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
              onPress={() => router.push(blueprintDetailHref(returnBp) as any)}
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
        {scopedAuthor ? (
          <>
            <Text style={[s.h1, isCompact && { fontSize: 22 }]}>
              Blueprints by {scopedAuthor.authorName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <Pressable
                onPress={() => router.replace('/marketplace' as any)}
                hitSlop={6}
              >
                <Text style={s.scopeBack}>← Browse all marketplace</Text>
              </Pressable>
              {scopedAuthor.orgName ? (
                <Text style={s.scopeOrg}>· {scopedAuthor.orgName}</Text>
              ) : (
                <Text style={s.scopeOrg}>· Independent author</Text>
              )}
            </View>
            {scopedAuthor.authorBio ? (
              <Text style={s.scopeBio}>{scopedAuthor.authorBio}</Text>
            ) : null}
          </>
        ) : scopedInterestName ? (
          <>
            <Text style={[s.h1, isCompact && { fontSize: 22 }]}>
              {scopedInterestName} plans
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <Pressable onPress={() => router.replace('/marketplace' as any)} hitSlop={6}>
                <Text style={s.scopeBack}>← Browse all plans</Text>
              </Pressable>
            </View>
            <Text style={s.lede}>
              Subscribable step-by-step playbooks for {scopedInterestName.toLowerCase()}. Cancel
              anytime; payouts route via Stripe Connect.
            </Text>
          </>
        ) : (
          <>
            <Text style={[s.h1, isCompact && { fontSize: 22 }]}>
              Blueprints from independent authors
            </Text>
            <Text style={s.lede}>
              Practical step-by-step playbooks you can subscribe to month-to-month. Authored by
              practitioners; payouts route via Stripe Connect.
            </Text>
            {stats.blueprints > 0 ? (
              <View style={s.statRow}>
                <View style={s.statChip}>
                  <Text style={s.statNum}>{stats.blueprints}</Text>
                  <Text style={s.statLabel}>
                    blueprint{stats.blueprints === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={s.statChip}>
                  <Text style={s.statNum}>{stats.authors}</Text>
                  <Text style={s.statLabel}>
                    author{stats.authors === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={s.statChip}>
                  <Text style={s.statNum}>{stats.subscribers}</Text>
                  <Text style={s.statLabel}>active subscribers</Text>
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>

      {!scopedAuthor ? (
        <View style={[s.howRow, isCompact && { flexDirection: 'column', gap: 12 }]}>
          <View style={s.howStep}>
            <View style={s.howIco}>
              <Ionicons name="search" size={14} color="#28406B" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.howStepTitle}>Browse</Text>
              <Text style={s.howStepCopy}>
                Curated playbooks from practitioners. Read the curriculum, reviews, and bio
                before you subscribe.
              </Text>
            </View>
          </View>
          <View style={s.howStep}>
            <View style={s.howIco}>
              <Ionicons name="card" size={14} color="#28406B" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.howStepTitle}>Subscribe</Text>
              <Text style={s.howStepCopy}>
                Pay via Stripe. Cancel anytime. 70% routes to the author; the platform takes
                30%.
              </Text>
            </View>
          </View>
          <View style={s.howStep}>
            <View style={s.howIco}>
              <Ionicons name="git-branch" size={14} color="#28406B" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.howStepTitle}>Practice</Text>
              <Text style={s.howStepCopy}>
                Steps land in your timeline. Work through them on shift; review when you're
                done.
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {!loading && blueprints.length > 0 ? (
        <View style={[s.filterRow, isCompact && { flexDirection: 'column', gap: 10 }]}>
          <View style={[s.searchBox, isCompact && { width: '100%' }]}>
            <Ionicons name="search" size={14} color="rgba(60, 60, 67, 0.55)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search title, author, or org…"
              placeholderTextColor="rgba(60, 60, 67, 0.45)"
              style={s.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={14} color="rgba(60, 60, 67, 0.45)" />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            style={[s.filterChip, trialOnly && s.filterChipOn]}
            onPress={() => setTrialOnly((v) => !v)}
          >
            <Ionicons
              name={trialOnly ? 'checkmark' : 'time-outline'}
              size={13}
              color={trialOnly ? '#28406B' : 'rgba(60, 60, 67, 0.65)'}
            />
            <Text style={[s.filterChipText, trialOnly && s.filterChipTextOn]}>
              Trial available
            </Text>
          </Pressable>
          {search || trialOnly ? (
            <Text style={s.filterCount}>
              {filtered.length} of {blueprints.length}
            </Text>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={s.loadingCard}>
          <ActivityIndicator color="#28406B" />
          <Text style={s.loadingText}>Loading marketplace…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyCard}>
          <Ionicons
            name={blueprints.length === 0 ? 'storefront-outline' : 'search-outline'}
            size={28}
            color="rgba(60, 60, 67, 0.4)"
          />
          <Text style={s.emptyTitle}>
            {blueprints.length === 0
              ? 'No marketplace blueprints yet'
              : 'No matches for these filters'}
          </Text>
          <Text style={s.emptyCopy}>
            {blueprints.length === 0
              ? 'Authors haven\'t listed any independent blueprints to Stripe yet. Check back soon — or, if you\'re an author, switch your blueprint to Independent and click "List on Stripe" in the Studio editor.'
              : 'Try clearing the search or the Trial filter to see all blueprints again.'}
          </Text>
          {blueprints.length > 0 ? (
            <Pressable
              onPress={() => {
                setSearch('');
                setTrialOnly(false);
              }}
              style={s.btnPrimary}
            >
              <Text style={s.btnPrimaryText}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: isCompact ? 14 : 22 }}>
          {filtered.some((b) => b.isFeatured) ? (
            <View style={{ gap: 12 }}>
              <View style={s.railHead}>
                <Ionicons name="sparkles" size={14} color="#C99632" />
                <Text style={s.railTitle}>Featured</Text>
              </View>
              <View style={{ gap: 12 }}>
                {filtered
                  .filter((b) => b.isFeatured)
                  .map((bp) => (
                    <FeaturedHero
                      key={bp.id}
                      bp={bp}
                      isCompact={isCompact}
                      pending={pendingId === bp.id}
                      error={errorByBp[bp.id]}
                      signedIn={signedIn}
                      onSubscribe={() => handleSubscribe(bp)}
                      onOpen={() => router.push(blueprintDetailHref(bp) as any)}
                    />
                  ))}
              </View>
            </View>
          ) : null}

          {filtered.some((b) => !b.isFeatured) ? (
            <View style={{ gap: 12 }}>
              {filtered.some((b) => b.isFeatured) ? (
                <View style={s.railHead}>
                  <Ionicons name="grid-outline" size={14} color="rgba(60, 60, 67, 0.6)" />
                  <Text style={s.railTitle}>All blueprints</Text>
                </View>
              ) : null}
              <View style={[s.grid, isCompact && { gap: 12 }]}>
                {filtered
                  .filter((b) => !b.isFeatured)
                  .map((bp) => {
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
                  <View style={s.ratingRow}>
                    {bp.ratingCount > 0 ? (
                      <>
                        <Ionicons name="star" size={12} color="#C99632" />
                        <Text style={s.ratingValue}>
                          {(bp.ratingAvg ?? 0).toFixed(1)}
                        </Text>
                        <Text style={s.ratingCount}>
                          ({bp.ratingCount})
                        </Text>
                      </>
                    ) : null}
                    {bp.activeSubscriberCount > 0 ? (
                      <>
                        {bp.ratingCount > 0 ? (
                          <Text style={s.ratingDot}>·</Text>
                        ) : null}
                        <Ionicons name="people" size={12} color="rgba(60, 60, 67, 0.55)" />
                        <Text style={s.ratingCount}>
                          {bp.activeSubscriberCount} subscriber{bp.activeSubscriberCount === 1 ? '' : 's'}
                        </Text>
                      </>
                    ) : bp.ratingCount === 0 ? (
                      <Text style={s.ratingEmpty}>Be the first to try this</Text>
                    ) : null}
                  </View>
                  {err ? (
                    <View style={s.errorBox}>
                      <Ionicons name="warning" size={12} color="#C0392B" />
                      <Text style={s.errorText}>{err}</Text>
                    </View>
                  ) : null}
                  {(() => {
                    const cta = subscribeCta(bp, signedIn, isPending);
                    return (
                      <Pressable
                        style={[s.btnPrimary, isPending && { opacity: 0.6 }]}
                        disabled={isPending}
                        onPress={() => handleSubscribe(bp)}
                      >
                        <Ionicons name={cta.icon} size={13} color="#FFFFFF" />
                        <Text style={s.btnPrimaryText}>{cta.label}</Text>
                      </Pressable>
                    );
                  })()}
                </View>
              </View>
            );
          })}
              </View>
            </View>
          ) : null}
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

function FeaturedHero({
  bp,
  isCompact,
  pending,
  error,
  signedIn,
  onSubscribe,
  onOpen,
}: {
  bp: MarketplaceBlueprint;
  isCompact: boolean;
  pending: boolean;
  error: string | undefined;
  signedIn: boolean;
  onSubscribe: () => void;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={[s.featuredCard, isCompact && s.featuredCardCompact]}>
      <View style={[s.featuredCover, { backgroundColor: aviTone(bp.authorTone) }]}>
        <View style={s.featuredFlag}>
          <Ionicons name="sparkles" size={11} color="#FFFFFF" />
          <Text style={s.featuredFlagText}>Featured</Text>
        </View>
        <Text style={s.featuredCoverTitle} numberOfLines={3}>
          {bp.title}
        </Text>
      </View>
      <View style={[s.featuredBody, isCompact && { padding: 16 }]}>
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
        <Text style={s.featuredBlurb} numberOfLines={isCompact ? 3 : 2}>
          {bp.featuredBlurb ?? bp.description ?? ''}
        </Text>
        <View style={s.featuredFooter}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={s.priceRow}>
              <Text style={s.priceMain}>
                {formatPrice(bp.pricePerSeatCents, bp.billingCadence)}
              </Text>
              {bp.trialDays > 0 && bp.billingCadence !== 'one_time' ? (
                <Text style={s.priceTrial}>· {bp.trialDays}-day trial</Text>
              ) : null}
            </View>
            {bp.ratingCount > 0 || bp.activeSubscriberCount > 0 ? (
              <View style={s.ratingRow}>
                {bp.ratingCount > 0 ? (
                  <>
                    <Ionicons name="star" size={12} color="#C99632" />
                    <Text style={s.ratingValue}>{(bp.ratingAvg ?? 0).toFixed(1)}</Text>
                    <Text style={s.ratingCount}>
                      ({bp.ratingCount})
                    </Text>
                  </>
                ) : null}
                {bp.activeSubscriberCount > 0 ? (
                  <>
                    {bp.ratingCount > 0 ? (
                      <Text style={s.ratingDot}>·</Text>
                    ) : null}
                    <Ionicons name="people" size={12} color="rgba(60, 60, 67, 0.55)" />
                    <Text style={s.ratingCount}>
                      {bp.activeSubscriberCount} subscriber{bp.activeSubscriberCount === 1 ? '' : 's'}
                    </Text>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="warning" size={12} color="#C0392B" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
          {(() => {
            const cta = subscribeCta(bp, signedIn, pending);
            return (
              <Pressable
                style={[s.btnPrimary, pending && { opacity: 0.6 }]}
                disabled={pending}
                onPress={(e) => {
                  e.stopPropagation();
                  onSubscribe();
                }}
              >
                <Ionicons name={cta.icon} size={13} color="#FFFFFF" />
                <Text style={s.btnPrimaryText}>{cta.label}</Text>
              </Pressable>
            );
          })()}
        </View>
      </View>
    </Pressable>
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    minWidth: 280,
    flexGrow: 1,
    maxWidth: 480,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#1C1C1E',
    paddingVertical: 0,
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  filterChipOn: {
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    borderColor: 'rgba(40, 64, 107, 0.30)',
  },
  filterChipText: { fontSize: 12.5, fontWeight: '500', color: 'rgba(60, 60, 67, 0.75)' },
  filterChipTextOn: { color: '#28406B', fontWeight: '600' },
  filterCount: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)', marginLeft: 'auto' as const },

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
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -2 },
  ratingValue: { fontSize: 12.5, fontWeight: '600', color: '#1C1C1E' },
  ratingCount: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)' },
  ratingDot: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.35)' },
  ratingEmpty: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.45)' },
  scopeBack: { fontSize: 12.5, fontWeight: '600', color: '#28406B' },
  scopeOrg: { fontSize: 12, color: 'rgba(60, 60, 67, 0.6)' },
  scopeBio: {
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(60, 60, 67, 0.85)',
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(40, 64, 107, 0.25)',
  },
  howRow: {
    flexDirection: 'row',
    gap: 18,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  howStep: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  howIco: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepTitle: { fontSize: 13.5, fontWeight: '700', color: '#1C1C1E' },
  howStepCopy: { fontSize: 12, lineHeight: 17, color: 'rgba(60, 60, 67, 0.75)' },
  statRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', marginTop: 14 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 64, 107, 0.07)',
  },
  statNum: { fontSize: 14, fontWeight: '700', color: '#28406B', letterSpacing: -0.2 },
  statLabel: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.7)' },

  // Featured rail
  railHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  railTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.75)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  featuredCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  featuredCardCompact: { flexDirection: 'column' as const },
  featuredCover: {
    width: 280,
    minHeight: 220,
    padding: 22,
    justifyContent: 'flex-end',
    gap: 10,
  },
  featuredFlag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  featuredFlagText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5 },
  featuredCoverTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  featuredBody: { flex: 1, padding: 22, gap: 12 },
  featuredBlurb: { fontSize: 13.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 4,
  },
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
