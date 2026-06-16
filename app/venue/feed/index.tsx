/**
 * Standalone Feed Route
 *
 * Full-screen community feed with query param support.
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, Text, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { TufteTokens } from '@/constants/designSystem';
import { CommunityFeed } from '@/components/venue/feed/CommunityFeed';
import { PostComposer } from '@/components/venue/post/PostComposer';
import { communityFeedKeys } from '@/hooks/useCommunityFeed';
import type { FeedPost } from '@/types/community-feed';

export default function FeedRoute() {
  const { venueId } = useLocalSearchParams<{
    venueId: string;
    sort?: string;
    tag?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showComposer, setShowComposer] = useState(false);

  const handlePostPress = useCallback((post: FeedPost) => {
    queryClient.setQueryData(communityFeedKeys.post(post.id), post);
    router.push(`/venue/post/${post.id}`);
  }, [router, queryClient]);

  if (!venueId) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>
        <Text style={styles.headerTitle}>Community Feed</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Feed */}
      <CommunityFeed
        venueId={venueId}
        onPostPress={handlePostPress}
        onCreatePost={() => setShowComposer(true)}
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => setShowComposer(true)}
      >
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </Pressable>

      {/* Composer Modal */}
      <PostComposer
        visible={showComposer}
        venueId={venueId}
        onDismiss={() => setShowComposer(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TufteTokens.backgrounds.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: TufteTokens.spacing.section,
    paddingVertical: TufteTokens.spacing.standard,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
  },
  backButton: {
    padding: TufteTokens.spacing.tight,
  },
  headerTitle: {
    ...TufteTokens.typography.primary,
    color: '#111827',
  },
  fab: {
    position: 'absolute',
    right: TufteTokens.spacing.section,
    bottom: Platform.OS === 'ios' ? 100 : 80,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...TufteTokens.shadows.subtle,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
