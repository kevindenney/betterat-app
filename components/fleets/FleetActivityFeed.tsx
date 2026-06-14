import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fleetSocialService,
  FleetPost,
  PostType,
  PostComment,
} from '@/services/FleetSocialService';

interface FleetActivityFeedProps {
  fleetId: string;
  userId: string;
}

type FilterType = 'all' | 'race_result' | 'tuning_guide' | 'event' | 'discussion';

export function FleetActivityFeed({ fleetId, userId }: FleetActivityFeedProps) {
  const [posts, setPosts] = useState<FleetPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [postType] = useState<PostType>('discussion');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showComments, setShowComments] = useState<string | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');

  const loadPosts = useCallback(async () => {
    try {
      const filterPostType = filter === 'all' ? undefined : (filter as PostType);
      const data = await fleetSocialService.getFeedPosts(fleetId, {
        limit: 50,
        postType: filterPostType,
        userId,
      });
      setPosts(data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fleetId, userId, filter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = fleetSocialService.subscribeToFleetPosts(fleetId, (newPost) => {
      setPosts((prev) => [newPost, ...prev]);
    });

    return () => {
      unsubscribe();
    };
  }, [fleetId]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPosts();
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;

    try {
      await fleetSocialService.createPost({
        fleetId,
        postType,
        content: newPostContent,
      });
      setNewPostContent('');
      loadPosts();
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await fleetSocialService.unlikePost(postId);
      } else {
        await fleetSocialService.likePost(postId);
      }

      // Optimistic update
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                likesCount: (post.likesCount || 0) + (isLiked ? -1 : 1),
                isLikedByUser: !isLiked,
              }
            : post
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleBookmark = async (postId: string, isBookmarked: boolean) => {
    try {
      if (isBookmarked) {
        await fleetSocialService.unbookmarkPost(postId);
      } else {
        await fleetSocialService.bookmarkPost(postId);
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, isBookmarkedByUser: !isBookmarked } : post
        )
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const handleShowComments = async (postId: string) => {
    setShowComments(postId);
    try {
      const data = await fleetSocialService.getComments(postId);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !showComments) return;

    try {
      await fleetSocialService.createComment({
        postId: showComments,
        content: commentText,
      });
      setCommentText('');

      // Reload comments
      const data = await fleetSocialService.getComments(showComments);
      setComments(data);

      // Update comment count
      setPosts((prev) =>
        prev.map((post) =>
          post.id === showComments
            ? { ...post, commentsCount: (post.commentsCount || 0) + 1 }
            : post
        )
      );
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const getPostTypeIcon = (type: PostType) => {
    switch (type) {
      case 'race_result':
        return { name: 'trophy' as const, color: '#F59E0B', bg: '#FEF3C7' };
      case 'tuning_guide':
        return { name: 'construct' as const, color: '#3B82F6', bg: '#DBEAFE' };
      case 'check_in':
        return { name: 'location' as const, color: '#10B981', bg: '#D1FAE5' };
      case 'event':
        return { name: 'calendar' as const, color: '#8B5CF6', bg: '#EDE9FE' };
      case 'announcement':
        return { name: 'megaphone' as const, color: '#EF4444', bg: '#FEE2E2' };
      default:
        return { name: 'chatbubble-ellipses' as const, color: '#6B7280', bg: '#F3F4F6' };
    }
  };

  const renderPostMetadata = (post: FleetPost) => {
    const metadata = post.metadata;

    switch (post.postType) {
      case 'race_result':
        return (
          <View style={styles.metadataCard}>
            <View style={styles.metadataRow}>
              <Ionicons name="trophy" size={16} color="#F59E0B" />
              <Text style={styles.metadataText}>
                Position: <Text style={styles.metadataBold}>#{metadata.position}</Text>
              </Text>
            </View>
            <Text style={styles.metadataSubtext}>{metadata.race_name}</Text>
            {metadata.race_date && (
              <Text style={styles.metadataDate}>
                {new Date(metadata.race_date).toLocaleDateString()}
              </Text>
            )}
          </View>
        );
      case 'tuning_guide':
        return (
          <View style={styles.metadataCard}>
            <View style={styles.metadataRow}>
              <Ionicons name="document-text" size={16} color="#3B82F6" />
              <Text style={styles.metadataText}>{metadata.title || 'Tuning Guide'}</Text>
            </View>
            {metadata.download_count !== undefined && (
              <Text style={styles.metadataSubtext}>
                {metadata.download_count} downloads
              </Text>
            )}
          </View>
        );
      case 'check_in':
        return (
          <View style={styles.metadataCard}>
            <View style={styles.metadataRow}>
              <Ionicons name="location" size={16} color="#10B981" />
              <Text style={styles.metadataText}>{metadata.location_name}</Text>
            </View>
            {metadata.checked_in_users && (
              <Text style={styles.metadataSubtext}>
                {metadata.checked_in_users.length} member(s) here
              </Text>
            )}
          </View>
        );
      case 'event':
        return (
          <View style={styles.metadataCard}>
            <View style={styles.metadataRow}>
              <Ionicons name="calendar" size={16} color="#8B5CF6" />
              <Text style={styles.metadataText}>{metadata.event_name}</Text>
            </View>
            {metadata.event_date && (
              <Text style={styles.metadataDate}>
                {new Date(metadata.event_date).toLocaleDateString()}
              </Text>
            )}
            {metadata.registration_url && (
              <Pressable style={styles.metadataButton}>
                <Text style={styles.metadataButtonText}>Register</Text>
              </Pressable>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  const renderPost = ({ item: post }: { item: FleetPost }) => {
    const typeIcon = getPostTypeIcon(post.postType);

    return (
      <View style={styles.postCard}>
        {post.isPinned && (
          <View style={styles.pinnedBadge}>
            <Ionicons name="pin" size={12} color="#8B5CF6" />
            <Text style={styles.pinnedText}>Pinned</Text>
          </View>
        )}

        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {post.author?.name?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View>
              <Text style={styles.authorName}>{post.author?.name || 'Unknown'}</Text>
              <Text style={styles.timestamp}>
                {new Date(post.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <View style={[styles.typeIcon, { backgroundColor: typeIcon.bg }]}>
            <Ionicons name={typeIcon.name} size={16} color={typeIcon.color} />
          </View>
        </View>

        {post.content && <Text style={styles.postContent}>{post.content}</Text>}

        {renderPostMetadata(post)}

        <View style={styles.postActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleLike(post.id, post.isLikedByUser || false)}
          >
            <Ionicons
              name={post.isLikedByUser ? 'heart' : 'heart-outline'}
              size={20}
              color={post.isLikedByUser ? '#EF4444' : '#6B7280'}
            />
            <Text
              style={[styles.actionText, post.isLikedByUser && styles.actionTextActive]}
            >
              {post.likesCount || 0}
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => handleShowComments(post.id)}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#6B7280" />
            <Text style={styles.actionText}>{post.commentsCount || 0}</Text>
          </Pressable>

          <Pressable style={styles.actionButton}>
            <Ionicons name="share-outline" size={20} color="#6B7280" />
          </Pressable>

          <Pressable
            style={styles.actionButton}
            onPress={() => handleBookmark(post.id, post.isBookmarkedByUser || false)}
          >
            <Ionicons
              name={post.isBookmarkedByUser ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={post.isBookmarkedByUser ? '#F59E0B' : '#6B7280'}
            />
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {[
          { key: 'all', label: 'All', icon: 'apps' },
          { key: 'race_result', label: 'Results', icon: 'trophy' },
          { key: 'tuning_guide', label: 'Guides', icon: 'construct' },
          { key: 'event', label: 'Events', icon: 'calendar' },
          { key: 'discussion', label: 'Discussions', icon: 'chatbubbles' },
        ].map((item) => (
          <Pressable
            key={item.key}
            style={[styles.filterButton, filter === item.key && styles.filterButtonActive]}
            onPress={() => setFilter(item.key as FilterType)}
          >
            <Ionicons
              name={item.icon as any}
              size={16}
              color={filter === item.key ? '#FFFFFF' : '#6B7280'}
            />
            <Text
              style={[
                styles.filterButtonText,
                filter === item.key && styles.filterButtonTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* New Post Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Share with your fleet..."
          value={newPostContent}
          onChangeText={setNewPostContent}
          multiline
        />
        <Pressable
          style={[
            styles.postButton,
            !newPostContent.trim() && styles.postButtonDisabled,
          ]}
          onPress={handleCreatePost}
          disabled={!newPostContent.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={newPostContent.trim() ? '#FFFFFF' : '#9CA3AF'}
          />
        </Pressable>
      </View>

      {/* Posts Feed */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>
              Be the first to share something with your fleet!
            </Text>
          </View>
        }
      />

      {/* Comments Modal */}
      <Modal
        visible={showComments !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowComments(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Comments</Text>
            <Pressable onPress={() => setShowComments(null)}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </Pressable>
          </View>

          <FlatList
            data={comments}
            renderItem={({ item }) => (
              <View style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {item.author?.name?.[0]?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                  <View style={styles.commentInfo}>
                    <Text style={styles.commentAuthor}>{item.author?.name || 'Unknown'}</Text>
                    <Text style={styles.commentTime}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.commentContent}>{item.content}</Text>
              </View>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={styles.emptyCommentsText}>No comments yet</Text>
              </View>
            }
          />

          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <Pressable
              style={[
                styles.commentButton,
                !commentText.trim() && styles.commentButtonDisabled,
              ]}
              onPress={handleAddComment}
              disabled={!commentText.trim()}
            >
              <Ionicons
                name="send"
                size={20}
                color={commentText.trim() ? '#FFFFFF' : '#9CA3AF'}
              />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterContent: {
    padding: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  postButton: {
    backgroundColor: '#3B82F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  feedList: {
    padding: 12,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  pinnedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  timestamp: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
    marginBottom: 12,
  },
  metadataCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metadataText: {
    fontSize: 14,
    color: '#374151',
  },
  metadataBold: {
    fontWeight: '600',
  },
  metadataSubtext: {
    fontSize: 13,
    color: '#6B7280',
  },
  metadataDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metadataButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  metadataButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  postActions: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  actionTextActive: {
    color: '#EF4444',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  commentsList: {
    padding: 16,
  },
  commentCard: {
    marginBottom: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  commentInfo: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  commentTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  emptyComments: {
    alignItems: 'center',
    padding: 40,
  },
  emptyCommentsText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  commentButton: {
    backgroundColor: '#3B82F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
});
