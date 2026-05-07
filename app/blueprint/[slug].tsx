/**
 * Blueprint Public Page
 *
 * Landing page for a published blueprint. Shows the author's timeline steps
 * with a subscribe CTA. Accessible via /blueprint/{slug}.
 */

import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
  Animated,
  useWindowDimensions,
  type ViewStyle,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import {
  useBlueprint,
  useBlueprintSteps,
  useBlueprintSubscription,
  useSubscribe,
  useUnsubscribe,
  useAdoptBlueprintStep,
} from '@/hooks/useBlueprint';
import { getBlueprintAccessInfo, checkBlueprintPurchase, getPeerSubscriberTimelines } from '@/services/BlueprintService';
import { blueprintPaymentService } from '@/services/BlueprintPaymentService';
import { NotificationService } from '@/services/NotificationService';
import { PublishBlueprintSheet } from '@/components/blueprint/PublishBlueprintSheet';
import { StudentProgressSection } from '@/components/blueprint/StudentProgressSection';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { PeerTimeline } from '@/types/blueprint';

const C = {
  bg: '#F8FAFC',
  cardBg: '#FFFFFF',
  accent: '#00897B',
  accentBg: 'rgba(0,137,123,0.08)',
  accentLight: '#E0F2F1',
  border: '#E5E4E1',
  labelDark: '#1A1918',
  labelMid: '#6D6C6A',
  labelLight: '#9C9B99',
  gold: '#D4A64A',
  green: '#3D8A5A',
  coral: '#D89575',
} as const;

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  pending: { color: C.labelMid, icon: 'ellipse-outline', label: 'Pending' },
  in_progress: { color: C.gold, icon: 'play-circle', label: 'In Progress' },
  completed: { color: C.green, icon: 'checkmark-circle', label: 'Completed' },
  skipped: { color: C.coral, icon: 'close-circle-outline', label: 'Skipped' },
};

export default function BlueprintPage() {
  const { slug, auto_subscribe } = useLocalSearchParams<{ slug: string; auto_subscribe?: string }>();
  const router = useRouter();
  const { user, ready: authReady, loading: authLoading } = useAuth();

  const { data: blueprint, isLoading: blueprintLoading } = useBlueprint(slug);
  const { data: steps, isLoading: stepsLoading } = useBlueprintSteps(blueprint?.id);
  const { data: subscription } = useBlueprintSubscription(blueprint?.id);
  const { allInterests, switchInterest, addInterest } = useInterest();
  const subscribeMutation = useSubscribe();
  const unsubscribeMutation = useUnsubscribe();
  const adoptStepMutation = useAdoptBlueprintStep();

  // Access info for restricted blueprints (fetched when blueprint is null but might exist)
  const [accessInfo, setAccessInfo] = useState<{
    exists: boolean;
    access_level?: string;
    org_name?: string;
    org_slug?: string;
    title?: string;
  } | null>(null);
  const [justSubscribed, setJustSubscribed] = useState(false);
  const handlePurchaseRef = useRef<(() => void) | null>(null);
  const [adoptingAll, setAdoptingAll] = useState(false);
  const [adoptedCount, setAdoptedCount] = useState(0);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [previewStep, setPreviewStep] = useState<TimelineStepRecord | null>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [peerTimelines, setPeerTimelines] = useState<PeerTimeline[]>([]);
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && screenWidth > 640;

  // Fetch peer subscriber timelines for non-owners
  const isOwnerForPeers = user?.id === blueprint?.user_id;
  useEffect(() => {
    if (!blueprint || !user?.id || isOwnerForPeers) return;
    getPeerSubscriberTimelines(
      blueprint.id,
      user.id,
      blueprint.interest_id,
      blueprint.title,
    ).then(setPeerTimelines);
  }, [blueprint?.id, user?.id, isOwnerForPeers]);

  useEffect(() => {
    if (!blueprintLoading && !blueprint && slug) {
      getBlueprintAccessInfo(slug).then(setAccessInfo);
    }
  }, [blueprintLoading, blueprint, slug]);

  // Check purchase status for paid blueprints
  useEffect(() => {
    if (blueprint?.access_level === 'paid' && user?.id) {
      checkBlueprintPurchase(user.id, blueprint.id).then(({ purchased }) => {
        setHasPurchased(purchased);
      });
    }
  }, [blueprint?.id, blueprint?.access_level, user?.id]);

  // Handle return from Stripe checkout
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const bpId = params.get('blueprint_id');
    const purchasedParam = params.get('purchased');
    console.log('[BlueprintPage] Stripe return check:', { sessionId, bpId, purchasedParam, blueprintId: blueprint?.id, userId: user?.id });
    if (sessionId && bpId) {
      console.log('[BlueprintPage] Verifying purchase via session_id...');
      // Retry verification — webhook may not have fired yet when Stripe redirects back
      const verifyWithRetry = async (attempts = 0): Promise<void> => {
        const verified = await blueprintPaymentService.verifyPurchase(sessionId, bpId);
        console.log('[BlueprintPage] verifyPurchase result:', verified, 'attempt:', attempts);
        if (verified) {
          setHasPurchased(true);
          setJustSubscribed(true);
        } else if (attempts < 5) {
          // Wait 2s between retries (webhook typically fires within a few seconds)
          await new Promise((r) => setTimeout(r, 2000));
          return verifyWithRetry(attempts + 1);
        } else {
          console.warn('[BlueprintPage] Purchase verification failed after retries — webhook may be delayed');
        }
      };
      verifyWithRetry();
      // Clean up URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (purchasedParam === 'true' && blueprint?.id && user?.id) {
      console.log('[BlueprintPage] Checking purchase via purchased=true fallback...');
      checkBlueprintPurchase(user.id, blueprint.id).then(({ purchased }) => {
        console.log('[BlueprintPage] checkBlueprintPurchase result:', purchased);
        if (purchased) {
          setHasPurchased(true);
          setJustSubscribed(true);
        }
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [blueprint?.id, user?.id]);

  const isSubscribed = !!subscription;
  const isOwner = user?.id === blueprint?.user_id;

  // Auto-trigger purchase if user just signed up from a Buy click
  const autoPurchaseTriggered = useRef(false);
  useEffect(() => {
    if (!user || !blueprint || autoPurchaseTriggered.current || hasPurchased || isSubscribed) return;
    AsyncStorage.getItem('pending_blueprint_purchase').then((pendingSlug) => {
      if (pendingSlug === slug && !autoPurchaseTriggered.current) {
        autoPurchaseTriggered.current = true;
        AsyncStorage.removeItem('pending_blueprint_purchase');
        // Small delay to let the page fully render before redirecting to Stripe
        setTimeout(() => {
          handlePurchaseRef.current?.();
        }, 500);
      }
    });
  }, [user, blueprint, slug, hasPurchased, isSubscribed]);

  // Auto-subscribe when arriving with ?auto_subscribe=1 (e.g. from the HKDW
  // "Open Worlds 2027 prep plan" CTA). Free/public blueprints only — paid
  // blueprints route through the existing purchase flow.
  const autoSubscribeTriggered = useRef(false);
  useEffect(() => {
    if (autoSubscribeTriggered.current) return;
    if (auto_subscribe !== '1') return;
    if (!blueprint) return;

    // Wait for auth to settle before deciding signed-in vs signed-out.
    // Without this, a brief `user === null` window during auth bootstrap
    // (e.g. immediately after returnTo round-trip from /(auth)/login)
    // causes a flash-redirect to login before useAuth() hydrates.
    if (!authReady || authLoading) return;

    // Hold off while the FirebaseBridgeHandler is establishing the session
    // from URL tokens. Otherwise we race with the bridge: the blueprint page
    // sees `!user`, redirects to /(auth)/login, then the bridge finishes and
    // replaceState's the (now-stale) blueprint URL back over the login URL.
    // Same pattern AuthGate uses in app/_layout.tsx.
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      (window.location.search.includes('rf_access_token=') ||
        window.location.search.includes('rf_bridge_token='))
    ) {
      return;
    }

    // Signed-out: route through login, preserving the auto_subscribe flag so
    // we resume after auth.
    if (!user) {
      autoSubscribeTriggered.current = true;
      const returnTo = `/blueprint/${slug}?auto_subscribe=1`;
      router.replace({ pathname: '/(auth)/login', params: { returnTo } } as any);
      return;
    }

    // Don't auto-subscribe to paid blueprints — let the user see the price.
    if (blueprint.access_level === 'paid') return;

    // Already subscribed (or subscription query is still loading and we'll
    // re-run when it resolves). Once we know the answer, strip the param.
    if (subscription === undefined) return;

    autoSubscribeTriggered.current = true;

    const stripParam = () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const u = new URL(window.location.href);
        u.searchParams.delete('auto_subscribe');
        window.history.replaceState({}, '', u.pathname + u.search + u.hash);
      }
    };

    if (subscription) {
      stripParam();
      return;
    }

    subscribeMutation
      .mutateAsync(blueprint.id)
      .then(async () => {
        setJustSubscribed(true);
        if (blueprint.user_id !== user.id) {
          NotificationService
            .notifyBlueprintSubscribed({
              blueprintOwnerId: blueprint.user_id,
              subscriberId: user.id,
              subscriberName: user.user_metadata?.full_name || user.email || 'Someone',
              blueprintId: blueprint.id,
              blueprintTitle: blueprint.title,
            })
            .catch(() => {});
        }

        // Switch the user's active interest to the blueprint's interest so a
        // back-arrow / next visit lands them where the steps actually live.
        // Adding to user_interests first prevents InterestProvider's
        // "auto-correct active slug" effect from immediately reverting it.
        const targetInterestSlug = blueprint.interest_id
          ? allInterests.find((i) => i.id === blueprint.interest_id)?.slug
          : null;
        if (targetInterestSlug) {
          try {
            await addInterest(targetInterestSlug);
            await switchInterest(targetInterestSlug);
          } catch (e) {
            console.warn('[BlueprintPage] interest switch failed:', e);
          }
        }

        // Set a one-shot welcome flag so the timeline shows a welcome card
        // after we navigate away from the blueprint page.
        try {
          await AsyncStorage.setItem(
            `betterat_blueprint_welcome:${slug}`,
            String(Date.now()),
          );
        } catch {}

        // Route the sailor to their timeline. The blueprint page is the
        // pitch; the timeline is the product. Use replace so the back-arrow
        // doesn't return them to the now-stale blueprint page.
        router.replace('/(tabs)/races' as any);
      })
      .catch((err) => {
        console.warn('[BlueprintPage] auto-subscribe failed:', err);
      })
      .finally(stripParam);
  }, [auto_subscribe, user, authReady, authLoading, blueprint, subscription, slug, router, subscribeMutation, allInterests, addInterest, switchInterest]);

  const blueprintInterestSlug = blueprint?.interest_id
    ? allInterests.find((i) => i.id === blueprint.interest_id)?.slug
    : undefined;

  const handleSubscribe = useCallback(async () => {
    if (!user) {
      router.push({
        pathname: '/(auth)/signup',
        params: {
          interest: blueprintInterestSlug,
          returnTo: `/blueprint/${slug}`,
        },
      } as any);
      return;
    }
    if (!blueprint) return;

    if (isSubscribed) {
      await unsubscribeMutation.mutateAsync(blueprint.id);
      setJustSubscribed(false);
    } else {
      await subscribeMutation.mutateAsync(blueprint.id);
      setJustSubscribed(true);

      // Notify the blueprint owner (best-effort, don't block)
      if (blueprint.user_id !== user.id) {
        NotificationService
          .notifyBlueprintSubscribed({
            blueprintOwnerId: blueprint.user_id,
            subscriberId: user.id,
            subscriberName: user.user_metadata?.full_name || user.email || 'Someone',
            blueprintId: blueprint.id,
            blueprintTitle: blueprint.title,
          })
          .catch(() => {}); // non-blocking
      }
    }
  }, [user, blueprint, isSubscribed, subscribeMutation, unsubscribeMutation, router]);

  const handlePurchase = useCallback(async () => {
    if (!user) {
      // Store purchase intent so we auto-trigger checkout after signup
      AsyncStorage.setItem('pending_blueprint_purchase', slug as string);
      router.push({
        pathname: '/(auth)/signup',
        params: {
          interest: blueprintInterestSlug,
          returnTo: `/blueprint/${slug}`,
        },
      } as any);
      return;
    }
    if (!blueprint) return;

    setPurchasing(true);
    try {
      const baseUrl = Platform.OS === 'web' ? window.location.origin : 'betterat://';
      const blueprintUrl = `${baseUrl}/blueprint/${blueprint.slug}`;
      // Don't add query params — the edge function appends ?session_id=...&blueprint_id=...
      const result = await blueprintPaymentService.purchaseBlueprint(
        user.id,
        blueprint.id,
        blueprintUrl,
        blueprintUrl,
      );

      if (result.free) {
        // Org member bypass or free blueprint — auto-subscribed
        setHasPurchased(true);
        setJustSubscribed(true);
        return;
      }

      if (result.url && Platform.OS === 'web') {
        window.location.href = result.url;
        return;
      }

      if (!result.success) {
        // TODO: show error toast
        console.error('Purchase failed:', result.error);
      }
    } finally {
      setPurchasing(false);
    }
  }, [user, blueprint, router]);

  // Keep ref in sync so auto-purchase effect can call it
  handlePurchaseRef.current = handlePurchase;

  const navigateToTimeline = useCallback(async () => {
    // Switch to the blueprint's interest before navigating to timeline
    if (blueprint?.interest_id) {
      const interest = allInterests.find((i) => i.id === blueprint.interest_id);
      if (interest) {
        await switchInterest(interest.slug);
      }
    }
    router.push('/(tabs)/races' as any);
  }, [blueprint?.interest_id, allInterests, switchInterest, router]);

  const handleAdoptAll = useCallback(async () => {
    if (!subscription || !blueprint || !steps?.length) return;
    setAdoptingAll(true);
    let count = 0;
    for (const step of steps) {
      try {
        await adoptStepMutation.mutateAsync({
          sourceStepId: step.id,
          interestId: blueprint.interest_id,
          subscriptionId: subscription.id,
        });
        count++;
      } catch {
        // Step may already be adopted — continue
      }
    }
    setAdoptedCount(count);
    setAdoptingAll(false);
  }, [subscription, blueprint, steps, adoptStepMutation]);

  // Build "What's included" summary from step metadata
  const includedSummary = useMemo(() => {
    if (!steps?.length) return null;
    let totalSubSteps = 0;
    const allSkills: string[] = [];
    for (const s of steps) {
      const meta = s.metadata as Record<string, any> | undefined;
      const plan = meta?.plan ?? {};
      totalSubSteps += (plan.how_sub_steps || []).length;
      for (const skill of (plan.capability_goals || [])) {
        if (!allSkills.includes(skill)) allSkills.push(skill);
      }
    }
    return { totalSubSteps, skills: allSkills.slice(0, 6) };
  }, [steps]);

  // Sticky header on scroll
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setShowStickyHeader(y > 200);
  }, []);

  const Container = Platform.OS === 'web' ? View : SafeAreaView;
  const containerStyle: ViewStyle[] =
    Platform.OS === 'web'
      ? [styles.container, styles.webContainer]
      : [styles.container];

  if (blueprintLoading) {
    return (
      <Container style={containerStyle}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </Container>
    );
  }

  if (!blueprint) {
    // Check if it's access-restricted vs truly not found
    const isRestricted = accessInfo?.exists && accessInfo?.access_level !== 'public';
    const isPaid = accessInfo?.access_level === 'paid';
    const priceCents = (accessInfo as any)?.price_cents;

    return (
      <Container style={containerStyle}>
        <View style={styles.emptyContainer}>
          <Ionicons
            name={isPaid ? 'pricetag-outline' : isRestricted ? 'lock-closed-outline' : 'layers-outline'}
            size={48}
            color={isPaid ? C.gold : C.labelLight}
          />
          <Text style={styles.emptyTitle}>
            {isPaid ? 'Premium Blueprint' : isRestricted ? 'Members Only Blueprint' : 'Blueprint not found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isPaid
              ? `"${accessInfo?.title}" is available for purchase${priceCents ? ` ($${(priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2)})` : ''}. Sign in to buy.`
              : isRestricted
                ? `"${accessInfo?.title}" is available to members of ${accessInfo?.org_name ?? 'this organization'}. Join to subscribe.`
                : 'This blueprint may have been unpublished or the URL is incorrect.'}
          </Text>
          {isPaid && !user && (
            <Pressable
              style={styles.joinOrgBtn}
              onPress={() => router.push({
                pathname: '/(auth)/signup',
                params: {
                  returnTo: `/blueprint/${slug}`,
                },
              } as any)}
            >
              <Ionicons name="log-in-outline" size={16} color="#FFFFFF" />
              <Text style={styles.joinOrgBtnText}>Sign in to purchase</Text>
            </Pressable>
          )}
          {isRestricted && !isPaid && accessInfo?.org_slug && (
            <Pressable
              style={styles.joinOrgBtn}
              onPress={() => router.push(`/org/${accessInfo.org_slug}` as any)}
            >
              <Ionicons name="business-outline" size={16} color="#FFFFFF" />
              <Text style={styles.joinOrgBtnText}>
                Join {accessInfo.org_name}
              </Text>
            </Pressable>
          )}
        </View>
      </Container>
    );
  }

  const completedCount = steps?.filter((s) => s.status === 'completed').length ?? 0;
  const totalCount = steps?.length ?? 0;

  // Price helper
  const priceLabel = blueprint.price_cents && blueprint.price_cents > 0
    ? `$${(blueprint.price_cents / 100).toFixed(blueprint.price_cents % 100 === 0 ? 0 : 2)}`
    : null;

  return (
    <Container style={containerStyle}>
      {/* Navigation header */}
      <View style={styles.navHeader}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/races' as any)}
        >
          <Ionicons name="arrow-back" size={20} color={C.accent} />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

      {/* Sticky header — appears on scroll */}
      {showStickyHeader && (
        <View style={styles.stickyHeader}>
          <Text style={styles.stickyTitle} numberOfLines={1}>{blueprint.title}</Text>
          {!isOwner && !isSubscribed && !hasPurchased && priceLabel ? (
            <Pressable style={styles.stickyCTA} onPress={handlePurchase}>
              <Text style={styles.stickyCTAText}>Buy for {priceLabel}</Text>
            </Pressable>
          ) : !isOwner && !isSubscribed && !hasPurchased ? (
            <Pressable style={styles.stickyCTA} onPress={handleSubscribe}>
              <Text style={styles.stickyCTAText}>Subscribe</Text>
            </Pressable>
          ) : isOwner ? (
            <View style={styles.stickyOwnerBadge}>
              <Ionicons name="person-circle-outline" size={14} color={C.accent} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.accent }}>Your Blueprint</Text>
            </View>
          ) : null}
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Hero */}
        <View
          style={styles.hero}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="layers" size={28} color={C.accent} />
          </View>
          <Text style={styles.heroTitle}>{blueprint.title}</Text>
          {blueprint.description ? (
            <Text style={styles.heroDescription}>{blueprint.description}</Text>
          ) : isOwner ? (
            <Pressable onPress={() => setShowEditSheet(true)}>
              <Text style={[styles.heroDescription, { color: C.labelLight, fontStyle: 'italic' }]}>
                Tap to add a description...
              </Text>
            </Pressable>
          ) : null}

          {/* Organization badge */}
          {blueprint.organization_name && (
            <Pressable
              style={styles.orgBadgeRow}
              onPress={() => {
                if (blueprint.organization_slug) {
                  router.push(`/org/${blueprint.organization_slug}` as any);
                }
              }}
            >
              <Ionicons name="business-outline" size={14} color={C.accent} />
              <Text style={styles.orgBadgeText}>
                Published by {blueprint.organization_name}
              </Text>
              {blueprint.access_level === 'org_members' && (
                <View style={styles.membersOnlyBadge}>
                  <Ionicons name="lock-closed" size={8} color={C.accent} />
                  <Text style={styles.membersOnlyText}>Members</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Author */}
          <Pressable
            style={styles.authorRow}
            onPress={() => router.push(`/person/${blueprint.user_id}` as any)}
          >
            <View
              style={[
                styles.authorAvatar,
                { backgroundColor: blueprint.author_avatar_color ?? C.accentBg },
              ]}
            >
              <Text style={styles.authorEmoji}>
                {blueprint.author_avatar_emoji ?? '👤'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>
                {blueprint.author_name ?? 'Anonymous'}
              </Text>
              <Text style={styles.authorMeta}>
                {blueprint.subscriber_count} subscriber
                {blueprint.subscriber_count !== 1 ? 's' : ''} · {totalCount} step
                {totalCount !== 1 ? 's' : ''}
              </Text>
              {blueprint.author_bio ? (
                <Text style={styles.authorBio} numberOfLines={2}>{blueprint.author_bio}</Text>
              ) : null}
            </View>
          </Pressable>

          {/* Price badge for paid blueprints — shown to everyone including owner */}
          {blueprint.access_level === 'paid' && blueprint.price_cents && blueprint.price_cents > 0 && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>
                ${(blueprint.price_cents / 100).toFixed(blueprint.price_cents % 100 === 0 ? 0 : 2)}
              </Text>
              <Text style={styles.priceSubtext}>
                {blueprint.pricing_type === 'recurring' ? 'per month' : 'one-time purchase'}
              </Text>
            </View>
          )}

          {/* Subscribe / Purchase / Post-subscribe CTA */}
          {!isOwner && !isSubscribed && !hasPurchased && (
            blueprint.access_level === 'paid' && blueprint.price_cents && blueprint.price_cents > 0 ? (
              <Pressable
                style={styles.purchaseBtn}
                onPress={handlePurchase}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.subscribeBtnText}>
                      Buy for ${(blueprint.price_cents / 100).toFixed(blueprint.price_cents % 100 === 0 ? 0 : 2)}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={styles.subscribeBtn}
                onPress={handleSubscribe}
                disabled={subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.subscribeBtnText}>Subscribe to Blueprint</Text>
                  </>
                )}
              </Pressable>
            )
          )}

          {/* Purchased but not yet subscribed (post-checkout return) */}
          {!isOwner && hasPurchased && !isSubscribed && (
            <View style={styles.subscribedSection}>
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={20} color={C.green} />
                <Text style={styles.successText}>Purchase complete! You now have access.</Text>
              </View>
              <Pressable
                style={styles.adoptBtn}
                onPress={handleAdoptAll}
                disabled={adoptingAll}
              >
                {adoptingAll ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.adoptBtnText}>
                      Add {steps?.length ?? 0} steps to my timeline
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {!isOwner && isSubscribed && (
            <View style={styles.subscribedSection}>
              {justSubscribed && adoptedCount === 0 && (
                <>
                  <View style={styles.successBanner}>
                    <Ionicons name="checkmark-circle" size={20} color={C.green} />
                    <Text style={styles.successText}>Subscribed! You'll get updates when new steps are added.</Text>
                  </View>

                  <Text style={styles.nextStepLabel}>What's next?</Text>

                  <Pressable
                    style={styles.adoptBtn}
                    onPress={handleAdoptAll}
                    disabled={adoptingAll}
                  >
                    {adoptingAll ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.adoptBtnText}>
                          Add {steps?.length ?? 0} steps to my timeline
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    style={styles.viewTimelineBtn}
                    onPress={() => navigateToTimeline()}
                  >
                    <Ionicons name="arrow-forward" size={16} color={C.accent} />
                    <Text style={styles.viewTimelineBtnText}>Go to my timeline</Text>
                  </Pressable>
                </>
              )}

              {adoptedCount > 0 && (
                <>
                  <View style={styles.successBanner}>
                    <Ionicons name="checkmark-circle" size={20} color={C.green} />
                    <Text style={styles.successText}>
                      {adoptedCount} step{adoptedCount !== 1 ? 's' : ''} added to your timeline!
                    </Text>
                  </View>

                  <Pressable
                    style={styles.adoptBtn}
                    onPress={() => navigateToTimeline()}
                  >
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    <Text style={styles.adoptBtnText}>View in my timeline</Text>
                  </Pressable>
                </>
              )}

              {!justSubscribed && adoptedCount === 0 && (
                <View style={styles.subscribedRow}>
                  <View style={styles.subscribedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={C.accent} />
                    <Text style={styles.subscribedBadgeText}>Subscribed</Text>
                  </View>

                  <Pressable
                    style={styles.viewTimelineBtn}
                    onPress={() => navigateToTimeline()}
                  >
                    <Ionicons name="arrow-forward" size={14} color={C.accent} />
                    <Text style={styles.viewTimelineBtnText}>My timeline</Text>
                  </Pressable>

                  <Pressable
                    style={styles.unsubscribeBtn}
                    onPress={handleSubscribe}
                    disabled={unsubscribeMutation.isPending}
                  >
                    <Text style={styles.unsubscribeBtnText}>
                      {unsubscribeMutation.isPending ? 'Unsubscribing...' : 'Unsubscribe'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {isOwner && (
            <View style={styles.ownerSection}>
              <View style={styles.ownerBadgeRow}>
                <View style={styles.ownerBadge}>
                  <Ionicons name="person-circle-outline" size={12} color={C.accent} />
                  <Text style={styles.ownerBadgeText}>Your Blueprint</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={styles.manageBtn}
                    onPress={async () => {
                      const url = `${Platform.OS === 'web' ? window.location.origin : 'https://betterat.com'}/blueprint/${blueprint.slug}`;
                      if (Platform.OS === 'web') {
                        await navigator.clipboard?.writeText(url);
                      } else {
                        const { Share } = require('react-native');
                        await Share.share({ url, message: `Check out my blueprint: ${url}` });
                      }
                    }}
                  >
                    <Ionicons name="share-outline" size={14} color={C.accent} />
                    <Text style={styles.manageBtnText}>Share</Text>
                  </Pressable>
                  <Pressable
                    style={styles.manageBtn}
                    onPress={() => setShowEditSheet(true)}
                  >
                    <Ionicons name="create-outline" size={14} color={C.accent} />
                    <Text style={styles.manageBtnText}>Edit</Text>
                  </Pressable>
                </View>
              </View>

              {/* Student progress — only show when there are subscribers */}
              {blueprint && steps && blueprint.subscriber_count > 0 && (
                <StudentProgressSection
                  blueprintId={blueprint.id}
                  blueprintSteps={steps}
                  interestId={blueprint.interest_id}
                />
              )}

              {/* Empty state for no subscribers */}
              {blueprint.subscriber_count === 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Ionicons name="people-outline" size={14} color={C.labelLight} />
                  <Text style={{ fontSize: 12, color: C.labelMid }}>
                    No subscribers yet — share your link to get started
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Progress summary — only for subscribers, not the owner */}
        {!isOwner && isSubscribed && (
          <View style={styles.progressBar}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {completedCount}/{totalCount} steps completed
            </Text>
          </View>
        )}

        {/* What's included summary */}
        {includedSummary && (totalCount > 0 || includedSummary.totalSubSteps > 0) && (
          <View
            style={styles.includedSection}
          >
            <Text style={styles.sectionTitle}>What's included</Text>
            <View
              style={styles.includedGrid}
            >
              <View style={styles.includedItem}>
                <Ionicons name="layers-outline" size={20} color={C.accent} />
                <Text style={styles.includedNumber}>{totalCount}</Text>
                <Text style={styles.includedLabel}>{totalCount === 1 ? 'step' : 'steps'}</Text>
              </View>
              {includedSummary.totalSubSteps > 0 && (
                <View style={styles.includedItem}>
                  <Ionicons name="list-outline" size={20} color={C.accent} />
                  <Text style={styles.includedNumber}>{includedSummary.totalSubSteps}</Text>
                  <Text style={styles.includedLabel}>sub-steps</Text>
                </View>
              )}
              {includedSummary.skills.length > 0 && (
                <View style={styles.includedItem}>
                  <Ionicons name="star-outline" size={20} color={C.accent} />
                  <Text style={styles.includedNumber}>{includedSummary.skills.length}</Text>
                  <Text style={styles.includedLabel}>{includedSummary.skills.length === 1 ? 'skill' : 'skills'}</Text>
                </View>
              )}
            </View>
            {includedSummary.skills.length > 0 && (
              <View style={styles.includedSkillsRow}>
                {includedSummary.skills.map((skill, i) => (
                  <View key={i} style={[styles.includedSkillBadge, { maxWidth: screenWidth - 96 }]}>
                    <Text style={styles.includedSkillText} numberOfLines={1}>{skill}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Social proof */}
        {blueprint.subscriber_count > 0 && !isOwner && (
          <View style={styles.socialProof}>
            <Ionicons name="people" size={16} color={C.accent} />
            <Text style={styles.socialProofText}>
              {blueprint.subscriber_count} {blueprint.subscriber_count === 1 ? 'person is' : 'people are'} working through this blueprint
            </Text>
          </View>
        )}

        {/* Steps vertical list */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>Timeline Steps</Text>
          {stepsLoading ? (
            <ActivityIndicator size="small" color={C.accent} style={{ marginTop: 20 }} />
          ) : totalCount === 0 ? (
            <Text style={styles.emptyStepsText}>No steps published yet.</Text>
          ) : (
            <View style={{ gap: 0 }}>
              {steps?.map((step, index) => (
                <StepListItem
                  key={step.id}
                  step={step}
                  index={index}
                  total={totalCount}
                  isExpanded={previewStep?.id === step.id}
                  onToggle={() => setPreviewStep(previewStep?.id === step.id ? null : step)}
                  accentColor={C.accent}
                />
              ))}
            </View>
          )}
        </View>

        {/* Peer subscriber timelines — non-owner subscribers see fellow learners */}
        {!isOwner && peerTimelines.length > 0 && (
          <View style={styles.stepsSection}>
            <Text style={styles.sectionTitle}>Fellow Learners</Text>
            <Text style={{ fontSize: 13, color: C.labelMid, marginBottom: 12 }}>
              Others working through this blueprint
            </Text>
            {peerTimelines.map((peer) => {
              const initials = peer.subscriber_name
                ? peer.subscriber_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
                : '?';
              return (
                <Pressable
                  key={peer.subscriber_id}
                  style={peerStyles.row}
                  onPress={() => router.push(`/person/${peer.subscriber_id}` as any)}
                >
                  <View style={[peerStyles.avatar, { backgroundColor: C.accent + '18' }]}>
                    <Text style={[peerStyles.avatarText, { color: C.accent }]}>
                      {peer.subscriber_avatar_emoji || initials}
                    </Text>
                  </View>
                  <View style={peerStyles.info}>
                    <Text style={peerStyles.name} numberOfLines={1}>
                      {peer.subscriber_name ?? 'Anonymous'}
                    </Text>
                    <Text style={peerStyles.progress}>
                      {peer.completed_count}/{peer.total_count} steps completed
                    </Text>
                  </View>
                  {/* Mini progress dots */}
                  <View style={peerStyles.dots}>
                    {peer.steps.slice(0, 8).map((step) => (
                      <View
                        key={step.id}
                        style={[
                          peerStyles.dot,
                          {
                            backgroundColor:
                              step.status === 'completed' ? C.green
                              : step.status === 'in_progress' ? C.gold
                              : '#D4D4D4',
                          },
                        ]}
                      />
                    ))}
                    {peer.steps.length > 8 && (
                      <Text style={{ fontSize: 9, color: C.labelLight }}>+{peer.steps.length - 8}</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.labelLight} />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {isOwner && blueprint && (
        <PublishBlueprintSheet
          visible={showEditSheet}
          onClose={() => setShowEditSheet(false)}
          interestId={blueprint.interest_id}
          interestName=""
          existingBlueprint={blueprint}
        />
      )}

      {/* Step Preview Modal */}
      <StepPreviewModal
        step={previewStep}
        stepIndex={previewStep && steps ? steps.findIndex(s => s.id === previewStep.id) : 0}
        totalSteps={steps?.length ?? 0}
        onClose={() => setPreviewStep(null)}
        onPrev={() => {
          if (!previewStep || !steps) return;
          const idx = steps.findIndex(s => s.id === previewStep.id);
          if (idx > 0) setPreviewStep(steps[idx - 1]);
        }}
        onNext={() => {
          if (!previewStep || !steps) return;
          const idx = steps.findIndex(s => s.id === previewStep.id);
          if (idx < steps.length - 1) setPreviewStep(steps[idx + 1]);
        }}
      />
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Step card component (horizontal timeline)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step list item (vertical, expandable)
// ---------------------------------------------------------------------------

function StepListItem({
  step,
  index,
  total,
  isExpanded,
  onToggle,
  accentColor,
}: {
  step: TimelineStepRecord;
  index: number;
  total: number;
  isExpanded: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  const statusCfg = STATUS_CONFIG[step.status] ?? STATUS_CONFIG.pending;
  const metadata = step.metadata as Record<string, any> | undefined;
  const planData = metadata?.plan ?? {};
  const howSubSteps: { text: string }[] = planData.how_sub_steps || [];
  const whatWillYouDo: string = planData.what_will_you_do || '';
  const whyReasoning: string = planData.why_reasoning || '';
  const capabilityGoals: string[] = planData.capability_goals || [];
  const isLast = index === total - 1;

  return (
    <View>
      {/* Row header — always visible */}
      <Pressable
        style={[
          stepListStyles.row,
          isExpanded && { backgroundColor: accentColor + '08' },
        ]}
        onPress={onToggle}
      >
        {/* Step number + connector */}
        <View style={stepListStyles.numberCol}>
          <View style={[stepListStyles.numberCircle, { backgroundColor: accentColor }]}>
            <Text style={stepListStyles.numberText}>{index + 1}</Text>
          </View>
          {!isLast && <View style={[stepListStyles.connector, { backgroundColor: accentColor + '25' }]} />}
        </View>

        {/* Content */}
        <View style={stepListStyles.content}>
          <Text style={stepListStyles.stepTitle} numberOfLines={isExpanded ? undefined : 1}>
            {step.title}
          </Text>
          {!isExpanded && (step.description || whatWillYouDo) ? (
            <Text style={stepListStyles.stepSnippet} numberOfLines={1}>
              {step.description || whatWillYouDo}
            </Text>
          ) : null}
        </View>

        {/* Status badge */}
        <View style={[stepListStyles.statusBadge, { backgroundColor: statusCfg.color + '18' }]}>
          <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
          <Text style={[stepListStyles.statusText, { color: statusCfg.color }]} numberOfLines={1}>
            {statusCfg.label}
          </Text>
        </View>

        {/* Expand chevron */}
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={C.labelLight}
          style={{ flexShrink: 0 }}
        />
      </Pressable>

      {/* Expanded detail */}
      {isExpanded && (
        <View style={stepListStyles.detail}>
          {/* Description */}
          {step.description ? (
            <Text style={stepListStyles.detailDesc}>{step.description}</Text>
          ) : null}

          {/* What you'll do */}
          {whatWillYouDo ? (
            <View style={stepListStyles.detailSection}>
              <Text style={stepListStyles.detailSectionTitle}>What you'll do</Text>
              <Text style={stepListStyles.detailSectionBody}>{whatWillYouDo}</Text>
            </View>
          ) : null}

          {/* Sub-steps */}
          {howSubSteps.length > 0 && (
            <View style={stepListStyles.detailSection}>
              <Text style={stepListStyles.detailSectionTitle}>Steps to follow</Text>
              {howSubSteps.map((sub, i) => (
                <View key={i} style={stepListStyles.subStepRow}>
                  <View style={stepListStyles.subStepNum}>
                    <Text style={stepListStyles.subStepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={stepListStyles.subStepText}>{sub.text}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Skills */}
          {capabilityGoals.length > 0 && (
            <View style={stepListStyles.detailSection}>
              <Text style={stepListStyles.detailSectionTitle}>Skills you'll build</Text>
              <View style={stepListStyles.skillsRow}>
                {capabilityGoals.map((skill, i) => (
                  <View key={i} style={[stepListStyles.skillBadge, { borderColor: accentColor + '40' }]}>
                    <Text style={[stepListStyles.skillText, { color: accentColor }]}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Why */}
          {whyReasoning ? (
            <View style={stepListStyles.detailSection}>
              <Text style={stepListStyles.detailSectionTitle}>Why this matters</Text>
              <Text style={stepListStyles.detailSectionBody}>{whyReasoning}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const stepListStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  numberCol: {
    width: 28,
    alignItems: 'center',
  },
  numberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 8,
    marginTop: 4,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  stepSnippet: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detail: {
    paddingLeft: 56,
    paddingRight: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FAFBFC',
  },
  detailDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginBottom: 12,
  },
  detailSection: {
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase' as any,
    letterSpacing: 0.3,
  },
  detailSectionBody: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
  },
  subStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  subStepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  subStepNumText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
  },
  subStepText: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
    lineHeight: 18,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  skillText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

const peerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  progress: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

// ---------------------------------------------------------------------------
// Step card component (horizontal timeline) — kept for potential reuse
// ---------------------------------------------------------------------------

function StepCard({
  step,
  index,
  total,
  onPress,
  wide = false,
}: {
  step: TimelineStepRecord;
  index: number;
  total: number;
  onPress: () => void;
  wide?: boolean;
}) {
  const metadata = step.metadata as Record<string, any> | undefined;
  const plan = metadata?.plan ?? {};
  const howSubSteps: any[] = plan.how_sub_steps || [];
  const whatWillYouDo: string = plan.what_will_you_do || '';
  const capabilityGoals: string[] = plan.capability_goals || [];

  return (
    <View style={styles.stepCardWrapper}>
      {/* Connector line */}
      {index < total - 1 && <View style={styles.stepConnector} />}

      <Pressable
        style={({ pressed }) => [
          styles.stepCard,
          wide && styles.stepCardWide,
          pressed && styles.stepCardPressed,
        ]}
        onPress={onPress}
      >
        {/* Step number badge */}
        <View style={[styles.stepCardStatusBadge, { backgroundColor: C.accent }]}>
          <Text style={styles.stepCardStatusText}>STEP {index + 1}</Text>
        </View>

        {/* Title */}
        <Text style={styles.stepCardTitle} numberOfLines={wide ? 3 : 2}>{step.title}</Text>

        {/* Description snippet — always show on wide cards */}
        {(step.description || whatWillYouDo) && (
          <Text style={styles.stepCardDesc} numberOfLines={wide ? 3 : 2}>
            {step.description || whatWillYouDo}
          </Text>
        )}

        {/* Sub-step count */}
        {howSubSteps.length > 0 && (
          <View style={styles.stepCardProgressRow}>
            <Ionicons name="list-outline" size={12} color={C.labelMid} />
            <Text style={styles.stepCardProgressText}>
              {howSubSteps.length} sub-steps
            </Text>
          </View>
        )}

        {/* Skills */}
        {capabilityGoals.length > 0 && (
          <View style={styles.stepCardSkillsRow}>
            {capabilityGoals.slice(0, wide ? 3 : 2).map((skill, i) => (
              <View key={i} style={styles.stepCardSkillBadge}>
                <Text style={styles.stepCardSkillText} numberOfLines={1}>{skill}</Text>
              </View>
            ))}
            {capabilityGoals.length > (wide ? 3 : 2) && (
              <View style={[styles.stepCardSkillBadge, { backgroundColor: C.accentBg, borderColor: C.accent }]}>
                <Text style={[styles.stepCardSkillText, { color: C.accent }]}>
                  +{capabilityGoals.length - (wide ? 3 : 2)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tap to preview hint */}
        <Text style={styles.stepCardPreviewHint}>Tap to preview</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step Preview Modal
// ---------------------------------------------------------------------------

function StepPreviewModal({
  step,
  stepIndex,
  totalSteps,
  onClose,
  onPrev,
  onNext,
}: {
  step: TimelineStepRecord | null;
  stepIndex: number;
  totalSteps: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (!step) return null;

  const metadata = step.metadata as Record<string, any> | undefined;
  const planData = metadata?.plan ?? {};
  const howSubSteps: { text: string }[] = planData.how_sub_steps || [];
  const whatWillYouDo: string = planData.what_will_you_do || '';
  const whyReasoning: string = planData.why_reasoning || '';
  const capabilityGoals: string[] = planData.capability_goals || [];

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.previewOverlay} onPress={onClose}>
        <Pressable style={styles.previewSheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.previewHeader}>
            <View style={styles.previewStepBadge}>
              <Text style={styles.previewStepBadgeText}>
                Step {stepIndex + 1} of {totalSteps}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={C.labelMid} />
            </Pressable>
          </View>

          <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={styles.previewTitle}>{step.title}</Text>

            {/* Description */}
            {step.description ? (
              <Text style={styles.previewDescription}>{step.description}</Text>
            ) : null}

            {/* Category */}
            {step.category && step.category !== 'general' && (
              <View style={styles.previewCategoryRow}>
                <View style={styles.previewCategoryBadge}>
                  <Text style={styles.previewCategoryText}>{step.category.replace(/_/g, ' ')}</Text>
                </View>
              </View>
            )}

            {/* What will you do */}
            {whatWillYouDo ? (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>What you'll do</Text>
                <Text style={styles.previewSectionBody}>{whatWillYouDo}</Text>
              </View>
            ) : null}

            {/* Sub-steps */}
            {howSubSteps.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Steps to follow</Text>
                {howSubSteps.map((sub, i) => (
                  <View key={i} style={styles.previewSubStep}>
                    <View style={styles.previewSubStepNum}>
                      <Text style={styles.previewSubStepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.previewSubStepText}>{sub.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Skills / capabilities */}
            {capabilityGoals.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Skills you'll build</Text>
                <View style={styles.previewSkillsRow}>
                  {capabilityGoals.map((skill, i) => (
                    <View key={i} style={styles.previewSkillBadge}>
                      <Text style={styles.previewSkillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Why */}
            {whyReasoning ? (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Why this matters</Text>
                <Text style={styles.previewSectionBody}>{whyReasoning}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Navigation footer */}
          <View style={styles.previewFooter}>
            <Pressable
              style={[styles.previewNavBtn, stepIndex === 0 && styles.previewNavBtnDisabled]}
              onPress={onPrev}
              disabled={stepIndex === 0}
            >
              <Ionicons name="chevron-back" size={18} color={stepIndex === 0 ? C.labelLight : C.accent} />
              <Text style={[styles.previewNavBtnText, stepIndex === 0 && { color: C.labelLight }]}>Previous</Text>
            </Pressable>
            <Pressable
              style={[styles.previewNavBtn, stepIndex >= totalSteps - 1 && styles.previewNavBtnDisabled]}
              onPress={onNext}
              disabled={stepIndex >= totalSteps - 1}
            >
              <Text style={[styles.previewNavBtnText, stepIndex >= totalSteps - 1 && { color: C.labelLight }]}>Next</Text>
              <Ionicons name="chevron-forward" size={18} color={stepIndex >= totalSteps - 1 ? C.labelLight : C.accent} />
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
  webContainer: {
    minHeight: '100vh' as any,
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.cardBg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.accent,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.labelDark,
  },
  emptySubtitle: {
    fontSize: 13,
    color: C.labelMid,
    textAlign: 'center',
  },
  joinOrgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  joinOrgBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  orgBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 10,
  },
  orgBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.accent,
  },
  membersOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: C.accentLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  membersOnlyText: {
    fontSize: 9,
    fontWeight: '600',
    color: C.accent,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },

  // Hero
  hero: {
    backgroundColor: C.cardBg,
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.labelDark,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 14,
    color: C.labelMid,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 16,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorEmoji: {
    fontSize: 18,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.labelDark,
  },
  authorMeta: {
    fontSize: 11,
    color: C.labelMid,
  },
  priceBadge: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  priceText: {
    fontSize: 28,
    fontWeight: '800',
    color: C.labelDark,
  },
  priceSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: C.labelMid,
    marginTop: 2,
  },
  purchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 300,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 300,
  },
  subscribeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subscribedSection: {
    width: '100%',
    maxWidth: 340,
    gap: 10,
    alignItems: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#ABEFC6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#067647',
    flex: 1,
  },
  nextStepLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  adoptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  adoptBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewTimelineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: C.accentBg,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  viewTimelineBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },
  subscribedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  subscribedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accentLight,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  subscribedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },
  unsubscribeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  unsubscribeBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.labelLight,
    textDecorationLine: 'underline',
  },
  ownerSection: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 12,
  },
  ownerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.accent,
    ...Platform.select({ web: { cursor: 'pointer' as any } }),
  },
  manageBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.accent,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.accent,
  },
  subscriberList: {
    width: '100%',
    backgroundColor: C.accentBg,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  subscriberListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.labelDark,
    marginBottom: 2,
  },
  subscriberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriberInfo: {
    flex: 1,
  },
  subscriberName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.labelDark,
  },
  subscriberDate: {
    fontSize: 10,
    color: C.labelMid,
  },

  // Progress
  progressBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: C.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  progressTrack: {
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: 4,
    backgroundColor: C.green,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: C.labelMid,
  },

  // Steps
  stepsSection: {
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.labelDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  emptyStepsText: {
    fontSize: 13,
    color: C.labelMid,
    paddingHorizontal: 20,
  },
  stepsHScroll: {
    paddingHorizontal: 20,
    gap: 0,
    paddingBottom: 8,
  },
  stepCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepConnector: {
    position: 'absolute',
    top: '50%',
    right: -1,
    left: 0,
    height: 2,
    backgroundColor: C.border,
    zIndex: -1,
  },
  stepCard: {
    width: 150,
    backgroundColor: C.cardBg,
    borderRadius: 12,
    padding: 10,
    marginRight: 12,
    minHeight: 140,
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  stepCardPressed: {
    opacity: 0.85,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      } as any,
    }),
  },
  stepCardStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  stepCardStatusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stepCardPhaseRow: {
    alignItems: 'center',
    marginBottom: 6,
  },
  stepCardPhaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepCardPhaseText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stepCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: C.labelDark,
    lineHeight: 16,
    marginBottom: 2,
    textAlign: 'center',
  },
  stepCardDesc: {
    fontSize: 10,
    color: C.labelMid,
    lineHeight: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  stepCardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 'auto' as any,
  },
  stepCardProgressText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.labelMid,
  },
  stepCardCategory: {
    fontSize: 9,
    color: C.labelLight,
    textAlign: 'center',
    marginTop: 2,
  },
  stepCardPreviewHint: {
    fontSize: 9,
    color: C.accent,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },

  // Step Preview Modal
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 10,
      },
    }),
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  previewStepBadge: {
    backgroundColor: C.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewStepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
  },
  previewScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.labelDark,
    marginBottom: 6,
  },
  previewDescription: {
    fontSize: 14,
    color: C.labelMid,
    lineHeight: 20,
    marginBottom: 12,
  },
  previewCategoryRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  previewCategoryBadge: {
    backgroundColor: C.accentBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  previewCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.accent,
    textTransform: 'capitalize',
  },
  previewSection: {
    marginBottom: 18,
  },
  previewSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  previewSectionBody: {
    fontSize: 14,
    color: C.labelDark,
    lineHeight: 20,
  },
  previewSubStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  previewSubStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accentBg,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  previewSubStepNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.accent,
  },
  previewSubStepText: {
    fontSize: 13,
    color: C.labelDark,
    lineHeight: 18,
    flex: 1,
    paddingTop: 2,
  },
  previewSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewSkillBadge: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewSkillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
  },
  previewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  previewNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  previewNavBtnDisabled: {
    opacity: 0.5,
    ...Platform.select({ web: { cursor: 'default' } as any }),
  },
  previewNavBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },

  // Sticky header
  stickyHeader: {
    position: Platform.OS === 'web' ? ('sticky' as any) : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as any,
      default: { elevation: 4 },
    }),
  },
  stickyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.labelDark,
    flex: 1,
    marginRight: 12,
  },
  stickyCTA: {
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    ...Platform.select({ web: { cursor: 'pointer' } as any }),
  },
  stickyCTAText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stickyOwnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.accentBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },

  // What's included
  includedSection: {
    backgroundColor: C.cardBg,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  includedGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  includedItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  includedNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: C.accent,
  },
  includedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.labelMid,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  includedSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    width: '100%',
  },
  includedSkillBadge: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 1,
  },
  includedSkillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
  },

  // Social proof
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  socialProofText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.labelMid,
  },

  // Wide step card (desktop)
  stepCardWide: {
    width: 260,
    minHeight: 180,
  },
  stepCardSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  stepCardSkillBadge: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 130,
  },
  stepCardSkillText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#0369A1',
  },

  // Author bio
  authorBio: {
    fontSize: 12,
    color: C.labelMid,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 300,
  },
});
