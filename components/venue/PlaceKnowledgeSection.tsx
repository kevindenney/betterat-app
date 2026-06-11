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
import { useAuthorAreaCred } from '@/hooks/useAuthorAreaCred';
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
    case 'cohort': return 'Cohort';
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
  splitPublicBand = false,
  groupBandLabel,
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
  /**
   * Venue-mastery sheet (V.4): split posts into a named group band and an
   * "Everyone on BetterAt" public band with raced-here credibility badges.
   */
  splitPublicBand?: boolean;
  /** Heading for the group band ("Dragon HK"); falls back to vocab heading. */
  groupBandLabel?: string | null;
}) {
  const labels = getPlaceKnowledgeLabels(interestSlug);
  const { data, isLoading } = usePlaceKnowledge(anchor, 10);

  const matchedCount = useMemo(() => {
    if (!data || !conditions || conditions.windSpeed == null) return null;
    return data.posts.filter((p) => bestMatchScore(p, conditions) >= MATCH_THRESHOLD).length;
  }, [data, conditions]);

  // V.4 split: group-scoped posts (fleet/org/blueprint/cohort) vs public
  // posts from anyone on BetterAt. Public band sorts by condition match
  // first (today's wind finds the relevant note), then recency.
  const groupPosts = useMemo(
    () => (data?.posts ?? []).filter((p) => p.scope_type !== 'public'),
    [data],
  );
  const publicPosts = useMemo(() => {
    const pub = (data?.posts ?? []).filter((p) => p.scope_type === 'public');
    if (!conditions || conditions.windSpeed == null) return pub;
    return [...pub].sort((a, b) => {
      const diff = bestMatchScore(b, conditions) - bestMatchScore(a, conditions);
      if (diff !== 0) return diff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data, conditions]);
  const publicAuthorIds = useMemo(
    () =>
      Array.from(
        new Set(publicPosts.map((p) => p.author_id).filter((id): id is string => Boolean(id))),
      ),
    [publicPosts],
  );
  const { data: authorCred } = useAuthorAreaCred({
    areaPoiId: anchor.poiId ?? null,
    authorIds: publicAuthorIds,
    enabled: splitPublicBand,
  });

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

  const renderPostRow = (post: FeedPost, credCount?: number) => {
    const typeConfig = POST_TYPE_CONFIG[post.post_type];
    const scope = scopeLabel(post);
    const cred = credCount && credCount > 0 ? `Local · raced here ${credCount}×` : null;
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
              {[post.author?.full_name, cred ?? scope].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={IOS_REGISTER.labelTertiary} />
        </View>
      </Pressable>
    );
  };

  const matchPill =
    matchedCount != null && conditions ? (
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
    ) : null;

  return (
    <View style={styles.card}>
      {splitPublicBand ? (
        <>
          <Text style={styles.heading}>
            {(groupBandLabel?.trim() || heading || labels.heading).toUpperCase()}
          </Text>
          {groupPosts.length === 0 ? (
            <Text style={styles.emptyText}>{labels.emptyText}</Text>
          ) : (
            <>
              {countsLine ? <Text style={styles.countsLine}>{countsLine}</Text> : null}
              {matchPill}
              {groupPosts.slice(0, TOP_POSTS_SHOWN).map((post) => renderPostRow(post))}
            </>
          )}
          {publicPosts.length > 0 ? (
            <>
              <Text style={[styles.heading, styles.publicBandHeading]}>
                EVERYONE ON BETTERAT
              </Text>
              {publicPosts
                .slice(0, TOP_POSTS_SHOWN)
                .map((post) =>
                  renderPostRow(
                    post,
                    post.author_id ? authorCred?.[post.author_id] : undefined,
                  ),
                )}
            </>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.heading}>{heading ?? labels.heading}</Text>
          {posts.length === 0 ? (
            <Text style={styles.emptyText}>{labels.emptyText}</Text>
          ) : (
            <>
              {countsLine ? <Text style={styles.countsLine}>{countsLine}</Text> : null}
              {matchPill}
              {posts.slice(0, TOP_POSTS_SHOWN).map((post) => renderPostRow(post))}
            </>
          )}
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
  publicBandHeading: {
    marginTop: 6,
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
