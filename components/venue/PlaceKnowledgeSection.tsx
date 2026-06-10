/**
 * PlaceKnowledgeSection — "Local knowledge" body for one place: a sailing
 * racing area or any Atlas POI (hospital, haat, market, golf course…).
 * Shows what the viewer is allowed to see (RLS-scoped): counts by audience,
 * the top posts, and — when live conditions are supplied (sailing) — how
 * many posts' condition tags match what the map is already displaying.
 *
 * Copy resolves per interest via getPlaceKnowledgeLabels so each persona
 * reads its own vernacular. Presentational + self-fetching via
 * usePlaceKnowledge; the parent sheet owns scroll, chrome, and the add CTA.
 */
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { getPlaceKnowledgeLabels } from '@/lib/vocabulary';
import { usePlaceKnowledge } from '@/hooks/useCommunityFeed';
import { ConditionMatchingService } from '@/services/venue/ConditionMatchingService';
import { POST_TYPE_CONFIG } from '@/types/community-feed';
import type { CurrentConditions, FeedPost, KnowledgeAnchor } from '@/types/community-feed';

const MATCH_THRESHOLD = 60;
const TOP_POSTS_SHOWN = 3;

function scopeLabel(post: FeedPost): string | null {
  switch (post.scope_type) {
    case 'fleet': return 'Fleet';
    case 'org': return 'Org';
    case 'blueprint': return 'Subscribers';
    case 'private': return 'Only you';
    default: return null;
  }
}

function bestMatchScore(post: FeedPost, conditions: CurrentConditions): number {
  const tags = post.condition_tags ?? [];
  if (tags.length === 0) return 0;
  return Math.max(
    ...tags.map((t) => ConditionMatchingService.calculateMatchScore(conditions, t)),
  );
}

export function PlaceKnowledgeSection({
  anchor,
  conditions,
  onEditArea,
  heading,
  interestSlug,
  onAddKnowledge,
}: {
  anchor: KnowledgeAnchor;
  conditions: CurrentConditions | null;
  /** Owner-only: opens the existing racing-area edit sheet. */
  onEditArea?: () => void;
  /** Override the vocab heading — race-step detail uses "ABOUT THIS AREA". */
  heading?: string;
  /** Resolves persona copy (sailing/nursing/golf/lac-craft). */
  interestSlug?: string | null;
  /** Renders the vocab add-CTA row (e.g. "Add site knowledge"). */
  onAddKnowledge?: () => void;
}) {
  const labels = getPlaceKnowledgeLabels(interestSlug);
  const { data, isLoading } = usePlaceKnowledge(anchor, 10);

  const matchedCount = useMemo(() => {
    if (!data || !conditions || conditions.windSpeed == null) return null;
    return data.posts.filter((p) => bestMatchScore(p, conditions) >= MATCH_THRESHOLD).length;
  }, [data, conditions]);

  const countsLine = useMemo(() => {
    if (!data) return null;
    const segments: string[] = [
      `${data.totalVisible} ${data.totalVisible === 1 ? 'note' : 'notes'}`,
    ];
    const { fleet, org, blueprint } = data.countsByScope;
    if (fleet) segments.push(`${fleet} fleet`);
    if (org) segments.push(`${org} org`);
    if (blueprint) segments.push(`${blueprint} subscriber`);
    return segments.join(' · ');
  }, [data]);

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={IOS_REGISTER.labelSecondary} />
      </View>
    );
  }

  const posts = data?.posts ?? [];

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{heading ?? labels.heading}</Text>
      {posts.length === 0 ? (
        <Text style={styles.emptyText}>{labels.emptyText}</Text>
      ) : (
        <>
          {countsLine ? <Text style={styles.countsLine}>{countsLine}</Text> : null}
          {matchedCount != null && conditions ? (
            <View style={styles.matchRow}>
              <Ionicons name="flash" size={12} color="#B45309" />
              <Text style={styles.matchText}>
                Matches now
                {conditions.windDirection != null
                  ? ` (${Math.round(conditions.windDirection)}° · ${Math.round(conditions.windSpeed ?? 0)} kn)`
                  : ''}
                : {matchedCount}
              </Text>
            </View>
          ) : null}
          {posts.slice(0, TOP_POSTS_SHOWN).map((post) => {
            const typeConfig = POST_TYPE_CONFIG[post.post_type];
            const scope = scopeLabel(post);
            return (
              <Pressable
                key={post.id}
                // Function-form Pressable styles silently drop row layout —
                // keep flexDirection on the inner View.
                style={({ pressed }) => (pressed ? styles.postRowPressed : null)}
                onPress={() => router.push(`/venue/post/${post.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open post: ${post.title}`}
              >
                <View style={styles.postRow}>
                  <Ionicons
                    name={(typeConfig?.icon ?? 'chatbubbles-outline') as never}
                    size={14}
                    color={typeConfig?.color ?? IOS_REGISTER.labelSecondary}
                    style={styles.postIcon}
                  />
                  <View style={styles.postBody}>
                    <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                    <Text style={styles.postMeta} numberOfLines={1}>
                      {[post.author?.full_name, scope].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={IOS_REGISTER.labelTertiary} />
                </View>
              </Pressable>
            );
          })}
        </>
      )}
      {onAddKnowledge ? (
        <Pressable
          style={({ pressed }) => (pressed ? styles.postRowPressed : null)}
          onPress={onAddKnowledge}
          accessibilityRole="button"
          accessibilityLabel={labels.addCta}
        >
          <View style={styles.linkRow}>
            <Ionicons name="add-circle-outline" size={14} color={IOS_REGISTER.accentUserAction} />
            <Text style={styles.linkText}>{labels.addCta}</Text>
          </View>
        </Pressable>
      ) : null}
      {onEditArea ? (
        <Pressable
          style={({ pressed }) => (pressed ? styles.postRowPressed : null)}
          onPress={onEditArea}
          accessibilityRole="button"
          accessibilityLabel="Edit this racing area"
        >
          <View style={styles.linkRow}>
            <Ionicons name="create-outline" size={14} color={IOS_REGISTER.accentUserAction} />
            <Text style={styles.linkText}>Edit area</Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  card: {
    paddingTop: 8,
    gap: 8,
  },
  heading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: IOS_REGISTER.labelSecondary,
  },
  countsLine: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  postRowPressed: {
    opacity: 0.6,
  },
  postIcon: {
    marginRight: 8,
  },
  postBody: {
    flex: 1,
    marginRight: 8,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_REGISTER.label,
  },
  postMeta: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    marginTop: 1,
  },
  emptyText: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
  },
});

export default PlaceKnowledgeSection;
