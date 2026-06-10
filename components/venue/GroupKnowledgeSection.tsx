/**
 * GroupKnowledgeSection — "Local knowledge" body for a group surface
 * (fleet page, org page). Shows the group's scoped knowledge posts
 * bucketed by racing area. RLS returns zero rows to non-members, so
 * the whole section collapses to null for viewers outside the group.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useGroupKnowledge } from '@/hooks/useCommunityFeed';
import { POST_TYPE_CONFIG } from '@/types/community-feed';

const POSTS_PER_AREA = 3;

export function GroupKnowledgeSection({
  scopeType,
  scopeId,
  style,
}: {
  scopeType: 'fleet' | 'org' | 'blueprint';
  scopeId: string | undefined;
  style?: StyleProp<ViewStyle>;
}) {
  const { data: groups } = useGroupKnowledge(scopeType, scopeId);
  if (!groups || groups.length === 0) return null;

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.heading}>LOCAL KNOWLEDGE</Text>
      {groups.map((group) => (
        <View
          key={group.racingAreaId ?? group.poiId ?? 'venue-wide'}
          style={styles.areaBlock}
        >
          <View style={styles.areaHeader}>
            <Ionicons
              name={group.racingAreaId || group.poiId ? 'map-outline' : 'water-outline'}
              size={13}
              color={IOS_REGISTER.labelSecondary}
            />
            <Text style={styles.areaName}>
              {group.placeName ?? 'Venue-wide'}
              <Text style={styles.areaCount}>  {group.posts.length}</Text>
            </Text>
          </View>
          {group.posts.slice(0, POSTS_PER_AREA).map((post) => {
            const typeConfig = POST_TYPE_CONFIG[post.post_type];
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
                    {post.author?.full_name ? (
                      <Text style={styles.postMeta} numberOfLines={1}>
                        {post.author.full_name}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={IOS_REGISTER.labelTertiary} />
                </View>
              </Pressable>
            );
          })}
          {group.posts.length > POSTS_PER_AREA ? (
            <Text style={styles.moreText}>
              +{group.posts.length - POSTS_PER_AREA} more
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  heading: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: IOS_REGISTER.labelSecondary,
  },
  areaBlock: {
    gap: 2,
  },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  areaName: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  areaCount: {
    fontWeight: '500',
    color: IOS_REGISTER.labelTertiary,
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
  moreText: {
    fontSize: 12,
    color: IOS_REGISTER.labelTertiary,
    paddingLeft: 22,
    paddingTop: 2,
  },
});

export default GroupKnowledgeSection;
