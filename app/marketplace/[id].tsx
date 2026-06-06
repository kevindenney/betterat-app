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
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplaceBlueprint } from '@/hooks/useMarketplaceBlueprint';
import { useMarketplaceCheckout } from '@/hooks/useMarketplaceBlueprints';
import { WebMeta } from '@/components/marketplace/WebMeta';

/** Lighten (amount > 0) or darken (amount < 0) a hex colour for the hero gradient. */
function shade(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const to = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const ch = (c: number) => Math.round(c + (to - c) * t);
  const r = ch(parseInt(m[1], 16));
  const g = ch(parseInt(m[2], 16));
  const b = ch(parseInt(m[3], 16));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

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

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(p));
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  const initials = (first + last).toUpperCase();
  return initials || name.slice(0, 2).toUpperCase() || 'AU';
}

function toneFromAuthorId(uid: string | null): string {
  if (!uid) return '#28406B';
  const palette = ['#28406B', '#8B5A3C', '#B8855A', '#6E8B5A', '#7A5A8B'];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export default function MarketplaceBlueprintPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isCompact = width < 640;
  const { user, isGuest } = useAuth();
  const signedIn = !!user && !isGuest;
  const { result, loading, upsertReview, deleteReview } = useMarketplaceBlueprint(id);
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

  const { blueprint, hasAccess, subscription, steps, reviews, myReview } = result;

  // The marketplace detail RPC has no interest accent column, so tint the hero
  // from the author's stable tone — an author's blueprints all read one colour.
  const accent = toneFromAuthorId(blueprint.authorUserId);
  const isWide = width >= 900;

  const categoryCounts = new Map<string, number>();
  for (const step of steps) {
    categoryCounts.set(step.category, (categoryCounts.get(step.category) ?? 0) + 1);
  }
  const categorySummary = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      count,
      tone: CATEGORY_TONE[key] ?? CATEGORY_TONE.other,
    }));

  // Plan → Do → Review → Discuss band. A subscriber lights phases from their own
  // progress; a browsing visitor sees only Plan live (the journey ahead).
  const completedSteps = steps.filter((st) => st.buyerStatus === 'completed').length;
  const anyStarted = steps.some(
    (st) => st.buyerStatus === 'in_progress' || st.buyerStatus === 'completed',
  );
  const phaseBand: { label: string; on: boolean }[] = [
    { label: 'Plan', on: true },
    { label: 'Do', on: anyStarted },
    { label: 'Review', on: completedSteps > 0 },
    { label: 'Discuss', on: steps.length > 0 && completedSteps === steps.length },
  ];

  const priceText = formatPrice(blueprint.pricePerSeatCents, blueprint.billingCadence);
  const isFreeTrial = blueprint.trialDays > 0 && blueprint.billingCadence !== 'one_time';
  const subscribeLabel = `Subscribe · ${priceText}`;
  const authorRole = blueprint.orgName ?? 'Independent author';
  const orgInitial = (blueprint.orgName?.trim()?.[0] ?? '•').toUpperCase();

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

  const stepsCard = (
    <View style={s.stepsCard}>
      <View style={s.stepsHead}>
        <Text style={s.eyebrow}>
          {hasAccess ? 'Steps' : `${steps.length} steps · preview`}
        </Text>
        <Text style={s.h2}>
          {hasAccess
            ? `What you'll work through · ${steps.length} step${steps.length === 1 ? '' : 's'}`
            : "Here's the shape of the playbook"}
        </Text>
      </View>
      {steps.length === 0 ? (
        <Text style={s.muted}>
          {hasAccess
            ? 'This blueprint has no steps published yet.'
            : 'The author is still drafting the step list.'}
        </Text>
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
                <View style={[s.stepIndex, { backgroundColor: accent }]}>
                  <Text style={s.stepIndexText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.stepTitle}>{step.title}</Text>
                  {step.description ? (
                    <Text style={s.stepDescription}>{step.description}</Text>
                  ) : null}
                  {step.whatQuestion ? (
                    <View style={[s.whatRow, { borderColor: accent + '33' }]}>
                      <Text style={[s.whatKey, { color: accent }]}>Ask</Text>
                      <Text style={s.whatVal}>{step.whatQuestion}</Text>
                    </View>
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
                {!hasAccess ? (
                  <Ionicons
                    name="lock-closed"
                    size={14}
                    color="rgba(60, 60, 67, 0.4)"
                    style={{ marginTop: 8 }}
                  />
                ) : null}
              </View>
            );
          })}
          {!hasAccess ? (
            <View style={s.lockedFooter}>
              <Text style={s.lockedFooterText}>
                Full step content unlocks the moment you subscribe.
                {isFreeTrial ? ` Try free for ${blueprint.trialDays} days.` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={s.body} contentContainerStyle={s.scrollContent}>
      <WebMeta
        title={`${blueprint.title} · BetterAt Marketplace`}
        description={
          blueprint.description ??
          `${blueprint.title} — a step-by-step blueprint by ${blueprint.authorName}${
            blueprint.orgName ? ` (${blueprint.orgName})` : ''
          }.`
        }
        ogType="product"
        url={typeof window !== 'undefined' ? window.location.href : undefined}
        priceAmount={blueprint.pricePerSeatCents / 100}
        priceCurrency="USD"
      />

      <Pressable style={s.backRow} onPress={() => router.replace('/marketplace' as any)} hitSlop={8}>
        <Ionicons name="chevron-back" size={15} color="#28406B" />
        <Text style={s.backText}>Marketplace</Text>
      </Pressable>

      {/* Accent-tinted gradient hero — tinted from the author's tone */}
      <LinearGradient
        colors={[accent, shade(accent, -0.4)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <Text style={s.heroEyebrow}>Marketplace blueprint</Text>
        <Text style={[s.heroTitle, isCompact && { fontSize: 24, lineHeight: 30 }]}>
          {blueprint.title}
        </Text>
        {blueprint.description ? <Text style={s.heroLede}>{blueprint.description}</Text> : null}
        <View style={s.heroMeta}>
          <View style={s.heroMetaItem}>
            <Ionicons name="layers-outline" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={s.heroMetaText}>
              {steps.length} step{steps.length === 1 ? '' : 's'}
            </Text>
          </View>
          {isFreeTrial ? (
            <View style={s.heroMetaItem}>
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={s.heroMetaText}>{blueprint.trialDays}-day trial</Text>
            </View>
          ) : null}
          {blueprint.activeSubscriberCount > 0 ? (
            <View style={s.heroMetaItem}>
              <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={s.heroMetaText}>
                {blueprint.activeSubscriberCount} subscriber{blueprint.activeSubscriberCount === 1 ? '' : 's'}
              </Text>
            </View>
          ) : null}
          {blueprint.ratingCount > 0 ? (
            <View style={s.heroMetaItem}>
              <Ionicons name="star" size={13} color="rgba(255,255,255,0.9)" />
              <Text style={s.heroMetaText}>
                {(blueprint.ratingAvg ?? 0).toFixed(1)} · {blueprint.ratingCount}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Plan → Do → Review → Discuss phase band */}
        <View style={s.arc}>
          {phaseBand.map((ph) => (
            <View key={ph.label} style={[s.phasePill, ph.on && s.phasePillOn]}>
              <Text style={[s.phasePillText, ph.on && s.phasePillTextOn]}>{ph.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Provenance — who authored this, plus a live subscription chip */}
      <View style={s.provenance}>
        {blueprint.authorUserId ? (
          <Pressable
            style={s.provChip}
            onPress={() => router.push(`/marketplace?author=${blueprint.authorUserId}` as any)}
          >
            <View style={[s.provAvatar, { backgroundColor: accent }]}>
              <Text style={s.provAvatarText}>{initialsFromName(blueprint.authorName)}</Text>
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={s.provName} numberOfLines={1}>{blueprint.authorName}</Text>
              <Text style={s.provRole} numberOfLines={1}>{authorRole}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={s.provChip}>
            <View style={[s.provAvatar, { backgroundColor: accent }]}>
              <Text style={s.provAvatarText}>{initialsFromName(blueprint.authorName)}</Text>
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={s.provName} numberOfLines={1}>{blueprint.authorName}</Text>
              <Text style={s.provRole} numberOfLines={1}>{authorRole}</Text>
            </View>
          </View>
        )}
        {blueprint.orgName ? (
          <View style={s.provChip}>
            <View style={[s.provOrgMark, { backgroundColor: accent }]}>
              <Text style={s.provOrgMarkText}>{orgInitial}</Text>
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={s.provName} numberOfLines={1}>{blueprint.orgName}</Text>
              <Text style={s.provRole}>Publishing org</Text>
            </View>
          </View>
        ) : null}
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

      {/* Two-column body: step ladder (main) + subscribe/at-a-glance (side) */}
      <View style={[s.bodyGrid, isWide && s.bodyGridWide]}>
        <View style={[s.side, isWide && s.sideWide]}>
          <View style={s.sideCard}>
            <View style={s.priceHeader}>
              <Text style={[s.bigPrice, { color: accent }]}>{priceText}</Text>
              <Text style={s.accessLineText}>
                {isFreeTrial
                  ? `${blueprint.trialDays}-day free trial · cancel anytime`
                  : 'Cancel anytime · 70% to author'}
              </Text>
            </View>

            {!hasAccess ? (
              <Pressable
                style={[s.btnPrimary, { backgroundColor: accent }, pending && { opacity: 0.55 }]}
                disabled={pending}
                onPress={handleSubscribe}
              >
                <Ionicons name={pending ? 'sync' : 'card-outline'} size={15} color="#FFFFFF" />
                <Text style={s.btnPrimaryText}>
                  {pending ? 'Opening Stripe…' : signedIn ? subscribeLabel : 'Sign in to subscribe'}
                </Text>
              </Pressable>
            ) : (
              <View style={s.haveAccessNote}>
                <Ionicons name="checkmark-circle" size={15} color="#1E8F47" />
                <Text style={s.haveAccessText}>
                  You have access — the steps below are unlocked.
                </Text>
              </View>
            )}

            {error ? (
              <View style={s.errorBox}>
                <Ionicons name="warning" size={14} color="#C0392B" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={s.adoptHelper}>
              Steps land on your own timeline — work them on shift, review when you&apos;re done.
            </Text>
          </View>

          <View style={s.glanceCard}>
            <Text style={s.glanceTitle}>At a glance</Text>
            <View style={s.glanceGrid}>
              <View style={s.glanceCell}>
                <Text style={[s.glanceNum, { color: accent }]}>{steps.length}</Text>
                <Text style={s.glanceLabel}>{steps.length === 1 ? 'step' : 'steps'}</Text>
              </View>
              {isFreeTrial ? (
                <View style={s.glanceCell}>
                  <Text style={[s.glanceNum, { color: accent }]}>{blueprint.trialDays}</Text>
                  <Text style={s.glanceLabel}>day trial</Text>
                </View>
              ) : null}
              {blueprint.activeSubscriberCount > 0 ? (
                <View style={s.glanceCell}>
                  <Text style={[s.glanceNum, { color: accent }]}>
                    {blueprint.activeSubscriberCount}
                  </Text>
                  <Text style={s.glanceLabel}>subscribers</Text>
                </View>
              ) : null}
              {blueprint.ratingCount > 0 ? (
                <View style={s.glanceCell}>
                  <Text style={[s.glanceNum, { color: accent }]}>
                    {(blueprint.ratingAvg ?? 0).toFixed(1)}
                  </Text>
                  <Text style={s.glanceLabel}>rating</Text>
                </View>
              ) : null}
            </View>
            {categorySummary.length > 0 ? (
              <View style={s.glanceTags}>
                {categorySummary.map(({ key, count, tone }) => (
                  <View key={key} style={[s.categoryChip, { backgroundColor: tone.bg }]}>
                    <Text style={[s.categoryChipText, { color: tone.fg }]}>
                      {count} {tone.label.toLowerCase()}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {blueprint.authorBio ? (
            <View style={s.authorBioBox}>
              <Text style={s.authorBioLabel}>About {blueprint.authorName}</Text>
              <Text style={s.authorBioText}>{blueprint.authorBio}</Text>
            </View>
          ) : null}
        </View>

        <View style={[s.main, isWide && s.mainWide]}>
          {stepsCard}
          <ReviewsSection
            ratingAvg={blueprint.ratingAvg}
            ratingCount={blueprint.ratingCount}
            reviews={reviews}
            myReview={myReview}
            canWrite={!!subscription}
            upsertReview={upsertReview}
            deleteReview={deleteReview}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function ReviewsSection({
  ratingAvg,
  ratingCount,
  reviews,
  myReview,
  canWrite,
  upsertReview,
  deleteReview,
}: {
  ratingAvg: number | null;
  ratingCount: number;
  reviews: import('@/hooks/useMarketplaceBlueprint').MarketplaceReview[];
  myReview: import('@/hooks/useMarketplaceBlueprint').MyReview | null;
  canWrite: boolean;
  upsertReview: ReturnType<typeof useMarketplaceBlueprint>['upsertReview'];
  deleteReview: ReturnType<typeof useMarketplaceBlueprint>['deleteReview'];
}) {
  const [editing, setEditing] = React.useState(false);
  const [rating, setRating] = React.useState(myReview?.rating ?? 5);
  const [body, setBody] = React.useState(myReview?.body ?? '');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!editing) {
      setRating(myReview?.rating ?? 5);
      setBody(myReview?.body ?? '');
    }
  }, [myReview, editing]);

  const submit = () => {
    setError(null);
    upsertReview.mutate(
      { rating, body: body.trim() || null },
      {
        onSuccess: () => setEditing(false),
        onError: (err: unknown) =>
          setError(err instanceof Error ? err.message : 'Failed to save'),
      },
    );
  };

  return (
    <View style={s.reviewsCard}>
      <View style={s.reviewsHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>Reviews</Text>
          <View style={s.ratingSummary}>
            {ratingCount > 0 ? (
              <>
                <Ionicons name="star" size={14} color="#C99632" />
                <Text style={s.ratingSummaryValue}>
                  {(ratingAvg ?? 0).toFixed(1)}
                </Text>
                <Text style={s.ratingSummaryCount}>
                  · {ratingCount} review{ratingCount === 1 ? '' : 's'}
                </Text>
              </>
            ) : (
              <Text style={s.ratingSummaryCount}>
                No reviews yet — be the first
              </Text>
            )}
          </View>
        </View>
        {canWrite && !editing ? (
          <Pressable
            style={s.btnGhost}
            onPress={() => setEditing(true)}
          >
            <Ionicons name="create-outline" size={13} color="#28406B" />
            <Text style={s.btnGhostText}>
              {myReview ? 'Edit your review' : 'Write a review'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View style={s.reviewForm}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={4}>
                <Ionicons
                  name={n <= rating ? 'star' : 'star-outline'}
                  size={24}
                  color={n <= rating ? '#C99632' : 'rgba(60, 60, 67, 0.35)'}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What worked, what didn't, who is this for?"
            placeholderTextColor="rgba(60, 60, 67, 0.4)"
            style={s.reviewBodyInput}
            multiline
            numberOfLines={4}
          />
          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="warning" size={12} color="#C0392B" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
          <View style={s.reviewFormActions}>
            <Pressable
              style={s.btnGhost}
              onPress={() => {
                setEditing(false);
                setError(null);
              }}
            >
              <Text style={s.btnGhostText}>Cancel</Text>
            </Pressable>
            {myReview ? (
              <Pressable
                style={[s.btnGhost, { backgroundColor: 'rgba(192, 57, 43, 0.10)' }]}
                onPress={() => {
                  deleteReview.mutate(myReview.id);
                  setEditing(false);
                }}
              >
                <Text style={[s.btnGhostText, { color: '#C0392B' }]}>Delete</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[s.btnPrimary, upsertReview.isPending && { opacity: 0.6 }]}
              disabled={upsertReview.isPending}
              onPress={submit}
            >
              <Text style={s.btnPrimaryText}>
                {upsertReview.isPending ? 'Saving…' : myReview ? 'Update review' : 'Post review'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {reviews.length === 0 && !editing ? (
        <Text style={s.muted}>
          {canWrite
            ? 'Share what you thought after working through the steps.'
            : 'Subscribe to write a review.'}
        </Text>
      ) : (
        <View style={{ gap: 12 }}>
          {reviews.map((r) => (
            <View key={r.id} style={s.reviewRow}>
              <View style={s.reviewAvi}>
                <Text style={s.reviewAviText}>{r.reviewerInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.reviewName}>{r.reviewerName}</Text>
                  {r.isMine ? (
                    <View style={s.youChip}>
                      <Text style={s.youChipText}>You</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={n <= r.rating ? 'star' : 'star-outline'}
                      size={12}
                      color={n <= r.rating ? '#C99632' : 'rgba(60, 60, 67, 0.3)'}
                    />
                  ))}
                  <Text style={s.reviewDate}>
                    · {new Date(r.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                {r.body ? <Text style={s.reviewBody}>{r.body}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 60,
    maxWidth: 980,
    width: '100%',
    alignSelf: 'center',
    gap: 18,
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

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  backText: { fontSize: 13, fontWeight: '600', color: '#28406B' },

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

  // Accent-tinted gradient hero
  hero: {
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 26,
    gap: 12,
    overflow: 'hidden',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.78)',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  heroLede: { fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 21, maxWidth: 620 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginTop: 2 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroMetaText: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.92)' },

  // Plan → Do → Review → Discuss band
  arc: { flexDirection: 'row', gap: 7, marginTop: 16 },
  phasePill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  phasePillOn: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  phasePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.7)',
  },
  phasePillTextOn: { color: '#FFFFFF' },

  // Provenance row
  provenance: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  provChip: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingRight: 4 },
  provAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  provAvatarText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  provName: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  provRole: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.65)' },
  provOrgMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  provOrgMarkText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  // Two-column body
  bodyGrid: { flexDirection: 'column', gap: 18 },
  bodyGridWide: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 22 },
  side: { gap: 14 },
  sideWide: { width: 320, flexShrink: 0 },
  main: { gap: 18 },
  mainWide: { flex: 1, minWidth: 0 },

  sideCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 12,
  },
  priceHeader: { gap: 3 },
  bigPrice: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  accessLineText: { fontSize: 12, color: 'rgba(60, 60, 67, 0.7)' },
  haveAccessNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 143, 71, 0.08)',
  },
  haveAccessText: { flex: 1, fontSize: 12.5, color: '#1E8F47', fontWeight: '600' },
  adoptHelper: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 16 },

  glanceCard: {
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 12,
  },
  glanceTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  glanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  glanceCell: { minWidth: 64, gap: 2 },
  glanceNum: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  glanceLabel: { fontSize: 11, color: 'rgba(60, 60, 67, 0.6)' },
  glanceTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  authorBioBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 6,
  },
  authorBioLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#28406B',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  authorBioText: { fontSize: 13, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 19 },
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

  whatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
    paddingLeft: 8,
    borderLeftWidth: 2,
  },
  whatKey: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  whatVal: { flex: 1, fontSize: 12, color: 'rgba(60, 60, 67, 0.8)', lineHeight: 17, fontStyle: 'italic' },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
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

  reviewsCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 14,
  },
  reviewsHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingSummaryValue: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  ratingSummaryCount: { fontSize: 13, color: 'rgba(60, 60, 67, 0.6)' },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
  },
  btnGhostText: { color: '#28406B', fontSize: 12.5, fontWeight: '600' },
  reviewForm: {
    gap: 10,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F5F4EE',
  },
  reviewBodyInput: {
    minHeight: 80,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.10)',
    fontSize: 13,
    color: '#1C1C1E',
    textAlignVertical: 'top',
    ...(typeof document !== 'undefined' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  reviewFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  reviewRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  reviewAvi: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#28406B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAviText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  reviewName: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  reviewDate: { fontSize: 11, color: 'rgba(60, 60, 67, 0.55)', marginLeft: 4 },
  reviewBody: { fontSize: 12.5, color: 'rgba(60, 60, 67, 0.85)', lineHeight: 18, marginTop: 6 },
  youChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(40, 64, 107, 0.10)',
  },
  youChipText: { fontSize: 10, fontWeight: '600', color: '#28406B' },

  lockedFooter: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(60, 60, 67, 0.05)',
    borderRadius: 8,
    marginTop: 4,
  },
  lockedFooterText: { fontSize: 11.5, color: 'rgba(60, 60, 67, 0.7)', lineHeight: 16 },
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
