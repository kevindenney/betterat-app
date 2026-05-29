/**
 * DiscoverPlansContent — the real "Plans you can follow" catalog.
 *
 * Replaces the old PlansPlaceholder stub. Surfaces:
 *   1. "Your plans" — blueprints the user already subscribes to (tap to open).
 *   2. "Plans you can follow" — published, interest-scoped catalog from
 *      `discoverBlueprints`, ranked by subscriber_count, with inline Subscribe.
 *
 * Copy says "plan"; the DB/code identifiers are still `blueprints`.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
  useSubscribedBlueprints,
  useDiscoverBlueprints,
  useSubscribe,
} from '@/hooks/useBlueprint';
import { NotificationService } from '@/services/NotificationService';
import type { DiscoveredBlueprint } from '@/services/BlueprintService';

interface DiscoverPlansContentProps {
  toolbarOffset: number;
}

export function DiscoverPlansContent({ toolbarOffset }: DiscoverPlansContentProps) {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const interestId = currentInterest?.id;

  const { data: subscribed = [] } = useSubscribedBlueprints(interestId);
  const { data: catalog = [], isLoading } = useDiscoverBlueprints(interestId);
  const subscribeMutation = useSubscribe();
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  const subscribedIds = new Set(subscribed.map((s) => s.blueprint_id));
  const available = catalog.filter((bp) => !subscribedIds.has(bp.id));

  const handleSubscribe = async (bp: DiscoveredBlueprint) => {
    if (!user) return;
    setSubscribingId(bp.id);
    try {
      await subscribeMutation.mutateAsync(bp.id);
      if (bp.user_id !== user.id) {
        NotificationService
          .notifyBlueprintSubscribed({
            blueprintOwnerId: bp.user_id,
            subscriberId: user.id,
            subscriberName: user.user_metadata?.full_name || user.email || 'Someone',
            blueprintId: bp.id,
            blueprintTitle: bp.title,
          })
          .catch(() => {});
      }
    } finally {
      setSubscribingId(null);
    }
  };

  const accessBadge = (bp: DiscoveredBlueprint): string | null => {
    if (bp.access_level === 'paid') {
      if (bp.price_cents && bp.price_cents > 0) {
        const amount = (bp.price_cents / 100).toFixed(0);
        return `${bp.currency?.toUpperCase() === 'USD' ? '$' : ''}${amount}`;
      }
      return 'Paid';
    }
    if (bp.access_level === 'org_members') return 'Members';
    return null;
  };

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={{
        paddingTop: toolbarOffset + IOS_SPACING.md,
        paddingBottom: FLOATING_TAB_BAR_HEIGHT + 80,
        paddingHorizontal: IOS_SPACING.lg,
        gap: 18,
      }}
    >
      {subscribed.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Your plans</Text>
          {subscribed.map((bp) => (
            <Pressable
              key={bp.subscription_id}
              style={styles.subscribedCard}
              onPress={() =>
                router.push(`/(tabs)/library/blueprints/${bp.blueprint_id}` as never)
              }
            >
              <Text style={styles.subscribedTitle} numberOfLines={2}>
                {bp.blueprint_title}
              </Text>
              <Text style={styles.subscribedMeta} numberOfLines={1}>
                {bp.author_name ?? 'Author'} · subscribed{' '}
                {new Date(bp.subscribed_at).toLocaleDateString()}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Plans you can follow</Text>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={IOS_COLORS.systemBlue} />
          </View>
        ) : available.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="reader-outline" size={26} color={IOS_COLORS.systemBlue} />
            <Text style={styles.emptyTitle}>No published plans here yet</Text>
            <Text style={styles.emptyBody}>
              {currentInterest?.name
                ? `Be among the first to publish a ${currentInterest.name} plan — or check the orgs that publish them.`
                : 'Be among the first to publish a plan here — or check the orgs that publish them.'}
            </Text>
            <Pressable
              style={styles.emptyAction}
              onPress={() => router.push('/(tabs)/library/blueprints' as never)}
            >
              <Text style={styles.emptyActionText}>All your plans</Text>
            </Pressable>
          </View>
        ) : (
          available.map((bp) => {
            const badge = accessBadge(bp);
            const author = bp.organization_name ?? bp.author_name ?? 'Author';
            return (
              <Pressable
                key={bp.id}
                style={styles.catalogCard}
                onPress={() =>
                  router.push(`/(tabs)/library/blueprints/${bp.id}` as never)
                }
              >
                <View style={styles.catalogMain}>
                  <View style={styles.catalogTextWrap}>
                    <Text style={styles.catalogTitle} numberOfLines={2}>
                      {bp.title}
                    </Text>
                    <Text style={styles.catalogMeta} numberOfLines={1}>
                      {author}
                      {bp.subscriber_count > 0
                        ? ` · ${bp.subscriber_count} follower${bp.subscriber_count !== 1 ? 's' : ''}`
                        : ''}
                    </Text>
                    {bp.description ? (
                      <Text style={styles.catalogDesc} numberOfLines={2}>
                        {bp.description}
                      </Text>
                    ) : null}
                  </View>
                  {badge ? (
                    <View style={styles.accessBadge}>
                      <Text style={styles.accessBadgeText}>{badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  style={styles.subscribeBtn}
                  onPress={() => handleSubscribe(bp)}
                  disabled={subscribingId === bp.id}
                  hitSlop={8}
                >
                  {subscribingId === bp.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.subscribeBtnText}>Follow plan</Text>
                  )}
                </Pressable>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  section: {
    gap: 10,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subscribedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 14,
    gap: 4,
  },
  subscribedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  subscribedMeta: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  catalogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 14,
    gap: 12,
  },
  catalogMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  catalogTextWrap: {
    flex: 1,
    gap: 3,
  },
  catalogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  catalogMeta: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  catalogDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.tertiaryLabel,
    marginTop: 2,
  },
  accessBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  accessBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
  },
  subscribeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 110,
    alignItems: 'center',
  },
  subscribeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: IOS_COLORS.systemBlue,
    marginTop: 2,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
